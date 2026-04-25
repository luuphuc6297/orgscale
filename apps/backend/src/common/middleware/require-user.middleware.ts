import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { AppError, ErrorCodes } from '../errors/app.error';

/**
 * Asserts that `req.user` was attached by an upstream auth middleware.
 * Throws 401 UNAUTHORIZED otherwise.
 *
 * Use AFTER authMiddleware to make `req.user` non-nullable in route handlers.
 */
export const requireUser: RequestHandler = (req: Request, _res: Response, next: NextFunction) => {
  if (!req.user) {
    return next(new AppError(ErrorCodes.UNAUTHORIZED, 'Unauthenticated', 401));
  }
  next();
};

/**
 * Type-narrowing helper for route handlers — asserts and returns req.user.
 * Use this when you need to access req.user.id without TypeScript complaining.
 */
export function getUser(req: Request): { id: string; email: string } {
  if (!req.user) {
    throw new AppError(ErrorCodes.UNAUTHORIZED, 'Unauthenticated', 401);
  }
  return req.user;
}
