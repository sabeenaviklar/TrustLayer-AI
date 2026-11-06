import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  CheckExecutionDependencies,
  executeCheck,
} from './checkExecutionService';
import { AICheckResponse } from './aiServiceClient';

const reservation = { reservationId: 'reservation-1', yearMonth: '2026-11' };
const aiResult = {
  workspace_id: 'workspace-1',
  question: 'question',
  answer: 'answer',
  overall_verdict: 'SUPPORTED',
  reliability_score: 100,
  total_claims: 1,
  supported_count: 1,
  contradicted_count: 0,
  unverifiable_count: 0,
  claims: [],
} as unknown as AICheckResponse;

function dependencies(
  overrides: Partial<CheckExecutionDependencies> = {},
  events: string[] = []
): CheckExecutionDependencies {
  return {
    reserveUsage: async () => {
      events.push('reserve');
      return reservation;
    },
    commitUsageReservation: async () => {
      events.push('commit');
    },
    releaseUsageReservation: async () => {
      events.push('release');
    },
    checkAnswer: async () => {
      events.push('check');
      return aiResult;
    },
    persistResult: async () => {
      events.push('persist');
      return { id: 'saved-result' };
    },
    ...overrides,
  };
}

test('AI failure releases the reservation without committing usage', async () => {
  const events: string[] = [];
  const deps = dependencies({
    checkAnswer: async () => {
      events.push('check');
      throw new Error('AI service unavailable');
    },
  }, events);

  await assert.rejects(
    executeCheck('workspace-1', 'question', 'answer', false, 'api_key:test', deps),
    /AI service unavailable/
  );
  assert.deepEqual(events, ['reserve', 'check', 'release']);
});

test('persistence failure releases the reservation without committing usage', async () => {
  const events: string[] = [];
  const deps = dependencies({
    persistResult: async () => {
      events.push('persist');
      throw new Error('Mongo persistence failed');
    },
  }, events);

  await assert.rejects(
    executeCheck('workspace-1', 'question', 'answer', false, 'user:test', deps),
    /Mongo persistence failed/
  );
  assert.deepEqual(events, ['reserve', 'check', 'persist', 'release']);
});

test('successful checks persist first and commit usage exactly once', async () => {
  const events: string[] = [];
  const deps = dependencies({}, events);

  const result = await executeCheck(
    'workspace-1',
    'question',
    'answer',
    false,
    'user:test',
    deps
  );

  assert.deepEqual(result, { id: 'saved-result' });
  assert.deepEqual(events, ['reserve', 'check', 'persist', 'commit']);
});

test('both API-key and JWT callers use the same reservation lifecycle', async () => {
  for (const checkedBy of ['api_key:key-1', 'user:user-1']) {
    const events: string[] = [];
    await executeCheck(
      'workspace-1',
      'question',
      'answer',
      false,
      checkedBy,
      dependencies({}, events)
    );
    assert.deepEqual(events, ['reserve', 'check', 'persist', 'commit']);
  }
});
