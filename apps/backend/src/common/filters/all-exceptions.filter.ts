import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AppError, ErrorCodes } from '../errors/app.error';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exception');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    if (exception instanceof AppError) {
      res.status(exception.status).json({
        error: {
          code: exception.code,
          message: exception.message,
          ...(exception.details !== undefined ? { details: exception.details } : {}),
        },
      });
      return;
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      const payload = typeof body === 'string'
        ? { code: this.mapStatusToCode(status), message: body }
        : this.normalizeNestError(body, status);
      res.status(status).json({ error: payload });
      return;
    }

    this.logger.error(`Unhandled error on ${req.method} ${req.url}`, exception as Error);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      error: { code: ErrorCodes.INTERNAL, message: 'Internal server error' },
    });
  }

  private mapStatusToCode(status: number): string {
    switch (status) {
      case HttpStatus.BAD_REQUEST: return ErrorCodes.VALIDATION;
      case HttpStatus.UNAUTHORIZED: return ErrorCodes.UNAUTHORIZED;
      case HttpStatus.FORBIDDEN: return ErrorCodes.FORBIDDEN;
      case HttpStatus.NOT_FOUND: return ErrorCodes.NOT_FOUND;
      case HttpStatus.CONFLICT: return ErrorCodes.CONFLICT;
      default: return ErrorCodes.INTERNAL;
    }
  }

  private normalizeNestError(body: any, status: number): { code: string; message: string; details?: unknown } {
    const code = this.mapStatusToCode(status);
    if (body && typeof body === 'object' && Array.isArray(body.message)) {
      return { code, message: 'Validation failed', details: body.message };
    }
    return {
      code,
      message: body?.message ?? body?.error ?? 'Request failed',
    };
  }
}
