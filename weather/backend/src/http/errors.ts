import type { FastifyError, FastifyInstance } from 'fastify';
import type { ApiError } from '../types.js';
import { AppError, type ErrorCode } from '../errors.js';

export function apiError(code: ErrorCode, message: string): ApiError {
  return { error: { code, message } };
}

/** Maps every thrown error onto the ApiError envelope. */
export function registerErrorHandling(app: FastifyInstance): void {
  app.setErrorHandler((err: FastifyError | AppError | Error, req, reply) => {
    reply.header('Cache-Control', 'no-store');
    if (err instanceof AppError) {
      if (err.statusCode >= 500) req.log.warn({ err: err.message, code: err.code }, 'request failed');
      return reply.status(err.statusCode).send(apiError(err.code, err.message));
    }
    const status = (err as FastifyError).statusCode ?? 500;
    if (status === 429) return reply.status(429).send(apiError('RATE_LIMITED', err.message || 'Too many requests'));
    if (status === 404) return reply.status(404).send(apiError('NOT_FOUND', err.message));
    if (status >= 400 && status < 500) return reply.status(400).send(apiError('BAD_REQUEST', err.message));
    req.log.error({ err }, 'unhandled error');
    return reply.status(500).send(apiError('INTERNAL', 'Internal server error'));
  });

  app.setNotFoundHandler((req, reply) => {
    reply.header('Cache-Control', 'no-store');
    return reply.status(404).send(apiError('NOT_FOUND', `Route ${req.method} ${req.url.split('?')[0]} not found`));
  });
}
