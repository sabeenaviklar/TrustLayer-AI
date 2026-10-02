import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { env } from '../config/env';
import { User } from '../models/User';
import { Workspace } from '../models/Workspace';
import { Membership } from '../models/Membership';
import { AppError } from '../middleware/errorHandler';
import { validate } from '../middleware/validate';
import { authenticateJWT, AuthenticatedRequest } from '../middleware/auth';
import { authLimiter } from '../middleware/rateLimiter';

const router = Router();

function generateToken(userId: string): string {
  return jwt.sign({ userId }, env.JWT_SECRET, {
    expiresIn: (env.JWT_EXPIRES_IN || '7d') as any,
  });
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

const signupSchema = z.object({
  body: z.object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    email: z.string().email('Invalid email address'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
  }),
});

const loginSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(1, 'Password is required'),
  }),
});

// POST /api/v1/auth/signup
router.post(
  '/signup',
  authLimiter,
  validate(signupSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name, email, password } = req.body;
      const normalizedEmail = email.toLowerCase().trim();

      const existingUser = await User.findOne({ email: normalizedEmail });
      if (existingUser) {
        throw new AppError('An account with this email already exists.', 409, 'EMAIL_EXISTS');
      }

      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password, salt);

      const user = await User.create({
        name: name.trim(),
        email: normalizedEmail,
        passwordHash,
      });

      // Automatically create a default workspace for the new user
      const baseSlug = slugify(name) || 'my-workspace';
      let slug = baseSlug;
      let counter = 1;
      while (await Workspace.findOne({ slug })) {
        slug = `${baseSlug}-${counter}`;
        counter++;
      }

      const workspace = await Workspace.create({
        name: `${user.name}'s Workspace`,
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

      const token = generateToken(user._id.toString());

      res.status(201).json({
        success: true,
        data: {
          user: {
            id: user._id,
            name: user.name,
            email: user.email,
          },
          workspace: {
            id: workspace._id,
            name: workspace.name,
            slug: workspace.slug,
            plan: workspace.plan,
            role: 'owner',
          },
          token,
        },
        error: null,
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/v1/auth/login
router.post(
  '/login',
  authLimiter,
  validate(loginSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password } = req.body;
      const normalizedEmail = email.toLowerCase().trim();

      const user = await User.findOne({ email: normalizedEmail });
      if (!user) {
        throw new AppError('Invalid email or password.', 401, 'INVALID_CREDENTIALS');
      }

      const isMatch = await bcrypt.compare(password, user.passwordHash);
      if (!isMatch) {
        throw new AppError('Invalid email or password.', 401, 'INVALID_CREDENTIALS');
      }

      // Find user's active workspaces
      const memberships = await Membership.find({
        userId: user._id,
        status: 'active',
      }).populate('workspaceId');

      let activeWorkspace = null;
      if (memberships.length > 0 && memberships[0].workspaceId) {
        const ws: any = memberships[0].workspaceId;
        activeWorkspace = {
          id: ws._id,
          name: ws.name,
          slug: ws.slug,
          plan: ws.plan,
          role: memberships[0].role,
        };
      }

      const token = generateToken(user._id.toString());

      res.status(200).json({
        success: true,
        data: {
          user: {
            id: user._id,
            name: user.name,
            email: user.email,
          },
          workspace: activeWorkspace,
          token,
        },
        error: null,
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/v1/auth/me
router.get(
  '/me',
  authenticateJWT,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const memberships = await Membership.find({
        userId: user._id,
        status: 'active',
      }).populate('workspaceId');

      const workspaces = memberships
        .filter((m) => m.workspaceId)
        .map((m) => {
          const ws: any = m.workspaceId;
          return {
            id: ws._id,
            name: ws.name,
            slug: ws.slug,
            plan: ws.plan,
            role: m.role,
          };
        });

      res.status(200).json({
        success: true,
        data: {
          user: {
            id: user._id,
            name: user.name,
            email: user.email,
          },
          workspaces,
        },
        error: null,
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
