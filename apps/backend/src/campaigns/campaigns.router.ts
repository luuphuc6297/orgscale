import { Router } from 'express';
import { CampaignsService } from './campaigns.service';
import { CampaignsLifecycleService } from './campaigns.lifecycle.service';
import { StatsService } from './stats.service';
import {
  createCampaignSchema,
  updateCampaignSchema,
  listCampaignsQuery,
  scheduleCampaignSchema,
  campaignIdParams,
} from './campaigns.schemas';
import { validate } from '../common/middleware/validate.middleware';
import { asyncHandler } from '../common/middleware/async-handler';
import { getUser } from '../common/middleware/require-user.middleware';

interface Deps {
  campaignsService: CampaignsService;
  lifecycleService: CampaignsLifecycleService;
  statsService: StatsService;
}

export function campaignsRouter(deps: Deps): Router {
  const router = Router();

  router.get(
    '/',
    validate(listCampaignsQuery, 'query'),
    asyncHandler(async (req, res) => {
      const user = getUser(req);
      const result = await deps.campaignsService.list(user.id, req.query as any);
      res.json(result);
    }),
  );

  router.post(
    '/',
    validate(createCampaignSchema),
    asyncHandler(async (req, res) => {
      const user = getUser(req);
      const campaign = await deps.campaignsService.create(user.id, req.body);
      res.status(201).json({ campaign });
    }),
  );

  router.get(
    '/:id',
    validate(campaignIdParams, 'params'),
    asyncHandler(async (req, res) => {
      const user = getUser(req);
      const detail = await deps.campaignsService.getDetail(user.id, req.params.id);
      res.json(detail);
    }),
  );

  router.patch(
    '/:id',
    validate(campaignIdParams, 'params'),
    validate(updateCampaignSchema),
    asyncHandler(async (req, res) => {
      const user = getUser(req);
      const campaign = await deps.campaignsService.update(user.id, req.params.id, req.body);
      res.json({ campaign });
    }),
  );

  router.delete(
    '/:id',
    validate(campaignIdParams, 'params'),
    asyncHandler(async (req, res) => {
      const user = getUser(req);
      await deps.campaignsService.remove(user.id, req.params.id);
      res.status(204).end();
    }),
  );

  router.post(
    '/:id/schedule',
    validate(campaignIdParams, 'params'),
    validate(scheduleCampaignSchema),
    asyncHandler(async (req, res) => {
      const user = getUser(req);
      const campaign = await deps.lifecycleService.schedule(
        user.id,
        req.params.id,
        req.body.scheduledAt,
      );
      res.json({ campaign });
    }),
  );

  router.post(
    '/:id/send',
    validate(campaignIdParams, 'params'),
    asyncHandler(async (req, res) => {
      const user = getUser(req);
      const campaign = await deps.lifecycleService.send(user.id, req.params.id);
      res.status(202).json({ campaign });
    }),
  );

  router.get(
    '/:id/stats',
    validate(campaignIdParams, 'params'),
    asyncHandler(async (req, res) => {
      const user = getUser(req);
      await deps.campaignsService.getOwned(user.id, req.params.id);
      const stats = await deps.statsService.compute(req.params.id);
      res.json(stats);
    }),
  );

  return router;
}
