import rateLimit from 'express-rate-limit';
import type { Request } from 'express';
import { ErrorCodes } from '../errors/app.error';

interface Opts { windowMs: number; max: number }

export function authRateLimit(opts: Opts) {
  return rateLimit({
    windowMs: opts.windowMs,
    max: opts.max,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (_req, res) => {
      res.status(429).json({
        error: {
          code: ErrorCodes.TOO_MANY_REQUESTS,
          message: 'Too many requests, please try again later',
        },
      });
    },
  });
}

interface ApiRateLimitOpts {
  windowMs: number;
  max: number;
}

/**
 * Rate limit for authenticated API endpoints.
 * Keys by `req.user.id` when present, falls back to IP otherwise.
 * Lower threshold than `authRateLimit` since these are authenticated calls.
 */
export function apiRateLimit(opts: ApiRateLimitOpts) {
  return rateLimit({
    windowMs: opts.windowMs,
    max: opts.max,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator: (req: Request) => req.user?.id ?? req.ip ?? 'unknown',
    handler: (_req, res) => {
      res.status(429).json({
        error: {
          code: ErrorCodes.TOO_MANY_REQUESTS,
          message: 'Too many requests, please slow down',
        },
      });
    },
  });
}
