import { Router, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { CheckResult } from '../models/CheckResult';
import { Workspace } from '../models/Workspace';
import { AuthenticatedRequest, authenticateAny, authenticateJWT } from '../middleware/auth';
import { requireWorkspaceMember } from '../middleware/workspaceAccess';
import { checkLimiter } from '../middleware/rateLimiter';
import { validate } from '../middleware/validate';
import { AppError } from '../middleware/errorHandler';
import { aiServiceClient } from '../services/aiServiceClient';
import { UsageService } from '../services/usageService';
import { toCsv } from '../utils/csv';

const router = Router();

// Safety cap on the number of checks returned by a single export
const EXPORT_MAX_ROWS = 10000;

const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})?)?$/;

// Rejects dates the parser would silently roll over, e.g. 2026-02-30 -> 2026-03-02
function isCalendarDate(value: string): boolean {
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

const isoDate = z
  .string()
  .refine(
    (v) => ISO_DATE_REGEX.test(v) && isCalendarDate(v) && !Number.isNaN(Date.parse(v)),
    'Must be a valid ISO 8601 date'
  );

// A date-only 'to' covers that whole UTC day; full datetimes are used as-is
function parseRangeDate(value: string, endOfDay = false): Date {
  const date = new Date(value);
  if (endOfDay && DATE_ONLY_REGEX.test(value)) {
    date.setUTCHours(23, 59, 59, 999);
  }
  return date;
}

const exportSchema = z.object({
  query: z
    .object({
      format: z.enum(['csv', 'json'], {
        errorMap: () => ({ message: "Format must be 'csv' or 'json'" }),
      }),
      verdict: z.enum(['SUPPORTED', 'CONTRADICTED', 'UNVERIFIABLE']).optional(),
      from: isoDate.optional(),
      to: isoDate.optional(),
    })
    .refine((q) => !q.from || !q.to || parseRangeDate(q.from) <= parseRangeDate(q.to, true), {
      message: "'from' must be on or before 'to'",
      path: ['from'],
    }),
});

const CSV_COLUMNS = [
  'id',
  'createdAt',
  'question',
  'answer',
  'overallVerdict',
  'reliabilityScore',
  'totalClaims',
  'supportedCount',
  'contradictedCount',
  'unverifiableCount',
  'documentId',
  'checkedBy',
  'selfConsistencyAgreement',
];

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
  requireWorkspaceMember,
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

// GET /api/v1/workspaces/:id/checks/export - Download full check history as CSV or JSON
router.get(
  '/:id/checks/export',
  authenticateJWT,
  requireWorkspaceMember,
  validate(exportSchema),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { format, verdict, from, to } = req.query as {
        format: 'csv' | 'json';
        verdict?: string;
        from?: string;
        to?: string;
      };
      const workspaceId = new mongoose.Types.ObjectId(req.workspaceId);
      const query: any = { workspaceId };

      if (verdict) {
        query.overallVerdict = verdict;
      }

      if (from || to) {
        query.createdAt = {};
        if (from) query.createdAt.$gte = parseRangeDate(from);
        if (to) query.createdAt.$lte = parseRangeDate(to, true);
      }

      const [records, workspace] = await Promise.all([
        CheckResult.find(query)
          .sort({ createdAt: -1 })
          .limit(EXPORT_MAX_ROWS + 1)
          .select(format === 'csv' ? '-__v -claims' : '-__v')
          .lean(),
        Workspace.findById(workspaceId).select('slug').lean(),
      ]);

      const truncated = records.length > EXPORT_MAX_ROWS;
      const items = truncated ? records.slice(0, EXPORT_MAX_ROWS) : records;

      const workspaceLabel =
        (workspace?.slug || req.workspaceId!).toLowerCase().replace(/[^a-z0-9-]/g, '-');
      const date = new Date().toISOString().slice(0, 10);
      const filename = `trustlayer-checks-${workspaceLabel}-${date}.${format}`;

      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('X-Export-Row-Count', String(items.length));
      res.setHeader('X-Export-Truncated', String(truncated));
      res.setHeader(
        'Access-Control-Expose-Headers',
        'Content-Disposition, X-Export-Row-Count, X-Export-Truncated'
      );

      if (format === 'json') {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.status(200).send(
          JSON.stringify(
            {
              workspaceId: req.workspaceId,
              exportedAt: new Date().toISOString(),
              filters: { verdict: verdict || null, from: from || null, to: to || null },
              count: items.length,
              truncated,
              maxRows: EXPORT_MAX_ROWS,
              items,
            },
            null,
            2
          )
        );
        return;
      }

      const rows = items.map((r) => [
        r._id.toString(),
        r.createdAt,
        r.question,
        r.answer,
        r.overallVerdict,
        r.reliabilityScore,
        r.totalClaims,
        r.supportedCount,
        r.contradictedCount,
        r.unverifiableCount,
        r.documentId ? r.documentId.toString() : null,
        r.checkedBy,
        r.selfConsistencyAgreement ?? null,
      ]);

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.status(200).send(toCsv(CSV_COLUMNS, rows));
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
