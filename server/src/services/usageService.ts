import mongoose from 'mongoose';
import { Workspace } from '../models/Workspace';
import { UsageRecord } from '../models/UsageRecord';
import { AppError } from '../middleware/errorHandler';

export const PLAN_LIMITS = {
  free: 100,
  pro: 5000,
};

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

    const record = await UsageRecord.findOne({
      workspaceId,
      yearMonth,
    });

    return {
      yearMonth,
      checkCount: record ? record.checkCount : 0,
      limit,
      remaining: Math.max(0, limit - (record ? record.checkCount : 0)),
    };
  }

  static async checkAndIncrementUsage(workspaceId: string | mongoose.Types.ObjectId) {
    const yearMonth = this.getCurrentYearMonth();
    const limit = await this.getWorkspaceLimit(workspaceId);

    // Atomically find or create the record and check limit
    const record = await UsageRecord.findOneAndUpdate(
      {
        workspaceId,
        yearMonth,
      },
      {
        $setOnInsert: {
          workspaceId,
          yearMonth,
          limit,
        },
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      }
    );

    if (record.checkCount >= record.limit) {
      throw new AppError(
        `Monthly check limit reached (${record.checkCount}/${record.limit}). Please upgrade your workspace to the Pro plan.`,
        403,
        'USAGE_LIMIT_EXCEEDED',
        {
          checkCount: record.checkCount,
          limit: record.limit,
          plan: limit === PLAN_LIMITS.pro ? 'pro' : 'free',
        }
      );
    }

    // Increment usage
    const updated = await UsageRecord.findOneAndUpdate(
      {
        workspaceId,
        yearMonth,
      },
      {
        $inc: { checkCount: 1 },
      },
      { new: true }
    );

    return updated;
  }
}
