import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // limit each IP to 50 login/signup requests per window
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req: Request, res: Response) => {
    res.status(429).json({
      success: false,
      data: null,
      error: {
        message: 'Too many authentication attempts. Please try again after 15 minutes.',
        code: 'RATE_LIMIT_EXCEEDED',
      },
    });
  },
});

export const checkLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 120, // limit each IP / client to 120 checks per minute
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req: Request, res: Response) => {
    res.status(429).json({
      success: false,
      data: null,
      error: {
        message: 'Check request rate limit exceeded. Please throttle your requests.',
        code: 'RATE_LIMIT_EXCEEDED',
      },
    });
  },
});

export const generalApiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req: Request, res: Response) => {
    res.status(429).json({
      success: false,
      data: null,
      error: {
        message: 'API rate limit exceeded.',
        code: 'RATE_LIMIT_EXCEEDED',
      },
    });
  },
});
