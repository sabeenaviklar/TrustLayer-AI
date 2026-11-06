import { randomUUID } from 'crypto';
import mongoose from 'mongoose';
import { Workspace } from '../models/Workspace';
import { IUsageReservation, UsageRecord } from '../models/UsageRecord';
import { AppError } from '../middleware/errorHandler';

export const PLAN_LIMITS = {
  free: 100,
  pro: 5000,
};

// A reservation is a short-lived lease so a crashed request cannot hold quota
// forever. Normal verification requests should complete well within this window.
export const USAGE_RESERVATION_TTL_MS = 60 * 60 * 1000;

export interface UsageReservation {
  reservationId: string;
  yearMonth: string;
}

export class UsageService {
  static getCurrentYearMonth(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }

  static async getWorkspaceLimit(workspaceId: string | mongoose.Types.ObjectId): Promise<number> {
    const ws = await Workspace.findById(workspaceId);
    if (!ws) return PLAN_LIMITS.free;
    return PLAN_LIMITS[ws.plan] || PLAN_LIMITS.free;
  }

  static async getUsage(workspaceId: string | mongoose.Types.ObjectId) {
    const yearMonth = this.getCurrentYearMonth();
    const limit = await this.getWorkspaceLimit(workspaceId);
    const now = new Date();

    const record = await UsageRecord.findOne({
      workspaceId,
      yearMonth,
    });

    const checkCount = record?.checkCount || 0;
    const reservedCount = (record?.reservations || []).filter(
      (reservation: IUsageReservation) => new Date(reservation.expiresAt).getTime() > now.getTime()
    ).length;

    return {
      yearMonth,
      checkCount,
      reservedCount,
      limit,
      remaining: Math.max(0, limit - checkCount - reservedCount),
    };
  }

  /**
   * Atomically reserve one monthly check slot before starting AI inference.
   * The $expr condition and $push execute as one MongoDB document update, so
   * simultaneous API-key and JWT requests cannot claim the same final slot.
   */
  static async reserveUsage(
    workspaceId: string | mongoose.Types.ObjectId
  ): Promise<UsageReservation> {
    const yearMonth = this.getCurrentYearMonth();
    const limit = await this.getWorkspaceLimit(workspaceId);
    const now = new Date();
    const reservationId = randomUUID();
    const expiresAt = new Date(now.getTime() + USAGE_RESERVATION_TTL_MS);

    // Create the monthly row if needed. A competing upsert can win the unique
    // workspace/yearMonth index; in that case the row already exists.
    try {
      await UsageRecord.findOneAndUpdate(
        { workspaceId, yearMonth },
        {
          $setOnInsert: {
            workspaceId,
            yearMonth,
            limit,
            checkCount: 0,
            reservations: [],
          },
        },
        {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true,
        }
      );
    } catch (error: any) {
      if (error?.code !== 11000) throw error;
    }

    // Remove expired leases to keep the stored reservation array bounded.
    await UsageRecord.updateOne(
      { workspaceId, yearMonth },
      { $pull: { reservations: { expiresAt: { $lte: now } } } }
    );

    const reservedRecord = await UsageRecord.findOneAndUpdate(
      {
        workspaceId,
        yearMonth,
        $expr: {
          $lt: [
            {
              $add: [
                { $ifNull: ['$checkCount', 0] },
                {
                  $size: {
                    $filter: {
                      input: { $ifNull: ['$reservations', []] },
                      as: 'reservation',
                      cond: { $gt: ['$$reservation.expiresAt', now] },
                    },
                  },
                },
              ],
            },
            { $ifNull: ['$limit', limit] },
          ],
        },
      },
      {
        $push: {
          reservations: { reservationId, expiresAt },
        },
      },
      { new: true }
    );

    if (!reservedRecord) {
      const record = await UsageRecord.findOne({ workspaceId, yearMonth });
      const activeReservations = (record?.reservations || []).filter(
        (reservation: IUsageReservation) => new Date(reservation.expiresAt).getTime() > now.getTime()
      ).length;
      const checkCount = record?.checkCount || 0;
      const recordLimit = record?.limit || limit;

      throw new AppError(
        `Monthly check limit reached (${checkCount + activeReservations}/${recordLimit}). Please upgrade your workspace to the Pro plan.`,
        403,
        'USAGE_LIMIT_EXCEEDED',
        {
          checkCount,
          reservedCount: activeReservations,
          limit: recordLimit,
          plan: limit === PLAN_LIMITS.pro ? 'pro' : 'free',
        }
      );
    }

    return { reservationId, yearMonth };
  }

  /**
   * Convert a live reservation into one completed usage count exactly once.
   * The reservation ID is matched and removed in the same atomic update.
   */
  static async commitUsageReservation(
    workspaceId: string | mongoose.Types.ObjectId,
    reservation: UsageReservation
  ) {
    const now = new Date();
    const updated = await UsageRecord.findOneAndUpdate(
      {
        workspaceId,
        yearMonth: reservation.yearMonth,
        reservations: {
          $elemMatch: {
            reservationId: reservation.reservationId,
            expiresAt: { $gt: now },
          },
        },
      },
      {
        $inc: { checkCount: 1 },
        $pull: { reservations: { reservationId: reservation.reservationId } },
      },
      { new: true }
    );

    if (!updated) {
      throw new AppError(
        'The usage reservation expired or was already settled. Please retry the verification.',
        409,
        'USAGE_RESERVATION_EXPIRED'
      );
    }

    return updated;
  }

  /**
   * Release a reservation after AI or persistence failure. Matching and pulling
   * by the unique reservation ID makes repeated releases harmless.
   */
  static async releaseUsageReservation(
    workspaceId: string | mongoose.Types.ObjectId,
    reservation: UsageReservation
  ): Promise<void> {
    await UsageRecord.updateOne(
      {
        workspaceId,
        yearMonth: reservation.yearMonth,
        'reservations.reservationId': reservation.reservationId,
      },
      {
        $pull: { reservations: { reservationId: reservation.reservationId } },
      }
    );
  }

  /**
   * Backward-compatible helper for any existing callers that need to consume
   * a slot immediately. Request handlers should use reserve/commit/release.
   */
  static async checkAndIncrementUsage(
    workspaceId: string | mongoose.Types.ObjectId
  ) {
    const reservation = await this.reserveUsage(workspaceId);
    return this.commitUsageReservation(workspaceId, reservation);
  }
}
