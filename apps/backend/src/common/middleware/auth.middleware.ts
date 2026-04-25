import type { Request, Response, NextFunction, RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { AppError, ErrorCodes } from '../errors/app.error';

interface JwtPayload { sub: string; email: string }

export function authMiddleware(secret: string): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      return next(new AppError(ErrorCodes.UNAUTHORIZED, 'Missing bearer token', 401));
    }
    const token = header.slice(7);
    try {
      const decoded = jwt.verify(token, secret) as JwtPayload;
      req.user = { id: decoded.sub, email: decoded.email };
      next();
    } catch {
      next(new AppError(ErrorCodes.UNAUTHORIZED, 'Invalid or expired token', 401));
    }
  };
}
