import { Router, RequestHandler } from 'express';
import { AuthService } from './auth.service';
import { registerSchema, loginSchema } from './auth.schemas';
import { validate } from '../common/middleware/validate.middleware';
import { asyncHandler } from '../common/middleware/async-handler';

interface Deps {
  authService: AuthService;
  rateLimit: RequestHandler;
}

export function authRouter(deps: Deps): Router {
  const router = Router();

  router.post(
    '/register',
    deps.rateLimit,
    validate(registerSchema),
    asyncHandler(async (req, res) => {
      const user = await deps.authService.register(req.body);
      res.status(201).json({ user });
    }),
  );

  router.post(
    '/login',
    deps.rateLimit,
    validate(loginSchema),
    asyncHandler(async (req, res) => {
      const result = await deps.authService.login(req.body);
      res.status(200).json(result);
    }),
  );

  return router;
}
