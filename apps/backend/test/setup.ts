import 'reflect-metadata';
import 'dotenv/config';
import type { Express } from 'express';
import type { Sequelize } from 'sequelize-typescript';
import { createApp } from '../src/app';
import { createLogger } from '../src/logger';
import { loadEnv, type Env } from '../src/config/env';

export interface TestBundle {
  app: Express;
  sequelize: Sequelize;
  env: Env;
}

export async function createTestApp(): Promise<TestBundle> {
  const env = loadEnv({
    ...process.env,
    NODE_ENV: 'test',
    JWT_SECRET: process.env.JWT_SECRET ?? 'test-secret-for-e2e-only-0123456789',
    RATE_LIMIT_AUTH_MAX: '1000',
    RATE_LIMIT_API_MAX: '10000',
  });
  const logger = createLogger('silent' as any, false);
  const { app, sequelize } = await createApp(env, logger);
  return { app, sequelize, env };
}

export async function truncateAll(sequelize: Sequelize): Promise<void> {
  await sequelize.query(
    'TRUNCATE TABLE campaign_recipients, campaigns, recipients, users RESTART IDENTITY CASCADE;',
  );
}
