import { Router, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { CheckResult } from '../models/CheckResult';
import { AuthenticatedRequest, authenticateAny, authenticateJWT } from '../middleware/auth';
import { requireWorkspaceMember } from '../middleware/workspaceAccess';
import { checkLimiter } from '../middleware/rateLimiter';
import { validate } from '../middleware/validate';
import { AppError } from '../middleware/errorHandler';
import { aiServiceClient } from '../services/aiServiceClient';
import { UsageService } from '../services/usageService';

const router = Router();

const checkSchema = z.object({
  body: z.object({
    question: z.string().min(1, 'Question is required'),
    answer: z.string().min(1, 'Answer is required'),
    workspace_id: z.string().optional(),
    regenerate: z.boolean().optional().default(false),
  }),
});

// Common handler for running check
async function executeCheck(
  workspaceId: string,
  question: string,
  answer: string,
  regenerate: boolean,
  checkedBy: string
) {
  // 1. Enforce usage limits and atomically increment
  await UsageService.checkAndIncrementUsage(workspaceId);

  // 2. Call AI Service pipeline
  const aiResult = await aiServiceClient.checkAnswer(
    workspaceId,
    question,
    answer,
    regenerate
  );

  // 3. Persist CheckResult record in MongoDB
  const savedRecord = await CheckResult.create({
    workspaceId: new mongoose.Types.ObjectId(workspaceId),
    question: aiResult.question,
    answer: aiResult.answer,
    overallVerdict: aiResult.overall_verdict,
    reliabilityScore: aiResult.reliability_score,
    totalClaims: aiResult.total_claims,
    supportedCount: aiResult.supported_count,
    contradictedCount: aiResult.contradicted_count,
    unverifiableCount: aiResult.unverifiable_count,
    claims: aiResult.claims.map((c) => ({
      claim: c.claim,
      verdict: c.verdict,
      confidence: c.confidence,
      evidenceSentence: c.evidence_sentence || null,
      chunkId: c.chunk_id || null,
      scores: c.scores,
    })),
    checkedBy,
    selfConsistencyAgreement: aiResult.self_consistency_agreement || null,
  });

  return savedRecord;
}

// POST /api/v1/check - Public API endpoint for external applications & API key users
router.post(
  '/check',
  checkLimiter,
  authenticateAny,
  validate(checkSchema),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const targetWorkspaceId = req.workspaceId || req.body.workspace_id;
      if (!targetWorkspaceId) {
        throw new AppError('workspace_id is required.', 400, 'WORKSPACE_ID_REQUIRED');
      }

      const checkedBy = req.apiKey
        ? `api_key:${req.apiKey._id}`
        : `user:${req.user!._id}`;

      const checkResult = await executeCheck(
        targetWorkspaceId,
        req.body.question,
        req.body.answer,
        req.body.regenerate || false,
        checkedBy
      );

      res.status(200).json({
        success: true,
        data: checkResult,
        error: null,
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/v1/workspaces/:id/check - Dashboard workspace check endpoint
router.post(
  '/:id/check',
  checkLimiter,
  authenticateJWT,
  requireWorkspaceMember,
  validate(checkSchema),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const workspaceId = req.workspaceId!;
      const checkedBy = `user:${req.user!._id}`;

      const checkResult = await executeCheck(
        workspaceId,
        req.body.question,
        req.body.answer,
        req.body.regenerate || false,
        checkedBy
      );

      res.status(200).json({
        success: true,
        data: checkResult,
        error: null,
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/v1/workspaces/:id/checks - List check history with filtering & pagination
router.get(
  '/:id/checks',
  authenticateJWT,
  requireWorkspaceMember,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { verdict, limit = '20', page = '1' } = req.query;
      const query: any = { workspaceId: new mongoose.Types.ObjectId(req.workspaceId) };

      if (verdict && ['SUPPORTED', 'CONTRADICTED', 'UNVERIFIABLE'].includes(String(verdict))) {
        query.overallVerdict = String(verdict);
      }

      const numLimit = Math.min(100, Math.max(1, parseInt(String(limit), 10)));
      const numPage = Math.max(1, parseInt(String(page), 10));
      const skip = (numPage - 1) * numLimit;

      const [records, total] = await Promise.all([
        CheckResult.find(query)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(numLimit),
        CheckResult.countDocuments(query),
      ]);

      res.status(200).json({
        success: true,
        data: {
          items: records,
          total,
          page: numPage,
          limit: numLimit,
          totalPages: Math.ceil(total / numLimit),
        },
        error: null,
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/v1/workspaces/:id/analytics - Dashboard metrics & trend line chart data
router.get(
  '/:id/analytics',
  authenticateJWT,
  requireWorkspaceMember,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const workspaceId = new mongoose.Types.ObjectId(req.workspaceId);

      // Aggregate counts by verdict
      const verdictStats = await CheckResult.aggregate([
        { $match: { workspaceId } },
        {
          $group: {
            _id: '$overallVerdict',
            count: { $sum: 1 },
          },
        },
      ]);

      let totalChecks = 0;
      let supportedCount = 0;
      let contradictedCount = 0;
      let unverifiableCount = 0;

      verdictStats.forEach((v) => {
        totalChecks += v.count;
        if (v._id === 'SUPPORTED') supportedCount = v.count;
        if (v._id === 'CONTRADICTED') contradictedCount = v.count;
        if (v._id === 'UNVERIFIABLE') unverifiableCount = v.count;
      });

      const hallucinationRate = totalChecks > 0 ? Math.round((contradictedCount / totalChecks) * 1000) / 10 : 0;
      const supportedRate = totalChecks > 0 ? Math.round((supportedCount / totalChecks) * 1000) / 10 : 0;
      const unverifiableRate = totalChecks > 0 ? Math.round((unverifiableCount / totalChecks) * 1000) / 10 : 0;

      // 30-day time series aggregation
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const dailyTrend = await CheckResult.aggregate([
        {
          $match: {
            workspaceId,
            createdAt: { $gte: thirtyDaysAgo },
          },
        },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            totalChecks: { $sum: 1 },
            contradicted: {
              $sum: { $cond: [{ $eq: ['$overallVerdict', 'CONTRADICTED'] }, 1, 0] },
            },
            supported: {
              $sum: { $cond: [{ $eq: ['$overallVerdict', 'SUPPORTED'] }, 1, 0] },
            },
            avgReliability: { $avg: '$reliabilityScore' },
          },
        },
        { $sort: { _id: 1 } },
      ]);

      const usage = await UsageService.getUsage(workspaceId);

      res.status(200).json({
        success: true,
        data: {
          totalChecks,
          supportedCount,
          contradictedCount,
          unverifiableCount,
          hallucinationRate,
          supportedRate,
          unverifiableRate,
          usage,
          dailyTrend: dailyTrend.map((d) => ({
            date: d._id,
            totalChecks: d.totalChecks,
            contradicted: d.contradicted,
            supported: d.supported,
            hallucinationRate: d.totalChecks > 0 ? Math.round((d.contradicted / d.totalChecks) * 100) : 0,
            avgReliability: Math.round(d.avgReliability * 10) / 10,
          })),
        },
        error: null,
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
