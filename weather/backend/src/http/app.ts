import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { corsOrigins } from '../config.js';
import type { Container } from '../container.js';
import { registerErrorHandling } from './errors.js';
import { deviceRoutes } from './routes/devices.js';
import { systemRoutes } from './routes/system.js';
import { weatherRoutes } from './routes/weather.js';

export interface BuildAppOptions {
  /** Fastify logger option; false in tests. Defaults to pino JSON at config.LOG_LEVEL. */
  logger?: FastifyServerOptions['logger'];
}

/** Round lat/lon in logged URLs to the 2-decimal cache precision (privacy, SA §9). */
export function redactUrl(url: string): string {
  return url.replace(/([?&](?:lat|lon)=)(-?\d+(?:\.\d+)?)/g, (_m, k: string, v: string) => `${k}${Number(v).toFixed(2)}`);
}

export async function buildApp(container: Container, opts: BuildAppOptions = {}): Promise<FastifyInstance> {
  const { config } = container;
  const app = Fastify({
    logger: opts.logger ?? {
      level: config.LOG_LEVEL,
      serializers: {
        req: (req: { method: string; url: string; id: string }) => ({ method: req.method, url: redactUrl(req.url), reqId: req.id }),
      },
    },
    trustProxy: config.TRUST_PROXY,
    requestIdHeader: 'x-request-id',
    bodyLimit: 64 * 1024,
  });

  // Lenient JSON parser: an empty body with a JSON content-type is "no body", not a 400.
  app.removeContentTypeParser('application/json');
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (_req, body, done) => {
    const text = typeof body === 'string' ? body : body.toString('utf8');
    if (text.trim() === '') return done(null, undefined);
    try {
      done(null, JSON.parse(text));
    } catch {
      const e = new Error('Body is not valid JSON') as Error & { statusCode: number };
      e.statusCode = 400;
      done(e, undefined);
    }
  });

  registerErrorHandling(app);

  await app.register(cors, {
    origin: corsOrigins(config),
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    exposedHeaders: ['X-Cache', 'X-Request-Id'],
    maxAge: 600,
  });

  await app.register(rateLimit, {
    max: config.RATE_LIMIT_MAX,
    timeWindow: config.RATE_LIMIT_WINDOW_MS,
    errorResponseBuilder: (_req, ctx) => {
      const e = new Error(`Rate limit exceeded: ${ctx.max} requests per ${ctx.after}`) as Error & { statusCode: number };
      e.statusCode = 429;
      return e;
    },
  });

  app.addHook('onSend', async (req, reply) => {
    reply.header('X-Request-Id', req.id);
  });

  await app.register(
    async (api) => {
      systemRoutes(api, container);
      weatherRoutes(api, container);
      deviceRoutes(api, container);
    },
    { prefix: '/api/v1' },
  );

  return app;
}
