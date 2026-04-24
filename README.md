# Mini Campaign Manager

A small full-stack MarTech tool: marketers create email campaigns, schedule or send them immediately, and watch live stats as the (simulated) sender works through the recipient list.

Built for the S5 Tech Full-Stack Code Challenge.

## Stack

| Layer       | Tech                                                                       |
|-------------|----------------------------------------------------------------------------|
| Frontend    | Vite + React 18 + TypeScript, TailwindCSS, shadcn/ui primitives, Zustand (auth), TanStack Query (server state), React Router |
| Backend     | Node 20 + **NestJS 10** (Express adapter), `@nestjs/sequelize` + `sequelize-typescript`, `class-validator`/`class-transformer`, `@nestjs/jwt` + `passport-jwt`, `@nestjs/schedule` (cron) |
| Database    | PostgreSQL 16 (with `pgcrypto` extension for `gen_random_uuid()`)          |
| Tests       | Jest + Supertest via `@nestjs/testing` (e2e tests against a real Postgres DB) |
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

# 4. Run backend (port 4000) — Nest watch mode
yarn workspace @mcm/backend dev

# 5. In another shell, run frontend (port 5173)
cp apps/frontend/.env.example apps/frontend/.env
yarn workspace @mcm/frontend dev
```

## API endpoints

All `/campaigns/*` and `/recipients/*` routes are protected by `JwtAuthGuard` and require `Authorization: Bearer <jwt>`.

| Method | Path                          | Body / Query                                      | Returns                                |
|--------|-------------------------------|---------------------------------------------------|----------------------------------------|
| POST   | `/auth/register`              | `{ email, name, password }`                       | `201 { user }`                         |
| POST   | `/auth/login`                 | `{ email, password }`                             | `{ token, user }`                      |
| GET    | `/recipients`                 | `?page&limit&search`                              | `{ data, total, page, limit }`         |
| POST   | `/recipients`                 | `{ email, name? }`                                | `201 { recipient }`                    |
| GET    | `/campaigns`                  | `?page&limit&status`                              | `{ data, total, page, limit }`         |
| POST   | `/campaigns`                  | `{ name, subject, body, recipientEmails[] }`      | `201 { campaign }`                     |
| GET    | `/campaigns/:id`              | —                                                 | `Campaign & { stats, recipients[] }`   |
| PATCH  | `/campaigns/:id`              | partial; **draft only**                           | `{ campaign }` or `409 INVALID_STATE_TRANSITION` |
| DELETE | `/campaigns/:id`              | **draft only**                                    | `204` or `409 INVALID_STATE_TRANSITION` |
| POST   | `/campaigns/:id/schedule`     | `{ scheduledAt: ISO8601 }` (must be future)       | `{ campaign }` (status → `scheduled`)  |
| POST   | `/campaigns/:id/send`         | — (allowed from `draft` or `scheduled`)           | `202 { campaign }` (status → `sending`)|
| GET    | `/campaigns/:id/stats`        | —                                                 | `CampaignStats`                        |

Errors follow a uniform shape: `{ "error": { "code": "...", "message": "...", "details"?: ... } }`. The shape is enforced by a single `AllExceptionsFilter` registered globally in `main.ts`.

## Backend layout (NestJS)

```
apps/backend/
├── src/
│   ├── main.ts                       # bootstrap: ValidationPipe + AllExceptionsFilter + CORS
│   ├── app.module.ts                 # wires Config, Sequelize, Schedule, feature modules
│   ├── auth/                         # AuthModule + JwtStrategy + JwtAuthGuard
│   ├── users/                        # User model + UsersModule
│   ├── recipients/                   # RecipientsModule (CRUD + ensureMany helper)
│   ├── campaigns/                    # CampaignsModule
│   │   ├── campaigns.service.ts      # list / detail / create / update / delete
│   │   ├── campaigns.lifecycle.service.ts  # atomic schedule() / send()
│   │   ├── campaigns.scheduler.ts    # @Cron(EVERY_30_SECONDS) tick
│   │   ├── send.simulator.ts         # in-process per-recipient loop
│   │   ├── stats.service.ts          # single SQL with COUNT FILTER
│   │   └── dto/                      # class-validator DTOs
│   ├── common/
│   │   ├── filters/all-exceptions.filter.ts  # uniform error shape
│   │   ├── guards/jwt-auth.guard.ts
│   │   ├── decorators/current-user.decorator.ts
│   │   └── errors/app.error.ts       # AppError + ErrorCodes enum
│   └── config/env.validation.ts      # class-validator env schema
├── db/                               # sequelize-cli artifacts (kept out of TS build)
│   ├── config/database.js
│   ├── migrations/*.js
│   └── seeders/*.js
└── test/
    ├── setup.ts                      # createTestApp() + truncateAll()
    ├── auth.e2e-spec.ts
    ├── stats.e2e-spec.ts
    └── campaigns.e2e-spec.ts
```

## Architecture decisions

**Why NestJS over plain Express?** The original spec is small enough that Express would work, but NestJS earns its keep here by giving us four things for free that we'd otherwise hand-roll: (a) a DI container so `CampaignsService`, `StatsService`, and `SendSimulator` get the same Sequelize models and `ConfigService` injected without singleton hacks, (b) a global `ValidationPipe` that runs `class-validator` on every DTO without per-route boilerplate, (c) `@nestjs/schedule` so the cron is a decorator on a method instead of a separate `node-cron.start()` lifecycle, and (d) `@nestjs/testing` so `Test.createTestingModule({ imports: [AppModule] })` spins up a real app for e2e tests with one line. The cost is one extra layer of abstraction (modules + decorators) — worth it once you have more than two services that share state.

**State machine.** Campaigns move through `draft → scheduled → sending → sent` (or `draft → sending → sent`). Mutations only transition forward; `PATCH`/`DELETE` are rejected with `409 INVALID_STATE_TRANSITION` outside `draft`. Each transition is a single `UPDATE … WHERE status = …` so two concurrent send requests cannot both succeed — the second sees `count = 0` and returns 409.

**Async sending without a queue.** `POST /campaigns/:id/send` flips status to `sending` synchronously inside `CampaignsLifecycleService`, then `SendSimulator.enqueue(id)` runs the per-recipient loop via `setImmediate`. An in-process `Set` (`inFlight`) guards against double-enqueue if the cron and an HTTP request fire for the same campaign. Each recipient is processed with a 50–250ms delay; success/failure is decided by `SEND_SUCCESS_RATE` (default 0.9) and 30% of successes get a synthetic `openedAt`. When the loop ends, status is set to `sent`. This keeps the surface area small while honoring the "async send" requirement; in production this is the seam where you'd plug BullMQ / SQS.

**Scheduler.** `CampaignsScheduler` uses `@Cron(CronExpression.EVERY_30_SECONDS)` from `@nestjs/schedule`, atomically transitions due `scheduled` campaigns to `sending` (`UPDATE … WHERE status='scheduled' AND scheduled_at ≤ NOW()`), and enqueues each. The scheduler shares the simulator's in-flight guard so a campaign that was just sent manually will not double-fire.

**Stats math.** A single SQL with `COUNT(*) FILTER` computes totals: `send_rate = sent / total`, `open_rate = opened / sent` (the marketing convention — open rate is conditional on delivery). Computed on-demand in `GET /campaigns/:id` and as a polled `GET /campaigns/:id/stats`.

**Frontend live updates.** While a campaign is `sending`, the detail page polls every 1s via TanStack Query's `refetchInterval`, so the stats numbers and progress bars animate as the simulator works. Polling auto-stops when status flips to `sent`.

**Auth.** `AuthService` issues JWTs via `JwtService.signAsync`. Protected routes use `@UseGuards(JwtAuthGuard)`, which extends `AuthGuard('jwt')` and runs the `passport-jwt` strategy that attaches `req.user = { id, email }`. The `@CurrentUser()` param decorator pulls that off the request. The frontend persists the token in `localStorage` via Zustand's `persist` middleware; an axios response interceptor logs out automatically on `401`.

**Validation.** Every DTO has `class-validator` decorators (`@IsEmail`, `@IsString`, `@MinLength`, `@ArrayMinSize`, `@IsISO8601`, …). The global `ValidationPipe` (configured in `main.ts` with `whitelist: true, forbidNonWhitelisted: true, transform: true`) runs them on every request and any failure becomes a `400 VALIDATION` response with the violation list in `details`. Env vars are also validated through `class-validator` via `ConfigModule.forRoot({ validate })`.

**Why a monorepo?** The `@mcm/shared-types` package gives the React app the same DTO shapes the API serves, with zero duplication and a single source of truth.

## Tests

```bash
# Spin up a Postgres for the test DB (or reuse the one from docker compose)
yarn workspace @mcm/backend test
```

Coverage includes:

* `auth.e2e-spec.ts` — register + login happy path, wrong password → 401
* `stats.e2e-spec.ts` — zero state, real rates with 5 recipients
* `campaigns.e2e-spec.ts` — `PATCH` non-draft → 409, schedule a past timestamp → 400, ownership check (other user's campaign → 404), full `send → sending → sent` flow

Each spec spins up a real Nest app via `Test.createTestingModule({ imports: [AppModule] })`, applies the production `ValidationPipe` + `AllExceptionsFilter`, and runs against the real Postgres at `TEST_DATABASE_URL` — no mocks at the DB boundary, so a broken migration or model change fails the suite.

## How I used Claude Code

I drove this build with the Superpowers workflow: a brainstorming pass to disambiguate the spec, a single end-to-end implementation plan saved to `docs/superpowers/plans/`, then inline execution task-by-task. Notable points where the agent's discipline mattered:

* **State-machine race:** the agent insisted on the atomic `UPDATE … WHERE status='draft'` pattern over the read-then-write pattern I would have written by hand — and the integration test for concurrent sends passed on the first try.
* **Stats convention:** when I asked for "open rate", the agent flagged the ambiguity (opened/total vs opened/sent) and locked in the marketing convention with a comment so the math is grep-able.
* **Live polling:** the agent reached for TanStack Query's conditional `refetchInterval` (returning `false` once status flips) instead of a blanket interval — which means a quiet detail page makes zero network noise.
* **Idempotent migrations:** the Postgres ENUM types are wrapped in `DO $$ BEGIN IF NOT EXISTS … $$` blocks so re-running the migration during local iteration doesn't blow up.
* **Framework swap mid-flight:** I shipped the Express version first, then asked the agent to migrate the entire backend to NestJS while keeping the API contract byte-for-byte identical. It scoped out the rewrite as 8 N-tasks (scaffold → models → auth → recipients/campaigns modules → tests → cleanup) and held the frontend constant — the React app needed zero changes.

Implementation plan (the full task-by-task playbook) lives in `docs/superpowers/plans/2026-04-24-mini-campaign-manager.md`.
