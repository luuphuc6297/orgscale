import type { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { AppError, ErrorCodes } from '../errors/app.error';
import type { Logger } from 'pino';

export function createErrorHandler(logger: Logger): ErrorRequestHandler {
  return (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof AppError) {
      return res.status(err.status).json({
        error: { code: err.code, message: err.message, ...(err.details ? { details: err.details } : {}) },
      });
    }
    if (err instanceof ZodError) {
      return res.status(400).json({
        error: {
          code: ErrorCodes.VALIDATION,
          message: 'Validation failed',
          details: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
        },
      });
    }
    if (
      err !== null &&
      typeof err === 'object' &&
      'name' in err &&
      (err as { name: unknown }).name === 'SequelizeUniqueConstraintError'
    ) {
      return res.status(409).json({
        error: { code: ErrorCodes.CONFLICT, message: 'Resource already exists' },
      });
    }
    logger.error({ err }, 'Unhandled error');
    res.status(500).json({
      error: { code: ErrorCodes.INTERNAL, message: 'Internal server error' },
    });
  };
}
