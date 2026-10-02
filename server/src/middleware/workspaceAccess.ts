import { Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { AuthenticatedRequest } from './auth';
import { Membership, WorkspaceRole } from '../models/Membership';
import { Workspace } from '../models/Workspace';
import { AppError } from './errorHandler';

export function requireWorkspaceRole(allowedRoles: WorkspaceRole[] = ['owner', 'member']) {
  return async (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
    try {
      // If request was authenticated via API key, workspaceId is already set and authorized
      if (req.apiKey && req.workspaceId) {
        req.workspaceRole = 'owner'; // API keys have full execution access
        return next();
      }

      if (!req.user) {
        throw new AppError('Authentication required.', 401, 'UNAUTHORIZED');
      }

      const workspaceParam = req.params.workspaceId || req.params.id || req.body.workspace_id;
      if (!workspaceParam) {
        throw new AppError('Workspace ID parameter is required.', 400, 'WORKSPACE_ID_REQUIRED');
      }

      if (!mongoose.Types.ObjectId.isValid(workspaceParam)) {
        throw new AppError('Invalid workspace ID format.', 400, 'INVALID_WORKSPACE_ID');
      }

      const workspaceId = new mongoose.Types.ObjectId(workspaceParam);

      // Verify workspace exists
      const workspace = await Workspace.findById(workspaceId);
      if (!workspace) {
        throw new AppError('Workspace not found.', 404, 'WORKSPACE_NOT_FOUND');
      }

      // Check membership
      const membership = await Membership.findOne({
        workspaceId,
        userId: req.user._id,
        status: 'active',
      });

      if (!membership) {
        throw new AppError('You do not have access to this workspace.', 403, 'FORBIDDEN');
      }

      if (!allowedRoles.includes(membership.role)) {
        throw new AppError(`Access denied. Requires role: ${allowedRoles.join(' or ')}.`, 403, 'INSUFFICIENT_PERMISSIONS');
      }

      req.workspaceId = workspaceId.toString();
      req.workspaceRole = membership.role;
      next();
    } catch (error) {
      next(error);
    }
  };
}

export const requireWorkspaceMember = requireWorkspaceRole(['owner', 'member']);
export const requireWorkspaceOwner = requireWorkspaceRole(['owner']);
