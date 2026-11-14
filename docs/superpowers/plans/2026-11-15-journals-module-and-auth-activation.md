# Journals Module & Auth Activation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the full backend `JournalsModule` in NestJS with the 7 canonical VNUHCM journals & article types, connect it to the Frontend templates view, and build a production-grade Account Activation page (`/activate`) on the Frontend matching Eatzy aesthetics.

**Architecture:** 
1. Backend: Create a dedicated `JournalsModule` in `apps/api` adhering to the 4-layer architecture (`presentation/`, `application/`, `domain/`, `infrastructure/`), seeding 7 VNUHCM journals in `packages/db`, exposing `GET /api/v1/journals`, `GET /api/v1/journals/:id`, `GET /api/v1/journals/:id/article-types`, and `GET /api/v1/profiles/resolve`.
2. Frontend Templates: Update `useManagedJournals` hook to fetch journals from the backend API while maintaining fallback to `@structpaper/journal-profiles`.
3. Frontend Auth Activation: Create `apps/web/src/app/activate/page.tsx` and redirect route `/invite` with Framer Motion, validation, Sileo toast, Eatzy design tokens, calling `POST /api/v1/auth/activate`.

**Tech Stack:** NestJS, Drizzle ORM, PostgreSQL, Next.js 14 App Router, TypeScript, Framer Motion, TailwindCSS, Vitest, Lucide React.

**Spec:** `docs/Architecture/Kiến trúc Backend (NestJS, PostgreSQL) — Thiết kế chi tiết (1).pdf` (Mục 5.4, 6.3, 8.6, 9.5).

## Global Constraints
- Every file must adhere to tiered line limits: logic files <= 300 lines (hard cap 500), controllers/modules <= 200 lines (hard cap 300).
- Zero TypeScript errors (`tsc --noEmit`).
- All existing tests in `apps/web/test/` and `apps/api/test/` must pass.
- Design must follow Eatzy design language: `#78C841` primary accents, smooth spring physics (`type: 'spring', damping: 28, stiffness: 220`), rounded pills, accessible form controls.

---

### Task 1: Backend Seed & Schema for 7 VNUHCM Journals

**Files:**
- Modify: `packages/db/src/seed.ts`
- Modify: `packages/db/src/schema/journals.ts`
- Test: `apps/api/test/journals/journals-seed.spec.ts`

**Interfaces:**
- Produces: 7 seeded journals (`std`, `hs`, `ssh`, `ebl`, `et`, `ees`, `arns`) in PostgreSQL with names, colors, ISSNs, and article types (`research`, `review`, `special_topic`).

- [ ] **Step 1: Write test verifying all 7 VNUHCM journals exist in database after seed**
- [ ] **Step 2: Update `packages/db/src/seed.ts` with definitions for the 7 VNUHCM journals**
- [ ] **Step 3: Run seed test to verify it passes**
- [ ] **Step 4: Commit**

---

### Task 2: Backend `JournalsModule` in NestJS

**Files:**
- Create: `apps/api/src/modules/journals/journals.module.ts`
- Create: `apps/api/src/modules/journals/application/journal.service.ts`
- Create: `apps/api/src/modules/journals/presentation/journal.controller.ts`
- Modify: `apps/api/src/app.module.ts`
- Test: `apps/api/test/journals/journal.controller.spec.ts`

**Interfaces:**
- Produces:
  - `GET /api/v1/journals`: List all active journals with short codes, names, and article types.
  - `GET /api/v1/journals/:id`: Retrieve single journal by ID or slug.
  - `GET /api/v1/journals/:id/article-types`: Retrieve article types for a journal.
  - `GET /api/v1/profiles/resolve?journal=:id&type=:type`: Resolve styling profile using `@structpaper/journal-profiles`.

- [ ] **Step 1: Write integration tests for journal controller endpoints**
- [ ] **Step 2: Implement `JournalService` and `JournalController`**
- [ ] **Step 3: Register `JournalsModule` in `app.module.ts`**
- [ ] **Step 4: Run tests to verify all endpoints return 200 and valid schema**
- [ ] **Step 5: Commit**

---

### Task 3: Frontend Account Activation Page (`/activate`)

**Files:**
- Create: `apps/web/src/app/activate/page.tsx`
- Create: `apps/web/src/app/invite/page.tsx` (redirect / fallback to `/activate`)
- Test: `apps/web/test/auth/activate.spec.tsx`

**Interfaces:**
- Consumes: `POST /api/v1/auth/activate` with `{ token: string, password: string }`.
- Produces: Production-grade activation screen with token auto-detection from query params (`?token=...`), password strength indicator, confirm password matching, loading state, Sileo toast notification, and redirection to `/login`.

- [ ] **Step 1: Write tests in `apps/web/test/auth/activate.spec.tsx`**
- [ ] **Step 2: Implement `/activate` page with Framer Motion, Eatzy capsule inputs, and password verification**
- [ ] **Step 3: Implement `/invite` route delegating to `/activate`**
- [ ] **Step 4: Run tests to verify pass with 0 errors**
- [ ] **Step 5: Commit**

---

### Task 4: Connect Frontend Templates to Backend Journals API

**Files:**
- Modify: `apps/web/src/features/templates/hooks/useManagedJournals.ts`
- Modify: `apps/web/src/lib/templates/journal-storage.ts`
- Test: `apps/web/test/templates/templates-api-sync.spec.tsx`

**Interfaces:**
- Consumes: `GET /api/v1/journals` from NestJS backend via `http.get`.
- Produces: Synchronized template list reflecting server state with fallback to built-in presets when offline.

- [ ] **Step 1: Write tests for `useManagedJournals` syncing with backend API**
- [ ] **Step 2: Update `useManagedJournals` to query `/api/v1/journals`**
- [ ] **Step 3: Run tests and typecheck**
- [ ] **Step 4: Commit**
