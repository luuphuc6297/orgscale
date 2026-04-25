import express, { Express, Request } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { Op } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';
import type { Logger } from 'pino';

import { Env } from './config/env';
import { createSequelize } from './db/sequelize';
import { User } from './users/user.model';
import { Recipient } from './recipients/recipient.model';
import { Campaign } from './campaigns/campaign.model';
import { CampaignRecipient } from './campaigns/campaign-recipient.model';

import { AuthService } from './auth/auth.service';
import { RecipientsService } from './recipients/recipients.service';
import { StatsService } from './campaigns/stats.service';
import { CampaignsService } from './campaigns/campaigns.service';
import { CampaignsLifecycleService } from './campaigns/campaigns.lifecycle.service';
import { SendSimulator } from './campaigns/send.simulator';
import { CampaignsScheduler } from './campaigns/scheduler';

import { authMiddleware } from './common/middleware/auth.middleware';
import { requireUser } from './common/middleware/require-user.middleware';
import { createErrorHandler } from './common/middleware/error-handler.middleware';
import { authRateLimit, apiRateLimit } from './common/middleware/rate-limit';
import { correlationId } from './common/middleware/correlation-id.middleware';

import { authRouter } from './auth/auth.router';
import { recipientsRouter } from './recipients/recipients.router';
import { campaignsRouter } from './campaigns/campaigns.router';
import { healthRouter } from './health.router';

export interface AppBundle {
  app: Express;
  sequelize: Sequelize;
  scheduler: CampaignsScheduler;
  simulator: SendSimulator;
}

export async function createApp(env: Env, logger: Logger): Promise<AppBundle> {
  const sequelize = createSequelize(env);
  sequelize.addModels([User, Recipient, Campaign, CampaignRecipient]);
  await sequelize.authenticate();

  // Restart resilience: campaigns left in 'sending' status by a previously crashed
  // process would otherwise be stuck forever. Reset to 'draft' if untouched > 5 min.
  const STALE_SENDING_THRESHOLD_MS = 5 * 60 * 1000;
  const [resetCount] = await Campaign.update(
    { status: 'draft' },
    {
      where: {
        status: 'sending',
        updatedAt: { [Op.lt]: new Date(Date.now() - STALE_SENDING_THRESHOLD_MS) },
      },
    },
  );
  if (resetCount > 0) {
    logger.warn({ count: resetCount }, 'Reset stale sending campaigns to draft on startup');
  }

  // Services (manual wiring, leaf → root)
  const authService = new AuthService(User, env.JWT_SECRET, env.JWT_EXPIRES_IN);
  const recipientsService = new RecipientsService(Recipient);
  const statsService = new StatsService(sequelize);
  const sendSimulator = new SendSimulator(Campaign, CampaignRecipient, env.SEND_SUCCESS_RATE, logger);
  const campaignsService = new CampaignsService(
    Campaign, CampaignRecipient, sequelize, recipientsService, statsService,
  );
  const lifecycleService = new CampaignsLifecycleService(Campaign, sendSimulator);
  const scheduler = new CampaignsScheduler(Campaign, sendSimulator, logger);

  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN, credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  app.use(correlationId);
  app.use(pinoHttp({
    logger,
    genReqId: (req) => (req as Request & { id?: string }).id ?? '',
    customLogLevel: (_req, res, err) => {
      if (err) return 'error';
      if (res.statusCode >= 500) return 'error';
      if (res.statusCode >= 400) return 'warn';
      return 'info';
    },
  }));

  const rateLimit = authRateLimit({
    windowMs: env.RATE_LIMIT_AUTH_WINDOW_MS,
    max: env.RATE_LIMIT_AUTH_MAX,
  });
  const apiLimit = apiRateLimit({
    windowMs: env.RATE_LIMIT_API_WINDOW_MS,
    max: env.RATE_LIMIT_API_MAX,
  });

  app.use('/health', healthRouter({ sequelize }));
  app.use('/auth', authRouter({ authService, rateLimit }));
  app.use('/recipients', authMiddleware(env.JWT_SECRET), requireUser, apiLimit, recipientsRouter({ recipientsService }));
  app.use('/campaigns', authMiddleware(env.JWT_SECRET), requireUser, apiLimit, campaignsRouter({
    campaignsService,
    lifecycleService,
    statsService,
  }));

  app.use(createErrorHandler(logger));

  return { app, sequelize, scheduler, simulator: sendSimulator };
}
