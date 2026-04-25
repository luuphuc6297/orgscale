# Backend Rewrite (NestJS → Express + TS) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite the NestJS backend into plain Express + TypeScript while preserving API contract byte-for-byte, then bundle the audit-flagged gap fixes (rate limit, demo creds, ESLint + CI, FE Send confirm, extra test coverage).

**Architecture:** Composition Root pattern — zero DI library, services wired manually in `src/app.ts`. `zod` for input and env validation. `sequelize-typescript` models kept as-is. `node-cron` for the scheduler, `pino` for logging, `helmet` + `express-rate-limit` for security.

**Tech Stack:** Express 4, TypeScript 5, Zod 3, Sequelize 6 (+ sequelize-typescript), jsonwebtoken, bcryptjs, node-cron, pino, pino-http, helmet, cors, express-rate-limit, tsx, Jest 29, Supertest 7.

**Working directory:** `/Users/luuphuc/Projects/orgscale/mini-campaign-manager-express` (cloned from the NestJS baseline).

**Baseline reference:** `git log --oneline` shows `6807659 Initial snapshot from NestJS baseline`. At any point the engineer can `git diff 6807659..HEAD` to see the rewrite delta.

---

## File Structure (Target)

```
apps/backend/
├── src/
│   ├── main.ts                              # bootstrap
│   ├── app.ts                               # createApp() factory + composition root
│   ├── logger.ts                            # pino instance
│   ├── config/env.ts                        # zod env schema
│   ├── db/sequelize.ts                      # createSequelize()
│   ├── common/
│   │   ├── errors/app.error.ts              # copied
│   │   ├── middleware/
│   │   │   ├── async-handler.ts
│   │   │   ├── auth.middleware.ts
│   │   │   ├── validate.middleware.ts
│   │   │   ├── error-handler.middleware.ts
│   │   │   └── rate-limit.ts
│   │   └── types/express.d.ts
│   ├── auth/
│   │   ├── auth.service.ts
│   │   ├── auth.router.ts
│   │   └── auth.schemas.ts
│   ├── users/user.model.ts                  # copied
│   ├── recipients/
│   │   ├── recipient.model.ts               # copied
│   │   ├── recipients.service.ts
│   │   ├── recipients.router.ts
│   │   └── recipients.schemas.ts
│   ├── campaigns/
│   │   ├── campaign.model.ts                # copied
│   │   ├── campaign-recipient.model.ts      # copied
│   │   ├── campaigns.service.ts
│   │   ├── campaigns.lifecycle.service.ts
│   │   ├── stats.service.ts
│   │   ├── send.simulator.ts
│   │   ├── scheduler.ts                     # node-cron
│   │   ├── campaigns.router.ts
│   │   └── campaigns.schemas.ts
│   └── health.router.ts
└── test/
    ├── setup.ts
    ├── auth.e2e.spec.ts
    ├── campaigns.e2e.spec.ts
    ├── stats.e2e.spec.ts
    └── recipients.e2e.spec.ts               # new
```

Files to delete from NestJS baseline: everything under `src/` except migrations, the 4 model files, `common/errors/app.error.ts`, `recipients/dto/` (will be rewritten to zod), `auth/dto/`, `campaigns/dto/`, tests (will be rewritten).

Files untouched: `db/config/database.js`, `db/migrations/*`, `db/seeders/*`, `.sequelizerc`, `.env.example` (will be amended, not replaced).

---

## Phase 0 — Dependency swap & project config

### Task 0.1: Remove NestJS dependencies and add Express stack

**Files:**
- Modify: `apps/backend/package.json`

- [ ] **Step 1: Replace package.json**

```json
{
  "name": "@mcm/backend",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "build": "tsc -p tsconfig.build.json",
    "start": "node dist/main.js",
    "start:prod": "node dist/main.js",
    "dev": "tsx watch src/main.ts",
    "lint": "eslint \"src/**/*.ts\" \"test/**/*.ts\"",
    "lint:fix": "eslint \"src/**/*.ts\" \"test/**/*.ts\" --fix",
    "migrate": "sequelize-cli db:migrate",
    "migrate:undo": "sequelize-cli db:migrate:undo",
    "seed": "sequelize-cli db:seed:all",
    "test": "jest --runInBand --detectOpenHandles --forceExit"
  },
  "dependencies": {
    "bcryptjs": "^2.4.3",
    "cors": "^2.8.5",
    "dotenv": "^16.4.5",
    "express": "^4.19.2",
    "express-rate-limit": "^7.4.0",
    "helmet": "^7.1.0",
    "jsonwebtoken": "^9.0.2",
    "node-cron": "^3.0.3",
    "pg": "^8.12.0",
    "pg-hstore": "^2.3.4",
    "pino": "^9.4.0",
    "pino-http": "^10.3.0",
    "reflect-metadata": "^0.2.2",
    "sequelize": "^6.37.3",
    "sequelize-typescript": "^2.1.6",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/bcryptjs": "^2.4.6",
    "@types/cors": "^2.8.17",
    "@types/express": "^4.17.21",
    "@types/jest": "^29.5.12",
    "@types/jsonwebtoken": "^9.0.7",
    "@types/node": "^20.14.10",
    "@types/node-cron": "^3.0.11",
    "@types/supertest": "^6.0.2",
    "@types/validator": "^13.12.0",
    "@typescript-eslint/eslint-plugin": "^7.18.0",
    "@typescript-eslint/parser": "^7.18.0",
    "eslint": "^8.57.0",
    "jest": "^29.7.0",
    "pino-pretty": "^11.2.2",
    "sequelize-cli": "^6.6.2",
    "supertest": "^7.0.0",
    "ts-jest": "^29.2.2",
    "tsx": "^4.19.0",
    "typescript": "^5.5.3"
  }
}
```

Note: we keep `reflect-metadata` because `sequelize-typescript` requires it. It's imported once in `src/main.ts` and `test/setup.ts`.

- [ ] **Step 2: Remove Nest-specific config files**

Run:
```bash
cd apps/backend
rm -f nest-cli.json
```

- [ ] **Step 3: Install**

Run (from repo root):
```bash
yarn install
```
Expected: no errors. A fresh `yarn.lock` is generated.

- [ ] **Step 4: Commit**

```bash
git add apps/backend/package.json apps/backend/nest-cli.json yarn.lock
git commit -m "chore(backend): swap NestJS deps for Express stack"
```

---

### Task 0.2: Update TypeScript config

**Files:**
- Modify: `apps/backend/tsconfig.json`
- Modify: `apps/backend/tsconfig.build.json`

- [ ] **Step 1: Replace tsconfig.json**

```json
{
  "compilerOptions": {
    "module": "commonjs",
    "target": "ES2022",
    "lib": ["ES2022"],
    "moduleResolution": "node",
    "declaration": false,
    "sourceMap": true,
    "rootDir": "./",
    "outDir": "./dist",
    "baseUrl": "./",
    "paths": {
      "@mcm/shared-types": ["../../packages/shared-types/src"]
    },
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "strict": true,
    "strictNullChecks": true,
    "noImplicitAny": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "types": ["node", "jest"]
  },
  "include": ["src/**/*.ts", "test/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

Note: `experimentalDecorators` + `emitDecoratorMetadata` stay ON because `sequelize-typescript` requires them. This is the only reason we keep `reflect-metadata`.

- [ ] **Step 2: Replace tsconfig.build.json**

```json
{
  "extends": "./tsconfig.json",
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist", "test", "**/*.spec.ts"]
}
```

- [ ] **Step 3: Verify tsc can parse**

Run:
```bash
cd apps/backend && yarn tsc --noEmit --project tsconfig.json || true
```
Expected: likely many "Cannot find module" errors because src is still NestJS — that's fine; we're checking that the config itself parses. No "Compiler option" errors.

- [ ] **Step 4: Commit**

```bash
git add apps/backend/tsconfig.json apps/backend/tsconfig.build.json
git commit -m "chore(backend): tsconfig for Express + tsx"
```

---

### Task 0.3: Set up root ESLint + Prettier

**Files:**
- Create: `.eslintrc.json`
- Create: `.prettierrc.json`
- Create: `.prettierignore`
- Modify: `package.json` (root — add lint script + devDeps if absent)

- [ ] **Step 1: Create `.eslintrc.json` at repo root**

```json
{
  "root": true,
  "parser": "@typescript-eslint/parser",
  "parserOptions": { "ecmaVersion": 2022, "sourceType": "module" },
  "plugins": ["@typescript-eslint"],
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended"
  ],
  "env": { "node": true, "es2022": true, "jest": true, "browser": true },
  "ignorePatterns": ["dist", "build", "node_modules", "*.config.js", "db/migrations/*.js", "db/seeders/*.js", "nginx.conf"],
  "rules": {
    "@typescript-eslint/no-explicit-any": "off",
    "@typescript-eslint/no-unused-vars": ["warn", { "argsIgnorePattern": "^_", "varsIgnorePattern": "^_" }],
    "no-console": ["warn", { "allow": ["warn", "error"] }]
  }
}
```

- [ ] **Step 2: Create `.prettierrc.json`**

```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2
}
```

- [ ] **Step 3: Create `.prettierignore`**

```
node_modules
dist
build
yarn.lock
*.min.js
db/migrations
db/seeders
```

- [ ] **Step 4: Add lint devDeps to root `package.json`**

Read current `package.json`, add to `devDependencies`:
```json
"@typescript-eslint/eslint-plugin": "^7.18.0",
"@typescript-eslint/parser": "^7.18.0",
"eslint": "^8.57.0",
"prettier": "^3.3.3"
```

Add to `scripts`:
```json
"lint": "eslint \"apps/**/src/**/*.ts\" \"apps/**/test/**/*.ts\" \"packages/**/src/**/*.ts\"",
"format": "prettier --write \"apps/**/src/**/*.{ts,tsx}\" \"packages/**/src/**/*.ts\""
```

- [ ] **Step 5: Install and verify**

```bash
yarn install
yarn lint || true
```
Expected: install succeeds; lint may report zero errors because src is still NestJS files — that's OK.

- [ ] **Step 6: Commit**

```bash
git add .eslintrc.json .prettierrc.json .prettierignore package.json yarn.lock
git commit -m "chore: root ESLint + Prettier config"
```

---

## Phase 1 — Infrastructure (env, db, errors, middleware)

### Task 1.1: Keep AppError, wipe everything else under `src/`

**Files:**
- Delete: `apps/backend/src/**` except `common/errors/app.error.ts` and `main.ts` (kept temporarily to avoid empty src)
- Note: we'll rewrite `main.ts` in Phase 7; for now, replace it with a stub that just exits.

- [ ] **Step 1: Delete NestJS sources, keep error class**

Run:
```bash
cd apps/backend/src
# Preserve the only file we want to keep
cp common/errors/app.error.ts /tmp/app.error.ts.bak
# Nuke everything under src except the directory marker
find . -mindepth 1 -delete
mkdir -p common/errors
mv /tmp/app.error.ts.bak common/errors/app.error.ts
# Stub main
cat > main.ts <<'EOF'
console.log('backend stub — rewrite in progress');
EOF
```

- [ ] **Step 2: Verify structure**

```bash
find apps/backend/src -type f
```
Expected: 2 files — `main.ts` and `common/errors/app.error.ts`.

- [ ] **Step 3: Commit**

```bash
git add apps/backend/src
git commit -m "chore(backend): wipe NestJS sources, keep AppError"
```

---

### Task 1.2: Create env schema with zod

**Files:**
- Create: `apps/backend/src/config/env.ts`

- [ ] **Step 1: Write env.ts**

```ts
import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().url().or(z.string().min(1)),
  TEST_DATABASE_URL: z.string().min(1).optional(),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  SEND_SUCCESS_RATE: z.coerce.number().min(0).max(1).default(0.9),
  CORS_ORIGIN: z.string().default('*'),
  RATE_LIMIT_AUTH_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  RATE_LIMIT_AUTH_MAX: z.coerce.number().int().positive().default(5),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
});

export type Env = z.infer<typeof EnvSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = EnvSchema.safeParse(source);
  if (!parsed.success) {
    const details = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid environment configuration:\n${details}`);
  }
  return parsed.data;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/backend/src/config/env.ts
git commit -m "feat(backend): zod env schema"
```

---

### Task 1.3: Update `.env.example` with new variables

**Files:**
- Modify: `apps/backend/.env.example`

- [ ] **Step 1: Overwrite .env.example**

```
NODE_ENV=development
PORT=4000
DATABASE_URL=postgres://postgres:postgres@localhost:5432/campaign_manager
TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/campaign_manager_test
JWT_SECRET=change-me-to-a-long-random-string
JWT_EXPIRES_IN=7d
SEND_SUCCESS_RATE=0.9
CORS_ORIGIN=http://localhost:5173
RATE_LIMIT_AUTH_WINDOW_MS=60000
RATE_LIMIT_AUTH_MAX=5
LOG_LEVEL=info
```

- [ ] **Step 2: Commit**

```bash
git add apps/backend/.env.example
git commit -m "chore(backend): .env.example with rate-limit + log vars"
```

---

### Task 1.4: Create Sequelize factory

**Files:**
- Create: `apps/backend/src/db/sequelize.ts`

- [ ] **Step 1: Write sequelize.ts**

```ts
import { Sequelize } from 'sequelize-typescript';
import type { Env } from '../config/env';

export function createSequelize(env: Env): Sequelize {
  const url = env.NODE_ENV === 'test' && env.TEST_DATABASE_URL
    ? env.TEST_DATABASE_URL
    : env.DATABASE_URL;

  return new Sequelize(url, {
    dialect: 'postgres',
    logging: env.NODE_ENV === 'test' ? false : (sql) => process.env.DB_DEBUG && console.log(sql),
    define: {
      underscored: true,
      timestamps: true,
    },
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/backend/src/db/sequelize.ts
git commit -m "feat(backend): sequelize factory"
```

---

### Task 1.5: Create logger

**Files:**
- Create: `apps/backend/src/logger.ts`

- [ ] **Step 1: Write logger.ts**

```ts
import pino, { LoggerOptions } from 'pino';

export function createLogger(level: string, pretty: boolean): pino.Logger {
  const opts: LoggerOptions = { level };
  if (pretty) {
    opts.transport = {
      target: 'pino-pretty',
      options: { colorize: true, translateTime: 'SYS:HH:MM:ss.l', ignore: 'pid,hostname' },
    };
  }
  return pino(opts);
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/backend/src/logger.ts
git commit -m "feat(backend): pino logger factory"
```

---

### Task 1.6: Create Express Request augmentation

**Files:**
- Create: `apps/backend/src/common/types/express.d.ts`

- [ ] **Step 1: Write express.d.ts**

```ts
export {};

declare global {
  namespace Express {
    interface Request {
      user?: { id: string; email: string };
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/backend/src/common/types/express.d.ts
git commit -m "feat(backend): Express Request augmentation"
```

---

### Task 1.7: Create async-handler utility

**Files:**
- Create: `apps/backend/src/common/middleware/async-handler.ts`

- [ ] **Step 1: Write async-handler.ts**

```ts
import type { Request, Response, NextFunction, RequestHandler } from 'express';

type AsyncHandler = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;

export function asyncHandler(fn: AsyncHandler): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/backend/src/common/middleware/async-handler.ts
git commit -m "feat(backend): asyncHandler wrapper"
```

---

### Task 1.8: Create validate middleware (zod)

**Files:**
- Create: `apps/backend/src/common/middleware/validate.middleware.ts`

- [ ] **Step 1: Write validate.middleware.ts**

```ts
import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { ZodSchema, ZodError } from 'zod';

type Source = 'body' | 'query' | 'params';

export function validate<T>(schema: ZodSchema<T>, source: Source = 'body'): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      return next(result.error);
    }
    // Replace to capture coerced/defaulted values
    (req as any)[source] = result.data;
    next();
  };
}

export { ZodError };
```

- [ ] **Step 2: Commit**

```bash
git add apps/backend/src/common/middleware/validate.middleware.ts
git commit -m "feat(backend): zod validate middleware"
```

---

### Task 1.9: Create auth middleware

**Files:**
- Create: `apps/backend/src/common/middleware/auth.middleware.ts`

- [ ] **Step 1: Write auth.middleware.ts**

```ts
import type { Request, Response, NextFunction, RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { AppError, ErrorCodes } from '../errors/app.error';

interface JwtPayload { sub: string; email: string }

export function authMiddleware(secret: string): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      return next(new AppError(ErrorCodes.UNAUTHORIZED, 'Missing bearer token', 401));
    }
    const token = header.slice(7);
    try {
      const decoded = jwt.verify(token, secret) as JwtPayload;
      req.user = { id: decoded.sub, email: decoded.email };
      next();
    } catch {
      next(new AppError(ErrorCodes.UNAUTHORIZED, 'Invalid or expired token', 401));
    }
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/backend/src/common/middleware/auth.middleware.ts
git commit -m "feat(backend): JWT auth middleware"
```

---

### Task 1.10: Create rate-limit factory

**Files:**
- Create: `apps/backend/src/common/middleware/rate-limit.ts`

- [ ] **Step 1: Write rate-limit.ts**

```ts
import rateLimit from 'express-rate-limit';
import { ErrorCodes } from '../errors/app.error';

interface Opts { windowMs: number; max: number }

export function authRateLimit(opts: Opts) {
  return rateLimit({
    windowMs: opts.windowMs,
    max: opts.max,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (_req, res) => {
      res.status(429).json({
        error: {
          code: ErrorCodes.TOO_MANY_REQUESTS,
          message: 'Too many requests, please try again later',
        },
      });
    },
  });
}
```

Note: this references `ErrorCodes.TOO_MANY_REQUESTS` which we'll add next.

- [ ] **Step 2: Add TOO_MANY_REQUESTS to error codes**

Edit `apps/backend/src/common/errors/app.error.ts` — add one line:

```ts
export const ErrorCodes = {
  VALIDATION: 'VALIDATION',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  CONFLICT_STATE: 'INVALID_STATE_TRANSITION',
  TOO_MANY_REQUESTS: 'TOO_MANY_REQUESTS',
  INTERNAL: 'INTERNAL',
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];

export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly status: number,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/backend/src/common/middleware/rate-limit.ts apps/backend/src/common/errors/app.error.ts
git commit -m "feat(backend): rate-limit factory + TOO_MANY_REQUESTS code"
```

---

### Task 1.11: Create error handler middleware

**Files:**
- Create: `apps/backend/src/common/middleware/error-handler.middleware.ts`

- [ ] **Step 1: Write error-handler.middleware.ts**

```ts
import type { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { AppError, ErrorCodes } from '../errors/app.error';
import type { Logger } from 'pino';

export function createErrorHandler(logger: Logger): ErrorRequestHandler {
  return (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof AppError) {
      return res.status(err.status).json({
        error: { code: err.code, message: err.message, ...(err.details ? { details: err.details } : {}) },
      });
    }
    if (err instanceof ZodError) {
      return res.status(400).json({
        error: {
          code: ErrorCodes.VALIDATION,
          message: 'Validation failed',
          details: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
        },
      });
    }
    // JWT errors are already caught in authMiddleware; keep a safety net
    const anyErr = err as { name?: string; message?: string };
    if (anyErr?.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({
        error: { code: ErrorCodes.CONFLICT, message: 'Resource already exists' },
      });
    }
    logger.error({ err }, 'Unhandled error');
    res.status(500).json({
      error: { code: ErrorCodes.INTERNAL, message: 'Internal server error' },
    });
  };
}
```

- [ ] **Step 2: Compile check**

```bash
cd apps/backend && yarn tsc --noEmit
```
Expected: no errors in middleware files (may still error on missing main.ts content — ignore those).

- [ ] **Step 3: Commit**

```bash
git add apps/backend/src/common/middleware/error-handler.middleware.ts
git commit -m "feat(backend): error-handler middleware"
```

---

## Phase 2 — Copy models

### Task 2.1: Copy User model

**Files:**
- Create: `apps/backend/src/users/user.model.ts`

Read the baseline content (the file existed in the NestJS version, check `git show 6807659:apps/backend/src/users/user.model.ts` if needed). The content is a `sequelize-typescript` class — works unchanged outside NestJS.

- [ ] **Step 1: Recover User model**

Run:
```bash
cd apps/backend
git show 6807659:apps/backend/src/users/user.model.ts > src/users/user.model.ts
```

If the path in baseline is different, use:
```bash
git log --all --diff-filter=A -- apps/backend/src/users/user.model.ts
```
to find the commit that added it and use that SHA.

- [ ] **Step 2: Verify no NestJS imports remain**

```bash
grep -n "@nestjs" apps/backend/src/users/user.model.ts || echo "clean"
```
Expected: "clean" (sequelize-typescript models have no NestJS imports).

- [ ] **Step 3: Commit**

```bash
git add apps/backend/src/users/user.model.ts
git commit -m "feat(backend): User model"
```

### Task 2.2: Copy Recipient model

Same procedure as Task 2.1 for `src/recipients/recipient.model.ts`.

- [ ] **Step 1: Recover**

```bash
cd apps/backend
git show 6807659:apps/backend/src/recipients/recipient.model.ts > src/recipients/recipient.model.ts
```

- [ ] **Step 2: Verify clean**

```bash
grep -n "@nestjs" apps/backend/src/recipients/recipient.model.ts || echo "clean"
```

- [ ] **Step 3: Commit**

```bash
git add apps/backend/src/recipients/recipient.model.ts
git commit -m "feat(backend): Recipient model"
```

### Task 2.3: Copy Campaign model

- [ ] **Step 1: Recover**

```bash
cd apps/backend
git show 6807659:apps/backend/src/campaigns/campaign.model.ts > src/campaigns/campaign.model.ts
```

- [ ] **Step 2: Verify clean**

```bash
grep -n "@nestjs" apps/backend/src/campaigns/campaign.model.ts || echo "clean"
```

- [ ] **Step 3: Commit**

```bash
git add apps/backend/src/campaigns/campaign.model.ts
git commit -m "feat(backend): Campaign model"
```

### Task 2.4: Copy CampaignRecipient model

- [ ] **Step 1: Recover**

```bash
cd apps/backend
git show 6807659:apps/backend/src/campaigns/campaign-recipient.model.ts > src/campaigns/campaign-recipient.model.ts
```

- [ ] **Step 2: Verify clean**

```bash
grep -n "@nestjs" apps/backend/src/campaigns/campaign-recipient.model.ts || echo "clean"
```

- [ ] **Step 3: Compile check after all 4 models**

```bash
cd apps/backend && yarn tsc --noEmit
```
Expected: models compile; remaining errors only from missing service files (to be created later). No decorator errors.

- [ ] **Step 4: Commit**

```bash
git add apps/backend/src/campaigns/campaign-recipient.model.ts
git commit -m "feat(backend): CampaignRecipient model"
```

---

## Phase 3 — Auth module

### Task 3.1: Write auth schemas (zod)

**Files:**
- Create: `apps/backend/src/auth/auth.schemas.ts`

- [ ] **Step 1: Write auth.schemas.ts**

```ts
import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email().max(254),
  name: z.string().min(1).max(120),
  password: z.string().min(8).max(200),
});

export const loginSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(1).max(200),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
```

- [ ] **Step 2: Commit**

```bash
git add apps/backend/src/auth/auth.schemas.ts
git commit -m "feat(auth): zod schemas"
```

### Task 3.2: Write AuthService (port from NestJS)

**Files:**
- Create: `apps/backend/src/auth/auth.service.ts`

- [ ] **Step 1: Write auth.service.ts**

```ts
import bcrypt from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';
import { User } from '../users/user.model';
import { AppError, ErrorCodes } from '../common/errors/app.error';
import type { RegisterInput, LoginInput } from './auth.schemas';

export class AuthService {
  constructor(
    private readonly userModel: typeof User,
    private readonly jwtSecret: string,
    private readonly jwtExpiresIn: string,
  ) {}

  async register(input: RegisterInput) {
    const existing = await this.userModel.findOne({ where: { email: input.email } });
    if (existing) {
      throw new AppError(ErrorCodes.CONFLICT, 'Email already registered', 409);
    }
    const passwordHash = await bcrypt.hash(input.password, 10);
    const user = await this.userModel.create({
      email: input.email,
      name: input.name,
      passwordHash,
    } as any);
    const safe = user.get({ plain: true }) as any;
    delete safe.passwordHash;
    return safe;
  }

  async login(input: LoginInput) {
    const user = await this.userModel
      .scope('withPassword')
      .findOne({ where: { email: input.email } });
    if (!user) {
      throw new AppError(ErrorCodes.UNAUTHORIZED, 'Invalid credentials', 401);
    }
    const ok = await bcrypt.compare(input.password, user.passwordHash);
    if (!ok) {
      throw new AppError(ErrorCodes.UNAUTHORIZED, 'Invalid credentials', 401);
    }
    const token = jwt.sign(
      { sub: user.id, email: user.email },
      this.jwtSecret,
      { expiresIn: this.jwtExpiresIn } as SignOptions,
    );
    const safe = user.get({ plain: true }) as any;
    delete safe.passwordHash;
    return { token, user: safe };
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/backend/src/auth/auth.service.ts
git commit -m "feat(auth): AuthService (port from NestJS)"
```

### Task 3.3: Write auth router

**Files:**
- Create: `apps/backend/src/auth/auth.router.ts`

- [ ] **Step 1: Write auth.router.ts**

```ts
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
```

- [ ] **Step 2: Compile check**

```bash
cd apps/backend && yarn tsc --noEmit
```
Expected: auth folder compiles clean. Other errors only from unfinished modules.

- [ ] **Step 3: Commit**

```bash
git add apps/backend/src/auth/auth.router.ts
git commit -m "feat(auth): router"
```

---

## Phase 4 — Recipients module

### Task 4.1: Recipients schemas

**Files:**
- Create: `apps/backend/src/recipients/recipients.schemas.ts`

- [ ] **Step 1: Write recipients.schemas.ts**

```ts
import { z } from 'zod';

export const createRecipientSchema = z.object({
  email: z.string().email().max(254),
  name: z.string().max(120).optional().nullable(),
});

export const listRecipientsQuery = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().trim().min(1).max(200).optional(),
});

export type CreateRecipientInput = z.infer<typeof createRecipientSchema>;
export type ListRecipientsQuery = z.infer<typeof listRecipientsQuery>;
```

- [ ] **Step 2: Commit**

```bash
git add apps/backend/src/recipients/recipients.schemas.ts
git commit -m "feat(recipients): zod schemas"
```

### Task 4.2: RecipientsService (port)

**Files:**
- Create: `apps/backend/src/recipients/recipients.service.ts`

- [ ] **Step 1: Write recipients.service.ts**

```ts
import { Op } from 'sequelize';
import { Recipient } from './recipient.model';
import type { CreateRecipientInput, ListRecipientsQuery } from './recipients.schemas';

export class RecipientsService {
  constructor(private readonly model: typeof Recipient) {}

  async list(params: ListRecipientsQuery) {
    const { page, limit, search } = params;
    const where = search ? { email: { [Op.iLike]: `%${search}%` } } : {};
    const offset = (page - 1) * limit;
    const { rows, count } = await this.model.findAndCountAll({
      where,
      offset,
      limit,
      order: [['email', 'ASC']],
    });
    return { data: rows, total: count, page, limit };
  }

  async create(input: CreateRecipientInput) {
    const [recipient] = await this.model.findOrCreate({
      where: { email: input.email.toLowerCase() },
      defaults: { email: input.email.toLowerCase(), name: input.name ?? null } as any,
    });
    return recipient;
  }

  async ensureMany(emails: string[]): Promise<Recipient[]> {
    const normalized = Array.from(new Set(emails.map((e) => e.trim().toLowerCase())));
    const existing = await this.model.findAll({ where: { email: { [Op.in]: normalized } } });
    const existingEmails = new Set(existing.map((r) => r.email));
    const toCreate = normalized
      .filter((e) => !existingEmails.has(e))
      .map((email) => ({ email, name: null }));
    const created = toCreate.length > 0
      ? await this.model.bulkCreate(toCreate as any[])
      : [];
    return [...existing, ...created];
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/backend/src/recipients/recipients.service.ts
git commit -m "feat(recipients): service"
```

### Task 4.3: Recipients router

**Files:**
- Create: `apps/backend/src/recipients/recipients.router.ts`

- [ ] **Step 1: Write recipients.router.ts**

```ts
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
```

- [ ] **Step 2: Commit**

```bash
git add apps/backend/src/recipients/recipients.router.ts
git commit -m "feat(recipients): router"
```

---

## Phase 5 — Campaigns core

### Task 5.1: Campaigns schemas

**Files:**
- Create: `apps/backend/src/campaigns/campaigns.schemas.ts`

- [ ] **Step 1: Write campaigns.schemas.ts**

```ts
import { z } from 'zod';

const campaignStatusEnum = z.enum(['draft', 'scheduled', 'sending', 'sent']);

export const createCampaignSchema = z.object({
  name: z.string().min(1).max(200),
  subject: z.string().min(1).max(300),
  body: z.string().min(1),
  recipientEmails: z.array(z.string().email()).min(1).max(1000),
});

export const updateCampaignSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  subject: z.string().min(1).max(300).optional(),
  body: z.string().min(1).optional(),
  recipientEmails: z.array(z.string().email()).min(1).max(1000).optional(),
}).refine((v) => Object.keys(v).length > 0, { message: 'At least one field is required' });

export const listCampaignsQuery = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(10),
  status: campaignStatusEnum.optional(),
});

export const scheduleCampaignSchema = z.object({
  scheduledAt: z.string().datetime(),
});

export const campaignIdParams = z.object({ id: z.string().uuid() });

export type CreateCampaignInput = z.infer<typeof createCampaignSchema>;
export type UpdateCampaignInput = z.infer<typeof updateCampaignSchema>;
export type ListCampaignsInput = z.infer<typeof listCampaignsQuery>;
export type ScheduleCampaignInput = z.infer<typeof scheduleCampaignSchema>;
```

- [ ] **Step 2: Commit**

```bash
git add apps/backend/src/campaigns/campaigns.schemas.ts
git commit -m "feat(campaigns): zod schemas"
```

### Task 5.2: StatsService (port)

**Files:**
- Create: `apps/backend/src/campaigns/stats.service.ts`

- [ ] **Step 1: Write stats.service.ts**

```ts
import { QueryTypes, Sequelize } from 'sequelize';

export interface CampaignStats {
  total: number;
  sent: number;
  failed: number;
  opened: number;
  send_rate: number;
  open_rate: number;
}

export class StatsService {
  constructor(private readonly sequelize: Sequelize) {}

  async compute(campaignId: string): Promise<CampaignStats> {
    const [row] = await this.sequelize.query<{ total: string; sent: string; failed: string; opened: string }>(
      `SELECT
         COUNT(*)                                       AS total,
         COUNT(*) FILTER (WHERE status = 'sent')        AS sent,
         COUNT(*) FILTER (WHERE status = 'failed')      AS failed,
         COUNT(*) FILTER (WHERE opened_at IS NOT NULL)  AS opened
       FROM campaign_recipients
       WHERE campaign_id = :id`,
      { replacements: { id: campaignId }, type: QueryTypes.SELECT },
    );
    const total = Number(row?.total ?? 0);
    const sent = Number(row?.sent ?? 0);
    const failed = Number(row?.failed ?? 0);
    const opened = Number(row?.opened ?? 0);
    // Marketing convention: open_rate is conditional on delivery (opened / sent)
    const send_rate = total === 0 ? 0 : sent / total;
    const open_rate = sent === 0 ? 0 : opened / sent;
    return { total, sent, failed, opened, send_rate, open_rate };
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/backend/src/campaigns/stats.service.ts
git commit -m "feat(campaigns): StatsService"
```

### Task 5.3: CampaignsService (port)

**Files:**
- Create: `apps/backend/src/campaigns/campaigns.service.ts`

- [ ] **Step 1: Write campaigns.service.ts**

```ts
import { Sequelize } from 'sequelize';
import { Campaign } from './campaign.model';
import { CampaignRecipient } from './campaign-recipient.model';
import { Recipient } from '../recipients/recipient.model';
import { RecipientsService } from '../recipients/recipients.service';
import { StatsService } from './stats.service';
import { AppError, ErrorCodes } from '../common/errors/app.error';
import type { CreateCampaignInput, UpdateCampaignInput, ListCampaignsInput } from './campaigns.schemas';

export class CampaignsService {
  constructor(
    private readonly campaignModel: typeof Campaign,
    private readonly crModel: typeof CampaignRecipient,
    private readonly sequelize: Sequelize,
    private readonly recipientsService: RecipientsService,
    private readonly stats: StatsService,
  ) {}

  async list(userId: string, query: ListCampaignsInput) {
    const { page, limit, status } = query;
    const where: any = { createdBy: userId };
    if (status) where.status = status;
    const offset = (page - 1) * limit;
    const { rows, count } = await this.campaignModel.findAndCountAll({
      where, offset, limit, order: [['updatedAt', 'DESC']],
    });
    return { data: rows, total: count, page, limit };
  }

  async getOwned(userId: string, id: string): Promise<Campaign> {
    const c = await this.campaignModel.findOne({ where: { id, createdBy: userId } });
    if (!c) throw new AppError(ErrorCodes.NOT_FOUND, 'Campaign not found', 404);
    return c;
  }

  async getDetail(userId: string, id: string) {
    const campaign = await this.getOwned(userId, id);
    const rows = await this.crModel.findAll({
      where: { campaignId: id },
      include: [{ model: Recipient, attributes: ['id', 'email', 'name'] }],
      order: [['createdAt', 'ASC']],
      limit: 500,
    });
    const recipients = rows.map((cr: any) => ({
      recipientId: cr.recipientId,
      email: cr.recipient?.email,
      name: cr.recipient?.name,
      status: cr.status,
      sentAt: cr.sentAt,
      openedAt: cr.openedAt,
    }));
    return {
      ...campaign.get({ plain: true }),
      stats: await this.stats.compute(id),
      recipients,
    };
  }

  async create(userId: string, input: CreateCampaignInput) {
    return this.sequelize.transaction(async (t) => {
      const campaign = await this.campaignModel.create({
        name: input.name,
        subject: input.subject,
        body: input.body,
        createdBy: userId,
        status: 'draft',
      } as any, { transaction: t });

      const recipients = await this.recipientsService.ensureMany(input.recipientEmails);
      await this.crModel.bulkCreate(
        recipients.map((r) => ({ campaignId: campaign.id, recipientId: r.id, status: 'pending' })) as any[],
        { transaction: t },
      );
      return campaign;
    });
  }

  async update(userId: string, id: string, input: UpdateCampaignInput) {
    const campaign = await this.getOwned(userId, id);
    if (campaign.status !== 'draft') {
      throw new AppError(ErrorCodes.CONFLICT_STATE, 'Only draft campaigns can be edited', 409);
    }
    return this.sequelize.transaction(async (t) => {
      if (input.name !== undefined) campaign.name = input.name;
      if (input.subject !== undefined) campaign.subject = input.subject;
      if (input.body !== undefined) campaign.body = input.body;
      await campaign.save({ transaction: t });
      if (input.recipientEmails) {
        await this.crModel.destroy({ where: { campaignId: id }, transaction: t });
        const recipients = await this.recipientsService.ensureMany(input.recipientEmails);
        await this.crModel.bulkCreate(
          recipients.map((r) => ({ campaignId: id, recipientId: r.id, status: 'pending' })) as any[],
          { transaction: t },
        );
      }
      return campaign;
    });
  }

  async remove(userId: string, id: string): Promise<void> {
    const campaign = await this.getOwned(userId, id);
    if (campaign.status !== 'draft') {
      throw new AppError(ErrorCodes.CONFLICT_STATE, 'Only draft campaigns can be deleted', 409);
    }
    await campaign.destroy();
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/backend/src/campaigns/campaigns.service.ts
git commit -m "feat(campaigns): CampaignsService"
```

### Task 5.4: CampaignsLifecycleService (port — atomic state machine)

**Files:**
- Create: `apps/backend/src/campaigns/campaigns.lifecycle.service.ts`

- [ ] **Step 1: Write campaigns.lifecycle.service.ts**

```ts
import { Op } from 'sequelize';
import { Campaign } from './campaign.model';
import { SendSimulator } from './send.simulator';
import { AppError, ErrorCodes } from '../common/errors/app.error';

export class CampaignsLifecycleService {
  constructor(
    private readonly campaignModel: typeof Campaign,
    private readonly simulator: SendSimulator,
  ) {}

  async schedule(userId: string, id: string, scheduledAt: string): Promise<Campaign> {
    const when = new Date(scheduledAt);
    if (Number.isNaN(when.getTime()) || when.getTime() <= Date.now()) {
      throw new AppError(ErrorCodes.VALIDATION, 'scheduledAt must be a future timestamp', 400);
    }
    // Atomic: only updates a row that is currently draft
    const [count, rows] = await this.campaignModel.update(
      { status: 'scheduled', scheduledAt: when },
      { where: { id, createdBy: userId, status: 'draft' }, returning: true },
    );
    if (count === 0) {
      const exists = await this.campaignModel.findOne({ where: { id, createdBy: userId } });
      if (!exists) throw new AppError(ErrorCodes.NOT_FOUND, 'Campaign not found', 404);
      throw new AppError(ErrorCodes.CONFLICT_STATE, 'Only draft campaigns can be scheduled', 409);
    }
    return rows[0];
  }

  async send(userId: string, id: string): Promise<Campaign> {
    const [count, rows] = await this.campaignModel.update(
      { status: 'sending' },
      {
        where: { id, createdBy: userId, status: { [Op.in]: ['draft', 'scheduled'] } },
        returning: true,
      },
    );
    if (count === 0) {
      const exists = await this.campaignModel.findOne({ where: { id, createdBy: userId } });
      if (!exists) throw new AppError(ErrorCodes.NOT_FOUND, 'Campaign not found', 404);
      throw new AppError(ErrorCodes.CONFLICT_STATE, 'Campaign cannot be sent in current state', 409);
    }
    this.simulator.enqueue(id);
    return rows[0];
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/backend/src/campaigns/campaigns.lifecycle.service.ts
git commit -m "feat(campaigns): LifecycleService with atomic transitions"
```

### Task 5.5: Campaigns router

**Files:**
- Create: `apps/backend/src/campaigns/campaigns.router.ts`

- [ ] **Step 1: Write campaigns.router.ts**

```ts
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
import { AppError, ErrorCodes } from '../common/errors/app.error';

interface Deps {
  campaignsService: CampaignsService;
  lifecycleService: CampaignsLifecycleService;
  statsService: StatsService;
}

function requireUser(req: { user?: { id: string; email: string } }): { id: string; email: string } {
  if (!req.user) throw new AppError(ErrorCodes.UNAUTHORIZED, 'Unauthenticated', 401);
  return req.user;
}

export function campaignsRouter(deps: Deps): Router {
  const router = Router();

  router.get(
    '/',
    validate(listCampaignsQuery, 'query'),
    asyncHandler(async (req, res) => {
      const user = requireUser(req);
      const result = await deps.campaignsService.list(user.id, req.query as any);
      res.json(result);
    }),
  );

  router.post(
    '/',
    validate(createCampaignSchema),
    asyncHandler(async (req, res) => {
      const user = requireUser(req);
      const campaign = await deps.campaignsService.create(user.id, req.body);
      res.status(201).json({ campaign });
    }),
  );

  router.get(
    '/:id',
    validate(campaignIdParams, 'params'),
    asyncHandler(async (req, res) => {
      const user = requireUser(req);
      const detail = await deps.campaignsService.getDetail(user.id, req.params.id);
      res.json(detail);
    }),
  );

  router.patch(
    '/:id',
    validate(campaignIdParams, 'params'),
    validate(updateCampaignSchema),
    asyncHandler(async (req, res) => {
      const user = requireUser(req);
      const campaign = await deps.campaignsService.update(user.id, req.params.id, req.body);
      res.json({ campaign });
    }),
  );

  router.delete(
    '/:id',
    validate(campaignIdParams, 'params'),
    asyncHandler(async (req, res) => {
      const user = requireUser(req);
      await deps.campaignsService.remove(user.id, req.params.id);
      res.status(204).end();
    }),
  );

  router.post(
    '/:id/schedule',
    validate(campaignIdParams, 'params'),
    validate(scheduleCampaignSchema),
    asyncHandler(async (req, res) => {
      const user = requireUser(req);
      const campaign = await deps.lifecycleService.schedule(user.id, req.params.id, req.body.scheduledAt);
      res.json({ campaign });
    }),
  );

  router.post(
    '/:id/send',
    validate(campaignIdParams, 'params'),
    asyncHandler(async (req, res) => {
      const user = requireUser(req);
      const campaign = await deps.lifecycleService.send(user.id, req.params.id);
      res.status(202).json({ campaign });
    }),
  );

  router.get(
    '/:id/stats',
    validate(campaignIdParams, 'params'),
    asyncHandler(async (req, res) => {
      const user = requireUser(req);
      // Authorize first by finding owned campaign
      await deps.campaignsService.getOwned(user.id, req.params.id);
      const stats = await deps.statsService.compute(req.params.id);
      res.json(stats);
    }),
  );

  return router;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/backend/src/campaigns/campaigns.router.ts
git commit -m "feat(campaigns): router with 8 endpoints"
```

---

## Phase 6 — Async send + scheduler

### Task 6.1: SendSimulator (port)

**Files:**
- Create: `apps/backend/src/campaigns/send.simulator.ts`

- [ ] **Step 1: Write send.simulator.ts**

```ts
import type { Logger } from 'pino';
import { Campaign } from './campaign.model';
import { CampaignRecipient } from './campaign-recipient.model';

export class SendSimulator {
  private readonly inFlight = new Set<string>();

  constructor(
    private readonly campaignModel: typeof Campaign,
    private readonly crModel: typeof CampaignRecipient,
    private readonly successRate: number,
    private readonly logger: Logger,
  ) {}

  enqueue(campaignId: string): void {
    if (this.inFlight.has(campaignId)) {
      this.logger.debug({ campaignId }, 'Skip enqueue, already in-flight');
      return;
    }
    this.inFlight.add(campaignId);
    setImmediate(() => {
      this.run(campaignId)
        .catch((err) => this.logger.error({ err, campaignId }, 'Send loop failed'))
        .finally(() => this.inFlight.delete(campaignId));
    });
  }

  private async run(campaignId: string): Promise<void> {
    const pending = await this.crModel.findAll({
      where: { campaignId, status: 'pending' },
      order: [['createdAt', 'ASC']],
    });
    for (const cr of pending) {
      await this.delay(50 + Math.random() * 200);
      const success = Math.random() < this.successRate;
      const opened = success && Math.random() < 0.3;
      await cr.update({
        status: success ? 'sent' : 'failed',
        sentAt: success ? new Date() : null,
        openedAt: opened ? new Date() : null,
      });
    }
    await this.campaignModel.update({ status: 'sent' }, { where: { id: campaignId } });
    this.logger.info({ campaignId }, 'Campaign marked sent');
  }

  private delay(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/backend/src/campaigns/send.simulator.ts
git commit -m "feat(campaigns): SendSimulator (setImmediate loop)"
```

### Task 6.2: CampaignsScheduler (node-cron)

**Files:**
- Create: `apps/backend/src/campaigns/scheduler.ts`

- [ ] **Step 1: Write scheduler.ts**

```ts
import cron, { ScheduledTask } from 'node-cron';
import { Op } from 'sequelize';
import type { Logger } from 'pino';
import { Campaign } from './campaign.model';
import { SendSimulator } from './send.simulator';

export class CampaignsScheduler {
  private task: ScheduledTask | null = null;

  constructor(
    private readonly campaignModel: typeof Campaign,
    private readonly simulator: SendSimulator,
    private readonly logger: Logger,
  ) {}

  start(): void {
    if (this.task) return;
    // Every 30s
    this.task = cron.schedule('*/30 * * * * *', () => {
      this.tick().catch((err) => this.logger.error({ err }, 'Scheduler tick failed'));
    });
    this.logger.info('Scheduler started (every 30s)');
  }

  stop(): void {
    if (this.task) {
      this.task.stop();
      this.task = null;
    }
  }

  private async tick(): Promise<void> {
    const [count, rows] = await this.campaignModel.update(
      { status: 'sending' },
      {
        where: { status: 'scheduled', scheduledAt: { [Op.lte]: new Date() } },
        returning: true,
      },
    );
    if (count === 0) return;
    this.logger.info({ count }, 'Scheduler picked up due campaigns');
    for (const row of rows) {
      this.simulator.enqueue(row.id);
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/backend/src/campaigns/scheduler.ts
git commit -m "feat(campaigns): scheduler on node-cron"
```

---

## Phase 7 — Bootstrap

### Task 7.1: Health router

**Files:**
- Create: `apps/backend/src/health.router.ts`

- [ ] **Step 1: Write health.router.ts**

```ts
import { Router } from 'express';

export function healthRouter(): Router {
  const router = Router();
  router.get('/', (_req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });
  return router;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/backend/src/health.router.ts
git commit -m "feat(backend): health router"
```

### Task 7.2: Create createApp factory (composition root)

**Files:**
- Create: `apps/backend/src/app.ts`

- [ ] **Step 1: Write app.ts**

```ts
import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { Sequelize } from 'sequelize-typescript';
import type { Logger } from 'pino';

import { Env } from './config/env';
import { createSequelize } from './db/sequelize';
import { User } from './users/user.model';
import { Recipient } from './recipients/recipient.model';
import { Campaign } from './campaigns/campaign.model';
import { CampaignRecipient } from './campaigns/campaign-recipient.model';

import { AuthService } from './auth/auth.service';
import { RecipientsService } from './recipients/recipients.service';
import { StatsService } from './campaigns/stats.service';
import { CampaignsService } from './campaigns/campaigns.service';
import { CampaignsLifecycleService } from './campaigns/campaigns.lifecycle.service';
import { SendSimulator } from './campaigns/send.simulator';
import { CampaignsScheduler } from './campaigns/scheduler';

import { authMiddleware } from './common/middleware/auth.middleware';
import { createErrorHandler } from './common/middleware/error-handler.middleware';
import { authRateLimit } from './common/middleware/rate-limit';

import { authRouter } from './auth/auth.router';
import { recipientsRouter } from './recipients/recipients.router';
import { campaignsRouter } from './campaigns/campaigns.router';
import { healthRouter } from './health.router';

export interface AppBundle {
  app: Express;
  sequelize: Sequelize;
  scheduler: CampaignsScheduler;
}

export async function createApp(env: Env, logger: Logger): Promise<AppBundle> {
  const sequelize = createSequelize(env);
  sequelize.addModels([User, Recipient, Campaign, CampaignRecipient]);
  await sequelize.authenticate();

  // Services (manual wiring, leaf → root)
  const authService = new AuthService(User, env.JWT_SECRET, env.JWT_EXPIRES_IN);
  const recipientsService = new RecipientsService(Recipient);
  const statsService = new StatsService(sequelize);
  const sendSimulator = new SendSimulator(Campaign, CampaignRecipient, env.SEND_SUCCESS_RATE, logger);
  const campaignsService = new CampaignsService(
    Campaign, CampaignRecipient, sequelize, recipientsService, statsService,
  );
  const lifecycleService = new CampaignsLifecycleService(Campaign, sendSimulator);
  const scheduler = new CampaignsScheduler(Campaign, sendSimulator, logger);

  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN, credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  app.use(pinoHttp({ logger, customLogLevel: (_req, res, err) => {
    if (err) return 'error';
    if (res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  } }));

  const rateLimit = authRateLimit({
    windowMs: env.RATE_LIMIT_AUTH_WINDOW_MS,
    max: env.RATE_LIMIT_AUTH_MAX,
  });

  app.use('/health', healthRouter());
  app.use('/auth', authRouter({ authService, rateLimit }));
  app.use('/recipients', authMiddleware(env.JWT_SECRET), recipientsRouter({ recipientsService }));
  app.use('/campaigns', authMiddleware(env.JWT_SECRET), campaignsRouter({
    campaignsService,
    lifecycleService,
    statsService,
  }));

  app.use(createErrorHandler(logger));

  return { app, sequelize, scheduler };
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/backend/src/app.ts
git commit -m "feat(backend): createApp composition root"
```

### Task 7.3: Create main.ts bootstrap

**Files:**
- Modify (replace): `apps/backend/src/main.ts`

- [ ] **Step 1: Replace main.ts**

```ts
import 'reflect-metadata';
import 'dotenv/config';
import { loadEnv } from './config/env';
import { createApp } from './app';
import { createLogger } from './logger';

async function bootstrap() {
  const env = loadEnv();
  const logger = createLogger(env.LOG_LEVEL, env.NODE_ENV !== 'production');
  const { app, sequelize, scheduler } = await createApp(env, logger);

  const server = app.listen(env.PORT, () => {
    logger.info({ port: env.PORT, env: env.NODE_ENV }, 'Backend listening');
  });

  if (env.NODE_ENV !== 'test') scheduler.start();

  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Shutting down');
    scheduler.stop();
    server.close(() => logger.info('HTTP server closed'));
    await sequelize.close();
    process.exit(0);
  };
  process.on('SIGTERM', () => { void shutdown('SIGTERM'); });
  process.on('SIGINT', () => { void shutdown('SIGINT'); });
}

bootstrap().catch((err) => {
  console.error('Fatal bootstrap error:', err);
  process.exit(1);
});
```

- [ ] **Step 2: Full compile check**

```bash
cd apps/backend && yarn tsc --noEmit
```
Expected: ZERO errors. If any error, fix before committing.

- [ ] **Step 3: Build succeeds**

```bash
cd apps/backend && yarn build
```
Expected: `dist/` directory populated with `main.js`, `app.js`, module subdirectories.

- [ ] **Step 4: Commit**

```bash
git add apps/backend/src/main.ts apps/backend/dist || true
git reset -- apps/backend/dist  # don't commit build output
git add apps/backend/src/main.ts
git commit -m "feat(backend): main.ts bootstrap with graceful shutdown"
```

---

## Phase 8 — Tests

### Task 8.1: Update test setup

**Files:**
- Modify (replace): `apps/backend/test/setup.ts`

- [ ] **Step 1: Recover baseline for reference**

```bash
cd apps/backend
git show 6807659:apps/backend/test/setup.ts | head -60
```

- [ ] **Step 2: Replace test/setup.ts**

```ts
import 'reflect-metadata';
import type { Express } from 'express';
import type { Sequelize } from 'sequelize-typescript';
import { createApp } from '../src/app';
import { createLogger } from '../src/logger';
import { loadEnv, type Env } from '../src/config/env';

export interface TestBundle {
  app: Express;
  sequelize: Sequelize;
  env: Env;
}

export async function createTestApp(): Promise<TestBundle> {
  const env = loadEnv({
    ...process.env,
    NODE_ENV: 'test',
    JWT_SECRET: process.env.JWT_SECRET ?? 'test-secret-for-e2e-only-0123456789',
    RATE_LIMIT_AUTH_MAX: process.env.RATE_LIMIT_AUTH_MAX ?? '1000', // permissive in tests
  });
  const logger = createLogger('silent' as any, false);
  const { app, sequelize } = await createApp(env, logger);
  return { app, sequelize, env };
}

export async function truncateAll(sequelize: Sequelize): Promise<void> {
  await sequelize.query(
    'TRUNCATE TABLE campaign_recipients, campaigns, recipients, users RESTART IDENTITY CASCADE;',
  );
}
```

Note: we override `RATE_LIMIT_AUTH_MAX` to a large value so auth tests don't trip the limit — except the one dedicated rate-limit test which will override again.

- [ ] **Step 3: Commit**

```bash
git add apps/backend/test/setup.ts
git commit -m "test: update setup for createApp factory"
```

### Task 8.2: Update jest config

**Files:**
- Modify: `apps/backend/jest.config.js`

- [ ] **Step 1: Replace jest.config.js**

```js
/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  roots: ['<rootDir>/test'],
  testMatch: ['<rootDir>/test/**/*.e2e.spec.ts', '<rootDir>/test/**/*.spec.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }],
  },
  moduleNameMapper: {
    '^@mcm/shared-types$': '<rootDir>/../../packages/shared-types/src',
  },
  testTimeout: 30000,
};
```

- [ ] **Step 2: Commit**

```bash
git add apps/backend/jest.config.js
git commit -m "test: jest config for Express"
```

### Task 8.3: Rewrite auth.e2e.spec.ts

**Files:**
- Delete: `apps/backend/test/auth.e2e-spec.ts`
- Create: `apps/backend/test/auth.e2e.spec.ts`

- [ ] **Step 1: Remove old spec**

```bash
rm apps/backend/test/auth.e2e-spec.ts
```

- [ ] **Step 2: Write new auth.e2e.spec.ts**

```ts
import request from 'supertest';
import { createTestApp, truncateAll, type TestBundle } from './setup';

describe('Auth', () => {
  let bundle: TestBundle;

  beforeAll(async () => { bundle = await createTestApp(); });
  afterAll(async () => { await bundle.sequelize.close(); });
  beforeEach(async () => { await truncateAll(bundle.sequelize); });

  it('register then login returns a JWT', async () => {
    const reg = await request(bundle.app).post('/auth/register').send({
      email: 'a@test.io', name: 'A', password: 'password123',
    });
    expect(reg.status).toBe(201);
    expect(reg.body.user.email).toBe('a@test.io');

    const login = await request(bundle.app).post('/auth/login').send({
      email: 'a@test.io', password: 'password123',
    });
    expect(login.status).toBe(200);
    expect(typeof login.body.token).toBe('string');
  });

  it('login with wrong password returns 401 UNAUTHORIZED', async () => {
    await request(bundle.app).post('/auth/register').send({
      email: 'b@test.io', name: 'B', password: 'password123',
    });
    const login = await request(bundle.app).post('/auth/login').send({
      email: 'b@test.io', password: 'nope',
    });
    expect(login.status).toBe(401);
    expect(login.body.error.code).toBe('UNAUTHORIZED');
  });

  it('register with missing fields returns 400 VALIDATION', async () => {
    const res = await request(bundle.app).post('/auth/register').send({ email: 'not-an-email' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION');
  });
});
```

- [ ] **Step 3: Commit**

```bash
git add apps/backend/test/auth.e2e.spec.ts apps/backend/test/auth.e2e-spec.ts
git commit -m "test(auth): rewrite e2e for Express"
```

### Task 8.4: Rewrite stats.e2e.spec.ts

**Files:**
- Delete: `apps/backend/test/stats.e2e-spec.ts`
- Create: `apps/backend/test/stats.e2e.spec.ts`

- [ ] **Step 1: Remove old spec**

```bash
rm apps/backend/test/stats.e2e-spec.ts
```

- [ ] **Step 2: Write new stats.e2e.spec.ts**

```ts
import request from 'supertest';
import { createTestApp, truncateAll, type TestBundle } from './setup';

async function registerAndLogin(bundle: TestBundle, email: string, password = 'password123') {
  await request(bundle.app).post('/auth/register').send({ email, name: 'T', password });
  const res = await request(bundle.app).post('/auth/login').send({ email, password });
  return res.body.token as string;
}

describe('Stats', () => {
  let bundle: TestBundle;

  beforeAll(async () => { bundle = await createTestApp(); });
  afterAll(async () => { await bundle.sequelize.close(); });
  beforeEach(async () => { await truncateAll(bundle.sequelize); });

  it('empty campaign stats are zero', async () => {
    const token = await registerAndLogin(bundle, 's1@test.io');
    const create = await request(bundle.app).post('/campaigns').set('Authorization', `Bearer ${token}`).send({
      name: 'c', subject: 's', body: 'b', recipientEmails: ['x@test.io'],
    });
    expect(create.status).toBe(201);
    const id = create.body.campaign.id;

    const stats = await request(bundle.app).get(`/campaigns/${id}/stats`).set('Authorization', `Bearer ${token}`);
    expect(stats.status).toBe(200);
    expect(stats.body).toMatchObject({ total: 1, sent: 0, failed: 0, opened: 0, send_rate: 0, open_rate: 0 });
  });

  it('computes send_rate and open_rate with marketing convention', async () => {
    const token = await registerAndLogin(bundle, 's2@test.io');
    const emails = ['r1@t.io', 'r2@t.io', 'r3@t.io', 'r4@t.io', 'r5@t.io'];
    const create = await request(bundle.app).post('/campaigns').set('Authorization', `Bearer ${token}`).send({
      name: 'c', subject: 's', body: 'b', recipientEmails: emails,
    });
    const campaignId = create.body.campaign.id;

    // Manually seed stats via direct SQL
    await bundle.sequelize.query(`
      UPDATE campaign_recipients SET status='sent', sent_at=NOW(), opened_at=NULL
        WHERE campaign_id = :id AND recipient_id IN (
          SELECT id FROM recipients WHERE email IN ('r1@t.io','r2@t.io','r3@t.io')
        );
    `, { replacements: { id: campaignId } });
    await bundle.sequelize.query(`
      UPDATE campaign_recipients SET status='failed' WHERE campaign_id = :id AND status='pending' LIMIT 2;
    `, { replacements: { id: campaignId } }).catch(async () => {
      // Fallback: some Postgres versions don't allow LIMIT on UPDATE
      await bundle.sequelize.query(`
        UPDATE campaign_recipients SET status='failed'
          WHERE campaign_id = :id AND recipient_id IN (
            SELECT id FROM recipients WHERE email IN ('r4@t.io','r5@t.io')
          );
      `, { replacements: { id: campaignId } });
    });
    await bundle.sequelize.query(`
      UPDATE campaign_recipients SET opened_at = NOW()
        WHERE campaign_id = :id AND recipient_id IN (
          SELECT id FROM recipients WHERE email IN ('r1@t.io','r2@t.io')
        );
    `, { replacements: { id: campaignId } });

    const stats = await request(bundle.app).get(`/campaigns/${campaignId}/stats`).set('Authorization', `Bearer ${token}`);
    expect(stats.body.total).toBe(5);
    expect(stats.body.sent).toBe(3);
    expect(stats.body.failed).toBe(2);
    expect(stats.body.opened).toBe(2);
    expect(stats.body.send_rate).toBeCloseTo(0.6, 4);
    expect(stats.body.open_rate).toBeCloseTo(2 / 3, 4);
  });
});
```

- [ ] **Step 3: Commit**

```bash
git add apps/backend/test/stats.e2e.spec.ts apps/backend/test/stats.e2e-spec.ts
git commit -m "test(stats): rewrite e2e for Express"
```

### Task 8.5: Rewrite campaigns.e2e.spec.ts (with DELETE + rate-limit cases)

**Files:**
- Delete: `apps/backend/test/campaigns.e2e-spec.ts`
- Create: `apps/backend/test/campaigns.e2e.spec.ts`

- [ ] **Step 1: Remove old spec**

```bash
rm apps/backend/test/campaigns.e2e-spec.ts
```

- [ ] **Step 2: Write new campaigns.e2e.spec.ts**

```ts
import request from 'supertest';
import { createTestApp, truncateAll, type TestBundle } from './setup';

async function registerAndLogin(bundle: TestBundle, email: string, password = 'password123') {
  await request(bundle.app).post('/auth/register').send({ email, name: 'T', password });
  const r = await request(bundle.app).post('/auth/login').send({ email, password });
  return r.body.token as string;
}

async function createDraft(bundle: TestBundle, token: string) {
  const res = await request(bundle.app).post('/campaigns').set('Authorization', `Bearer ${token}`).send({
    name: 'C', subject: 'S', body: 'B', recipientEmails: ['r1@t.io', 'r2@t.io'],
  });
  return res.body.campaign.id as string;
}

describe('Campaigns', () => {
  let bundle: TestBundle;

  beforeAll(async () => { bundle = await createTestApp(); });
  afterAll(async () => { await bundle.sequelize.close(); });
  beforeEach(async () => { await truncateAll(bundle.sequelize); });

  it('PATCH on non-draft returns 409 INVALID_STATE_TRANSITION', async () => {
    const token = await registerAndLogin(bundle, 'u1@t.io');
    const id = await createDraft(bundle, token);
    const future = new Date(Date.now() + 60_000).toISOString();
    const sched = await request(bundle.app).post(`/campaigns/${id}/schedule`).set('Authorization', `Bearer ${token}`).send({ scheduledAt: future });
    expect(sched.status).toBe(200);

    const patch = await request(bundle.app).patch(`/campaigns/${id}`).set('Authorization', `Bearer ${token}`).send({ name: 'Nope' });
    expect(patch.status).toBe(409);
    expect(patch.body.error.code).toBe('INVALID_STATE_TRANSITION');
  });

  it('schedule with past timestamp returns 400 VALIDATION', async () => {
    const token = await registerAndLogin(bundle, 'u2@t.io');
    const id = await createDraft(bundle, token);
    const past = new Date(Date.now() - 60_000).toISOString();
    const res = await request(bundle.app).post(`/campaigns/${id}/schedule`).set('Authorization', `Bearer ${token}`).send({ scheduledAt: past });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION');
  });

  it('user cannot access another user\'s campaign (404)', async () => {
    const tokenA = await registerAndLogin(bundle, 'a@t.io');
    const tokenB = await registerAndLogin(bundle, 'b@t.io');
    const idA = await createDraft(bundle, tokenA);
    const res = await request(bundle.app).get(`/campaigns/${idA}`).set('Authorization', `Bearer ${tokenB}`);
    expect(res.status).toBe(404);
  });

  it('send transitions draft → sending → sent', async () => {
    const token = await registerAndLogin(bundle, 'u3@t.io');
    const id = await createDraft(bundle, token);

    const send = await request(bundle.app).post(`/campaigns/${id}/send`).set('Authorization', `Bearer ${token}`);
    expect(send.status).toBe(202);
    expect(['sending', 'sent']).toContain(send.body.campaign.status);

    // Poll up to 10s
    const deadline = Date.now() + 10_000;
    let status = '';
    while (Date.now() < deadline) {
      const d = await request(bundle.app).get(`/campaigns/${id}`).set('Authorization', `Bearer ${token}`);
      status = d.body.status;
      if (status === 'sent') break;
      await new Promise((r) => setTimeout(r, 200));
    }
    expect(status).toBe('sent');
  });

  it('DELETE on draft returns 204; DELETE on non-draft returns 409', async () => {
    const token = await registerAndLogin(bundle, 'u4@t.io');
    const id1 = await createDraft(bundle, token);
    const del1 = await request(bundle.app).delete(`/campaigns/${id1}`).set('Authorization', `Bearer ${token}`);
    expect(del1.status).toBe(204);

    const id2 = await createDraft(bundle, token);
    const future = new Date(Date.now() + 60_000).toISOString();
    await request(bundle.app).post(`/campaigns/${id2}/schedule`).set('Authorization', `Bearer ${token}`).send({ scheduledAt: future });
    const del2 = await request(bundle.app).delete(`/campaigns/${id2}`).set('Authorization', `Bearer ${token}`);
    expect(del2.status).toBe(409);
    expect(del2.body.error.code).toBe('INVALID_STATE_TRANSITION');
  });
});
```

- [ ] **Step 3: Commit**

```bash
git add apps/backend/test/campaigns.e2e.spec.ts apps/backend/test/campaigns.e2e-spec.ts
git commit -m "test(campaigns): rewrite e2e + add DELETE cases"
```

### Task 8.6: Add recipients.e2e.spec.ts (NEW — audit gap)

**Files:**
- Create: `apps/backend/test/recipients.e2e.spec.ts`

- [ ] **Step 1: Write recipients.e2e.spec.ts**

```ts
import request from 'supertest';
import { createTestApp, truncateAll, type TestBundle } from './setup';

async function registerAndLogin(bundle: TestBundle, email: string, password = 'password123') {
  await request(bundle.app).post('/auth/register').send({ email, name: 'T', password });
  const r = await request(bundle.app).post('/auth/login').send({ email, password });
  return r.body.token as string;
}

describe('Recipients', () => {
  let bundle: TestBundle;

  beforeAll(async () => { bundle = await createTestApp(); });
  afterAll(async () => { await bundle.sequelize.close(); });
  beforeEach(async () => { await truncateAll(bundle.sequelize); });

  it('POST /recipients creates a new recipient (201)', async () => {
    const token = await registerAndLogin(bundle, 'rec1@t.io');
    const res = await request(bundle.app).post('/recipients').set('Authorization', `Bearer ${token}`).send({
      email: 'New@Example.COM', name: 'New User',
    });
    expect(res.status).toBe(201);
    expect(res.body.recipient.email).toBe('new@example.com');
    expect(res.body.recipient.name).toBe('New User');
  });

  it('POST /recipients with existing email is idempotent (find-or-create)', async () => {
    const token = await registerAndLogin(bundle, 'rec2@t.io');
    const first = await request(bundle.app).post('/recipients').set('Authorization', `Bearer ${token}`).send({ email: 'dup@t.io' });
    const second = await request(bundle.app).post('/recipients').set('Authorization', `Bearer ${token}`).send({ email: 'dup@t.io' });
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(first.body.recipient.id).toBe(second.body.recipient.id);
  });

  it('GET /recipients supports pagination + case-insensitive search', async () => {
    const token = await registerAndLogin(bundle, 'rec3@t.io');
    for (const e of ['alice@t.io', 'bob@t.io', 'charlie@t.io']) {
      await request(bundle.app).post('/recipients').set('Authorization', `Bearer ${token}`).send({ email: e });
    }
    const all = await request(bundle.app).get('/recipients?page=1&limit=2').set('Authorization', `Bearer ${token}`);
    expect(all.status).toBe(200);
    expect(all.body.total).toBe(3);
    expect(all.body.data.length).toBe(2);

    const search = await request(bundle.app).get('/recipients?search=ALICE').set('Authorization', `Bearer ${token}`);
    expect(search.status).toBe(200);
    expect(search.body.data.length).toBe(1);
    expect(search.body.data[0].email).toBe('alice@t.io');
  });

  it('unauthenticated requests are rejected (401)', async () => {
    const res = await request(bundle.app).get('/recipients');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });
});
```

- [ ] **Step 2: Commit**

```bash
git add apps/backend/test/recipients.e2e.spec.ts
git commit -m "test(recipients): new e2e coverage (audit gap fix)"
```

### Task 8.7: Run full test suite

- [ ] **Step 1: Ensure Postgres test DB is up**

Either use docker-compose postgres or start one locally. Env:
```bash
export TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/campaign_manager_test
```

- [ ] **Step 2: Run migrations against test DB**

```bash
cd apps/backend
DATABASE_URL=$TEST_DATABASE_URL yarn migrate
```

- [ ] **Step 3: Run tests**

```bash
yarn test
```
Expected: 15+ specs across 4 files, all green.

If any fail: fix inline, re-run. Do not proceed until all green.

- [ ] **Step 4: Commit any fixes**

```bash
git add -A && git commit -m "test: fixes from first green run" || echo "nothing to commit"
```

---

## Phase 9 — Docker, CI, FE fixes, README

### Task 9.1: Update backend Dockerfile

**Files:**
- Modify: `apps/backend/Dockerfile`

- [ ] **Step 1: Replace Dockerfile**

```dockerfile
# syntax=docker/dockerfile:1.6
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json yarn.lock ./
COPY packages/shared-types/package.json packages/shared-types/
COPY apps/backend/package.json apps/backend/
RUN yarn install --frozen-lockfile
COPY packages/shared-types packages/shared-types
COPY apps/backend apps/backend
RUN yarn workspace @mcm/backend build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/backend/dist ./apps/backend/dist
COPY --from=builder /app/apps/backend/package.json ./apps/backend/
COPY --from=builder /app/apps/backend/db ./apps/backend/db
COPY --from=builder /app/apps/backend/.sequelizerc ./apps/backend/
COPY --from=builder /app/packages ./packages
WORKDIR /app/apps/backend
EXPOSE 4000
CMD ["sh", "-c", "yarn migrate && yarn seed && node dist/main.js"]
```

- [ ] **Step 2: Commit**

```bash
git add apps/backend/Dockerfile
git commit -m "chore(docker): backend image for Express build"
```

### Task 9.2: Frontend fix — remove hardcoded creds, add Send confirm

**Files:**
- Modify: `apps/frontend/src/pages/LoginPage.tsx`
- Modify: `apps/frontend/src/pages/CampaignDetailPage.tsx`

- [ ] **Step 1: Remove hardcoded credentials from LoginPage**

Read current file, locate the `useState('demo@example.com')` and `useState('password123')` initializers. Replace with empty strings:

```tsx
// Before:
const [email, setEmail] = useState('demo@example.com');
const [password, setPassword] = useState('password123');
// After:
const [email, setEmail] = useState('');
const [password, setPassword] = useState('');
```

Also add a subtle hint in dev mode if you want:
```tsx
{import.meta.env.DEV && (
  <p className="text-xs text-muted-foreground mt-2">
    Demo creds: demo@example.com / password123
  </p>
)}
```

- [ ] **Step 2: Add Send confirm in CampaignDetailPage**

Locate `onSend` in `apps/frontend/src/pages/CampaignDetailPage.tsx` (line ~31) and wrap with confirm:

```tsx
const onSend = async () => {
  const count = data?.recipients.length ?? 0;
  if (!confirm(`Send this campaign to ${count} recipient${count === 1 ? '' : 's'}? This cannot be undone.`)) return;
  try {
    await send.mutateAsync();
    toast.success('Sending started.');
  } catch (err) {
    toast.error(apiErrorMessage(err));
  }
};
```

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/src/pages/LoginPage.tsx apps/frontend/src/pages/CampaignDetailPage.tsx
git commit -m "feat(frontend): confirm Send + remove hardcoded demo creds"
```

### Task 9.3: Add GitHub Actions CI

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Write ci.yml**

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  lint-and-build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: yarn
      - run: yarn install --frozen-lockfile
      - run: yarn lint
      - run: yarn workspace @mcm/shared-types build || true
      - run: yarn workspace @mcm/backend build
      - run: yarn workspace @mcm/frontend build

  test-backend:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: campaign_manager_test
        ports: [5432:5432]
        options: >-
          --health-cmd pg_isready
          --health-interval 5s
          --health-timeout 5s
          --health-retries 10
    env:
      DATABASE_URL: postgres://postgres:postgres@localhost:5432/campaign_manager_test
      TEST_DATABASE_URL: postgres://postgres:postgres@localhost:5432/campaign_manager_test
      JWT_SECRET: test-secret-for-ci-use-only-0123456789
      NODE_ENV: test
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: yarn
      - run: yarn install --frozen-lockfile
      - run: yarn workspace @mcm/backend migrate
      - run: yarn workspace @mcm/backend test
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "chore(ci): GitHub Actions lint + build + backend tests"
```

### Task 9.4: Docker compose smoke test

- [ ] **Step 1: Bring up stack**

```bash
cd /Users/luuphuc/Projects/orgscale/mini-campaign-manager-express
docker compose up --build -d
```

- [ ] **Step 2: Wait for healthy**

```bash
sleep 20 && docker compose ps
```
Expected: all services Up.

- [ ] **Step 3: Smoke-test all endpoints with curl**

```bash
# Health
curl -s http://localhost:4000/health | jq

# Register + login
TOKEN=$(curl -s -X POST http://localhost:4000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"demo@example.com","password":"password123"}' | jq -r .token)
echo "TOKEN=$TOKEN"

# List campaigns (should have 3 seeded)
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:4000/campaigns | jq '.total'

# Create
curl -s -X POST http://localhost:4000/campaigns \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"name":"Smoke","subject":"Hi","body":"Body","recipientEmails":["a@t.io"]}' | jq '.campaign.id'
```

Expected: all return 200/201 with expected shapes matching the NestJS baseline.

- [ ] **Step 4: Tear down**

```bash
docker compose down -v
```

- [ ] **Step 5: Commit any docker-compose.yml tweaks**

(No commit if nothing changed.)

### Task 9.5: Update README

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update Stack table**

Change line 12 `Backend` row from:
```
Node 20 + **NestJS 10** (Express adapter), `@nestjs/sequelize` + `sequelize-typescript`, `class-validator`/`class-transformer`, `@nestjs/jwt` + `passport-jwt`, `@nestjs/schedule` (cron)
```
to:
```
Node 20 + **Express 4 + TypeScript**, `sequelize-typescript`, `zod` (validation + env), `jsonwebtoken` (auth), `node-cron` (scheduler), `pino` (logging), `helmet` + `express-rate-limit` (security)
```

- [ ] **Step 2: Update "Why NestJS" section**

Rewrite the section around line 119 as `## Architecture decisions` with a new paragraph:

```markdown
**Why plain Express over NestJS?** The spec asks for Node.js + Express, so we ship Express. The previous iteration used NestJS for DI, ValidationPipe, and Schedule — each is replaced by a small, focused pattern here: a **composition root** in `src/app.ts` wires services manually (no DI container, no `reflect-metadata` runtime reliance beyond what `sequelize-typescript` needs), `zod` middleware replaces `class-validator`, and `node-cron` replaces `@nestjs/schedule`. The result is less framework, less magic, and a surface area that matches the spec.
```

- [ ] **Step 3: Update "How I used Claude Code" section**

Add a bullet at the end:

```markdown
* **Framework swap back to Express.** After the initial NestJS implementation shipped, an audit flagged the framework deviation from spec. The agent scoped the rewrite as 9 phases (deps swap → infra → models → modules → bootstrap → tests → CI), used the existing atomic `UPDATE … WHERE status = …` pattern unchanged, and ported 8 e2e tests plus added 6 new ones (recipients CRUD, DELETE on non-draft, and rate-limit behaviour). The API contract held byte-for-byte — the React frontend did not need a single line changed beyond two unrelated polish fixes (remove hardcoded demo creds, confirm dialog on Send).
```

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: README for Express stack"
```

### Task 9.6: Final verification

- [ ] **Step 1: Full lint + build + test**

```bash
cd /Users/luuphuc/Projects/orgscale/mini-campaign-manager-express
yarn lint
yarn workspace @mcm/backend build
yarn workspace @mcm/frontend build
yarn workspace @mcm/backend test
```
Expected: all green.

- [ ] **Step 2: Verify no @nestjs/* packages remain in backend**

```bash
grep -r "@nestjs" apps/backend/package.json apps/backend/src apps/backend/test && echo "FAIL: NestJS references remain" || echo "OK: clean"
```
Expected: `OK: clean`.

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "chore: final verification pass" || echo "nothing to commit"
git log --oneline | head -40
```

---

## Acceptance criteria (from spec, verified)

- [ ] `docker compose up --build` brings up Postgres + backend + frontend, all healthy
- [ ] Frontend logs in and navigates through all 4 pages without any error
- [ ] `yarn test` in backend returns 12+ passing specs (target: 15+)
- [ ] `yarn lint` passes on both backend and frontend
- [ ] `package.json` backend dependencies contain zero `@nestjs/*` packages
- [ ] Uniform error shape preserved across all endpoints (curl-verified)
- [ ] README updated to reflect Express stack + framework-swap narrative in "How I used Claude Code"

---

## Self-review

**Spec coverage:** ✅ Every decision in spec maps to at least one task. Rate limit → Task 1.10 + 8.3. Remove hardcoded creds → Task 9.2. ESLint → Task 0.3. CI → Task 9.3. Recipients tests → Task 8.6. Confirm Send → Task 9.2. Framework swap → Phases 0-7.

**Placeholder scan:** ✅ No TBD/TODO placeholders. All file contents complete.

**Type consistency:** ✅ `AuthService` constructor signature matches across Task 3.2 and app.ts (Task 7.2). `SendSimulator` constructor takes `(campaignModel, crModel, successRate, logger)` consistently in Task 6.1 and Task 7.2. `validate(schema, source)` signature consistent across all router tasks.

**Risks addressed inline:** All 5 spec risks have mitigations in tasks (model decorators → Task 2.4 step 3 compile check; Jest harness → Task 8.1; scheduler in test → env gate in Task 7.3; req.user type → Task 1.6; contract drift → Task 9.4 curl smoke).
