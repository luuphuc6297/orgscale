import 'reflect-metadata';
import 'dotenv/config';
import { loadEnv } from './config/env';
import { createApp } from './app';
import { createLogger } from './logger';

async function bootstrap() {
  const env = loadEnv();
  const logger = createLogger(env.LOG_LEVEL, env.NODE_ENV !== 'production');
  const { app, sequelize, scheduler, simulator } = await createApp(env, logger);

  const server = app.listen(env.PORT, () => {
    logger.info({ port: env.PORT, env: env.NODE_ENV }, 'Backend listening');
  });

  if (env.NODE_ENV !== 'test') scheduler.start();

  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Shutting down');
    scheduler.stop();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    logger.info('HTTP server closed');
    const DRAIN_TIMEOUT_MS = 30_000;
    await Promise.race([
      simulator.drain(),
      new Promise<void>((resolve) => {
        setTimeout(() => {
          logger.warn({ timeoutMs: DRAIN_TIMEOUT_MS }, 'Simulator drain timed out');
          resolve();
        }, DRAIN_TIMEOUT_MS);
      }),
    ]);
    await sequelize.close();
    process.exit(0);
  };
  process.on('SIGTERM', () => { void shutdown('SIGTERM'); });
  process.on('SIGINT', () => { void shutdown('SIGINT'); });
}

bootstrap().catch((err) => {
  console.error('Fatal bootstrap error:', err);
  process.exit(1);
});
