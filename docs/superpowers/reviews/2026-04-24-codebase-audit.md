# Mini Campaign Manager — Codebase Audit

**Ngày audit:** 2026-04-24
**Scope:** Toàn bộ monorepo (`apps/backend`, `apps/frontend`, `packages/shared-types`, Docker, docs)
**Đối chiếu với:** Đề bài S5 Tech Full-Stack Code Challenge (cả phiên bản 1 và bản cập nhật có `sending` state + `/recipients`)

---

## 1. Tóm tắt điều hành

| Khía cạnh | % hoàn thành | Đánh giá |
|---|---|---|
| **Backend — functional spec** | **100%** | Toàn bộ 12 endpoints, 4 models, tất cả business rules được enforce. |
| **Backend — tech spec** | **90%** | Dùng NestJS thay vì Express thuần — có document & justify trong README. Mọi yêu cầu khác đạt. |
| **Frontend — functional spec** | **95%** | 4/4 trang, status badge màu, pagination, stats progress bar, conditional actions, skeleton loading. |
| **Frontend — tech spec** | **85%** | Zustand + React Query (đề bài chấp nhận Zustand hoặc Redux). Thiếu schema validation (zod) cho form, không có confirm dialog trên Send. |
| **Documentation & submission** | **100%** | README đầy đủ, docker-compose 1-command, seed data, section "How I Used Claude Code" chi tiết. |
| **Architecture / Clean Code** | **85%** | Layering rõ ràng, DI, centralized error, atomic state transitions. Thiếu Repository layer, lint/CI, error boundary FE. |
| **Testing** | **80%** | 8 e2e tests meaningful (vượt yêu cầu ≥3). Chưa cover `/recipients`, `DELETE /campaigns/:id`, FE không có test. |
| **UI/UX** | **80%** | Design system consistent (shadcn/ui), dark mode, responsive, toast. Thiếu confirm Send, field-level error, aria-*, optimistic update. |

**Tổng thể: ~90% so với đề bài. Submission-ready.**

---

## 2. Coverage theo từng yêu cầu của đề bài

### 2.1 Backend endpoints

| Endpoint | Trạng thái | File |
|---|---|---|
| `POST /auth/register` | ✅ | `apps/backend/src/auth/auth.controller.ts:10-14` |
| `POST /auth/login` | ✅ | `apps/backend/src/auth/auth.controller.ts:17-21` |
| `GET /campaigns` (pagination + status filter) | ✅ | `apps/backend/src/campaigns/campaigns.controller.ts:34-36` |
| `POST /campaigns` | ✅ | `…campaigns.controller.ts:39-43` |
| `GET /recipients` (pagination + search) | ✅ | `apps/backend/src/recipients/recipients.controller.ts:12-14` |
| `POST /recipients` (find-or-create) | ✅ | `…recipients.controller.ts:17-21` |
| `GET /campaigns/:id` (kèm stats + recipient list) | ✅ | `…campaigns.controller.ts:46-48` |
| `PATCH /campaigns/:id` (draft-only) | ✅ | `…campaigns.controller.ts:51-58` |
| `DELETE /campaigns/:id` (draft-only) | ✅ | `…campaigns.controller.ts:61-64` |
| `POST /campaigns/:id/schedule` | ✅ | `…campaigns.controller.ts:67-74` |
| `POST /campaigns/:id/send` | ✅ | `…campaigns.controller.ts:77-81` (202 Accepted, async) |
| `GET /campaigns/:id/stats` | ✅ | `…campaigns.controller.ts:84-88` |

**Kết luận:** 12/12. Stats shape đúng đề (`total, sent, failed, opened, open_rate, send_rate`) — xem `apps/backend/src/campaigns/stats.service.ts:18-39`.

### 2.2 Business rules

| Rule | Nơi enforce | Test phủ |
|---|---|---|
| Chỉ edit/delete khi `draft` | `campaigns.service.ts` (check 409) + `campaigns.lifecycle.service.ts:25-29` | `test/campaigns.e2e-spec.ts` (PATCH non-draft → 409) |
| `scheduled_at` phải là future | `campaigns.lifecycle.service.ts:17-19` | `test/campaigns.e2e-spec.ts` (past timestamp → 400) |
| Send là 1 chiều, idempotent, atomic | Atomic UPDATE `WHERE status IN ('draft','scheduled')` tại `campaigns.lifecycle.service.ts:34-39` + in-flight Set tại `send.simulator.ts:10` | Có — full flow test |
| Random sent/failed async | `send.simulator.ts:42-49` (setImmediate + 50–250ms delay + success rate) | Có — kiểm trạng thái cuối là `sent` |
| Ownership (user A không thấy campaign user B) | `WHERE createdBy = userId` trong mọi query | `test/campaigns.e2e-spec.ts` (cross-user → 404) |

**Kết luận:** 100% rules được enforce server-side với atomicity chuẩn (tránh được race condition trên concurrent send).

### 2.3 Schema & indexes

Tables: `users`, `recipients`, `campaigns`, `campaign_recipients` (composite PK, CASCADE theo spec).
Status enum đúng — `campaigns(draft|scheduled|sending|sent)`, `campaign_recipients(pending|sent|failed)`.

Indexes hợp lý:
- `users(email)` unique
- `recipients(email)` unique
- `campaigns(created_by, status)` — phục vụ list-by-owner + filter status
- `campaigns(scheduled_at) WHERE status='scheduled'` (partial index) — cho cron scanner
- `campaign_recipients(campaign_id, status)` — cho stats query (`COUNT FILTER`)
- `campaign_recipients(recipient_id)` — cho recipient lookup ngược

ENUM tạo bằng `DO $$ BEGIN IF NOT EXISTS … $$` block → idempotent migration (chạy lại không vỡ). Pattern tốt.

### 2.4 Frontend pages

| Page | Trạng thái | Ghi chú |
|---|---|---|
| `/login` | ✅ | Form login + register toggle. Tồn tại **pre-filled demo creds** (`LoginPage.tsx:13-15`) — nên xoá trước submit. |
| `/campaigns` | ✅ | Pagination (prev/next), skeleton loading, status badge color-coded, empty state. **Không có infinite scroll** — nhưng đề bài cho phép "pagination HOẶC infinite scroll". |
| `/campaigns/new` | ✅ | Form name/subject/body/recipientEmails. Có validate email inline (`RecipientEmailsInput.tsx`). |
| `/campaigns/:id` | ✅ | Stats progress bars, recipient list, action buttons conditional. **Polling live 1s khi status=sending** → dừng khi `sent`. Minh chứng: `useCampaigns.ts:34` + thấy trong `CampaignDetailPage.tsx`. |

### 2.5 UI features yêu cầu

| Feature | Trạng thái |
|---|---|
| Status badge color-coded (grey/blue/green) | ✅ `StatusBadge.tsx` — kèm amber+pulse cho `sending` |
| Conditional action buttons (Schedule/Send/Delete) | ✅ `CampaignDetailPage.tsx:99-110` |
| Stats display (progress bar/chart) | ✅ `StatsDisplay.tsx` progress bar |
| Error handling meaningful | ⚠️ Chỉ toast, chưa có **field-level errors** và **error boundary** |
| Loading states (skeleton/spinner) | ✅ Skeleton trên list và detail; button disabled + text change ("Sending…", "Scheduling…") |

---

## 3. Architecture & Clean Code

### 3.1 Điểm mạnh

1. **Monorepo đúng chuẩn.** Yarn workspaces + `@mcm/shared-types` thật sự chia sẻ type giữa FE/BE — 1 source of truth, không drift.
2. **Layer phân chia rõ ràng trên backend:** `controller` → `service` → `model`. Không có controller gọi trực tiếp Sequelize. Có tách `CampaignsService` (CRUD) vs `CampaignsLifecycleService` (state machine) — single-responsibility tốt.
3. **Atomic state transitions.** Pattern `UPDATE … WHERE status = 'draft' RETURNING` → nếu count=0 check tồn tại rồi throw 409. Tránh hoàn toàn race condition của read-then-write.
4. **Centralized error handling.** `AllExceptionsFilter` + `AppError` + `ErrorCodes` enum → shape `{ error: { code, message, details? } }` đồng nhất toàn hệ thống. FE dễ consume.
5. **Env validation.** `class-validator` + `ConfigModule.forRoot({ validate })` → app fail fast khi thiếu `JWT_SECRET`, `DATABASE_URL`.
6. **Config production-ready.** Docker compose có healthcheck postgres, backend đợi DB ready rồi migrate + seed trước khi start. Frontend build qua multi-stage Dockerfile serve bằng nginx.
7. **DI & testing.** NestJS DI cho phép `Test.createTestingModule({ imports: [AppModule] })` chạy integration test chạm DB thật — test không dùng mock, bắt được lỗi migration.

### 3.2 Vấn đề kiến trúc / điểm cần cải thiện

| # | Vấn đề | Mức độ | Khuyến nghị |
|---|---|---|---|
| 1 | **Dùng NestJS thay vì Express thuần** — đề bài yêu cầu Express | Trung bình | Đã justify trong README (line 119). Nếu reviewer khắt khe thì cần đổi; nếu không thì OK vì NestJS chạy trên Express adapter và vượt rõ Express về structure. |
| 2 | **Không có Repository layer** — Service trực tiếp gọi Sequelize model | Thấp | Chấp nhận được cho scale hiện tại. Khi scale lớn thì tách `ICampaignRepository` để test dễ mock. |
| 3 | **Không có lint / Prettier / CI** | Trung bình | Tạo `.eslintrc.json` + `.prettierrc` + `.github/workflows/ci.yml` (lint + test + build). Reviewer sẽ đánh giá cao điểm này. |
| 4 | **Không có rate limit** cho `/auth/*` | Trung bình | Thêm `@nestjs/throttler` — 5 req/min cho register/login. Chống brute force. |
| 5 | **Không có refresh token flow** | Thấp | JWT hiện expire thì user bị logout — chấp nhận được cho challenge. |
| 6 | **FE không có Error Boundary** | Trung bình | Thêm `react-error-boundary` bọc routes — tránh white screen khi render crash. |
| 7 | **FE không có form schema (zod)** | Trung bình | Thêm `zod` + `react-hook-form` cho `LoginPage` và `CampaignNewPage` → field-level error + type-safe parse. |
| 8 | **LoginPage hardcode demo credentials** (`demo@example.com` / `password123`) | Trung bình | Xoá trước khi submit. Nếu muốn convenience thì gói sau `import.meta.env.DEV`. |
| 9 | **Send button không có confirm dialog** trong khi Delete có | Thấp | Thêm `confirm('Send campaign to N recipients?')` ở `CampaignDetailPage.tsx:31`. Send là action không reversible nên cần confirm. |
| 10 | **Không có optimistic update** trên mutations | Thấp | TanStack Query `onMutate` + `cancelQueries` + rollback — cho Send chuyển badge thành `sending` ngay. |
| 11 | **JWT lưu localStorage qua Zustand persist** | Thấp | Đề bài cho phép "in memory hoặc httpOnly cookie"; localStorage chấp nhận được nhưng XSS-exposed. Production nên chuyển httpOnly cookie. |
| 12 | **Không test `/recipients/*` và `DELETE /campaigns/:id`** | Thấp | Thêm 2 spec ngắn — dưới 30 LOC mỗi cái. |

### 3.3 Solution architecture scorecard

| Tiêu chí | Điểm (1–5) | Lý do |
|---|---|---|
| Module boundaries (backend) | 4.5 | Tách `CampaignsService` vs `CampaignsLifecycleService` rất tốt. SendSimulator đứng riêng. |
| Module boundaries (frontend) | 4 | Pages → hooks → lib; không có page nào gọi axios trực tiếp. Thiếu barrel exports. |
| Monorepo sharing | 5 | `shared-types` dùng đúng cách cả 2 phía. |
| Error handling | 5 | Filter + AppError + uniform shape. Top-tier. |
| Async processing | 5 | Atomic guard, in-flight set, cron idempotent. Scale yếu (in-process only) nhưng có điểm seam BullMQ/SQS. |
| Config management | 4.5 | Env validated. Thiếu `.env.example` cho FE. |
| Test strategy | 4 | E2E thật sự chạm DB — bắt lỗi migration. Nhưng chỉ cover backend. |
| Code quality gates | 2 | Thiếu lint/prettier/husky/CI. |

**Tổng điểm kiến trúc: 4.25/5** — chuẩn senior-level cho project scope này.

---

## 4. UI/UX assessment

### Điểm mạnh
- **Design system nhất quán.** shadcn/ui + Tailwind tokens + dark mode CSS variables. Không có inline style, không có color magic.
- **Visual hierarchy rõ.** Title `text-2xl font-semibold`, secondary `text-muted-foreground`, stat numbers nổi bật.
- **Loading UX.** Skeleton đúng chỗ (list + detail), button disabled + text đổi khi pending → không bị double-submit.
- **Micro-interaction.** `hover:bg-accent/40 transition-colors` trên card, `animate-pulse` trên badge sending.
- **Live update.** Polling conditional (1s khi sending, stop khi sent) — tiết kiệm network, feel real-time.
- **Responsive.** Grid `md:grid-cols-4`, flex-wrap header, max-width containers — mobile OK.

### Điểm yếu (ưu tiên fix)

1. **Send không có confirm dialog** (in khi Delete có) — action gửi ra N recipients mà 1 click thẳng. Phải fix.
2. **Hardcoded credentials trên Login page** — cần xoá hoặc bọc `DEV`.
3. **Không có field-level error** — nhập sai thì chỉ toast chung chung, không chỉ rõ field nào sai.
4. **Không có ARIA** (`aria-busy`, `aria-live`) cho loading state → screen reader không nhận biết được app đang load.
5. **Không có retry button** khi API fail — user chỉ thấy toast biến mất.
6. **Không có empty state** cho recipients panel khi danh sách rỗng.
7. **Không có toast khi campaign vừa tạo xong** — chỉ navigate về `/campaigns/:id`; nên `toast.success('Campaign created')`.

---

## 5. Top 10 action items nên làm trước khi submit

Xếp theo ROI cao → thấp:

1. ✅ **Xoá hardcoded demo credentials** trong `LoginPage.tsx:13-15` (hoặc bọc `if (import.meta.env.DEV)`). *5 phút, impact: chuyên nghiệp hơn.*
2. ✅ **Thêm confirm dialog trên Send button.** *10 phút, fix inconsistency với Delete.*
3. ✅ **Thêm ESLint + Prettier + GitHub Actions CI** (lint + test + build). *30 phút, reviewer sẽ thấy project có code quality gates.*
4. ✅ **Thêm rate limit cho `/auth/register` và `/auth/login`** bằng `@nestjs/throttler`. *15 phút.*
5. ✅ **Thêm test cho `/recipients` POST/GET và `DELETE /campaigns/:id`** — đủ 3 spec case mỗi nhóm. *30 phút.*
6. ✅ **Thêm zod schema + react-hook-form** cho LoginPage và CampaignNewPage — field-level errors. *45 phút.*
7. ✅ **Thêm react-error-boundary** bọc routes + fallback UI. *20 phút.*
8. ⚠️ **Xem lại lựa chọn NestJS vs Express** — nếu reviewer đánh giá strict theo spec, cân nhắc rewrite AppModule sang Express + thư viện tương đương. Đã có justify tốt trong README, rủi ro thấp nhưng cần tính toán.
9. ✅ **Thêm optimistic update** cho Send mutation — badge đổi sang `sending` trước khi server confirm. *20 phút.*
10. ✅ **Thêm `.env.example` cho frontend** + document `VITE_API_URL`. *5 phút.*

Tổng thời gian ước tính: ~3 tiếng để kéo dự án từ 90% → 97%.

---

## 6. Kết luận

Dự án **chất lượng cao, submission-ready ở mức 90%**. Điểm mạnh nổi bật là (a) kiến trúc layer rõ ràng, (b) xử lý state machine atomic đúng kỹ thuật, (c) monorepo + shared-types chuẩn mực, (d) README rất kỹ kèm section "How I Used Claude Code" với dẫn chứng cụ thể.

Điểm trừ lớn nhất cần cân nhắc: **dùng NestJS trong khi đề bài yêu cầu Express thuần** — nhưng đã có document giải thích trong README và chạy trên Express adapter. Các gap còn lại là polish (confirm Send, zod form, lint/CI, test rộng hơn) — đều không phải critical miss mà là các điểm tăng điểm đánh giá từ "đạt" lên "xuất sắc".

So với checklist evaluation criteria của đề bài:
- Backend correctness: **xuất sắc**
- API design: **xuất sắc**
- Frontend quality: **khá tốt, còn polish**
- Code quality: **tốt, thiếu lint gate**
- AI collaboration: **xuất sắc** (README documentation rõ ràng, có chứng cứ cụ thể nơi Claude suggest đúng và nơi agent swap framework giữa flight)
- Testing: **đạt và có phần vượt**
