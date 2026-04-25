import { Router } from 'express';
import { RecipientsService } from './recipients.service';
import { createRecipientSchema, listRecipientsQuery } from './recipients.schemas';
import { validate } from '../common/middleware/validate.middleware';
import { asyncHandler } from '../common/middleware/async-handler';

interface Deps { recipientsService: RecipientsService }

export function recipientsRouter(deps: Deps): Router {
  const router = Router();

  router.get(
    '/',
    validate(listRecipientsQuery, 'query'),
    asyncHandler(async (req, res) => {
      const result = await deps.recipientsService.list(req.query as any);
      res.json(result);
    }),
  );

  router.post(
    '/',
    validate(createRecipientSchema),
    asyncHandler(async (req, res) => {
      const recipient = await deps.recipientsService.create(req.body);
      res.status(201).json({ recipient });
    }),
  );

  return router;
}
