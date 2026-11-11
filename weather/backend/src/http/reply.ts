import type { FastifyReply } from 'fastify';
import type { ApiResponse } from '../types.js';
import type { ServiceResult } from '../services/common.js';

/** Send a cached service result with Cache-Control + X-Cache. */
export function sendCached<T>(reply: FastifyReply, r: ServiceResult<T>): ApiResponse<T> {
  reply.header('Cache-Control', `public, max-age=${r.maxAge}`);
  reply.header('X-Cache', r.cache);
  return r.body;
}

/** Envelope for data that is not provider-backed (regions, devices). */
export function envelope<T>(data: T, provider = 'skycast'): ApiResponse<T> {
  return { data, meta: { provider, fetchedAt: new Date().toISOString(), stale: false, mock: false } };
}

export function noStore(reply: FastifyReply): void {
  reply.header('Cache-Control', 'no-store');
}
