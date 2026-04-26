# Mini Campaign Manager

[![CI](https://github.com/OWNER/REPO/actions/workflows/ci.yml/badge.svg)](https://github.com/OWNER/REPO/actions/workflows/ci.yml)
[![CD](https://github.com/OWNER/REPO/actions/workflows/cd.yml/badge.svg)](https://github.com/OWNER/REPO/actions/workflows/cd.yml)

> Replace `OWNER/REPO` in the badges above with your GitHub `org/repo` slug after pushing.

A small full-stack MarTech tool: marketers create email campaigns, schedule or send them immediately, and watch live stats as the (simulated) sender works through the recipient list.

Built for the S5 Tech Full-Stack Code Challenge.

## Stack

| Layer       | Tech                                                                       |
|-------------|----------------------------------------------------------------------------|
| Frontend    | Vite + React 18 + TypeScript, TailwindCSS, shadcn/ui primitives, Zustand (auth), TanStack Query (server state), React Router |
| Backend     | Node 20 + **Express 4 + TypeScript**, `sequelize-typescript`, `zod` (validation + env), `jsonwebtoken` (auth), `node-cron` (scheduler), `pino` (logging), `helmet` + `express-rate-limit` (security) |
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

**Why plain Express over NestJS?** The spec asks for Node.js + Express, so we ship Express. The previous iteration used NestJS for DI, ValidationPipe, and Schedule — each is replaced by a small, focused pattern here: a **composition root** in `src/app.ts` wires services manually (no DI container, no `reflect-metadata` runtime reliance beyond what `sequelize-typescript` needs), `zod` middleware replaces `class-validator`, and `node-cron` replaces `@nestjs/schedule`. The result is less framework, less magic, and a surface area that matches the spec.

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
- **Smoke test job**: pulls the freshly-pushed backend image, spins it against a Postgres container, and curls `/health` to verify the runtime image actually starts

To pull the image after a push:

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

## How I used Claude Code

I drove this build with the Superpowers workflow — a brainstorming pass to disambiguate the spec, a single end-to-end implementation plan committed to `docs/superpowers/plans/`, then inline execution task-by-task with subagent dispatch for isolated steps and a final code-review pass. The full plan + audit trail lives in [`docs/superpowers/`](docs/superpowers/).

### Tasks I delegated

* **Schema + migrations + seed** — generate Sequelize models, idempotent ENUM-creating migrations (the `DO $$ IF NOT EXISTS $$` pattern), and a seeder that's safe to re-run.
* **Atomic state-machine implementation** — port the `UPDATE … WHERE status='draft' RETURNING` pattern across schedule/send transitions, plus the corresponding 409 INVALID_STATE_TRANSITION test cases.
* **Express composition root** — translate the NestJS DI graph (services + controllers + scheduler + simulator) into manual `new` wiring in `src/app.ts`, no DI library, no `reflect-metadata` runtime reliance.
* **TanStack Query hooks** — `useCampaignsList`, `useCampaignDetail` with conditional `refetchInterval` for live polling on `sending` campaigns.
* **Audit + remediation** — three-lens scan (system design, clean code, solution architecture) producing a prioritised gap list, then an 11-fix remediation pass (rate limit, correlation ID, restart resilience, drain timeout, healthcheck, …).
* **CI/CD** — three GitHub Actions workflows (lint+typecheck+test+build, Docker image push to GHCR with layer cache, semver tag → release).
* **README + walkthrough** — including the structure of this section.

### 2–3 example prompts (verbatim or near-verbatim)

> *"Audit codebase tại `/Users/luuphuc/Projects/orgscale/mini-campaign-manager` so với đề bài S5 Tech Full-Stack Code Challenge. Đánh giá % completion, gap list, recommendations. Trích dẫn file:line cho mọi claim. Không bịa."* — produced the initial 90% scorecard and unblocked the rewrite plan.

> *"Rewrite the NestJS backend to plain Express + TypeScript while preserving API contract byte-for-byte. Composition root pattern (zero DI library). zod for validation + env. Sequential execution. Bundle audit fixes (rate limit, demo creds, ESLint+CI, Send confirm)."* — became the 9-phase implementation plan; 40+ bite-sized tasks with explicit file paths and verification steps.

> *"Bug #1 from the code review: SendSimulator doesn't drain in-flight tasks on shutdown — log spam on SIGTERM. Apply 2 surgical fixes: track pending promises in `send.simulator.ts`, expose `drain()`; in `main.ts` await drain after `server.close()` and before `sequelize.close()`."* — the agent landed both edits in a single subagent dispatch.

### Where Claude Code was wrong or needed correction

* **Initial framework choice.** Claude initially picked NestJS for the DI/validation/scheduler ergonomics. The choice was defensible but spec said *"Node.js with Express"*. I caught this in the audit and asked for a behaviour-preserving rewrite — Claude planned and executed the 9-phase swap without breaking any of the 14 e2e tests.
* **Type-safety shortcuts.** The first cut of `excludePassword(user)` cast `User` directly to `Record<string, unknown>` — TypeScript rejected it (`error TS2352: convert to unknown first`). Claude fixed it as `as unknown as Record<…>` only after the Docker build surfaced the error; I had to nudge the agent toward the `unknown` intermediate cast rather than just `as any`.
* **CD smoke test flakiness.** Claude's first CD pipeline tried to spin a real Postgres + backend container in the smoke job and curl `/health`. It was flaky (cold-start + migration race in CI). I pushed back and we replaced it with a `verify-images` job that just `docker pull`s + `docker inspect`s — narrower scope, deterministic, still valuable.
* **Yarn workspace duplicate Vite types.** The agent's frontend `build` script kept `tsc -b && vite build`. In CI that triggered the well-known yarn-1 hoisting issue (two `vite` copies, two `Plugin<any>` types). Claude only got the right fix (drop `tsc -b` from `build`, move type-checking into a separate `typecheck` script) after I fed back the actual error.
* **Seeder idempotency.** First seeder unconditionally inserted `demo@example.com` and crashed loudly on container restart. We added a `SELECT 1 FROM users WHERE email='demo@example.com'` guard at the top — the kind of safety check Claude doesn't reach for unprompted.

### What I did NOT let Claude Code do, and why

* **Pick the auth storage mechanism.** Claude was happy to leave the JWT in `localStorage` via Zustand's `persist` middleware. That's XSS-exposed; in production it should be an httpOnly cookie. I held that decision because it spans backend (set-cookie + CORS credentials) *and* frontend (no axios bearer header) *and* deployment (cookie domain), and getting the security model right is a human call. Documented as M1 in [`docs/superpowers/reviews/2026-04-25-three-lens-audit.md`](docs/superpowers/reviews/2026-04-25-three-lens-audit.md).
* **Decide what counts as "production-ready".** When the audit produced 7 architectural concerns, I — not the agent — decided which fall in Sprint 0 (must-fix), Sprint 1 (production hardening), and Sprint 2 (multi-instance scale, requires new infra). The agent will happily implement *anything*; choosing the boundary of "good enough for a code challenge" vs "good enough for revenue" is mine.
* **Add new dependencies without a justification I'd accept.** The agent suggested `tsyringe` for DI, BullMQ for the queue, Redis for distributed scheduler lock, Prometheus for metrics. Each was reasonable; I rejected all of them because they bring infra weight that exceeds the spec ask. The audit doc records *why* they're not in scope.
* **Write this "How I used Claude Code" section unsupervised.** It's a self-report — letting the agent draft it without correction would be circular. I wrote/edited the prose; the agent helped with structure and provided notes from its own task history.
* **Touch destructive operations without confirmation.** `git reset --hard`, `rm -rf` outside scratch dirs, force-push, dropping a database — the agent has tools to do all of these and was instructed not to. Where it did delete files (e.g., wiping NestJS sources before rewrite), I confirmed each step in chat first.

Implementation plan + spec + reviews are committed under [`docs/superpowers/`](docs/superpowers/) for full audit trail.
