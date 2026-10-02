import { Request, Response, NextFunction } from 'express';
import { AnyZodObject, ZodError } from 'zod';
import { AppError } from './errorHandler';

export const validate = (schema: AnyZodObject) => {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const firstError = error.errors[0];
        const message = `Validation error on ${firstError.path.join('.')}: ${firstError.message}`;
        next(new AppError(message, 400, 'VALIDATION_ERROR', error.errors));
      } else {
        next(error);
      }
    }
  };
};
