import { Router, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { Workspace } from '../models/Workspace';
import { Membership } from '../models/Membership';
import { User } from '../models/User';
import { AuthenticatedRequest, authenticateJWT } from '../middleware/auth';
import { requireWorkspaceMember, requireWorkspaceOwner } from '../middleware/workspaceAccess';
import { validate } from '../middleware/validate';
import { AppError } from '../middleware/errorHandler';
import { UsageService } from '../services/usageService';

const router = Router();

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

const createWorkspaceSchema = z.object({
  body: z.object({
    name: z.string().min(2, 'Workspace name must be at least 2 characters'),
  }),
});

const inviteMemberSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email address'),
    role: z.enum(['owner', 'member']).default('member'),
  }),
});

// GET /api/v1/workspaces - List all workspaces user belongs to
router.get(
  '/',
  authenticateJWT,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const memberships = await Membership.find({
        userId: user._id,
        status: 'active',
      }).populate('workspaceId');

      const workspaces = await Promise.all(
        memberships
          .filter((m) => m.workspaceId)
          .map(async (m) => {
            const ws: any = m.workspaceId;
            const usage = await UsageService.getUsage(ws._id);
            return {
              id: ws._id,
              name: ws.name,
              slug: ws.slug,
              plan: ws.plan,
              role: m.role,
              usage,
              createdAt: ws.createdAt,
            };
          })
      );

      res.status(200).json({
        success: true,
        data: workspaces,
        error: null,
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/v1/workspaces - Create a new workspace
router.post(
  '/',
  authenticateJWT,
  validate(createWorkspaceSchema),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const { name } = req.body;

      const baseSlug = slugify(name) || 'workspace';
      let slug = baseSlug;
      let counter = 1;
      while (await Workspace.findOne({ slug })) {
        slug = `${baseSlug}-${counter}`;
        counter++;
      }

      const workspace = await Workspace.create({
        name: name.trim(),
        slug,
        ownerId: user._id,
        plan: 'free',
      });

      await Membership.create({
        workspaceId: workspace._id,
        userId: user._id,
        role: 'owner',
        status: 'active',
      });

      res.status(201).json({
        success: true,
        data: {
          id: workspace._id,
          name: workspace.name,
          slug: workspace.slug,
          plan: workspace.plan,
          role: 'owner',
          createdAt: workspace.createdAt,
        },
        error: null,
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/v1/workspaces/:id - Get single workspace details
router.get(
  '/:id',
  authenticateJWT,
  requireWorkspaceMember,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const workspace = await Workspace.findById(req.workspaceId);
      if (!workspace) throw new AppError('Workspace not found', 404, 'NOT_FOUND');

      const usage = await UsageService.getUsage(workspace._id);

      res.status(200).json({
        success: true,
        data: {
          id: workspace._id,
          name: workspace.name,
          slug: workspace.slug,
          plan: workspace.plan,
          role: req.workspaceRole,
          usage,
          createdAt: workspace.createdAt,
        },
        error: null,
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/v1/workspaces/:id/members - List members of workspace
router.get(
  '/:id/members',
  authenticateJWT,
  requireWorkspaceMember,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const memberships = await Membership.find({
        workspaceId: req.workspaceId,
      }).populate('userId', 'name email avatarUrl');

      const members = memberships.map((m) => {
        const userObj: any = m.userId;
        return {
          id: m._id,
          userId: userObj?._id || null,
          name: userObj?.name || 'Pending Invite',
          email: userObj?.email || m.invitedEmail,
          role: m.role,
          status: m.status,
          createdAt: m.createdAt,
        };
      });

      res.status(200).json({
        success: true,
        data: members,
        error: null,
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/v1/workspaces/:id/invites - Invite a member by email (Owner only)
router.post(
  '/:id/invites',
  authenticateJWT,
  requireWorkspaceOwner,
  validate(inviteMemberSchema),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { email, role } = req.body;
      const normalizedEmail = email.toLowerCase().trim();
      const workspaceId = new mongoose.Types.ObjectId(req.workspaceId);

      // Check if user already exists
      const targetUser = await User.findOne({ email: normalizedEmail });

      if (targetUser) {
        const existingMember = await Membership.findOne({
          workspaceId,
          userId: targetUser._id,
        });

        if (existingMember) {
          throw new AppError('This user is already a member of this workspace.', 409, 'ALREADY_MEMBER');
        }

        const newMembership = await Membership.create({
          workspaceId,
          userId: targetUser._id,
          role: role || 'member',
          status: 'active',
        });

        return res.status(201).json({
          success: true,
          data: {
            id: newMembership._id,
            email: normalizedEmail,
            role: newMembership.role,
            status: 'active',
            message: `User ${targetUser.name} added to workspace.`,
          },
          error: null,
        });
      }

      // If user does not exist yet, create invited record
      const existingInvite = await Membership.findOne({
        workspaceId,
        invitedEmail: normalizedEmail,
      });

      if (existingInvite) {
        throw new AppError('An invitation has already been sent to this email.', 409, 'ALREADY_INVITED');
      }

      const invite = await Membership.create({
        workspaceId,
        invitedEmail: normalizedEmail,
        role: role || 'member',
        status: 'invited',
      });

      res.status(201).json({
        success: true,
        data: {
          id: invite._id,
          email: normalizedEmail,
          role: invite.role,
          status: 'invited',
          message: `Invitation recorded for ${normalizedEmail}.`,
        },
        error: null,
      });
    } catch (error) {
      next(error);
    }
  }
);

// DELETE /api/v1/workspaces/:id/members/:memberId - Remove a member (Owner only)
router.delete(
  '/:id/members/:memberId',
  authenticateJWT,
  requireWorkspaceOwner,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { memberId } = req.params;
      const membership = await Membership.findById(memberId);

      if (!membership || membership.workspaceId.toString() !== req.workspaceId) {
        throw new AppError('Membership not found in this workspace.', 404, 'NOT_FOUND');
      }

      if (membership.role === 'owner') {
        throw new AppError('Cannot remove workspace owner.', 400, 'CANNOT_REMOVE_OWNER');
      }

      await Membership.findByIdAndDelete(memberId);

      res.status(200).json({
        success: true,
        data: { message: 'Member removed successfully.' },
        error: null,
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
