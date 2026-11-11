import { loadConfig } from './config.js';
import { createContainer } from './container.js';
import { buildApp } from './http/app.js';
import { scheduleDispatcher } from './notifications/dispatcher.js';

async function main(): Promise<void> {
  const config = loadConfig();
  // The container logs through Fastify's pino instance once the app exists.
  const logRef: { current?: { info(o: object, m?: string): void; warn(o: object, m?: string): void } } = {};
  const log = {
    info: (o: object, m?: string) => logRef.current?.info(o, m),
    warn: (o: object, m?: string) => logRef.current?.warn(o, m),
  };
  const container = createContainer(config, { log });
  const app = await buildApp(container);
  logRef.current = app.log;

  const stopDispatcher = config.DISPATCH_ENABLED ? scheduleDispatcher(container.notifications.dispatcher, config.DISPATCH_INTERVAL_MS, app.log) : () => {};

  const shutdown = async (signal: string) => {
    app.log.info({ signal }, 'shutting down');
    stopDispatcher();
    await app.close();
    process.exit(0);
  };
  process.once('SIGINT', () => void shutdown('SIGINT'));
  process.once('SIGTERM', () => void shutdown('SIGTERM'));

  await app.listen({ port: config.PORT, host: config.HOST });
  app.log.info({ mode: config.PROVIDER_MODE, provider: container.providerLabel, push: container.notifications.push.name, dispatch: config.DISPATCH_ENABLED }, 'skycast backend ready');
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
