import { randomUUID } from 'crypto';
import type { Request, Response, NextFunction, RequestHandler } from 'express';

const HEADER_NAME = 'x-request-id';

/**
 * Attaches a stable request id to each request:
 *  - Reuses incoming `X-Request-Id` header if present (e.g., from a load balancer / client)
 *  - Otherwise generates a fresh UUIDv4
 *
 * The id is exposed as `req.id` and echoed back as the `X-Request-Id` response header
 * so a single user action can be traced through logs end-to-end.
 */
export const correlationId: RequestHandler = (req: Request, res: Response, next: NextFunction) => {
  const incoming = req.headers[HEADER_NAME];
  const id =
    typeof incoming === 'string' && incoming.length > 0 && incoming.length <= 200
      ? incoming
      : randomUUID();
  (req as Request & { id?: string }).id = id;
  res.setHeader('X-Request-Id', id);
  next();
};
