import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { UsageRecord } from '../models/UsageRecord';
import { UsageService } from './usageService';

const originalFindOneAndUpdate = UsageRecord.findOneAndUpdate;
const originalUpdateOne = UsageRecord.updateOne;
const originalFindOne = UsageRecord.findOne;
const originalGetWorkspaceLimit = UsageService.getWorkspaceLimit;
const originalGetCurrentYearMonth = UsageService.getCurrentYearMonth;

let record: any;

function cloneRecord() {
  return record ? {
    ...record,
    reservations: (record.reservations || []).map((reservation: any) => ({ ...reservation })),
  } : null;
}

function matchesReservation(reservation: any, matcher: any) {
  if (matcher.reservationId && reservation.reservationId !== matcher.reservationId) return false;
  if (matcher.expiresAt?.$gt && new Date(reservation.expiresAt) <= matcher.expiresAt.$gt) return false;
  return true;
}

// Replace the model methods with a serialized in-memory document so these tests
// exercise the UsageService lifecycle without requiring a running MongoDB.
let queue = Promise.resolve();
function serialize<T>(callback: () => T | Promise<T>): Promise<T> {
  const result = queue.then(callback);
  queue = result.then(() => undefined, () => undefined);
  return result;
}

function installFakeUsageRecord(initial: any) {
  record = {
    workspaceId: 'workspace-1',
    yearMonth: '2026-11',
    checkCount: 1,
    limit: 2,
    reservations: [],
    ...initial,
  };
  queue = Promise.resolve();

  (UsageRecord as any).findOneAndUpdate = (filter: any, update: any) =>
    serialize(() => {
      if (update.$setOnInsert) {
        if (!record) record = { ...update.$setOnInsert };
        return cloneRecord();
      }

      if (update.$push?.reservations) {
        const now = new Date();
        const active = (record.reservations || []).filter(
          (reservation: any) => new Date(reservation.expiresAt) > now
        ).length;
        if (record.checkCount + active >= record.limit) return null;
        record.reservations.push({ ...update.$push.reservations });
        return cloneRecord();
      }

      if (update.$inc?.checkCount && update.$pull?.reservations) {
        const matcher = filter.reservations?.$elemMatch;
        const index = (record.reservations || []).findIndex(
          (reservation: any) => matchesReservation(reservation, matcher)
        );
        if (index < 0) return null;
        record.checkCount += update.$inc.checkCount;
        const id = update.$pull.reservations.reservationId;
        record.reservations = record.reservations.filter(
          (reservation: any) => reservation.reservationId !== id
        );
        return cloneRecord();
      }

      return cloneRecord();
    });

  (UsageRecord as any).updateOne = (filter: any, update: any) =>
    serialize(() => {
      if (update.$pull?.reservations?.expiresAt?.$lte) {
        const expiry = update.$pull.reservations.expiresAt.$lte;
        record.reservations = record.reservations.filter(
          (reservation: any) => new Date(reservation.expiresAt) > expiry
        );
      } else if (update.$pull?.reservations?.reservationId) {
        const id = update.$pull.reservations.reservationId;
        record.reservations = record.reservations.filter(
          (reservation: any) => reservation.reservationId !== id
        );
      }
      return { acknowledged: true, modifiedCount: 1 };
    });

  (UsageRecord as any).findOne = async () => cloneRecord();
  (UsageService as any).getWorkspaceLimit = async () => 2;
  (UsageService as any).getCurrentYearMonth = () => '2026-11';
}

after(() => {
  (UsageRecord as any).findOneAndUpdate = originalFindOneAndUpdate;
  (UsageRecord as any).updateOne = originalUpdateOne;
  (UsageRecord as any).findOne = originalFindOne;
  (UsageService as any).getWorkspaceLimit = originalGetWorkspaceLimit;
  (UsageService as any).getCurrentYearMonth = originalGetCurrentYearMonth;
});

test('only one concurrent request can reserve the final available slot', async () => {
  installFakeUsageRecord({ checkCount: 1, limit: 2, reservations: [] });

  const results = await Promise.allSettled(
    Array.from({ length: 8 }, () => UsageService.reserveUsage('workspace-1'))
  );

  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal(results.filter((result) => result.status === 'rejected').length, 7);
  assert.equal(record.reservations.length, 1);
  assert.equal(record.checkCount, 1);
});

test('commit consumes the reservation once and increments usage once', async () => {
  installFakeUsageRecord({ checkCount: 1, limit: 2, reservations: [] });

  const reservation = await UsageService.reserveUsage('workspace-1');
  await UsageService.commitUsageReservation('workspace-1', reservation);

  assert.equal(record.checkCount, 2);
  assert.equal(record.reservations.length, 0);
  await assert.rejects(
    UsageService.commitUsageReservation('workspace-1', reservation),
    /expired or was already settled/
  );
  assert.equal(record.checkCount, 2);
});

test('release removes a failed request reservation without incrementing usage', async () => {
  installFakeUsageRecord({ checkCount: 1, limit: 2, reservations: [] });

  const reservation = await UsageService.reserveUsage('workspace-1');
  await UsageService.releaseUsageReservation('workspace-1', reservation);

  assert.equal(record.checkCount, 1);
  assert.equal(record.reservations.length, 0);
});
