import { Router, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { ApiKey } from '../models/ApiKey';
import { AuthenticatedRequest, authenticateJWT, hashApiKey } from '../middleware/auth';
import { requireWorkspaceOwner, requireWorkspaceMember } from '../middleware/workspaceAccess';
import { validate } from '../middleware/validate';
import { AppError } from '../middleware/errorHandler';

const router = Router();

const createApiKeySchema = z.object({
  body: z.object({
    name: z.string().min(2, 'Key name must be at least 2 characters').max(50),
  }),
});

// GET /api/v1/workspaces/:id/api-keys - List API keys
router.get(
  '/:id/api-keys',
  authenticateJWT,
  requireWorkspaceMember,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const keys = await ApiKey.find({
        workspaceId: req.workspaceId,
      }).sort({ createdAt: -1 });

      res.status(200).json({
        success: true,
        data: keys.map((k) => ({
          id: k._id,
          name: k.name,
          keyPrefix: k.keyPrefix,
          lastUsedAt: k.lastUsedAt,
          createdAt: k.createdAt,
        })),
        error: null,
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/v1/workspaces/:id/api-keys - Generate new API key (Owner only)
router.post(
  '/:id/api-keys',
  authenticateJWT,
  requireWorkspaceOwner,
  validate(createApiKeySchema),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { name } = req.body;
      const randomSecret = crypto.randomBytes(24).toString('hex');
      const plainKey = `tl_live_${randomSecret}`;
      const keyPrefix = `tl_live_${randomSecret.slice(0, 6)}...`;
      const keyHash = hashApiKey(plainKey);

      const apiKeyDoc = await ApiKey.create({
        workspaceId: req.workspaceId,
        name: name.trim(),
        keyPrefix,
        keyHash,
        createdBy: req.user!._id,
      });

      res.status(201).json({
        success: true,
        data: {
          id: apiKeyDoc._id,
          name: apiKeyDoc.name,
          keyPrefix: apiKeyDoc.keyPrefix,
          secretKey: plainKey, // Returned ONLY once
          message: 'Store this secret key securely. It will not be shown again.',
          createdAt: apiKeyDoc.createdAt,
        },
        error: null,
      });
    } catch (error) {
      next(error);
    }
  }
);

// DELETE /api/v1/workspaces/:id/api-keys/:keyId - Revoke API key (Owner only)
router.delete(
  '/:id/api-keys/:keyId',
  authenticateJWT,
  requireWorkspaceOwner,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const key = await ApiKey.findOne({
        _id: req.params.keyId,
        workspaceId: req.workspaceId,
      });

      if (!key) {
        throw new AppError('API key not found in this workspace.', 404, 'NOT_FOUND');
      }

      await ApiKey.findByIdAndDelete(key._id);

      res.status(200).json({
        success: true,
        data: { message: 'API key revoked successfully.' },
        error: null,
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
