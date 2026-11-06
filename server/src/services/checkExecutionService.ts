import mongoose from 'mongoose';
import { CheckResult } from '../models/CheckResult';
import { UsageReservation, UsageService } from './usageService';
import { aiServiceClient, AICheckResponse } from './aiServiceClient';

export interface CheckExecutionDependencies {
  reserveUsage: (workspaceId: string) => Promise<UsageReservation>;
  commitUsageReservation: (
    workspaceId: string,
    reservation: UsageReservation
  ) => Promise<unknown>;
  releaseUsageReservation: (
    workspaceId: string,
    reservation: UsageReservation
  ) => Promise<void>;
  checkAnswer: (
    workspaceId: string,
    question: string,
    answer: string,
    regenerate: boolean
  ) => Promise<AICheckResponse>;
  persistResult: (
    workspaceId: string,
    result: AICheckResponse,
    checkedBy: string
  ) => Promise<unknown>;
}

const defaultDependencies: CheckExecutionDependencies = {
  reserveUsage: (workspaceId) => UsageService.reserveUsage(workspaceId),
  commitUsageReservation: (workspaceId, reservation) =>
    UsageService.commitUsageReservation(workspaceId, reservation),
  releaseUsageReservation: (workspaceId, reservation) =>
    UsageService.releaseUsageReservation(workspaceId, reservation),
  checkAnswer: (workspaceId, question, answer, regenerate) =>
    aiServiceClient.checkAnswer(workspaceId, question, answer, regenerate),
  persistResult: (workspaceId, aiResult, checkedBy) =>
    CheckResult.create({
      workspaceId: new mongoose.Types.ObjectId(workspaceId),
      question: aiResult.question,
      answer: aiResult.answer,
      overallVerdict: aiResult.overall_verdict,
      reliabilityScore: aiResult.reliability_score,
      totalClaims: aiResult.total_claims,
      supportedCount: aiResult.supported_count,
      contradictedCount: aiResult.contradicted_count,
      unverifiableCount: aiResult.unverifiable_count,
      claims: aiResult.claims.map((claim) => ({
        claim: claim.claim,
        verdict: claim.verdict,
        confidence: claim.confidence,
        evidenceSentence: claim.evidence_sentence || null,
        chunkId: claim.chunk_id || null,
        scores: claim.scores,
      })),
      checkedBy,
      selfConsistencyAgreement: aiResult.self_consistency_agreement || null,
    }),
};

/**
 * Shared check flow used by both API-key and JWT routes. Usage is reserved
 * before inference, committed only after the result is persisted, and released
 * on every inference/persistence failure.
 */
export async function executeCheck(
  workspaceId: string,
  question: string,
  answer: string,
  regenerate: boolean,
  checkedBy: string,
  dependencies: CheckExecutionDependencies = defaultDependencies
) {
  const reservation = await dependencies.reserveUsage(workspaceId);

  try {
    const aiResult = await dependencies.checkAnswer(
      workspaceId,
      question,
      answer,
      regenerate
    );

    const savedRecord = await dependencies.persistResult(
      workspaceId,
      aiResult,
      checkedBy
    );

    await dependencies.commitUsageReservation(workspaceId, reservation);
    return savedRecord;
  } catch (error) {
    try {
      await dependencies.releaseUsageReservation(workspaceId, reservation);
    } catch (releaseError) {
      // Preserve the original failure. The reservation also has an expiry so
      // an unavailable database cannot permanently lock this quota slot.
      console.error('Failed to release usage reservation:', releaseError);
    }
    throw error;
  }
}
