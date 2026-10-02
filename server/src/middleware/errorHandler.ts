import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';

export class AppError extends Error {
  statusCode: number;
  code: string;
  details?: any;

  constructor(message: string, statusCode = 400, code = 'BAD_REQUEST', details?: any) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export function errorHandler(
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  const statusCode = err.statusCode || (err.status ? Number(err.status) : 500);
  const code = err.code || (statusCode === 500 ? 'INTERNAL_SERVER_ERROR' : 'ERROR');

  const message =
    statusCode === 500 && env.NODE_ENV === 'production'
      ? 'An unexpected internal server error occurred.'
      : err.message || 'Something went wrong.';

  if (statusCode === 500) {
    console.error('[Unhandled Error]:', err);
  }

  res.status(statusCode).json({
    success: false,
    data: null,
    error: {
      message,
      code,
      ...(err.details ? { details: err.details } : {}),
      ...(env.NODE_ENV !== 'production' && statusCode === 500 ? { stack: err.stack } : {}),
    },
  });
}
