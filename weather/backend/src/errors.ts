import type { ApiError } from './types.js';

export type ErrorCode = ApiError['error']['code'];

/** Base class for errors that map onto the ApiError envelope. */
export class AppError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly statusCode: number,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = new.target.name;
  }
}

export class BadRequestError extends AppError {
  constructor(message: string) {
    super('BAD_REQUEST', message, 400);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string) {
    super('NOT_FOUND', message, 404);
  }
}

export type UpstreamFailureKind =
  | 'rate-limited' // HTTP 429
  | 'timeout'
  | 'network'
  | 'server' // HTTP 5xx
  | 'client' // other HTTP 4xx (our request was wrong)
  | 'parse'; // payload did not match the expected shape

/** Failure talking to a third-party service (Open-Meteo, AI service, Expo). */
export class UpstreamError extends AppError {
  constructor(
    readonly upstream: string,
    readonly kind: UpstreamFailureKind,
    message: string,
    readonly status?: number,
    options?: { cause?: unknown },
  ) {
    super('UPSTREAM_UNAVAILABLE', `${upstream}: ${message}`, kind === 'client' ? 502 : 503, options);
  }

  /** Transient failures that justify falling back to another provider. */
  get transient(): boolean {
    return this.kind !== 'client';
  }
}

export function isUpstreamError(err: unknown): err is UpstreamError {
  return err instanceof UpstreamError;
}
