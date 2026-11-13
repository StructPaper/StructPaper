# StructPaper Backend Architecture (NestJS, PostgreSQL) & Frontend Sync Design

## 1. Intent & Why

StructPaper is evolving from a single-user desktop/web prototype with a deprecated Java Spring Boot backend (`apps/api`) into an enterprise-grade, multi-tenant collaborative academic publishing platform. 

Based on the detailed specification (*"Kiến trúc Backend (NestJS, PostgreSQL) — Thiết kế chi tiết"* and *"Cơ chế lưu, hoàn tác và lịch sử phiên bản (kiểu Google Docs) — Thiết kế chi tiết"*), this design replaces the legacy Java backend with a modern, high-performance TypeScript modular monolith powered by **NestJS** and **Fastify**, backed by **PostgreSQL 15+** with **Drizzle ORM**, and a dedicated background worker (`apps/worker`) using **pg-boss** for heavy CPU-bound tasks (LaTeX compilation, Ghostscript PDF rendering).

Furthermore, the frontend (`apps/web`) data-fetching architecture is overhauled using patterns from `eatzy_frontend`: automated type-safe API client generation (via `Orval` / `openapi-typescript` + Axios interceptors for automatic JWT token rotation), TanStack Query for cache management, standard RFC 9457 (`application/problem+json`) error handling, server-side pagination for manuscripts, and a comprehensive Role & Permission management page integrated into the main navigation sidebar.

---

## 2. Goals, Non-Goals & Anti-Goals

### 2.1 Goals
- **Monorepo Structure (pnpm workspaces):**
  - Deprecate existing Java backend by renaming `apps/api` to `apps/api-deprecated` and updating references.
  - Create `apps/api`: NestJS + Fastify HTTP API (stateless, modular monolith).
  - Create `apps/worker`: NestJS background worker driven by `pg-boss` queues for LaTeX compilation, asset processing, and transactional outbox event dispatch.
  - Create `packages/contracts`: Zod schemas, TypeScript types, DTOs, and OpenAPI 3.1 specification pipeline.
  - Create `packages/db`: Drizzle ORM schemas, migration runners, and seed data.
  - Create `packages/api-client`: Automated code-generated API client (Orval/OpenAPI) wrapped with typed Axios interceptors, token refresh queue, and RFC 9457 error mappings.
  - Refactor `apps/web`: TanStack Query integration, paginated manuscript lists, and Role & Permission UI on sidebar.
- **Milestones Covered (B0 through B6 + Frontend Sync):**
  - **B0: Foundation & Tooling:** Fastify HTTP adapter, RFC 9457 exception filter, Zod validation pipe, Pino logger, health/metrics endpoints. Docker Compose setup for local development (Postgres 16 + MinIO).
  - **B1: Database Schema & Seeds:** Drizzle tables for Journals, Users (`permissions_version`), User Tokens, Roles, Permissions, User Roles, Role Permissions, Manuscripts, Manuscript Members (ACL), Manuscript Docs, Manuscript Ops, Manuscript Revisions, Assets, Compile Jobs, Outbox Events, Idempotency Keys, Audit Logs. Seeds for SuperAdmin (read from `INITIAL_ADMIN_PASSWORD` env or `INVITED` state), System Roles, and VNU default journal.
  - **B2: Identity & User Management:** Argon2id password hashing, admin-invite workflow (with `DevMailDriver` logging activation URLs to console and returning them in dev/staging API responses), short-lived JWT access tokens (15m, carrying `{ sub: userId, pv: permissionsVersion }`), rotating opaque refresh tokens (SHA-256 hashed in DB), user CRUD and profile management.
  - **B3: RBAC & Permissions:** CASL (`@casl/ability`) scoped permission engine (`global:*`, `journal:<id>:*`, and manuscript-level ACL via `manuscript_members`), NestJS `JwtAuthGuard` and `PoliciesGuard`. Instant permission revocation via `permissions_version` + backend LRU Cache (30–60s).
  - **B4: Journals, Manuscripts & Assets (MinIO):** Journal configuration, manuscript CRUD with `pg_trgm` search and pagination (offset & cursor), `ETag` / `If-Match` optimistic concurrency control on resource updates, MinIO S3 integration using **Presigned PUT URL** flow (client uploads directly to MinIO, backend completes with magic-byte and SHA-256 validation).
  - **B5: Patch Sync & Revisions (Google Docs Op-Log Architecture):** 
    - `manuscript_docs` maintains the authoritative current document tree.
    - `manuscript_ops` stores the append-only operational log with `server_rev`, `client_rev`, `op_id`, `patches`.
    - `POST /manuscripts/:id/sync/patches` (or `PUT /manuscripts/:id/ops`) enforces idempotency via `op_id`.
    - Concurrent conflicts (`baseServerRev < current_server_rev`) return RFC 9457 HTTP 409 Conflict with missing remote ops delta for automatic client-side rebase.
    - Periodic or manual milestone checkpoints saved to `manuscript_revisions`.
    - SSE stream (`GET /manuscripts/:id/sync/stream`) broadcasts new ops to active collaborators.
  - **B6: LaTeX Compilation Worker:** NestJS worker queue consumer for `compile.latex` via `pg-boss`, `LatexExporter` bundle generation, modular `LatexRunner` (supporting host CLI process sandbox and optional Docker sandbox), log capture, PDF artifact upload to MinIO.
  - **Frontend Refactor:** TanStack Query client, automated API SDK, manuscript list pagination, role/permission management page at `/permissions`.

### 2.2 Non-Goals
- **B7 Module (Deferred):** Desktop release artifacts, auto-updater server, client remote configuration, and AI proxy are deferred as requested by the user.
- **Java Maintenance:** No new features or bug fixes in `apps/api-deprecated`.

### 2.3 Anti-Goals
- **No monolithic "God-files":** Every module follows the 4-layer structure (`presentation`, `application`, `domain`, `infrastructure`). Files stay focused (<300 lines).
- **No in-process LaTeX execution:** Never compile LaTeX directly inside the Fastify HTTP request loop. All compilation is offloaded to `apps/worker` via `pg-boss`.
- **No bypass of authorization:** Never query or mutate manuscript/user records without scoped CASL ability verification.
- **No heavy uploads through API RAM:** High-resolution assets must never stream through Fastify memory. Use Presigned PUT URLs directly to MinIO.

---

## 3. Environment & Infrastructure Strategy

### 3.1 Two-Stage Deployment Strategy
1. **Stage 1 (Local Dev First):** 
   - A complete `docker-compose.yml` at root providing local PostgreSQL 16 (with extensions) and local MinIO (port 9000/9001).
   - Allows rapid offline iteration, development, and integration testing without VPN dependency.
2. **Stage 2 (Staging Switch via Environment Variables):**
   - Configured strictly via environment variables (never committed to git):
     - `DATABASE_URL`: Staging Postgres connection URL (`postgresql://<USER>:<PASS>@<HOST>:5432/<DB_NAME>`).
     - `S3_ENDPOINT`: Staging MinIO URL.
     - `S3_BUCKET`: Staging bucket name.
     - `S3_ACCESS_KEY`: Staging S3 Access Key.
     - `S3_SECRET_KEY`: Staging S3 Secret Key.
   - **Prerequisites for Staging Database & Storage:**
     - Database user must have privileges to run `CREATE EXTENSION IF NOT EXISTS citext, pg_trgm, unaccent, "uuid-ossp"` and create the `pgboss` schema.
     - MinIO bucket must have CORS configured to permit browser PUT requests from the frontend origin.

### 3.2 Email & Invitation Channel (Developer-Friendly)
- Abstract `MailService` interface.
- When `SMTP_HOST` is not set or in development/staging:
  - System uses `DevMailDriver`: prints activation and password reset URLs directly to the console log.
  - Non-production API responses for invite and password reset endpoints also include the generated `activationUrl` and `token` for seamless manual and automated testing.
- When production SMTP credentials are later supplied, `SmtpMailDriver` activates automatically without code changes.

---

## 4. Approaches Considered

### Approach A: Two-Process Modular Monolith (`apps/api` + `apps/worker` + Shared Packages) — *Selected*
- Separates HTTP API (Fastify) from background worker (`pg-boss`).
- Strict 4-layer architecture per NestJS module.
- Shared contracts, database schemas, and client SDK packages.
- Automated API client generation (`Orval` / `openapi-typescript`) wrapped with custom Axios interceptors.
- *Pros:* Matches the architecture specification 100%, insulates the HTTP thread from LaTeX CPU starvation, fully scalable.
- *Cons:* Requires managing two processes in development (automated via pnpm scripts).

### Approach B: Single Process NestJS (Merged API + Worker) — *Rejected*
- Combine API and compilation queue processing in a single Node.js runtime.
- *Trade-off:* Spikes in LaTeX compilation load degrade API latency and can block the Fastify event loop. Deviates from the architecture specification.

---

## 5. Architectural Breakdown & Module Details

```
StructPaper/
├── apps/
│   ├── api/                     # NestJS + Fastify HTTP API (Stateless)
│   │   ├── src/
│   │   │   ├── modules/
│   │   │   │   ├── identity/    # Auth, Login, Refresh, Sessions
│   │   │   │   ├── users/       # User profile, Invitations, Password reset
│   │   │   │   ├── access/      # RBAC, CASL Ability, Roles, Permissions
│   │   │   │   ├── journals/    # Journal configuration & profiles (If-Match support)
│   │   │   │   ├── manuscripts/ # Manuscript CRUD, Pagination, Search, Members ACL
│   │   │   │   ├── sync/        # Op-log sync, SSE events, Checksums, 409 Rebase
│   │   │   │   ├── assets/      # Presigned PUT upload intent & complete endpoints
│   │   │   │   ├── compile/     # Job dispatch & status API
│   │   │   │   └── platform/    # Health, Metrics, RFC 9457 Filter
│   │   │   ├── main.ts
│   │   │   └── app.module.ts
│   ├── worker/                  # NestJS Worker (pg-boss consumers)
│   │   ├── src/
│   │   │   ├── jobs/
│   │   │   │   ├── latex-compile.processor.ts
│   │   │   │   ├── outbox-dispatcher.processor.ts
│   │   │   │   └── asset-cleanup.processor.ts
│   │   │   ├── runners/
│   │   │   │   ├── local-process.runner.ts
│   │   │   │   └── docker-sandbox.runner.ts
│   │   │   ├── main.ts
│   │   │   └── worker.module.ts
│   ├── api-deprecated/          # Preserved legacy Java Spring Boot code
│   └── web/                     # Next.js 14 Frontend
│       ├── src/
│       │   ├── app/
│       │   │   ├── (auth)/login/
│       │   │   ├── permissions/ # NEW: Role & Permission Management
│       │   │   ├── papers/      # Refactored: Server-side pagination & TanStack Query
│       │   │   └── ...
│       │   ├── lib/
│       │   │   ├── api/         # Generated API client + Axios interceptors
│       │   │   └── auth/        # Token management & session store
│       │   └── components/
│       │       └── Sidebar.tsx  # Added 'Phân quyền' navigation item
├── packages/
│   ├── contracts/               # Zod schemas, DTOs, API Interfaces, OpenAPI Generator
│   ├── db/                      # Drizzle schemas, Migrations, Seeds
│   ├── api-client/              # Codegen SDK (Orval) + Axios Interceptors + Mock Fallback
│   └── ...                      # Existing packages (doc-model, editor-core, etc.)
```

### 5.1 `packages/contracts`
- Zod schemas validating all API inputs and outputs:
  - Auth: `LoginRequestSchema`, `TokenResponseSchema`, `InviteUserSchema`, `ResetPasswordSchema`.
  - Access: `RoleSchema`, `PermissionSchema`, `AssignRoleSchema`.
  - Manuscripts: `CreateManuscriptSchema`, `UpdateManuscriptSchema`, `ManuscriptQuerySchema` (supports cursor & offset pagination), `AddManuscriptMemberSchema`.
  - Assets: `UploadIntentSchema`, `UploadCompleteSchema`.
  - Sync: `SubmitOpsSchema` (`baseServerRev`, `clientRev`, `opId`, `patches`), `OpsDeltaResponseSchema`.
  - Compile: `TriggerCompileSchema`, `CompileJobResponseSchema`.
- Exports TypeScript types inferred from Zod schemas: `z.infer<typeof ...>`.
- Generates `openapi.json` for consumption by `packages/api-client`.
- Standard RFC 9457 Problem Details schema:
  ```ts
  export interface ProblemDetails {
    type: string;
    title: string;
    status: number;
    detail: string;
    instance?: string;
    code?: string;
    invalidParams?: Array<{ name: string; reason: string }>;
  }
  ```

### 5.2 `packages/db` (Drizzle ORM & PostgreSQL)
- **Schemas:**
  - `journals`: `id` (uuid), `slug` (citext), `name`, `issn`, `settings` (jsonb), `version` (int, for ETag), `created_at`, `updated_at`.
  - `users`: `id` (uuid), `email` (citext, unique), `password_hash`, `display_name`, `avatar_url`, `status` (`ACTIVE`, `INVITED`, `SUSPENDED`), `permissions_version` (int, default 1), `created_at`, `updated_at`.
  - `user_tokens`: `id` (uuid), `user_id`, `type` (`INVITATION`, `PASSWORD_RESET`), `token_hash` (sha256), `expires_at`, `consumed_at`, `created_at`.
  - `roles`: `id` (uuid), `journal_id` (uuid, nullable for global), `name`, `description`, `is_system` (boolean).
  - `permissions`: `id` (uuid), `action` (varchar), `subject` (varchar), `conditions` (jsonb).
  - `user_roles`: `user_id`, `role_id`, `scope_journal_id` (composite PK).
  - `role_permissions`: `role_id`, `permission_id` (composite PK).
  - `refresh_tokens`: `id` (uuid), `user_id`, `token_hash` (sha256), `expires_at`, `revoked_at`, `created_at`.
  - `manuscripts`: `id` (uuid), `journal_id`, `title`, `abstract`, `status` (`DRAFT`, `SUBMITTED`, `IN_REVIEW`, `ACCEPTED`, `REJECTED`, `PUBLISHED`), `created_by`, `current_server_rev` (int), `version` (int, for ETag), `metadata` (jsonb), `created_at`, `updated_at`.
  - `manuscript_members`: `manuscript_id` (uuid), `user_id` (uuid), `role` (`OWNER`, `COAUTHOR`, `EDITOR`, `REVIEWER`), `created_at`. Composite PK: `(manuscript_id, user_id)`.
  - `manuscript_docs`: `manuscript_id` (PK, uuid), `doc_tree` (jsonb), `server_rev` (int), `updated_at`.
  - `manuscript_ops`: `id` (uuid), `manuscript_id`, `server_rev` (int), `client_rev` (int), `op_id` (uuid, unique), `patches` (jsonb), `checksum` (sha256), `created_by`, `created_at`.
  - `manuscript_revisions`: `id` (uuid), `manuscript_id`, `server_rev` (int), `tag_name` (varchar, e.g. "Draft v1", "Submission checkpoint"), `snapshot` (jsonb), `checksum` (sha256), `created_by`, `created_at`.
  - `assets`: `id` (uuid), `manuscript_id` (uuid, nullable for avatars/logos), `filename`, `file_size`, `mime_type`, `storage_key`, `checksum`, `created_by`, `created_at`.
  - `compile_jobs`: `id` (uuid), `manuscript_id`, `revision_id` (nullable), `server_rev`, `status` (`QUEUED`, `PROCESSING`, `COMPLETED`, `FAILED`), `engine` (`XELATEX`, `TECTONIC`), `log_output` (text), `pdf_asset_id` (uuid, nullable), `duration_ms` (int), `created_at`.
  - `outbox_events`: `id` (uuid), `aggregate_type` (varchar), `aggregate_id` (uuid), `event_type` (varchar), `payload` (jsonb), `status` (`PENDING`, `PROCESSED`, `FAILED`), `retry_count` (int), `created_at`, `processed_at`.
  - `idempotency_keys`: `key` (varchar, PK), `user_id` (uuid), `request_hash` (varchar), `response_body` (jsonb), `status_code` (int), `expires_at` (timestamp), `created_at`.
  - `audit_logs`: `id` (uuid), `user_id`, `action`, `resource_type`, `resource_id`, `payload` (jsonb), `ip_address`, `created_at`.
- **Migrations & Seeds:**
  - Forward-only SQL migrations via `drizzle-kit`.
  - Secure seed script:
    - Default Journal: *Tạp chí Phát triển Khoa học và Công nghệ ĐHQG-HCM* (`vnu-jst`).
    - System Roles: `SuperAdmin` (global), `JournalManager`, `Editor`, `Author`, `Reviewer`.
    - Default SuperAdmin user: `admin@structpaper.org` (created in `INVITED` state; prints one-time activation link to console, or uses password from `INITIAL_ADMIN_PASSWORD` env variable when supplied). No hardcoded passwords in source.

### 5.3 `apps/api` (NestJS Modular Monolith)
- **Layering per Module:**
  - `presentation/`: Controllers, DTOs, Route decorators.
  - `application/`: Commands, Queries, Use-case services.
  - `domain/`: Domain entities, value objects, domain logic.
  - `infrastructure/`: Drizzle repositories, external adapters.
- **Security & Instant RBAC Revocation:**
  - Argon2id password hashing (memory 64MB, iterations 3).
  - Access Token: Short-lived JWT (15 min) payload contains ONLY `{ sub: userId, pv: permissionsVersion }`.
  - Backend resolves CASL abilities dynamically, backed by an LRU Cache (30–60s TTL).
  - When an admin updates roles or permissions, `users.permissions_version` is incremented in DB and the cache is immediately evicted. Any subsequent request with an outdated `pv` is immediately rejected (401), achieving instant revocation.
  - Refresh Token: Secure HTTP-only cookie or authorization body, 30-day lifetime, rotated on each refresh, stored as SHA-256 hash in DB.
  - Guards: `JwtAuthGuard` -> `PoliciesGuard` (`@CheckPolicies((ability) => ability.can(...))`).
  - Resource ACL: CASL evaluates `manuscript_members` to ensure authors, coauthors, reviewers, and editors can only access authorized manuscripts.
- **Optimistic Concurrency Control (`ETag` / `If-Match`):**
  - Metadata mutations (`PATCH /manuscripts/:id`, `PATCH /journals/:id`, `PATCH /users/:id`) emit `ETag` based on the resource `version` column and require `If-Match` headers. If version conflicts, responds with HTTP 412 Precondition Failed.
- **Presigned PUT URL Asset Storage (MinIO S3):**
  - `POST /assets/upload-intent`: Authenticated user requests upload URL with filename, MIME type, and expected file size. Backend authorizes and generates Presigned PUT URL.
  - Client uploads directly to MinIO, completely bypassing Fastify RAM.
  - `POST /assets/upload-complete`: Client notifies backend with `storageKey` and client-computed checksum. Backend inspects MinIO object, verifies magic bytes and SHA-256 hash, inserts `assets` record, and returns asset metadata.
- **Sync & Revisions (Op-Log Engine):**
  - `POST /manuscripts/:id/sync/patches` (or `PUT /manuscripts/:id/ops`):
    - Validates `opId` in DB: if already applied, returns 200 OK (idempotent).
    - If `baseServerRev < current_server_rev`: returns HTTP 409 Conflict with `{ code: 'OUT_OF_SYNC', serverRev: current_server_rev, missingOps: [...] }` so client rebases locally.
    - If synchronized: increments `server_rev`, applies Immer/RFC 6902 patches to `manuscript_docs.doc_tree`, appends to `manuscript_ops`, updates checksum, broadcasts SSE event to `GET /manuscripts/:id/sync/stream`.
    - Every N ops (or on explicit save checkpoint), saves snapshot into `manuscript_revisions`.

### 5.4 `apps/worker` (NestJS + pg-boss)
- Connects to PostgreSQL database via `pg-boss`.
- Worker Queues:
  - `compile.latex`:
    1. Fetches manuscript document state from `manuscript_docs` (or revision snapshot).
    2. Invokes `@structpaper/exporters` (`LatexExporter`) to generate the full LaTeX project bundle.
    3. Runs compile sandbox via `LatexRunner` (`LocalProcessRunner` using host `xelatex`/`tectonic` with fallback mock, or `DockerSandboxRunner`).
    4. Captures stdout/stderr compilation logs into `compile_jobs.log_output`.
    5. On success: uploads resulting PDF to MinIO bucket, inserts record into `assets`, marks job `COMPLETED`.
    6. On failure: records error details, marks job `FAILED`.
  - `outbox.dispatch`:
    - Polls/receives `outbox_events` and dispatches background tasks (sending emails, triggering compile jobs) reliably without losing events.
- Self-recovering with configurable job timeouts and retry policies.

### 5.5 `packages/api-client` & Frontend Refactoring (`apps/web`)
- **API Client (Automated Codegen):**
  - Uses `Orval` / `openapi-typescript` consuming the OpenAPI 3.1 schema generated from `packages/contracts`.
  - Produces typed API endpoints and React Query hooks automatically without manual boilerplate.
  - Custom Axios instance configured with:
    - In-memory access token storage with automatic request interception.
    - Request queuing during token refresh (`subscribeTokenRefresh` / `onRefreshed`).
    - RFC 9457 error interceptor translating `application/problem+json` into typed exceptions and user-friendly toast notifications.
    - Mock mode / offline fallback adapter for smooth UI development when staging DB/VPN is offline.
- **TanStack Query Integration:**
  - `QueryClientProvider` configured in `src/app/layout.tsx`.
  - Auto-generated and custom React query hooks:
    - `useManuscripts(query)`: Paginated manuscript list with cursor/offset support, keyword search, and journal filtering.
    - `useManuscript(id)`: Detailed manuscript fetch and cache.
    - `usePatchSync(manuscriptId)`: Operational patch submission with 409 rebase and SSE sync subscriber.
    - `useRoles()` & `usePermissions()`: Role definitions and user permission matrices.
    - `useUsers(query)`: User list with role assignment mutations.
- **Roles & Permissions UI (`/permissions`):**
  - New sidebar navigation item: **"Phân quyền & Vai trò"** (Icon: `ShieldCheck`).
  - Three primary tabs:
    1. **Người dùng & Phân vai:** Table of users, statuses, assigned roles (SuperAdmin, JournalManager, Editor, Author, Reviewer), and quick role assignment modal.
    2. **Ma trận Quyền (Permission Matrix):** Interactive grid showing system roles (baseline immutable) and journal roles vs actions.
    3. **Lời mời thành viên (Invitations):** Form to invite academic members by email with pre-assigned roles and journal scopes (displaying activation link directly in UI when in dev/staging).
- **Paper Management Refactor (`/papers`):**
  - Modern paginated table with page size selector, next/previous buttons, and search input with debounced query.
  - Direct integration with TanStack Query.

---

## 6. What Is Left to the Builder
- Exact internal variable naming and granular helper functions.
- Exact CSS classes (Tailwind CSS matching existing design language).
- Test mock fixtures and unit test assertions.
- Development scripts in `package.json` for running both `apps/api` and `apps/worker` concurrently.

---

## 7. Verification & Success Criteria
1. **Monorepo Build:** `pnpm install` and `pnpm build` succeed cleanly across all workspaces.
2. **Architecture Compliance (`dependency-cruiser`):**
   - Run `pnpm depcruise` / `pnpm deps:check` to verify 100% adherence to 4-layer architecture (`presentation` -> `application` -> `domain` <- `infrastructure`) and zero circular dependencies.
3. **Database & Migrations:** Drizzle schema migrations run successfully against PostgreSQL (including `manuscript_members`, `outbox_events`, `idempotency_keys`).
4. **Seeding:** Creates default journal and superadmin (with activation link/token, no hardcoded password in source).
5. **Auth & Instant Revocation:**
   - Auth endpoints (`/api/v1/auth/login`, `/api/v1/auth/refresh`, `/api/v1/users/invite`) function correctly with JWT rotation.
   - Incrementing `permissions_version` immediately revokes access for active tokens.
6. **CASL Scoped & ACL Authorization:** Guards block unauthorized access and allow authorized roles based on journal scope and `manuscript_members`.
7. **Concurrency & Presigned Uploads:**
   - `If-Match` validation blocks conflicting updates with HTTP 412.
   - Presigned PUT flow uploads directly to MinIO and completes with magic-byte verification.
8. **Op-Log Sync:** Ingestion with `opId` idempotency and 409 rebase handling persists document updates cleanly without snapshot bloat.
9. **Worker Compilation:** Worker compiles a manuscript bundle into PDF and persists artifact in MinIO.
10. **Frontend:** TanStack Query + generated Axios client renders the paginated paper list and enables Role & Permission management from the sidebar.
