# Three-Lens Audit: Mini Campaign Manager (Express version)

**Date:** 2026-04-25
**Scope:** `apps/backend`, `apps/frontend`, `packages/shared-types`, infra (Docker, CI)
**Lenses:** System Design • Clean Code • Solution Architecture
**Method:** 3 parallel reviewer agents, each focused on one lens

---

## Unified scorecard

| Lens | Score | Top-line verdict |
|---|---|---|
| **System Design** | 70/100 | Single-instance MVP-grade; 7 production concerns to address before scale |
| **Clean Code** | 72/100 | Clean composition + good error handling; type-safety gaps and 1 oversize page component |
| **Solution Architecture** | 80/100 | Clear layering + composition root + shared-types win; gaps are observability + secrets management |
| **Aggregate** | **~75/100** | Solid for MVP/challenge submission; would need 1-2 sprints to harden for production |

---

## Cross-cutting concerns (all 3 reviewers agreed)

### 🔴 HIGH severity (must fix before any prod deploy)

| # | Concern | Lens | Files |
|---|---|---|---|
| H1 | **Hardcoded JWT secret in docker-compose.yml** (`dev-secret-change-me`) | Architecture | `docker-compose.yml:31` |
| H2 | **Multi-instance scheduler duplication** — cron ticks on every instance, in-flight Set is in-process only | System Design | `scheduler.ts:18-44`, `send.simulator.ts:7` |
| H3 | **Stuck `sending` state on process crash** — no auto-recovery | System Design | `campaigns.lifecycle.service.ts:29-44` (no startup reset) |
| H4 | **`as any` type assertions (9 instances)** in Sequelize create/bulkCreate calls | Clean Code | `auth.service.ts:24,25,46`, `campaigns.service.ts:75,85,110`, `recipients.service.ts:24,37` |

### 🟡 MEDIUM severity (polish before review submission)

| # | Concern | Lens | Files |
|---|---|---|---|
| M1 | **JWT in localStorage** — XSS exposed; no CSRF | System Design | `apps/frontend/src/stores/authStore.ts:12-22` |
| M2 | **No correlation ID** for cross-request tracing | Architecture | `app.ts:60-68` (pino-http only) |
| M3 | **Rate limit only on `/auth`** — missing on POST `/campaigns/*`, `/recipients` | System Design | `app.ts:78-82` |
| M4 | **CampaignDetailPage 170 LOC** — too many responsibilities | Clean Code | `apps/frontend/src/pages/CampaignDetailPage.tsx` |
| M5 | **`requireUser()` duplicated 6x** in campaigns router | Clean Code | `campaigns.router.ts:22-25` (each endpoint) |
| M6 | **No timeout on drain**() during shutdown | System Design | `main.ts:23` |
| M7 | **Stats query O(n) with no caching** — full table scan per request | System Design | `stats.service.ts:22-38` |
| M8 | **No backend healthcheck in docker-compose** | Architecture | `docker-compose.yml:19-36` |
| M9 | **Error handler unsafe cast** `err as { name?, message? }` | Clean Code | `error-handler.middleware.ts:22` |

### 🟢 LOW severity (nice-to-have, not blocking)

| # | Concern | Lens |
|---|---|---|
| L1 | `crModel` cryptic abbreviation → `campaignRecipientModel` | Clean Code |
| L2 | Cron string `'*/30 * * * * *'` magic string → constant | Clean Code |
| L3 | Hardcoded test emails `a@t.io`, `b@t.io` → factory | Clean Code |
| L4 | `/health` không ping DB | System Design |
| L5 | Password exclusion duplicated 2x → helper | Clean Code |
| L6 | Missing barrel exports (`index.ts`) | Clean Code |
| L7 | Tight coupling SendSimulator → CampaignRecipient model (no Repository) | Architecture |

---

## Strengths (top 5, cả 3 reviewers cùng đồng thuận)

1. **Composition Root pattern** rõ ràng tại `app.ts:38-87` — manual DI wiring, no reflection magic, dependency direction strict downward
2. **Atomic state machine** với pattern `UPDATE … WHERE status = … RETURNING` ở `campaigns.lifecycle.service.ts:21-26, 34-39` — race-condition safe, đã verified bằng concurrent test
3. **shared-types package** thật sự được share FE+BE — single source of truth cho DTOs, zero drift
4. **Test coverage end-to-end** với Postgres thật (no mocks at DB boundary) — bắt được lỗi migration + state machine
5. **Error handling centralized** với uniform shape `{ error: { code, message, details? } }` — chain order đúng (AppError → ZodError → Sequelize → fallback)

---

## Action plan ưu tiên theo ROI

### Sprint 0 — Pre-submission polish (3-4h)
Mục tiêu: lên submission-ready 95% → 98%.

| Task | Effort | Impact |
|---|---|---|
| Extract `requireUser()` thành middleware (M5) | 15 phút | Clean Code +5% |
| Move hardcoded secret từ docker-compose sang `.env` (H1) | 15 phút | Security critical |
| Fix `as any` ở Sequelize bằng `InferAttributes`/`InferCreationAttributes` (H4) | 1-2h | TypeScript +15% |
| Add timeout cho drain() (M6) — `Promise.race([drain(), timeout(30s)])` | 10 phút | Reliability |
| Add backend healthcheck vào docker-compose (M8) | 15 phút | Deployability |
| Extract magic numbers/strings (L2, L5) | 20 phút | Clean Code |

### Sprint 1 — Production hardening (1 tuần)
Mục tiêu: ready cho deploy single-instance production.

| Task | Effort | Impact |
|---|---|---|
| Restart resilience: reset stale `sending` campaigns on boot (H3) | 2h | Reliability critical |
| Move JWT to httpOnly cookie + CSRF token (M1) | 4h | Security |
| Per-user rate limit trên protected routes (M3) | 2h | DoS protection |
| Correlation ID middleware + log mọi request với reqId (M2) | 3h | Observability |
| Health endpoint ping DB + return 503 nếu down (L4) | 30 phút | Deployability |
| Refactor CampaignDetailPage thành 3-4 sub-components (M4) | 2h | Maintainability |
| Stats caching 5s TTL với LRU (M7) | 1h | Performance |

### Sprint 2 — Multi-instance ready (1-2 tuần)
Mục tiêu: ready cho horizontal scaling.

| Task | Effort | Impact |
|---|---|---|
| Distributed scheduler lock (Redis SETNX or PG advisory lock) (H2) | 1 ngày | Critical |
| Replace `setImmediate` simulator bằng BullMQ + Redis | 2-3 ngày | Async correctness |
| Rate limit store ngoài (Redis) thay in-memory | 0.5 ngày | Multi-instance |
| Add Prometheus metrics (campaign send latency, queue depth, error rate) | 1 ngày | Observability |
| Add OpenTelemetry tracing (request → service → DB) | 1 ngày | Debugging |

### Sprint 3+ — Enterprise / scale (optional)
- Repository pattern (Sequelize behind interface) cho test mocking dễ
- Move secrets to AWS Secrets Manager / HashiCorp Vault với rotation
- Replace Sequelize cli với typed migration tool (e.g. drizzle, kysely)
- A/B testing infrastructure
- Multi-tenancy (recipients per-org instead of global pool)

---

## Production readiness verdict (consolidated)

| Scenario | Verdict |
|---|---|
| **Code challenge submission** | ✅ Ready ngay (~95% spec, có 2 lens give it ≥70/100) |
| **Internal tool / single-team** | ✅ Ready với Sprint 0 fixes |
| **Single-instance production** | ⚠️ Cần Sprint 1 fixes (hardcoded secret, JWT cookie, rate limit, restart resilience, observability) |
| **Multi-instance horizontal scale** | ❌ Cần Sprint 2 (distributed lock, queue, shared rate-limit store) |
| **Public SaaS / enterprise** | ❌ Cần Sprint 3+ (multi-tenant, secrets vault, tracing/APM) |

---

## Architecture diagram (consolidated)

```
┌────────────────────────────────────────────────────────────────────┐
│                        Browser (React 18)                          │
│  Pages → Hooks (TanStack Query) → API client (axios)               │
│  Zustand persist → localStorage[token]    ← M1 risk (XSS exposed) │
└────────────────────────────┬───────────────────────────────────────┘
                             │ JSON over HTTP, Bearer JWT
                             ▼
┌────────────────────────────────────────────────────────────────────┐
│                Express App (single Node.js process)                │
│ ┌─────────────────────────────────────────────────────────────┐   │
│ │ helmet → cors → json(1mb) → pino-http                       │   │
│ │ ↓                                                           │   │
│ │ /health (open)   /auth + rateLimit (5/60s) + zod validate   │   │
│ │ /recipients + authMiddleware + zod                          │   │
│ │ /campaigns + authMiddleware + zod                           │   │
│ │ ↓                                                           │   │
│ │ Service layer (constructor injection, no DI lib):           │   │
│ │   AuthService                                               │   │
│ │   RecipientsService                                         │   │
│ │   CampaignsService ── StatsService                          │   │
│ │   CampaignsLifecycleService ── SendSimulator (in-flight Set)│   │
│ │   CampaignsScheduler (node-cron, every 30s)                 │   │
│ │ ↓                                                           │   │
│ │ Sequelize ORM (sequelize-typescript decorators)             │   │
│ │ ↓                                                           │   │
│ │ Error handler (AppError → ZodError → SQL → fallback)        │   │
│ └─────────────────────────────────────────────────────────────┘   │
│                                                                    │
│ setImmediate ──► loop pending recipients (50-250ms each)           │
│ drain() on SIGTERM ◄── wait for in-flight tasks                    │
└────────────────────────────┬───────────────────────────────────────┘
                             │ pg connection pool (default 5)
                             ▼
┌────────────────────────────────────────────────────────────────────┐
│ PostgreSQL 16 (single instance)                                    │
│  users  | campaigns | recipients | campaign_recipients (composite) │
│  Indexes: campaigns(created_by,status), campaigns(scheduled_at)    │
│           campaign_recipients(campaign_id,status)                  │
│           campaign_recipients(recipient_id)                        │
└────────────────────────────────────────────────────────────────────┘
```

**Single-process limitations highlighted:** in-flight Set không share, scheduler duplicate, rate-limit store in-memory → multi-instance breaks 3 cách.

---

## Sources

- System Design review (full): `docs/superpowers/reviews/2026-04-25-system-design-detail.md` (mặc định trong báo cáo này)
- Clean Code review (full): same
- Architecture review (full): same
- Spec: `docs/superpowers/specs/2026-04-25-backend-express-rewrite-design.md`
- Plan: `docs/superpowers/plans/2026-04-25-backend-express-rewrite.md`
- Previous audit (NestJS version): `docs/superpowers/reviews/2026-04-24-codebase-audit.md`
