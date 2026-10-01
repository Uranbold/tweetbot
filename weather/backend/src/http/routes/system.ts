import type { FastifyInstance } from 'fastify';
import type { Container } from '../../container.js';
import { buildOpenApi } from '../openapi.js';

export function systemRoutes(app: FastifyInstance, c: Container): void {
  app.get('/health', { config: { rateLimit: false } }, async (_req, reply) => {
    reply.header('Cache-Control', 'no-store');
    const stats = c.cache.snapshot();
    const ai = await c.services.predict.reachability();
    return {
      status: 'ok' as const,
      uptimeSeconds: Math.round((Date.now() - c.startedAt) / 1000),
      provider: c.providerLabel,
      mode: c.config.PROVIDER_MODE,
      cache: { size: await c.cache.store.size(), hits: stats.hits, misses: stats.misses, stale: stats.stale, inflight: stats.inflight },
      upstream: c.fallbackStats(),
      ai: ai.ai,
      ...(ai.aiService ? { aiService: ai.aiService } : {}),
      notifications: {
        push: c.notifications.push.name,
        devices: await c.notifications.devices.count(),
        dispatcher: { enabled: c.config.DISPATCH_ENABLED, intervalMs: c.config.DISPATCH_INTERVAL_MS, ...c.notifications.dispatcher.stats() },
      },
    };
  });

  const spec = buildOpenApi();
  app.get('/openapi.json', async (_req, reply) => {
    reply.header('Cache-Control', 'public, max-age=3600');
    return spec;
  });
}
