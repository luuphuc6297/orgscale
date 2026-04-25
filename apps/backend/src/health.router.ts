import { Router } from 'express';
import type { Sequelize } from 'sequelize-typescript';

interface Deps {
  sequelize: Sequelize;
}

export function healthRouter(deps: Deps): Router {
  const router = Router();

  router.get('/', async (_req, res) => {
    const time = new Date().toISOString();
    try {
      await deps.sequelize.query('SELECT 1');
      res.json({ status: 'ok', db: 'up', time });
    } catch {
      res.status(503).json({ status: 'degraded', db: 'down', time });
    }
  });

  return router;
}
