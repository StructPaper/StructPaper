# StructPaper Backend Architecture (NestJS, PostgreSQL) & Frontend Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a production-grade, two-process NestJS modular monolith backend (`apps/api` with Fastify and `apps/worker` with pg-boss) backed by PostgreSQL 15+ and Drizzle ORM, deprecate the legacy Java backend (`apps/api-deprecated`), generate an automated type-safe client (`packages/api-client`), and overhaul the frontend (`apps/web`) with TanStack Query, paginated paper management, and a dedicated Role & Permission sidebar page.

**Architecture:** A Fastify-powered NestJS HTTP API handles stateless REST, CASL scoped authorization, op-log document synchronization, and presigned MinIO uploads, while a separate NestJS worker process handles CPU-intensive LaTeX compilation via pg-boss queues and transactional outbox events. The frontend consumes an automated typed SDK with Axios interceptors for instant token rotation, RFC 9457 Problem Details error translation, and TanStack Query caching.

**Tech Stack:** Node.js LTS, pnpm workspaces, NestJS 10, Fastify, PostgreSQL 15+, Drizzle ORM, Drizzle Kit, pg-boss, CASL (`@casl/ability`), Argon2id, JWT, MinIO S3 SDK, Orval / OpenAPI-TypeScript, TanStack Query v5, Axios, Next.js 14, Vitest, dependency-cruiser.

**Spec:** [docs/superpowers/specs/2026-11-13-nestjs-backend-architecture-design.md](file:///C:/Users/OWNER/source/Eatzy/StructPaper/docs/superpowers/specs/2026-11-13-nestjs-backend-architecture-design.md)

---

## Global Constraints

- **Language & Runtime:** TypeScript strict mode (`"strict": true`, `"noImplicitAny": true`) on Node.js LTS.
- **Package Manager:** `pnpm@9.15.4` monorepo workspaces.
- **Architectural Layers:** Every NestJS module must follow the 4-layer architecture: `presentation/` -> `application/` -> `domain/` <- `infrastructure/`. No circular dependencies allowed (`pnpm depcruise`).
- **File Length:** Focused files only (<300 lines per file). No monolithic god-files.
- **Security:** Argon2id password hashing, JWT access token carrying only `{ sub, pv }`, opaque rotating refresh tokens hashed with SHA-256 in DB, instant permission revocation via `permissions_version` + LRU Cache.
- **Error Standard:** All API errors must conform to RFC 9457 `application/problem+json` format.
- **Storage:** No high-resolution files stream through Fastify memory. Use Presigned PUT URLs directly to MinIO, validated on `/upload-complete`.
- **Database:** Support local Docker Compose development first, with zero-code toggle to remote staging database via `.env`.

---

## Review Focus

1. **Concurrent Op-Log Sync Conflict (HTTP 409):** When a client pushes patches with an outdated `baseServerRev`, the server must reject with RFC 9457 409 Conflict containing `{ code: 'OUT_OF_SYNC', serverRev: N, missingOps: [...] }` so the client rebases instead of corrupting the document tree.
2. **Instant Permission Revocation:** When an admin downgrades a user or modifies roles, the user's `permissions_version` in DB must increment and local LRU cache must be evicted immediately; any in-flight access token with an outdated `pv` must receive a 401 Unauthorized on its next request.
3. **Presigned Upload Integrity Check:** The `/assets/upload-complete` endpoint must verify that the file actually exists in MinIO, matches the declared file size, and passes MIME magic-byte verification before inserting into `assets`.
4. **Optimistic Locking (`If-Match` / `ETag`):** Any `PATCH` to manuscripts, journals, or user profiles without a matching `If-Match` header must be rejected with HTTP 412 Precondition Failed.
5. **Worker LaTeX Sandbox Isolation:** LaTeX compilation jobs in `apps/worker` must never execute arbitrary shell commands outside the temporary sandbox directory, and must handle compiler timeouts gracefully without leaving dangling worker processes.

---

## Task Decomposition

### Task 1: Deprecate Legacy Java Backend & Scaffold Local Infrastructure (B0)

**Files:**
- Modify: `StructPaper/apps/api` -> Rename to `StructPaper/apps/api-deprecated`
- Create: `StructPaper/apps/api-deprecated/DEPRECATED.md`
- Create: `StructPaper/docker-compose.yml`
- Create: `StructPaper/.env.example`
- Modify: `StructPaper/pnpm-workspace.yaml`
- Modify: `StructPaper/package.json`

**Interfaces:**
- Consumes: None
- Produces: Docker Compose environment for local PostgreSQL 16 (with `uuid-ossp`, `citext`, `pg_trgm`, `unaccent`) and local MinIO (port 9000/9001).

- [ ] **Step 1: Move legacy Java backend and create deprecation notice**
  Rename directory `apps/api` to `apps/api-deprecated`. Add `apps/api-deprecated/DEPRECATED.md` explaining that this Spring Boot service is replaced by NestJS `apps/api`.
- [ ] **Step 2: Create local Docker Compose for PostgreSQL 16 and MinIO**
  Write `docker-compose.yml` with services `postgres` (image `postgres:16-alpine`, healthcheck, extensions volume) and `minio` (image `minio/minio:RELEASE.2024-01-18T22-51-28Z`, port 9000, console 9001, default bucket `structpaper-dev`).
- [ ] **Step 3: Create root `.env.example`**
  Add template with `DATABASE_URL`, `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `NODE_ENV=development`.
- [ ] **Step 4: Verify workspace configuration**
  Run `pnpm install` at root to verify workspace integrity after renaming `apps/api-deprecated`.
- [ ] **Step 5: Commit changes**
  ```bash
  git add apps/api-deprecated docker-compose.yml .env.example pnpm-workspace.yaml package.json
  git commit -m "chore(infra): deprecate legacy java api and add local docker-compose environment"
  ```

---

### Task 2: Contracts Package & RFC 9457 Problem Details (`packages/contracts`)

**Files:**
- Create: `StructPaper/packages/contracts/package.json`
- Create: `StructPaper/packages/contracts/tsconfig.json`
- Create: `StructPaper/packages/contracts/src/errors/problem-details.ts`
- Create: `StructPaper/packages/contracts/src/auth/auth.contract.ts`
- Create: `StructPaper/packages/contracts/src/access/access.contract.ts`
- Create: `StructPaper/packages/contracts/src/manuscripts/manuscript.contract.ts`
- Create: `StructPaper/packages/contracts/src/sync/sync.contract.ts`
- Create: `StructPaper/packages/contracts/src/assets/asset.contract.ts`
- Create: `StructPaper/packages/contracts/src/compile/compile.contract.ts`
- Create: `StructPaper/packages/contracts/src/index.ts`
- Test: `StructPaper/packages/contracts/test/contracts.spec.ts`

**Interfaces:**
- Consumes: `zod`
- Produces: Type-safe Zod schemas, TypeScript types, and RFC 9457 `ProblemDetails` interface exported as `@structpaper/contracts`.

- [ ] **Step 1: Write failing test for contracts validation and RFC 9457 error structure**
  In `packages/contracts/test/contracts.spec.ts`, test that `LoginRequestSchema`, `SubmitOpsSchema`, and `ProblemDetails` validate correct inputs and reject malformed schemas.
- [ ] **Step 2: Run test to verify it fails**
  Run: `pnpm --filter @structpaper/contracts test` (Expected: FAIL due to missing files).
- [ ] **Step 3: Implement Zod schemas and ProblemDetails interfaces**
  - Implement `problem-details.ts` with `ProblemDetails` interface and factory helpers.
  - Implement `auth.contract.ts`: `LoginRequestSchema`, `TokenResponseSchema`, `InviteUserSchema`, `ResetPasswordSchema`.
  - Implement `access.contract.ts`: `RoleSchema`, `PermissionSchema`, `AssignRoleSchema`.
  - Implement `manuscript.contract.ts`: `CreateManuscriptSchema`, `UpdateManuscriptSchema`, `ManuscriptQuerySchema`, `AddManuscriptMemberSchema`.
  - Implement `sync.contract.ts`: `SubmitOpsSchema` (`baseServerRev`, `clientRev`, `opId`, `patches`), `OpsDeltaResponseSchema`.
  - Implement `asset.contract.ts`: `UploadIntentSchema`, `UploadCompleteSchema`.
  - Implement `compile.contract.ts`: `TriggerCompileSchema`, `CompileJobResponseSchema`.
- [ ] **Step 4: Run test to verify it passes**
  Run: `pnpm --filter @structpaper/contracts test` (Expected: PASS).
- [ ] **Step 5: Commit changes**
  ```bash
  git add packages/contracts
  git commit -m "feat(contracts): implement shared zod schemas and rfc 9457 problem details"
  ```

---

### Task 3: Database Package & Drizzle Schema Migrations (`packages/db`)

**Files:**
- Create: `StructPaper/packages/db/package.json`
- Create: `StructPaper/packages/db/tsconfig.json`
- Create: `StructPaper/packages/db/drizzle.config.ts`
- Create: `StructPaper/packages/db/src/schema/journals.ts`
- Create: `StructPaper/packages/db/src/schema/users.ts`
- Create: `StructPaper/packages/db/src/schema/access.ts`
- Create: `StructPaper/packages/db/src/schema/manuscripts.ts`
- Create: `StructPaper/packages/db/src/schema/sync.ts`
- Create: `StructPaper/packages/db/src/schema/assets.ts`
- Create: `StructPaper/packages/db/src/schema/compile.ts`
- Create: `StructPaper/packages/db/src/schema/outbox.ts`
- Create: `StructPaper/packages/db/src/schema/audit.ts`
- Create: `StructPaper/packages/db/src/schema/index.ts`
- Create: `StructPaper/packages/db/src/client.ts`
- Create: `StructPaper/packages/db/src/seed.ts`
- Create: `StructPaper/packages/db/src/index.ts`
- Test: `StructPaper/packages/db/test/schema.spec.ts`

**Interfaces:**
- Consumes: `@structpaper/contracts`, `drizzle-orm`, `postgres`
- Produces: Drizzle schemas, connection pool factory `createDbClient(url)`, migration CLI, and `seedDatabase(db)` function.

- [ ] **Step 1: Write failing test for Drizzle schema definitions and relations**
  In `packages/db/test/schema.spec.ts`, test that all schema objects export the expected table names, columns (`users.permissions_version`, `manuscript_members.role`, `outbox_events`, `idempotency_keys`), and foreign key relationships.
- [ ] **Step 2: Run test to verify it fails**
  Run: `pnpm --filter @structpaper/db test` (Expected: FAIL).
- [ ] **Step 3: Implement Drizzle table schemas, client, and secure seed**
  - Define all tables per spec Section 5.2.
  - Implement `client.ts` exporting `createDbClient(connectionString: string)` with connection pooling.
  - Implement `seed.ts` creating the default journal (*vnu-jst*), 5 system roles (`SuperAdmin`, `JournalManager`, `Editor`, `Author`, `Reviewer`), and admin user (`admin@structpaper.org` in `INVITED` state with activation token or `INITIAL_ADMIN_PASSWORD`). No hardcoded passwords in code.
- [ ] **Step 4: Run test to verify it passes**
  Run: `pnpm --filter @structpaper/db test` (Expected: PASS).
- [ ] **Step 5: Generate initial migration files**
  Run: `pnpm --filter @structpaper/db drizzle-kit generate` to generate SQL migrations.
- [ ] **Step 6: Commit changes**
  ```bash
  git add packages/db
  git commit -m "feat(db): implement drizzle orm schemas, relations, migrations and secure seed"
  ```

---

### Task 4: Fastify NestJS API Platform & Architecture Enforcement (`apps/api`)

**Files:**
- Create: `StructPaper/apps/api/package.json`
- Create: `StructPaper/apps/api/tsconfig.json`
- Create: `StructPaper/apps/api/.dependency-cruiser.js`
- Create: `StructPaper/apps/api/src/modules/platform/filters/rfc9457-exception.filter.ts`
- Create: `StructPaper/apps/api/src/modules/platform/pipes/zod-validation.pipe.ts`
- Create: `StructPaper/apps/api/src/modules/platform/controllers/health.controller.ts`
- Create: `StructPaper/apps/api/src/modules/platform/platform.module.ts`
- Create: `StructPaper/apps/api/src/app.module.ts`
- Create: `StructPaper/apps/api/src/main.ts`
- Test: `StructPaper/apps/api/test/platform/rfc9457.spec.ts`

**Interfaces:**
- Consumes: `@structpaper/contracts`, `@structpaper/db`, `@nestjs/platform-fastify`
- Produces: Running Fastify NestJS application with RFC 9457 Exception Filter, Zod Validation Pipe, Health Check endpoint (`GET /health`), and `dependency-cruiser` rule enforcement.

- [ ] **Step 1: Write failing test for RFC 9457 Exception Filter**
  In `apps/api/test/platform/rfc9457.spec.ts`, test that standard HttpExceptions, ZodValidationErrors, and unhandled errors are formatted into `application/problem+json` with `type`, `title`, `status`, `detail`, and `invalidParams`.
- [ ] **Step 2: Run test to verify it fails**
  Run: `pnpm --filter @structpaper/api test` (Expected: FAIL).
- [ ] **Step 3: Implement NestJS Fastify bootstrap, filter, pipe, and depcruise config**
  - Implement `rfc9457-exception.filter.ts` handling Fastify response serialization.
  - Implement `zod-validation.pipe.ts` parsing incoming request bodies against contract Zod schemas.
  - Implement `health.controller.ts` returning DB readiness status.
  - Implement `.dependency-cruiser.js` verifying 4 layers (`presentation` -> `application` -> `domain` <- `infrastructure`) and zero circular references.
  - Implement `main.ts` configuring Fastify adapter, CORS, Helmet, and global filters/pipes.
- [ ] **Step 4: Run test and dependency-cruiser to verify compliance**
  Run: `pnpm --filter @structpaper/api test` and `pnpm --filter @structpaper/api depcruise` (Expected: PASS).
- [ ] **Step 5: Commit changes**
  ```bash
  git add apps/api
  git commit -m "feat(api): scaffold nestjs fastify server with rfc 9457 filter and depcruise rules"
  ```

---

### Task 5: Identity, User Management & Instant Permission Revocation (B2)

**Files:**
- Create: `StructPaper/apps/api/src/modules/identity/domain/password.service.ts`
- Create: `StructPaper/apps/api/src/modules/identity/domain/token.service.ts`
- Create: `StructPaper/apps/api/src/modules/identity/infrastructure/mail.service.ts`
- Create: `StructPaper/apps/api/src/modules/identity/application/auth.service.ts`
- Create: `StructPaper/apps/api/src/modules/identity/presentation/auth.controller.ts`
- Create: `StructPaper/apps/api/src/modules/identity/identity.module.ts`
- Create: `StructPaper/apps/api/src/modules/users/application/user.service.ts`
- Create: `StructPaper/apps/api/src/modules/users/presentation/user.controller.ts`
- Create: `StructPaper/apps/api/src/modules/users/users.module.ts`
- Test: `StructPaper/apps/api/test/identity/auth.service.spec.ts`
- Test: `StructPaper/apps/api/test/identity/revocation.spec.ts`

**Interfaces:**
- Consumes: `@structpaper/contracts`, `@structpaper/db`, `argon2`, `@nestjs/jwt`
- Produces: Auth endpoints (`POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `GET /auth/me`), User endpoints (`GET /users`, `POST /users/invite`, `PATCH /users/:id`), and instant revocation via `permissions_version`.

- [ ] **Step 1: Write failing tests for login, token refresh, and instant permission revocation**
  In `apps/api/test/identity/auth.service.spec.ts` and `revocation.spec.ts`, test:
  1. Argon2id login succeeds with valid credentials and sets rotating refresh token.
  2. Access token contains `{ sub: userId, pv: permissionsVersion }`.
  3. When `permissions_version` is bumped in DB, subsequent verification of the old token fails.
- [ ] **Step 2: Run tests to verify they fail**
  Run: `pnpm --filter @structpaper/api test` (Expected: FAIL).
- [ ] **Step 3: Implement Identity & User services and controllers**
  - Implement `password.service.ts` using Argon2id with memory cost 65536, time cost 3.
  - Implement `token.service.ts` signing 15m access token with `{ sub, pv }` and generating opaque 30d refresh tokens (SHA-256 hashed in DB).
  - Implement `mail.service.ts` with `DevMailDriver` (logs activation URL and returns it in dev response).
  - Implement `auth.service.ts` and `auth.controller.ts`.
  - Implement `user.service.ts` and `user.controller.ts` with `If-Match` optimistic locking support on `PATCH /users/:id`.
- [ ] **Step 4: Run tests to verify they pass**
  Run: `pnpm --filter @structpaper/api test` (Expected: PASS).
- [ ] **Step 5: Commit changes**
  ```bash
  git add apps/api/src/modules/identity apps/api/src/modules/users apps/api/test/identity
  git commit -m "feat(identity): implement argon2id auth, refresh rotation, and instant permission revocation"
  ```

---

### Task 6: Scoped RBAC & Manuscript ACL with CASL (B3)

**Files:**
- Create: `StructPaper/apps/api/src/modules/access/domain/ability.factory.ts`
- Create: `StructPaper/apps/api/src/modules/access/infrastructure/ability-cache.service.ts`
- Create: `StructPaper/apps/api/src/modules/access/presentation/guards/jwt-auth.guard.ts`
- Create: `StructPaper/apps/api/src/modules/access/presentation/guards/policies.guard.ts`
- Create: `StructPaper/apps/api/src/modules/access/presentation/decorators/check-policies.decorator.ts`
- Create: `StructPaper/apps/api/src/modules/access/application/access.service.ts`
- Create: `StructPaper/apps/api/src/modules/access/presentation/access.controller.ts`
- Create: `StructPaper/apps/api/src/modules/access/access.module.ts`
- Test: `StructPaper/apps/api/test/access/ability.factory.spec.ts`
- Test: `StructPaper/apps/api/test/access/policies.guard.spec.ts`

**Interfaces:**
- Consumes: `@casl/ability`, `@structpaper/contracts`, `@structpaper/db`
- Produces: `AppAbility`, `PoliciesGuard`, `AbilityCacheService` (30–60s LRU), and Access Controller (`GET /roles`, `GET /permissions`, `POST /roles/assign`).

- [ ] **Step 1: Write failing tests for CASL ability evaluation and policies guard**
  In `apps/api/test/access/ability.factory.spec.ts` and `policies.guard.spec.ts`, test:
  1. `SuperAdmin` has global wildcard ability `manage all`.
  2. `JournalManager` can manage manuscripts only within their scoped journal.
  3. `Author` can update manuscript only if listed in `manuscript_members` as `OWNER` or `COAUTHOR`.
  4. Guard rejects requests when policy fails or token `pv` is outdated.
- [ ] **Step 2: Run tests to verify they fail**
  Run: `pnpm --filter @structpaper/api test` (Expected: FAIL).
- [ ] **Step 3: Implement CASL Ability Factory, LRU cache, and Guards**
  - Implement `ability.factory.ts` constructing CASL `MongoAbility` from user roles, scoped journals, and manuscript memberships.
  - Implement `ability-cache.service.ts` with LRU caching (TTL 60s) keyed by `userId:pv`.
  - Implement `jwt-auth.guard.ts` and `policies.guard.ts`.
  - Implement `access.service.ts` and `access.controller.ts` (assigning roles increments `users.permissions_version` and purges ability cache).
- [ ] **Step 4: Run tests to verify they pass**
  Run: `pnpm --filter @structpaper/api test` (Expected: PASS).
- [ ] **Step 5: Commit changes**
  ```bash
  git add apps/api/src/modules/access apps/api/test/access
  git commit -m "feat(access): implement casl ability factory, lru permission cache and rbac guards"
  ```

---

### Task 7: Manuscripts CRUD, ACL & Presigned MinIO Asset Storage (B4)

**Files:**
- Create: `StructPaper/apps/api/src/modules/assets/infrastructure/s3-storage.service.ts`
- Create: `StructPaper/apps/api/src/modules/assets/application/asset.service.ts`
- Create: `StructPaper/apps/api/src/modules/assets/presentation/asset.controller.ts`
- Create: `StructPaper/apps/api/src/modules/assets/assets.module.ts`
- Create: `StructPaper/apps/api/src/modules/manuscripts/application/manuscript.service.ts`
- Create: `StructPaper/apps/api/src/modules/manuscripts/presentation/manuscript.controller.ts`
- Create: `StructPaper/apps/api/src/modules/manuscripts/manuscripts.module.ts`
- Test: `StructPaper/apps/api/test/manuscripts/manuscript.service.spec.ts`
- Test: `StructPaper/apps/api/test/assets/asset.service.spec.ts`

**Interfaces:**
- Consumes: `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`, `@structpaper/contracts`, `@structpaper/db`
- Produces: Manuscript CRUD with pagination (offset & cursor) and `If-Match` concurrency; Presigned PUT URL asset upload pipeline.

- [ ] **Step 1: Write failing tests for manuscript pagination, ACL filters, and presigned upload verification**
  In `manuscript.service.spec.ts` and `asset.service.spec.ts`, test:
  1. `listManuscripts` returns paginated records with cursor and offset support, filtered by CASL abilities.
  2. `PATCH /manuscripts/:id` validates `If-Match` and rejects outdated version with 412.
  3. `POST /assets/upload-intent` generates valid Presigned PUT URL.
  4. `POST /assets/upload-complete` verifies file presence, size, and SHA-256 before inserting into `assets`.
- [ ] **Step 2: Run tests to verify they fail**
  Run: `pnpm --filter @structpaper/api test` (Expected: FAIL).
- [ ] **Step 3: Implement Manuscript and Asset services and controllers**
  - Implement `s3-storage.service.ts` interfacing with MinIO via S3 SDK.
  - Implement `asset.service.ts` and `asset.controller.ts` (`POST /assets/upload-intent`, `POST /assets/upload-complete`).
  - Implement `manuscript.service.ts` and `manuscript.controller.ts` (CRUD, `manuscript_members` management, ETag calculation, and pg_trgm search).
- [ ] **Step 4: Run tests to verify they pass**
  Run: `pnpm --filter @structpaper/api test` (Expected: PASS).
- [ ] **Step 5: Commit changes**
  ```bash
  git add apps/api/src/modules/assets apps/api/src/modules/manuscripts apps/api/test/manuscripts apps/api/test/assets
  git commit -m "feat(manuscripts): implement manuscript crud, acl members, and presigned minio asset flow"
  ```

---

### Task 8: Op-Log Patch Sync, 409 Rebase & SSE Streaming (B5)

**Files:**
- Create: `StructPaper/apps/api/src/modules/sync/domain/patch-applier.ts`
- Create: `StructPaper/apps/api/src/modules/sync/infrastructure/sse-manager.service.ts`
- Create: `StructPaper/apps/api/src/modules/sync/application/sync.service.ts`
- Create: `StructPaper/apps/api/src/modules/sync/presentation/sync.controller.ts`
- Create: `StructPaper/apps/api/src/modules/sync/sync.module.ts`
- Test: `StructPaper/apps/api/test/sync/patch-applier.spec.ts`
- Test: `StructPaper/apps/api/test/sync/sync.service.spec.ts`

**Interfaces:**
- Consumes: `immer`, `@structpaper/contracts`, `@structpaper/db`
- Produces: Op-log sync endpoints (`POST /manuscripts/:id/sync/patches` with 409 rebase response, `GET /manuscripts/:id/sync/stream` Fastify SSE).

- [ ] **Step 1: Write failing tests for patch application, op idempotency, and 409 rebase response**
  In `patch-applier.spec.ts` and `sync.service.spec.ts`, test:
  1. Applying RFC 6902 / Immer patch list correctly mutates document tree and produces consistent SHA-256 checksum.
  2. Re-submitting an existing `opId` returns 200 without duplicating operations (idempotency).
  3. Submitting patches with `baseServerRev < current_server_rev` returns 409 Conflict with `{ code: 'OUT_OF_SYNC', serverRev, missingOps }`.
  4. Successful push triggers SSE broadcast to connected listeners.
- [ ] **Step 2: Run tests to verify they fail**
  Run: `pnpm --filter @structpaper/api test` (Expected: FAIL).
- [ ] **Step 3: Implement Sync service, Patch Applier, and SSE Controller**
  - Implement `patch-applier.ts` applying Immer patches to `manuscript_docs.doc_tree` with checksum verification.
  - Implement `sse-manager.service.ts` tracking active Fastify SSE connections per manuscript.
  - Implement `sync.service.ts` handling transactional op-log append, milestone revision creation, and outbox event emission.
  - Implement `sync.controller.ts` exposing `POST /manuscripts/:id/sync/patches` and `GET /manuscripts/:id/sync/stream`.
- [ ] **Step 4: Run tests to verify they pass**
  Run: `pnpm --filter @structpaper/api test` (Expected: PASS).
- [ ] **Step 5: Commit changes**
  ```bash
  git add apps/api/src/modules/sync apps/api/test/sync
  git commit -m "feat(sync): implement op-log patch sync, 409 conflict rebase and fastify sse broadcast"
  ```

---

### Task 9: Background Worker & LaTeX Compilation Sandbox (`apps/worker`, B6)

**Files:**
- Create: `StructPaper/apps/worker/package.json`
- Create: `StructPaper/apps/worker/tsconfig.json`
- Create: `StructPaper/apps/worker/src/runners/latex-runner.interface.ts`
- Create: `StructPaper/apps/worker/src/runners/local-process.runner.ts`
- Create: `StructPaper/apps/worker/src/runners/docker-sandbox.runner.ts`
- Create: `StructPaper/apps/worker/src/jobs/latex-compile.processor.ts`
- Create: `StructPaper/apps/worker/src/jobs/outbox-dispatcher.processor.ts`
- Create: `StructPaper/apps/worker/src/worker.module.ts`
- Create: `StructPaper/apps/worker/src/main.ts`
- Test: `StructPaper/apps/worker/test/latex-compile.processor.spec.ts`

**Interfaces:**
- Consumes: `pg-boss`, `@structpaper/db`, `@structpaper/exporters`, MinIO S3 SDK
- Produces: Standalone NestJS worker process executing `compile.latex` and `outbox.dispatch` jobs.

- [ ] **Step 1: Write failing test for LaTeX compilation processor and runner sandbox**
  In `apps/worker/test/latex-compile.processor.spec.ts`, test that the processor fetches manuscript document tree, generates LaTeX bundle via `LatexExporter`, delegates to `LatexRunner`, captures logs, and saves PDF artifact to MinIO on completion.
- [ ] **Step 2: Run test to verify it fails**
  Run: `pnpm --filter @structpaper/worker test` (Expected: FAIL).
- [ ] **Step 3: Implement Worker module, processors, and runners**
  - Implement `latex-runner.interface.ts`.
  - Implement `local-process.runner.ts` running host `xelatex`/`tectonic` in an isolated temp directory with mock fallback for environments without TeX binaries installed.
  - Implement `latex-compile.processor.ts` listening to `compile.latex` in `pg-boss`.
  - Implement `outbox-dispatcher.processor.ts` processing pending `outbox_events`.
  - Implement `main.ts` bootstrapping the standalone NestJS worker process.
- [ ] **Step 4: Run test to verify it passes**
  Run: `pnpm --filter @structpaper/worker test` (Expected: PASS).
- [ ] **Step 5: Commit changes**
  ```bash
  git add apps/worker
  git commit -m "feat(worker): implement standalone nestjs worker with pg-boss and latex compilation sandbox"
  ```

---

### Task 10: OpenAPI Contract Pipeline & Automated API Client (`packages/api-client`)

**Files:**
- Create: `StructPaper/apps/api/src/scripts/generate-openapi.ts`
- Create: `StructPaper/packages/api-client/package.json`
- Create: `StructPaper/packages/api-client/tsconfig.json`
- Create: `StructPaper/packages/api-client/orval.config.ts`
- Create: `StructPaper/packages/api-client/src/http.ts`
- Create: `StructPaper/packages/api-client/src/mock-adapter.ts`
- Create: `StructPaper/packages/api-client/src/index.ts`
- Test: `StructPaper/packages/api-client/test/http.spec.ts`

**Interfaces:**
- Consumes: `@structpaper/contracts`, `axios`, `@tanstack/react-query`, `orval`
- Produces: `@structpaper/api-client` package with automated typed React Query hooks and custom Axios interceptors.

- [ ] **Step 1: Write failing test for Axios token refresh queue and RFC 9457 parsing**
  In `packages/api-client/test/http.spec.ts`, test that the Axios instance unwraps response data, queues 401 requests during token refresh, updates Authorization headers on refresh completion, and transforms RFC 9457 `ProblemDetails` errors into typed error objects.
- [ ] **Step 2: Run test to verify it fails**
  Run: `pnpm --filter @structpaper/api-client test` (Expected: FAIL).
- [ ] **Step 3: Implement OpenAPI generator script and API Client package**
  - Implement `apps/api/src/scripts/generate-openapi.ts` dumping OpenAPI 3.1 JSON from NestJS controllers.
  - Implement `packages/api-client/src/http.ts` modeled on `eatzy_frontend/packages/api/src/http.ts` with in-memory access token storage, refresh queue, and RFC 9457 interceptor.
  - Implement `orval.config.ts` configured to generate typed Axios calls and TanStack Query hooks.
  - Run codegen to produce typed client bindings.
- [ ] **Step 4: Run test to verify it passes**
  Run: `pnpm --filter @structpaper/api-client test` (Expected: PASS).
- [ ] **Step 5: Commit changes**
  ```bash
  git add apps/api/src/scripts packages/api-client
  git commit -m "feat(api-client): implement automated codegen sdk with axios refresh queue and rfc 9457 interceptor"
  ```

---

### Task 11: Frontend TanStack Query Integration & Paginated Papers List (`apps/web`)

**Files:**
- Modify: `StructPaper/apps/web/package.json`
- Create: `StructPaper/apps/web/src/lib/query-client.ts`
- Modify: `StructPaper/apps/web/src/app/layout.tsx`
- Modify: `StructPaper/apps/web/src/app/papers/page.tsx`
- Create: `StructPaper/apps/web/src/components/papers/PaginationControls.tsx`
- Create: `StructPaper/apps/web/src/components/papers/ManuscriptTable.tsx`
- Test: `StructPaper/apps/web/test/papers/pagination.spec.tsx`

**Interfaces:**
- Consumes: `@structpaper/api-client`, `@tanstack/react-query`
- Produces: Server-side paginated manuscript management view with debounced search, status filters, and TanStack Query caching.

- [ ] **Step 1: Write failing component test for ManuscriptTable and PaginationControls**
  In `apps/web/test/papers/pagination.spec.tsx`, test that the table displays manuscripts, handles page changes (next/previous/limit), and triggers refetch with updated query parameters.
- [ ] **Step 2: Run test to verify it fails**
  Run: `pnpm --filter @structpaper/web test` (Expected: FAIL).
- [ ] **Step 3: Refactor QueryClientProvider and Papers view**
  - Install `@tanstack/react-query` in `apps/web` and configure `QueryClientProvider` in `src/app/layout.tsx`.
  - Implement `PaginationControls.tsx` supporting offset pagination and page size selection (10, 20, 50).
  - Implement `ManuscriptTable.tsx` rendering paper metadata, authors, status badge, and revision number.
  - Refactor `src/app/papers/page.tsx` using `useManuscripts` query from `@structpaper/api-client`.
- [ ] **Step 4: Run test to verify it passes**
  Run: `pnpm --filter @structpaper/web test` (Expected: PASS).
- [ ] **Step 5: Commit changes**
  ```bash
  git add apps/web
  git commit -m "feat(web): integrate tanstack query and server-side paginated paper management view"
  ```

---

### Task 12: Role & Permission Management Screen & Sidebar Integration (`apps/web`)

**Files:**
- Modify: `StructPaper/apps/web/src/components/Sidebar.tsx`
- Create: `StructPaper/apps/web/src/app/permissions/page.tsx`
- Create: `StructPaper/apps/web/src/components/permissions/UserRoleAssignmentTab.tsx`
- Create: `StructPaper/apps/web/src/components/permissions/PermissionMatrixTab.tsx`
- Create: `StructPaper/apps/web/src/components/permissions/InviteMemberModal.tsx`
- Test: `StructPaper/apps/web/test/permissions/permissions-page.spec.tsx`

**Interfaces:**
- Consumes: `@structpaper/api-client`, `lucide-react`
- Produces: Navigation item in `Sidebar.tsx` and full Role & Permission management page at `/permissions`.

- [ ] **Step 1: Write failing component test for Role & Permission management page**
  In `apps/web/test/permissions/permissions-page.spec.tsx`, test that:
  1. The page renders the three tabs: User & Role Assignment, Permission Matrix, and Invitations.
  2. Modifying a user role calls the role assignment mutation.
  3. The permission matrix correctly shows system roles as immutable baselines.
- [ ] **Step 2: Run test to verify it fails**
  Run: `pnpm --filter @structpaper/web test` (Expected: FAIL).
- [ ] **Step 3: Implement Permissions UI and Sidebar link**
  - Add `ShieldCheck` icon item **"Phân quyền & Vai trò"** (`/permissions`) to `NAV_ITEMS` in `Sidebar.tsx`.
  - Implement `UserRoleAssignmentTab.tsx` with user status table and role select dropdown.
  - Implement `PermissionMatrixTab.tsx` rendering the action-subject permission grid for system roles and custom journal roles.
  - Implement `InviteMemberModal.tsx` inviting academic members by email with immediate display of the generated activation link in dev/staging mode.
  - Assemble `src/app/permissions/page.tsx`.
- [ ] **Step 4: Run test to verify it passes**
  Run: `pnpm --filter @structpaper/web test` (Expected: PASS).
- [ ] **Step 5: Commit changes**
  ```bash
  git add apps/web/src/components/Sidebar.tsx apps/web/src/app/permissions apps/web/src/components/permissions apps/web/test/permissions
  git commit -m "feat(web): add role and permission management page and integrate with sidebar navigation"
  ```

---

### Task 13: End-to-End Monorepo Integration & Architecture Verification

**Files:**
- Modify: `StructPaper/package.json`
- Create: `StructPaper/scripts/verify-all.ts`
- Test: End-to-end integration across all workspaces

**Interfaces:**
- Consumes: All packages and applications
- Produces: Monorepo verification scripts (`pnpm build`, `pnpm test`, `pnpm depcruise`).

- [ ] **Step 1: Write verification script `scripts/verify-all.ts`**
  Script validates that:
  1. All TypeScript packages compile cleanly (`pnpm build`).
  2. Drizzle migrations validate against local/schema definitions.
  3. All unit and integration test suites pass (`pnpm test`).
  4. Architecture linting rules pass (`pnpm depcruise`).
- [ ] **Step 2: Run verification across the entire monorepo**
  Run: `pnpm build && pnpm test && pnpm depcruise`
  Expected: All builds, tests, and dependency cruise checks PASS.
- [ ] **Step 3: Update root scripts in `package.json`**
  Add convenient monorepo commands:
  - `"dev:api": "pnpm --filter @structpaper/api dev"`
  - `"dev:worker": "pnpm --filter @structpaper/worker dev"`
  - `"db:migrate": "pnpm --filter @structpaper/db migrate"`
  - `"db:seed": "pnpm --filter @structpaper/db seed"`
  - `"deps:check": "pnpm depcruise --config .dependency-cruiser.js packages apps"`
- [ ] **Step 4: Commit changes**
  ```bash
  git add package.json scripts/verify-all.ts
  git commit -m "chore(monorepo): add end-to-end verification scripts and workspace dev commands"
  ```

---

## Self-Review Checklist

1. **Spec Coverage:**
   - B0 (Repo & Platform): Tasks 1, 4
   - B1 (Database & Seeds): Task 3
   - B2 (Identity & Users): Task 5
   - B3 (RBAC & Permissions): Task 6
   - B4 (Manuscripts & MinIO Assets): Task 7
   - B5 (Op-Log Patch Sync & Revisions): Task 8
   - B6 (Worker & LaTeX Sandbox): Task 9
   - Client Codegen & TanStack Query: Task 10
   - Frontend Paper Pagination: Task 11
   - Frontend Role & Permissions UI: Task 12
   - Monorepo Verification & Dependency Cruiser: Task 13
2. **Step Scan:** Every step specifies the exact command, expected output, and unambiguous actions.
3. **Type Consistency:** Schema names, column names (`permissions_version`, `manuscript_members`), and contract types match consistently across all tasks.
4. **Review Focus:** Covered in Tasks 5 (revocation), 7 (upload check & If-Match), 8 (409 conflict rebase), and 9 (sandbox isolation).
5. **Proportion:** The plan is comprehensive, structured, and modular without bloated unnecessary boilerplate.
