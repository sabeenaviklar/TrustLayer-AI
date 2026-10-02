import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { env } from '../config/env';
import { User, IUser } from '../models/User';
import { ApiKey, IApiKey } from '../models/ApiKey';
import { AppError } from './errorHandler';
import { WorkspaceRole } from '../models/Membership';

export interface AuthenticatedRequest extends Request {
  user?: IUser;
  apiKey?: IApiKey;
  workspaceId?: string;
  workspaceRole?: WorkspaceRole;
}

export function hashApiKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

export async function authenticateJWT(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('Authentication required. Missing Bearer token.', 401, 'UNAUTHORIZED');
    }

    const token = authHeader.split(' ')[1];
    let decoded: any;
    try {
      decoded = jwt.verify(token, env.JWT_SECRET);
    } catch (err: any) {
      throw new AppError('Invalid or expired authentication token.', 401, 'INVALID_TOKEN');
    }

    const user = await User.findById(decoded.userId);
    if (!user) {
      throw new AppError('User account not found.', 401, 'USER_NOT_FOUND');
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
}

export async function authenticateApiKey(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
) {
  try {
    const headerKey = req.headers['x-api-key'] as string | undefined;
    const authHeader = req.headers.authorization;
    const bearerKey = authHeader?.startsWith('Bearer tl_live_') ? authHeader.split(' ')[1] : undefined;
    const rawKey = headerKey || bearerKey;

    if (!rawKey) {
      throw new AppError('API key required. Provide X-API-Key header.', 401, 'API_KEY_REQUIRED');
    }

    const keyHash = hashApiKey(rawKey);
    const keyDoc = await ApiKey.findOne({ keyHash });

    if (!keyDoc) {
      throw new AppError('Invalid API key.', 401, 'INVALID_API_KEY');
    }

    // Update last used timestamp asynchronously
    ApiKey.updateOne({ _id: keyDoc._id }, { lastUsedAt: new Date() }).exec().catch(() => {});

    req.apiKey = keyDoc;
    req.workspaceId = keyDoc.workspaceId.toString();
    next();
  } catch (error) {
    next(error);
  }
}

export async function authenticateAny(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization;
  const headerKey = req.headers['x-api-key'];

  // Check if API key was provided
  if (headerKey || (authHeader && authHeader.startsWith('Bearer tl_live_'))) {
    return authenticateApiKey(req, res, next);
  }

  // Otherwise fallback to JWT
  return authenticateJWT(req, res, next);
}
