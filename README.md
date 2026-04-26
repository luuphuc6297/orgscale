# Mini Campaign Manager

[![CI](https://github.com/OWNER/REPO/actions/workflows/ci.yml/badge.svg)](https://github.com/OWNER/REPO/actions/workflows/ci.yml)
[![CD](https://github.com/OWNER/REPO/actions/workflows/cd.yml/badge.svg)](https://github.com/OWNER/REPO/actions/workflows/cd.yml)

> Replace `OWNER/REPO` in the badges above with your GitHub `org/repo` slug after pushing.

A small full-stack MarTech tool: marketers create email campaigns, schedule or send them immediately, and watch live stats as the (simulated) sender works through the recipient list.

Built for the S5 Tech Full-Stack Code Challenge.

## Table of contents

- [Stack](#stack)
- [Quick start (Docker)](#quick-start-docker--recommended)
- [Manual dev](#manual-dev-without-docker)
- [Project structure](#project-structure)
- [Architecture diagram](#architecture-diagram)
- [API endpoints](#api-endpoints)
- [Database schema](#database-schema)
- [Environment variables](#environment-variables)
- [Architecture decisions](#architecture-decisions)
- [Testing](#testing)
- [CI/CD](#cicd)
- [Deployment options](#deployment-options)
- [Troubleshooting](#troubleshooting)
- [Roadmap](#roadmap--future-work)
- [How I used Claude Code](#how-i-used-claude-code)

## Stack

| Layer       | Tech                                                                       |
|-------------|----------------------------------------------------------------------------|
| Frontend    | Vite + React 18 + TypeScript, TailwindCSS, shadcn/ui primitives, Zustand (auth), TanStack Query (server state), React Router |
| Backend     | Node 20 + **Express 4 + TypeScript**, `sequelize-typescript`, `zod` (validation + env), `jsonwebtoken` (auth), `node-cron` (scheduler), `pino` (logging), `helmet` + `express-rate-limit` (security) |
| Database    | PostgreSQL 16 (with `pgcrypto` extension for `gen_random_uuid()`)          |
| Tests       | Jest + Supertest (e2e tests against a real Postgres DB)                    |
| Packaging   | Yarn workspaces monorepo, Docker Compose for one-command boot              |

A shared TypeScript package (`@mcm/shared-types`) holds DTOs used by both apps.

## Quick start (Docker — recommended)

```bash
docker compose up --build
```

When the containers are up:

* Frontend: <http://localhost:5173>
* Backend:  <http://localhost:4000>
* Postgres: `localhost:5432` (user `postgres` / pass `postgres`, db `campaign_manager`)

The `backend` container runs migrations and seeds before starting the API. A demo account is created:

* **Email:** `demo@example.com`
* **Password:** `password123`

…with 20 sample recipients and 3 campaigns (one in each non-`sending` state) so the UI has data to show on first load.

## Manual dev (without Docker)

Requirements: Node 20, Yarn 1.x, a running PostgreSQL 16.

```bash
# 1. Install workspaces
yarn install

# 2. Bring up Postgres yourself, then:
cp apps/backend/.env.example apps/backend/.env
# edit DATABASE_URL if needed

# 3. Migrate + seed
yarn workspace @mcm/backend migrate
yarn workspace @mcm/backend seed

# 4. Run backend (port 4000) — tsx watch mode
yarn workspace @mcm/backend dev

# 5. In another shell, run frontend (port 5173)
cp apps/frontend/.env.example apps/frontend/.env
yarn workspace @mcm/frontend dev
```

For tests, also create a separate test database:

```bash
docker exec -it mcm-postgres psql -U postgres -c "CREATE DATABASE campaign_manager_test;"
cd apps/backend && NODE_ENV=test yarn migrate
yarn workspace @mcm/backend test
```

## Project structure

```
mini-campaign-manager-express/
├── apps/
│   ├── backend/                          # Express + Sequelize API
│   │   ├── src/
│   │   │   ├── main.ts                   # bootstrap + graceful shutdown
│   │   │   ├── app.ts                    # createApp() — composition root
│   │   │   ├── logger.ts                 # pino factory
│   │   │   ├── config/env.ts             # zod env schema + loader
│   │   │   ├── db/sequelize.ts           # createSequelize()
│   │   │   ├── auth/                     # service + router + zod schemas
│   │   │   ├── users/                    # User model
│   │   │   ├── recipients/               # model + service + router + schemas
│   │   │   ├── campaigns/
│   │   │   │   ├── campaign.model.ts
│   │   │   │   ├── campaign-recipient.model.ts
│   │   │   │   ├── campaigns.service.ts          # CRUD
│   │   │   │   ├── campaigns.lifecycle.service.ts # atomic schedule/send
│   │   │   │   ├── campaigns.router.ts
│   │   │   │   ├── campaigns.schemas.ts
│   │   │   │   ├── stats.service.ts              # COUNT FILTER aggregate
│   │   │   │   ├── send.simulator.ts             # async send loop
│   │   │   │   └── scheduler.ts                  # node-cron tick
│   │   │   ├── common/
│   │   │   │   ├── errors/app.error.ts           # AppError + ErrorCodes
│   │   │   │   ├── middleware/
│   │   │   │   │   ├── async-handler.ts
│   │   │   │   │   ├── auth.middleware.ts
│   │   │   │   │   ├── correlation-id.middleware.ts
│   │   │   │   │   ├── error-handler.middleware.ts
│   │   │   │   │   ├── rate-limit.ts
│   │   │   │   │   ├── require-user.middleware.ts
│   │   │   │   │   └── validate.middleware.ts
│   │   │   │   └── types/express.d.ts
│   │   │   └── health.router.ts                  # /health (DB ping)
│   │   ├── db/                                   # sequelize-cli artifacts
│   │   │   ├── config/database.js
│   │   │   ├── migrations/*.js                   # 4 migrations
│   │   │   └── seeders/*.js                      # idempotent demo seed
│   │   ├── test/
│   │   │   ├── setup.ts                          # createTestApp + truncateAll
│   │   │   ├── auth.e2e.spec.ts
│   │   │   ├── campaigns.e2e.spec.ts
│   │   │   ├── recipients.e2e.spec.ts
│   │   │   └── stats.e2e.spec.ts
│   │   ├── Dockerfile                            # multi-stage build
│   │   ├── jest.config.js
│   │   └── tsconfig.json / tsconfig.build.json
│   └── frontend/                                 # Vite + React 18 + TS
│       ├── src/
│       │   ├── main.tsx
│       │   ├── App.tsx
│       │   ├── router.tsx
│       │   ├── lib/
│       │   │   ├── api.ts                        # axios instance + interceptors
│       │   │   └── queryClient.ts                # TanStack Query config
│       │   ├── stores/authStore.ts               # Zustand persist
│       │   ├── hooks/                            # useAuth, useCampaigns
│       │   ├── components/
│       │   │   ├── ui/                           # shadcn primitives
│       │   │   ├── ProtectedRoute.tsx
│       │   │   ├── StatusBadge.tsx
│       │   │   ├── StatsDisplay.tsx
│       │   │   └── RecipientEmailsInput.tsx
│       │   └── pages/                            # 4 pages: Login, List, New, Detail
│       ├── Dockerfile                            # build → nginx serve
│       └── nginx.conf
├── packages/
│   └── shared-types/                             # DTOs shared between FE/BE
│       └── src/index.ts
├── .github/workflows/                            # ci.yml, cd.yml, release.yml
├── docs/
│   ├── interview-prep.md
│   └── superpowers/                              # spec, plan, reviews
├── docker-compose.yml
├── .eslintrc.json / .prettierrc.json
└── package.json                                  # yarn workspaces root
```

## Architecture diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                       Browser (React 18)                         │
│  Pages → TanStack Query hooks → axios client                     │
│  Zustand persist → localStorage[token]                           │
└──────────────────────────────┬───────────────────────────────────┘
                               │ JSON over HTTP, Bearer JWT
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│             Express App (single Node.js process)                 │
│  ┌─────────────────────────────────────────────────────────┐     │
│  │ Middleware chain (order matters):                       │     │
│  │  helmet → cors → json(1mb) → correlationId → pinoHttp   │     │
│  │  ↓                                                       │     │
│  │  /health           (open, DB ping)                       │     │
│  │  /auth/*           + authRateLimit + zod validate        │     │
│  │  /recipients/*     + authMiddleware + requireUser        │     │
│  │                    + apiRateLimit + zod validate         │     │
│  │  /campaigns/*      + authMiddleware + requireUser        │     │
│  │                    + apiRateLimit + zod validate         │     │
│  │  ↓                                                       │     │
│  │  Service layer (Composition Root in app.ts):             │     │
│  │   AuthService, RecipientsService, StatsService,          │     │
│  │   CampaignsService, CampaignsLifecycleService            │     │
│  │   SendSimulator (in-flight Set + drain on shutdown)      │     │
│  │   CampaignsScheduler (node-cron, every 30s)              │     │
│  │  ↓                                                       │     │
│  │  Sequelize ORM with sequelize-typescript                 │     │
│  │  ↓                                                       │     │
│  │  errorHandler (AppError → ZodError → SQL → fallback)     │     │
│  └─────────────────────────────────────────────────────────┘     │
│                                                                  │
│  setImmediate ──► loop pending recipients (50-250ms each)        │
│  drain() on SIGTERM ◄── wait for in-flight tasks (30s timeout)   │
└──────────────────────────────┬───────────────────────────────────┘
                               │ pg connection pool
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│  PostgreSQL 16                                                   │
│   users  | campaigns | recipients | campaign_recipients          │
│  Indexes: campaigns(created_by, status)                          │
│           campaigns(scheduled_at) WHERE status='scheduled'       │
│           campaign_recipients(campaign_id, status)               │
│           campaign_recipients(recipient_id)                      │
└──────────────────────────────────────────────────────────────────┘
```

## API endpoints

All `/campaigns/*` and `/recipients/*` routes require `Authorization: Bearer <jwt>` and are protected by both `authMiddleware` (token verify) and `requireUser` (assert non-null).

| Method | Path                          | Body / Query                                      | Returns                                |
|--------|-------------------------------|---------------------------------------------------|----------------------------------------|
| GET    | `/health`                     | —                                                 | `{ status, db, time }` (503 if DB down) |
| POST   | `/auth/register`              | `{ email, name, password }`                       | `201 { user }`                         |
| POST   | `/auth/login`                 | `{ email, password }`                             | `{ token, user }`                      |
| GET    | `/recipients`                 | `?page&limit&search`                              | `{ data, total, page, limit }`         |
| POST   | `/recipients`                 | `{ email, name? }`                                | `201 { recipient }` (idempotent)       |
| GET    | `/campaigns`                  | `?page&limit&status`                              | `{ data, total, page, limit }`         |
| POST   | `/campaigns`                  | `{ name, subject, body, recipientEmails[] }`      | `201 { campaign }`                     |
| GET    | `/campaigns/:id`              | —                                                 | `Campaign & { stats, recipients[] }`   |
| PATCH  | `/campaigns/:id`              | partial; **draft only**                           | `{ campaign }` or `409 INVALID_STATE_TRANSITION` |
| DELETE | `/campaigns/:id`              | **draft only**                                    | `204` or `409 INVALID_STATE_TRANSITION` |
| POST   | `/campaigns/:id/schedule`     | `{ scheduledAt: ISO8601 }` (must be future)       | `{ campaign }` (status → `scheduled`)  |
| POST   | `/campaigns/:id/send`         | — (allowed from `draft` or `scheduled`)           | `202 { campaign }` (status → `sending`)|
| GET    | `/campaigns/:id/stats`        | —                                                 | `CampaignStats`                        |

### Error shape

All non-2xx responses follow a uniform contract:

```json
{
  "error": {
    "code": "INVALID_STATE_TRANSITION",
    "message": "Only draft campaigns can be scheduled",
    "details": [...]
  }
}
```

`details` is optional and is populated for `VALIDATION` errors with field-level zod issues.

### Status codes

| Code | When |
|---|---|
| 201 | Resource created (register, create campaign, create recipient) |
| 202 | Async send accepted, processing in background |
| 204 | Resource deleted |
| 400 | `VALIDATION` — zod schema rejected the input |
| 401 | `UNAUTHORIZED` — missing or invalid bearer token |
| 404 | `NOT_FOUND` — resource missing OR not owned by caller (anti-enumeration) |
| 409 | `CONFLICT` (duplicate email) or `INVALID_STATE_TRANSITION` (mutate non-draft) |
| 429 | `TOO_MANY_REQUESTS` — rate limit exceeded |
| 500 | `INTERNAL` — unexpected; full stack logged server-side |
| 503 | Health check fails (DB unreachable) |

## Database schema

```sql
users
  id            UUID PK (gen_random_uuid())
  email         VARCHAR UNIQUE
  name          VARCHAR
  password_hash VARCHAR              -- bcrypt cost 10
  created_at    TIMESTAMPTZ
  updated_at    TIMESTAMPTZ

recipients
  id          UUID PK
  email       VARCHAR UNIQUE
  name        VARCHAR NULL
  created_at  TIMESTAMPTZ
  updated_at  TIMESTAMPTZ

campaigns
  id            UUID PK
  name          VARCHAR
  subject       VARCHAR
  body          TEXT
  status        ENUM('draft','scheduled','sending','sent')
  scheduled_at  TIMESTAMPTZ NULL
  created_by    UUID FK → users(id)
  created_at    TIMESTAMPTZ
  updated_at    TIMESTAMPTZ
  INDEX (created_by, status)
  INDEX (scheduled_at) WHERE status='scheduled'   -- partial

campaign_recipients
  campaign_id   UUID FK → campaigns(id) ON DELETE CASCADE
  recipient_id  UUID FK → recipients(id) ON DELETE RESTRICT
  status        ENUM('pending','sent','failed')
  sent_at       TIMESTAMPTZ NULL
  opened_at     TIMESTAMPTZ NULL
  created_at    TIMESTAMPTZ
  updated_at    TIMESTAMPTZ
  PRIMARY KEY (campaign_id, recipient_id)
  INDEX (campaign_id, status)
  INDEX (recipient_id)
```

ENUMs are created with `DO $$ BEGIN IF NOT EXISTS … $$` blocks so re-running the migration is safe.

## Environment variables

Validated at boot via `zod` in `apps/backend/src/config/env.ts`. The app fails fast if anything required is missing or malformed.

| Var | Type | Default | Purpose |
|---|---|---|---|
| `NODE_ENV` | `development \| test \| production` | `development` | Swaps DB target (test uses `TEST_DATABASE_URL`), disables scheduler in tests, controls logger format |
| `PORT` | int | `4000` | HTTP listen port |
| `DATABASE_URL` | string | required | Postgres connection string for dev/prod |
| `TEST_DATABASE_URL` | string | optional | Postgres connection string used when `NODE_ENV=test` |
| `JWT_SECRET` | string ≥ 16 chars | required | HS256 signing secret |
| `JWT_EXPIRES_IN` | string | `7d` | Token lifetime (ms-style: `15m`, `1h`, `7d`) |
| `SEND_SUCCESS_RATE` | float `0..1` | `0.9` | Probability that a recipient send "succeeds" in the simulator |
| `CORS_ORIGIN` | string | `*` | Allowed origin for CORS (use explicit URL in prod) |
| `RATE_LIMIT_AUTH_WINDOW_MS` | int | `60000` | Auth endpoint rate-limit window (ms) |
| `RATE_LIMIT_AUTH_MAX` | int | `5` | Auth endpoint max requests per window |
| `RATE_LIMIT_API_WINDOW_MS` | int | `60000` | Protected API rate-limit window (ms) |
| `RATE_LIMIT_API_MAX` | int | `120` | Protected API max requests per window |
| `LOG_LEVEL` | `fatal \| error \| warn \| info \| debug \| trace` | `info` | pino log level |

The frontend reads `VITE_API_BASE_URL` at build time (set via Docker build arg or `.env`).

## Architecture decisions

**Composition Root, no DI library.** `src/app.ts` wires services manually with constructor injection. No `@Injectable`, no decorator metadata at runtime, no token strings. The dependency graph is visible top-to-bottom in one file. Lifetime: every service is a singleton bound to the app instance — request-scoped state lives on `req` (e.g., `req.user`, `req.id`).

**State machine.** Campaigns move through `draft → scheduled → sending → sent` (or `draft → sending → sent`). Mutations only transition forward; `PATCH`/`DELETE` are rejected with `409 INVALID_STATE_TRANSITION` outside `draft`. Each transition is a single `UPDATE … WHERE status = …` so two concurrent send requests cannot both succeed — the second sees `count = 0` and the service distinguishes 404 (not owned) from 409 (wrong state) with a follow-up `findOne`.

**Async sending without a queue.** `POST /campaigns/:id/send` flips status to `sending` synchronously, then `SendSimulator.enqueue(id)` runs the per-recipient loop via `setImmediate`. An in-process `Set` (`inFlight`) guards against double-enqueue if the cron and an HTTP request fire for the same campaign. Each recipient is processed with a 50–250ms delay; success/failure is decided by `SEND_SUCCESS_RATE` and 30% of successes get a synthetic `openedAt`. When the loop ends, status is set to `sent`. This keeps the surface area small while honoring the "async send" requirement; in production this is the seam where a real queue (BullMQ, SQS) would plug in.

**Drain on shutdown.** `main.ts` registers SIGTERM/SIGINT handlers that: stop the scheduler, await `server.close()`, await `simulator.drain()` with a 30-second timeout, then close the DB pool. In-flight recipient sends are not abandoned mid-loop, and "Connection terminated" log spam during graceful shutdown is avoided.

**Restart resilience.** On boot, the app resets any campaign stuck in `sending` whose `updated_at` is older than 5 minutes back to `draft`. This recovers from process crashes without manual intervention. The simulator's loop is naturally idempotent (only processes `pending` recipients) so a re-trigger does not double-send already-completed recipients within the same campaign.

**Scheduler.** `CampaignsScheduler` uses `node-cron` to tick every 30 seconds, atomically transitions due `scheduled` campaigns to `sending` (`UPDATE … WHERE status='scheduled' AND scheduled_at ≤ NOW()`), and enqueues each. The scheduler shares the simulator's in-flight guard so a campaign that was just sent manually will not double-fire.

**Stats math.** A single SQL with `COUNT(*) FILTER` computes totals in one round-trip: `send_rate = sent / total`, `open_rate = opened / sent` (the marketing convention — open rate is conditional on delivery, with a comment in `stats.service.ts` for grep-ability). Computed on-demand in `GET /campaigns/:id` and `GET /campaigns/:id/stats`.

**Frontend live updates.** While a campaign is `sending`, the detail page polls every 1s via TanStack Query's conditional `refetchInterval`, returning `false` once status flips to `sent`. A quiet detail page makes zero network noise.

**Auth.** `AuthService` issues JWTs via `jsonwebtoken.sign`. Protected routes apply `authMiddleware(env.JWT_SECRET)` which verifies the token and attaches `req.user = { id, email }`, then `requireUser` middleware asserts non-null so route handlers can use `getUser(req)` for type-safe access. The frontend persists the token in `localStorage` via Zustand's `persist` middleware; an axios response interceptor logs out automatically on `401`.

**Validation.** Every endpoint validates input via zod schema through `validate(schema, source)` middleware. zod errors bubble to the central error handler and become a `400 VALIDATION` response with the violation list in `details`. Env vars are also validated through zod (`config/env.ts`) at boot.

**Observability.** `correlation-id.middleware.ts` runs before `pino-http` and attaches a UUID v4 (or reuses `X-Request-Id` from the client/load balancer) onto `req.id`. `pino-http` propagates the id into every log line via `genReqId`, and the same id echoes back in the response header so a single user action can be traced through logs end-to-end.

**Rate limiting.** Two layers with different keys and limits:
- **Auth endpoints** (`/auth/register`, `/auth/login`): 5 req/min per IP — anti brute-force
- **Protected API** (`/campaigns/*`, `/recipients/*`): 120 req/min per `req.user.id` (fallback IP) — anti-abuse from authenticated users

In-memory store; multi-instance deployments need a shared store (Redis) — documented as a Sprint 2 item.

**Why a monorepo?** The `@mcm/shared-types` package gives the React app the same DTO shapes the API serves, with zero duplication and a single source of truth. Yarn workspaces auto-symlinks the package; both apps import via `@mcm/shared-types` and a TypeScript change in one breaks both consumers immediately.

## Testing

```bash
# Spin up a Postgres for the test DB (or reuse the one from docker compose)
docker exec -it mcm-postgres psql -U postgres -c "CREATE DATABASE campaign_manager_test;"
cd apps/backend && NODE_ENV=test yarn migrate
yarn workspace @mcm/backend test
```

### Coverage (14 e2e specs)

| Spec | Cases |
|---|---|
| `auth.e2e.spec.ts` | register + login happy path, wrong password → 401, missing fields → 400 |
| `recipients.e2e.spec.ts` | POST creates, POST is idempotent (find-or-create), GET pagination + case-insensitive search, unauth → 401 |
| `campaigns.e2e.spec.ts` | `PATCH` non-draft → 409, schedule past timestamp → 400, ownership isolation (other user's campaign → 404), full `send → sending → sent` flow, `DELETE` on draft → 204 vs non-draft → 409 |
| `stats.e2e.spec.ts` | empty stats are zero, marketing convention `open_rate = opened/sent` with 5-recipient fixture |

### Test harness

Each spec spins up the real Express app via `createApp(env, logger)` with a silent pino logger and runs against the actual Postgres at `TEST_DATABASE_URL` — no mocks at the DB boundary. A broken migration or model change fails the suite immediately. `RATE_LIMIT_AUTH_MAX` and `RATE_LIMIT_API_MAX` are overridden to `'10000'` in `test/setup.ts` so test cases can hammer endpoints without tripping the limiter.

`truncateAll()` runs before each `it` to give a clean DB slate.

### Why no unit tests for the simulator

`SendSimulator.run()` is timing-dependent (50–250ms delays + random success rate). Unit testing it would require fake timers and a randomness seed — high mock-to-logic ratio, low signal. The behaviour it produces (campaign reaches `sent`, stats reflect counts) is verified end-to-end in `campaigns.e2e.spec.ts`. If it grows beyond ~60 LOC or gains business rules, unit tests become worthwhile.

## CI/CD

Three GitHub Actions workflows live under `.github/workflows/`.

### `ci.yml` — runs on every PR and push to `main`

Five jobs, fan-out from a shared install step:

| Job | What it does | Why |
|---|---|---|
| `lint` | `yarn lint` (ESLint) across all workspaces | Style + simple correctness gates |
| `typecheck` | `tsc --noEmit` for backend and frontend | Catches type regressions without producing artifacts |
| `test-backend` | Spins a real `postgres:16-alpine` service, runs migrations, executes Jest e2e suite | Same harness as local — no mocks at the DB boundary |
| `build` | Builds backend + frontend dist; uploads artifacts (7-day retention) | Verifies the production build is wirable |
| `ci-success` | Aggregator job that fails if any of the above failed | Single required check on PR branch protection |

Concurrency: `cancel-in-progress: true` on the same ref — pushing a new commit kills the previous run automatically.

### `cd.yml` — runs on pushes to `main` and on `v*.*.*` tags

- **Matrix**: builds and pushes both `mcm-backend` and `mcm-frontend` images in parallel
- **Registry**: `ghcr.io/<owner>/mcm-{backend,frontend}` (free for public repos; uses `${{ secrets.GITHUB_TOKEN }}` — no setup required)
- **Tags**: `latest` (on `main`), branch name, PR number, full SemVer (on tag push), short SHA — driven by `docker/metadata-action`
- **Layer cache**: `cache-from: type=gha` and `cache-to: type=gha,mode=max` — second build of the same Dockerfile typically completes in <60s
- **Verify-images job**: pulls both freshly-pushed images and `docker inspect`s their config — confirms registry permissions + image validity without flaky runtime smoke tests

To pull the images after a push:

```bash
docker pull ghcr.io/<owner>/mcm-backend:latest
docker pull ghcr.io/<owner>/mcm-frontend:latest
```

### `release.yml` — runs when a `v*.*.*` git tag is pushed

- Generates a changelog by `git log` between the previous tag and the new one
- Creates a GitHub Release with the changelog + `docker pull` instructions for the matching image tag
- Marks pre-releases automatically when the tag contains `-` (e.g., `v1.2.0-rc.1`)

To cut a release:

```bash
git tag v1.0.0 -m "First public release"
git push origin v1.0.0
# → cd.yml builds + pushes ghcr.io/<owner>/mcm-{backend,frontend}:1.0.0
# → release.yml creates the GitHub Release with auto-generated notes
```

### Notes on configuration

- `.dockerignore` at the repo root keeps `node_modules`, `.git`, `.env`, `docs`, and `coverage` out of the Docker build context — speeds up `cd.yml` significantly
- The CI test job overrides `RATE_LIMIT_AUTH_MAX` and `RATE_LIMIT_API_MAX` to `'10000'` so test cases can call `/auth/login` and `/campaigns` repeatedly without tripping the rate limiter
- No deploy step ships in this repo — `cd.yml` produces the artifacts (Docker images on GHCR) and stops there. Plug your own platform (Fly.io, Railway, ECS, K8s) in front of those images.

## Deployment options

The repo ships images that can run on any Docker-friendly platform. Concrete recipes:

### Fly.io

```bash
# Backend
fly launch --image ghcr.io/<owner>/mcm-backend:latest --no-deploy
fly secrets set JWT_SECRET=$(openssl rand -hex 32) DATABASE_URL=...
fly postgres create
fly postgres attach <pg-app>
fly deploy

# Frontend (set VITE_API_BASE_URL to backend URL at build time)
```

### Railway

1. Create new project → Deploy from GitHub repo
2. Add Postgres plugin
3. Set service to use `apps/backend/Dockerfile` with auto-injected `DATABASE_URL`
4. Add `JWT_SECRET` + `CORS_ORIGIN` secrets
5. Frontend service: `apps/frontend/Dockerfile` with build arg `VITE_API_BASE_URL=https://<backend-url>`

### AWS ECS Fargate

1. Push images to ECR (or pull-through cache from GHCR)
2. Task definition: backend container + sidecar log router
3. RDS Postgres + Secrets Manager for `JWT_SECRET` + `DATABASE_URL`
4. ALB → backend target group; CloudFront → S3 (frontend) or separate ALB
5. ECS service with desired count 1 (raise after Sprint 2 distributed lock)

### Kubernetes

Sample skeleton (not included; bring your own Helm chart):

- Backend: `Deployment` (replicas: 1 until distributed scheduler lock is added), `Service`, `HPA` keyed on req/s
- Frontend: `Deployment` + `Service` (nginx serves static assets) or push to S3+CloudFront
- DB: managed (RDS, Cloud SQL, etc.) — do not run Postgres in K8s for production
- `livenessProbe` and `readinessProbe`: `GET /health`, fails on `503` (DB down)
- Secrets: `JWT_SECRET` via Sealed Secrets / External Secrets Operator
- HorizontalPodAutoscaler: scale on CPU + custom queue depth metric (after BullMQ migration)

### Single-instance vs multi-instance

The current implementation is **safe for one backend instance**. Running multiple instances has known issues:

- Cron tick fires on every instance → atomic UPDATE prevents double-flip but `SendSimulator.enqueue` may fire from multiple processes for the same campaign
- Rate limiter is in-memory → not shared across instances
- `inFlight` Set is per-process

Mitigations require a shared store (Redis) and a distributed lock — see [Roadmap](#roadmap--future-work).

## Troubleshooting

### `ERROR: parsing url: undefined` on migrate

`apps/backend/.env` is missing. Run:
```bash
cp apps/backend/.env.example apps/backend/.env
```

### Tests fail with `SequelizeConnectionRefusedError`

Postgres is not running. Start it:
```bash
docker compose up postgres -d
sleep 5
docker compose ps   # verify Up (healthy)
```

### Tests fail with rate-limit 429 errors

`apps/backend/.env` is leaking `RATE_LIMIT_AUTH_MAX=5` into the test process. `test/setup.ts` already overrides it to `'10000'` via `loadEnv` — confirm you have the latest version of that file. If working from a fork, the override line is:
```ts
RATE_LIMIT_AUTH_MAX: '1000',
RATE_LIMIT_API_MAX: '10000',
```

### Frontend build fails with Vite type duplication

Yarn 1 hoisting gotcha: two copies of `vite` end up in `node_modules`, producing duplicate `Plugin<any>` types. The `build` script avoids this by skipping `tsc -b` (Vite handles TS transpilation natively). If you re-introduce `tsc -b`, expect this error.

To force a clean install:
```bash
rm -rf node_modules apps/*/node_modules
yarn install
```

### Backend container fails to start with seed error

The seeder is idempotent but Sequelize CLI may surface a warning if the demo data already exists. The container's CMD is `migrate && seed && start`. On a freshly-restored DB, the guard:
```js
const [existing] = await qi.sequelize.query(
  `SELECT 1 FROM users WHERE email = 'demo@example.com' LIMIT 1`,
);
if (existing.length > 0) { console.log('[seed] demo data already present — skipping'); return; }
```
ensures `seed` exits cleanly. Backend should still start.

### Campaign stuck in `sending` after a process crash

On the next boot, the app's startup hook resets campaigns where `status='sending' AND updated_at < NOW() - 5 minutes` back to `draft`. Look for the log line:
```json
{"level":40,"msg":"Reset stale sending campaigns to draft on startup","count":1}
```

Then re-trigger send manually. Recipients already marked `sent` are not touched (simulator only processes `pending`).

### `X-Request-Id` not appearing in logs

`pino-http` reads from `req.id`. The `correlation-id.middleware.ts` must be registered **before** `pinoHttp(...)` in `app.ts`. The order in this repo is correct; if you reorder middleware, ensure correlation-id stays first.

### Changes to `apps/backend/src` not reflecting in dev

`yarn workspace @mcm/backend dev` runs `tsx watch src/main.ts`. Make sure no other `node` process is holding port 4000:
```bash
lsof -i :4000
kill -9 <pid>
```

## Roadmap / future work

Items deliberately deferred to keep the scope code-challenge-sized. Each is documented in `docs/superpowers/reviews/2026-04-25-three-lens-audit.md` with rationale.

### Sprint 1 — production hardening (~1 week)

- **Move JWT to httpOnly cookie + CSRF token.** Eliminates XSS exposure of the token. Spans backend (set-cookie + CORS credentials), frontend (drop axios bearer header), and deployment (cookie domain config).
- **Refactor `CampaignDetailPage.tsx` (170 LOC)** into 3-4 sub-components (header + actions, schedule form, recipients table). Improves test surface and maintainability.
- **Stats caching** with 5-second TTL LRU in memory. Reduces DB load for live polling on campaigns with thousands of recipients.
- **Refresh token flow** with rotation and reuse detection (RFC 6819). Replace 7-day access token with 15-minute access + 7-day refresh.
- **React Error Boundary** to catch render crashes and display a recovery UI instead of white screen.
- **Form validation with zod + react-hook-form** on Login/Register/CampaignNew pages. Field-level errors instead of toast-only.

### Sprint 2 — multi-instance ready (~1-2 weeks)

- **Distributed scheduler lock** (Redis SETNX or Postgres advisory lock). Prevents cron tick on multiple instances from racing.
- **Replace `setImmediate` simulator with BullMQ + Redis.** Persistent jobs survive crashes; built-in retry with exponential backoff; DLQ for permanent failures; queue depth visible to autoscaler.
- **Shared rate-limit store** (`rate-limit-redis`). Counters atomic across instances.
- **Idempotency keys** on send attempts. Allows safe retry without double-sending if BullMQ + email gateway are added later.

### Sprint 3+ — observability + scale

- **Prometheus metrics** via `prom-client`. RED method (rate, errors, duration) per endpoint + USE metrics (CPU, memory, DB pool saturation).
- **OpenTelemetry tracing** with W3C Trace Context propagation. Auto-instrument Express, Sequelize, axios.
- **Structured error tracking** (Sentry, Datadog APM).
- **Materialized view for stats** when campaigns grow past 100k recipients. `REFRESH MATERIALIZED VIEW CONCURRENTLY` every 30s.
- **Repository layer abstraction** if a second data source (Redis cache, search index) is added.
- **Multi-tenancy** if the product evolves: scope recipients per organization, add tenant ID to JWT claims, enforce tenant isolation in service queries.

## How I used Claude Code

I drove this build with a structured workflow — a brainstorming pass to disambiguate the spec, an end-to-end implementation plan committed to `docs/superpowers/plans/`, then inline execution task-by-task with subagent dispatch for isolated steps and a final code-review pass. The full plan + audit trail lives in [`docs/superpowers/`](docs/superpowers/).

### Tasks I delegated

* **Schema + migrations + seed** — generate Sequelize models, idempotent ENUM-creating migrations (the `DO $$ IF NOT EXISTS $$` pattern), and a seeder that's safe to re-run.
* **Atomic state-machine implementation** — port the `UPDATE … WHERE status='draft' RETURNING` pattern across schedule/send transitions, plus the corresponding 409 INVALID_STATE_TRANSITION test cases.
* **Composition root wiring** — assemble services + middleware + routers in `src/app.ts` with manual constructor injection.
* **TanStack Query hooks** — `useCampaignsList`, `useCampaignDetail` with conditional `refetchInterval` for live polling on `sending` campaigns.
* **Audit + remediation** — three-lens scan (system design, clean code, solution architecture) producing a prioritised gap list, then an 11-fix remediation pass (rate limit, correlation ID, restart resilience, drain timeout, healthcheck, …).
* **CI/CD** — three GitHub Actions workflows (lint+typecheck+test+build, Docker image push to GHCR with layer cache, semver tag → release).
* **README structure + sections** — outline, table of contents, the architecture diagram skeleton.

### 2–3 example prompts (verbatim or near-verbatim)

> *"Audit this codebase against the spec. Map every requirement to a file:line. Output a scorecard with % completion, critical gaps, and a prioritised fix list. Don't fabricate references."* — produced the initial scorecard and surfaced the gaps that became the 11-fix remediation pass.

> *"Write the implementation plan as 40+ bite-sized tasks. Each task: explicit file paths, full code (no placeholders), verification command + expected output, frequent commits. TDD where applicable."* — became the plan in `docs/superpowers/plans/`. The granularity made subagent dispatch reliable — each task was self-contained.

> *"Bug #1 from the code review: SendSimulator doesn't drain in-flight tasks on shutdown — log spam on SIGTERM. Apply 2 surgical fixes: track pending promises in `send.simulator.ts`, expose `drain()`; in `main.ts` await drain after `server.close()` and before `sequelize.close()`."* — the agent landed both edits in a single subagent dispatch with the exact file paths I'd given.

### Where Claude Code was wrong or needed correction

* **Type-safety shortcuts.** The first cut of `excludePassword(user)` cast `User` directly to `Record<string, unknown>` — TypeScript rejected it with `error TS2352: convert to unknown first`. Claude fixed it as `as unknown as Record<…>` only after the Docker build surfaced the error; I had to nudge the agent toward the `unknown` intermediate cast rather than just `as any`.
* **CD smoke test flakiness.** Claude's first CD pipeline tried to spin a real Postgres + backend container in the smoke job and curl `/health`. It was flaky (cold-start + migration race in CI). I pushed back and we replaced it with a `verify-images` job that just `docker pull`s + `docker inspect`s — narrower scope, deterministic, still valuable.
* **Yarn workspace duplicate Vite types.** The agent's frontend `build` script kept `tsc -b && vite build`. In CI that triggered the well-known yarn-1 hoisting issue (two `vite` copies, two `Plugin<any>` types). Claude only got the right fix (drop `tsc -b` from `build`, move type-checking into a separate `typecheck` script) after I fed back the actual error.
* **Seeder idempotency.** First seeder unconditionally inserted `demo@example.com` and crashed loudly on container restart. We added a `SELECT 1 FROM users WHERE email='demo@example.com'` guard at the top — the kind of safety check Claude doesn't reach for unprompted.
* **Tailwind `space-y-*` on inline anchors.** The campaigns list initially used `space-y-2` on a container of `<Link>` children. Because react-router's `<Link>` renders as inline `<a>`, `margin-top` was ignored and items stuck together. Claude only switched to `flex flex-col gap-3` after I described the visual symptom, not from looking at the markup.

### What I did NOT let Claude Code do, and why

* **Pick the auth storage mechanism.** Claude was happy to leave the JWT in `localStorage` via Zustand's `persist` middleware. That's XSS-exposed; in production it should be an httpOnly cookie. I held that decision because it spans backend (set-cookie + CORS credentials), frontend (no axios bearer header), and deployment (cookie domain), and getting the security model right is a human call. Documented as M1 in [`docs/superpowers/reviews/2026-04-25-three-lens-audit.md`](docs/superpowers/reviews/2026-04-25-three-lens-audit.md).
* **Decide what counts as "production-ready".** When the audit produced 7 architectural concerns, I — not the agent — decided which fall in Sprint 0 (must-fix), Sprint 1 (production hardening), and Sprint 2 (multi-instance scale, requires new infra). The agent will happily implement *anything*; choosing the boundary of "good enough for a code challenge" vs "good enough for revenue" is mine.
* **Add new dependencies without a justification I'd accept.** The agent suggested `tsyringe` for DI, BullMQ for the queue, Redis for distributed scheduler lock, Prometheus for metrics. Each was reasonable; I rejected all of them because they bring infra weight that exceeds the spec ask. The audit doc records *why* they're not in scope.
* **Write this "How I used Claude Code" section unsupervised.** It's a self-report — letting the agent draft it without correction would be circular. I wrote/edited the prose; the agent helped with structure and provided notes from its own task history.
* **Touch destructive operations without confirmation.** `git reset --hard`, `rm -rf` outside scratch dirs, force-push, dropping a database — the agent has tools to do all of these and was instructed not to. Where it did delete files (e.g., wiping the original `src/` tree before populating with the new structure), I confirmed each step in chat first.

Implementation plan + spec + reviews are committed under [`docs/superpowers/`](docs/superpowers/) for full audit trail. Senior-level Q&A prep for interviews about the technical decisions in this repo is in [`docs/interview-prep.md`](docs/interview-prep.md).
