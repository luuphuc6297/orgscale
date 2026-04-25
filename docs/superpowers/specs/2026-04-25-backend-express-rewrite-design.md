# Backend Rewrite: NestJS → Express + TypeScript

**Date:** 2026-04-25
**Scope:** Full backend rewrite within the cloned repo `mini-campaign-manager-express/`. Frontend, shared-types, migrations, seeders, docker-compose are untouched or only lightly updated (env var names, backend start command).
**Goal:** Deliver a project identical in behavior but built on plain Express + TypeScript, bundled with the gap fixes flagged in the 2026-04-24 audit.

## Context

Original project (`mini-campaign-manager/`) implements the S5 Full-Stack Challenge with NestJS backend. Spec asks for Express. Rewrite is behavior-preserving but tightens compliance and fixes polish gaps.

## Decisions (all approved in brainstorming)

1. **DI**: Composition Root pattern — zero third-party DI library, zero `reflect-metadata`. Services stay as classes with constructor injection; wiring happens in `src/app.ts`.
2. **Validation**: `zod`. Request bodies/queries validated via middleware `validate(schema)`. Env parsed via `z.object(...).parse(process.env)` on boot.
3. **Execution mode**: Inline sequential — each phase produces a compiling, passing state before the next starts.
4. **Models layer**: keep `sequelize-typescript` decorators (lib is framework-agnostic). Copy model files as-is.
5. **Migrations + seeders**: unchanged (JS, already framework-agnostic).
6. **Scheduler**: `node-cron` replacing `@nestjs/schedule`.
7. **Logger**: `pino` + `pino-http` replacing NestJS Logger.
8. **Dev runner**: `tsx` replacing `ts-node-dev`.
9. **Security middleware**: `helmet`, `cors`, `express-rate-limit`.
10. **Test harness**: Jest + Supertest against a real Postgres (same as before). `createApp()` factory replaces `createTestApp()`.

## Bundled audit fixes (Scope B)

Included as part of rewrite, not separate follow-up:

- **Rate limit** on `/auth/register` and `/auth/login` (5 req/min per IP).
- **Remove hardcoded demo credentials** from `LoginPage.tsx` (gate behind `import.meta.env.DEV` or delete).
- **ESLint + Prettier + `.editorconfig`** (already present) at root; backend + frontend both inherit.
- **GitHub Actions CI** workflow (`.github/workflows/ci.yml`) running lint + test + build for backend and frontend.
- **Add test coverage** for `POST/GET /recipients` and `DELETE /campaigns/:id` (3 cases min).
- **Confirm dialog on Send button** in `CampaignDetailPage.tsx` — mirror the Delete pattern.
- **Frontend `.env.example`** added at `apps/frontend/.env.example` already exists, verify `VITE_API_URL` is documented.

Items explicitly NOT bundled (would expand scope too far, suggest follow-up):
- React Error Boundary
- Zod+react-hook-form for frontend forms
- Optimistic UI updates
- Repository layer abstraction
- Refresh token flow

## Target architecture

### Backend layout

```
apps/backend/
├── src/
│   ├── main.ts                              # bootstrap: createApp() → listen + graceful SIGTERM
│   ├── app.ts                               # createApp(): composition root + middleware stack
│   ├── config/env.ts                        # zod schema + parse(process.env)
│   ├── db/sequelize.ts                      # Sequelize instance + addModels([...])
│   ├── common/
│   │   ├── errors/app.error.ts              # COPY from NestJS version
│   │   ├── middleware/
│   │   │   ├── async-handler.ts             # wrap async (req,res,next) → forward errors
│   │   │   ├── auth.middleware.ts           # verify JWT → attach req.user
│   │   │   ├── validate.middleware.ts       # (schema) → parse body/query/params
│   │   │   ├── error-handler.middleware.ts  # map AppError/ZodError → uniform shape
│   │   │   └── rate-limit.ts                # factory: perRoute(opts)
│   │   └── types/express.d.ts               # augment Express.Request.user
│   ├── auth/
│   │   ├── auth.service.ts                  # COPY logic from NestJS (drop @Injectable)
│   │   ├── auth.router.ts                   # Router with /register, /login
│   │   └── auth.schemas.ts                  # zod schemas
│   ├── users/user.model.ts                  # COPY
│   ├── recipients/
│   │   ├── recipient.model.ts               # COPY
│   │   ├── recipients.service.ts            # COPY logic
│   │   ├── recipients.router.ts
│   │   └── recipients.schemas.ts
│   ├── campaigns/
│   │   ├── campaign.model.ts                # COPY
│   │   ├── campaign-recipient.model.ts      # COPY
│   │   ├── campaigns.service.ts             # COPY logic
│   │   ├── campaigns.lifecycle.service.ts   # COPY logic (atomic UPDATE)
│   │   ├── send.simulator.ts                # COPY logic (setImmediate + in-flight Set)
│   │   ├── stats.service.ts                 # COPY logic (COUNT FILTER SQL)
│   │   ├── scheduler.ts                     # node-cron replacing @Cron
│   │   ├── campaigns.router.ts
│   │   └── campaigns.schemas.ts
│   └── health.router.ts                     # GET /health
└── test/
    ├── setup.ts                             # createApp + truncateAll
    ├── auth.e2e.spec.ts
    ├── campaigns.e2e.spec.ts
    ├── stats.e2e.spec.ts
    └── recipients.e2e.spec.ts               # NEW — audit gap fix
```

### Composition root (sketch)

```ts
// src/app.ts
export async function createApp(env: Env): Promise<Express> {
  const sequelize = createSequelize(env);
  sequelize.addModels([User, Recipient, Campaign, CampaignRecipient]);

  // Services (manual wiring, top-down)
  const authService = new AuthService(User, env.JWT_SECRET, env.JWT_EXPIRES_IN);
  const recipientsService = new RecipientsService(Recipient);
  const sendSimulator = new SendSimulator(Campaign, CampaignRecipient, env.SEND_SUCCESS_RATE);
  const statsService = new StatsService(sequelize);
  const campaignsService = new CampaignsService(Campaign, CampaignRecipient, Recipient, recipientsService, statsService);
  const campaignsLifecycle = new CampaignsLifecycleService(Campaign, sendSimulator);
  const scheduler = new CampaignsScheduler(Campaign, campaignsLifecycle, sendSimulator);

  const app = express();
  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGIN }));
  app.use(express.json({ limit: '1mb' }));
  app.use(pinoHttp({ logger }));

  app.use('/health', healthRouter());
  app.use('/auth', authRouter(authService));        // rate-limited inside
  app.use('/recipients', authMiddleware(env.JWT_SECRET), recipientsRouter(recipientsService));
  app.use('/campaigns', authMiddleware(env.JWT_SECRET), campaignsRouter(campaignsService, campaignsLifecycle, statsService));

  app.use(errorHandler);  // LAST

  if (env.NODE_ENV !== 'test') scheduler.start();
  return app;
}
```

### Error response contract

Unchanged from NestJS version — `{ "error": { "code", "message", "details"? } }`. Error handler middleware maps:
- `AppError` → status from `err.status`, body from `err.toJSON()`
- `ZodError` → 400 VALIDATION with `details: err.issues`
- `UnauthorizedError` (jsonwebtoken) → 401 UNAUTHORIZED
- Everything else → 500 INTERNAL with generic message (log full error server-side)

### Auth middleware contract

```ts
// Request augmentation
declare global {
  namespace Express {
    interface Request { user?: { id: string; email: string } }
  }
}
```

Middleware reads `Authorization: Bearer <token>`, verifies with `jsonwebtoken.verify`, attaches `req.user`. No passport dependency.

## Execution phases (sequential)

Each phase ends with either a compiling build (phases 1-7) or a green test suite (phases 8-9). No phase starts until the previous is verified.

| # | Phase | Produces | Verify |
|---|---|---|---|
| 0 | Strip NestJS, install Express stack | Updated `package.json`, `tsconfig`, `.eslintrc`, `.prettierrc` | `yarn install` succeeds |
| 1 | Infra: env, db, errors, middleware skeletons | 8 files in `config/`, `db/`, `common/` | `tsc --noEmit` compiles |
| 2 | Models (copy 4) | `user.model.ts`, `recipient.model.ts`, `campaign.model.ts`, `campaign-recipient.model.ts` | compiles |
| 3 | Auth module | service + schemas + router | compiles |
| 4 | Recipients module | service + schemas + router | compiles |
| 5 | Campaigns core | 2 services + stats + schemas + router | compiles |
| 6 | Async: send simulator + scheduler | `send.simulator.ts`, `scheduler.ts` (node-cron) | compiles |
| 7 | Bootstrap: `app.ts` + `main.ts` + health | app factory wires everything | `yarn build`, `yarn start` both OK |
| 8 | Tests: update harness + existing 3 specs + new recipients spec | 4 e2e specs | `yarn test` green (target: 10+ tests) |
| 9 | Docker + CI + FE fixes + README | Dockerfile, `.github/workflows/ci.yml`, FE confirm Send + remove hardcoded creds, README updated | `docker compose up` healthy; CI yaml validates |

Total estimate: **5-6h** of sequential work.

## Testing strategy

- Keep all existing 8 test cases (auth, campaigns, stats). They are behavior tests — rewrite must preserve them.
- Add `recipients.e2e.spec.ts` with 3 cases: `POST /recipients` (create), `POST /recipients` with existing email (find-or-create), `GET /recipients?search=` (pagination + filter).
- Add 1 case to `campaigns.e2e.spec.ts`: `DELETE /campaigns/:id` on draft → 204; on non-draft → 409.
- Add 1 case to `auth.e2e.spec.ts`: rate limit — 6th request to `/auth/login` returns 429.

Target: **12+ passing e2e specs** (up from 8).

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| Sequelize model decorators behave differently outside Nest context | Unit-test model load early in Phase 2; if decorators fail, fall back to `sequelize.define()` (~30 min rewrite) |
| Jest + Supertest harness subtle differences (app lifecycle) | Use `beforeAll: const app = await createApp(env); server = app.listen(0)` pattern; close in `afterAll` |
| `node-cron` scheduler firing during tests | Only `scheduler.start()` when `NODE_ENV !== 'test'` |
| Request augmentation `req.user` not picked up by TS | Add `common/types/express.d.ts` to `tsconfig.json` `include` array |
| FE contract drift from renaming/refactoring routes | Curl smoke test all 12 endpoints against both versions; compare JSON shape |

## Non-goals

- No route contract changes — URL paths, query params, request/response shapes identical
- No database schema changes (migrations unchanged)
- No frontend rewrite (only 2 small fixes: Send confirm + remove hardcoded creds)
- No Express-specific features beyond what's needed to match NestJS behavior

## Acceptance criteria

- [ ] `docker compose up --build` brings up Postgres + backend + frontend, all healthy
- [ ] Frontend logs in and navigates through all 4 pages without any error
- [ ] `yarn test` in backend returns 12+ passing specs
- [ ] `yarn lint` passes on both backend and frontend
- [ ] CI workflow on GitHub Actions (if push to test branch) runs green
- [ ] `package.json` backend dependencies contain zero `@nestjs/*` packages
- [ ] Uniform error shape preserved across all endpoints (curl-verified)
- [ ] README "How I Used Claude Code" updated to reflect the framework swap as a completed task
