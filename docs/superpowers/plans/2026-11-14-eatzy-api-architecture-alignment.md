# Eatzy API Architecture Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-architect StructPaper's API calling infrastructure to strictly mirror the proven `eatzy_frontend` pattern: unified Axios HTTP client under `/api/proxy`, dedicated modular API objects (`authApi`, `manuscriptApi`, `assetApi`, `compileApi`), session hydration with `useAuth`, complete removal of raw `fetch` in `DocumentApi`, proper ID & version state propagation on creation, TanStack Query cache invalidation, and backend compile integration.

**Architecture:** Standardize on a single Axios instance in `@structpaper/api-client` configured with `baseURL: '/api/proxy'`, proxy rewrites in Next.js, and automatic JWT bearer attachment + 401 refresh token queue. Eliminate raw `fetch` calls in `DocumentApi` so all editor persistence flows go through the authenticated Axios client. Ensure React Query cache is automatically invalidated when papers are created/saved, and provide background reconciliation at the unified `/papers` hub.

**Tech Stack:** Next.js 14, Axios, TanStack React Query, Zustand, NestJS, TypeScript, Vitest.

**Spec:** Reference architecture in `eatzy_frontend/packages/api/src/http.ts`, `eatzy_frontend/apps/restaurant/next.config.mjs`, and `eatzy_frontend/apps/restaurant/src/features/auth/hooks/useAuth.ts`.

## Global Constraints
- Single source of truth for HTTP requests: all network calls must flow through the central Axios client (`http`).
- No mock mode needed (user explicit requirement: real API calls only).
- Zero data loss: Local-First IndexedDB persistence remains active as fallback.
- Strictly adhere to TypeScript strict mode with no type regressions.

## Review Focus
1. Bearer Token presence: Verify every outgoing request has `Authorization: Bearer <token>` when authenticated.
2. 401 Refresh Token queue: Verify expired tokens trigger `/api/v1/auth/refresh` without infinite loops.
3. Editor Save & Autosave: Verify `DocumentApi` requests are authenticated and transition `saveState` to `'saved'` (Cloud icon) instead of `'saved-local'`.
4. Creation ID propagation: Verify `createManuscript` response UUID is captured and replaces the temporary local ID in both React state and IndexedDB.
5. React Query cache invalidation: Verify creating/updating a manuscript immediately updates the `/papers` list without manual page reload.

---

### Task 1: Setup Unified Axios HTTP Client (`/api/proxy` baseURL & Interceptors) & Next.js Rewrite

**Files:**
- Modify: `packages/api-client/src/http.ts`
- Modify: `apps/web/next.config.mjs`
- Modify: `packages/api-client/src/index.ts`
- Test: `packages/api-client/test/http.spec.ts`

- [x] **Step 1: Write failing unit test in `packages/api-client/test/http.spec.ts`**
  - Test that `http.defaults.baseURL` is `/api/proxy`.
  - Test that requests attach `Authorization: Bearer <token>` when `accessToken` is set.
  - Test that 401 responses trigger token refresh callback and retry the original request.
- [x] **Step 2: Update `packages/api-client/src/http.ts`**
  - Set `baseURL: '/api/proxy'`.
  - Configure request interceptor to attach Bearer token.
  - Configure response interceptor to handle 401 queue with `/api/v1/auth/refresh`.
  - Remove unused mock adapter logic.
- [x] **Step 3: Update `apps/web/next.config.mjs` rewrites**
  - Add rewrite rule forwarding `/api/proxy/:path*` to `${process.env.INTERNAL_API_URL || 'http://localhost:3001'}/:path*`.
- [x] **Step 4: Run unit tests**
  - Run `pnpm --filter @structpaper/api-client test` and ensure all tests pass.
- [x] **Step 5: Commit changes**
  - Commit as `feat(api-client): configure unified axios http client with /api/proxy and token refresh`.

---

### Task 2: Implement Clean API Modules (`authApi`, `manuscriptApi`, `assetApi`, `compileApi`)

**Files:**
- Create: `packages/api-client/src/modules/auth.ts`
- Create: `packages/api-client/src/modules/manuscripts.ts`
- Create: `packages/api-client/src/modules/assets.ts`
- Create: `packages/api-client/src/modules/compile.ts`
- Modify: `packages/api-client/src/index.ts`
- Test: `packages/api-client/test/api-modules.spec.ts`

- [x] **Step 1: Write unit tests in `packages/api-client/test/api-modules.spec.ts`**
  - Test each method of `authApi` (`login`, `logout`, `getAccount`, `refreshToken`).
  - Test `manuscriptApi` (`list`, `get`, `create`, `update`, `delete`, `getMembers`, `addMember`, `removeMember`).
  - Test `assetApi` (`putAsset`, `getAssetBlob`, `hasAsset`).
  - Test `compileApi` (`compileLatex`).
- [x] **Step 2: Implement the API modules**
  - Mirroring `eatzy_frontend/packages/api/src/auth.ts`, `file.ts`, etc.:
  - Define `authApi` using `http.post('/api/v1/auth/login')`, `http.get('/api/v1/auth/account')`, etc.
  - Define `manuscriptApi` using `http.get('/api/v1/manuscripts')`, `http.post('/api/v1/manuscripts')`, `http.patch('/api/v1/manuscripts/:id')`, etc.
  - Define `assetApi` using `http.put('/api/v1/assets/:hash')`, `http.get('/api/v1/assets/:hash', { responseType: 'blob' })`, etc.
  - Define `compileApi` calling `http.post('/api/v1/compile/latex', ... , { responseType: 'blob' })`.
- [x] **Step 3: Export from `packages/api-client/src/index.ts`**
  - Export `authApi`, `manuscriptApi`, `assetApi`, `compileApi`.
- [x] **Step 4: Run unit tests**
  - Run `pnpm --filter @structpaper/api-client test` and confirm pass.
- [x] **Step 5: Commit changes**
  - Commit as `feat(api-client): add modular api services matching eatzy architecture`.

---

### Task 3: Implement `useAuth` Hook, Session Hydration, and Auth Store Sync

**Files:**
- Create: `apps/web/src/hooks/useAuth.ts`
- Modify: `apps/web/src/lib/auth-store.ts`
- Modify: `apps/web/src/components/layout/AppShell.tsx`
- Test: `apps/web/test/auth/use-auth.spec.tsx`

- [ ] **Step 1: Write unit tests for `useAuth` in `apps/web/test/auth/use-auth.spec.tsx`**
  - Test session check calling `authApi.getAccount()`.
  - Test automatic synchronization into `useAuthStore` and `setAccessToken`.
  - Test unauthenticated fallback handling.
- [ ] **Step 2: Implement `apps/web/src/hooks/useAuth.ts`**
  - Mirroring `eatzy_frontend/apps/restaurant/src/features/auth/hooks/useAuth.ts`:
  - Use `useQuery({ queryKey: ['auth', 'me'], queryFn: () => authApi.getAccount() })`.
  - On data: `setUser(user)` and `setAccessToken(token)`.
  - On 401 error: `clearAuth()` and redirect to `/login` when appropriate.
- [ ] **Step 3: Wire `useAuth` in `AppShell.tsx`**
  - Ensure every page render has access to active session and token in Axios memory.
- [ ] **Step 4: Run tests**
  - Run `pnpm --filter @structpaper/web test` on auth tests.
- [ ] **Step 5: Commit changes**
  - Commit as `feat(web): add useAuth hook and session hydration mirroring eatzy`.

---

### Task 4: Refactor `DocumentApi` to Use Axios `http` from `@structpaper/api-client`

**Files:**
- Modify: `apps/web/src/lib/documents/document-api.ts`
- Test: `apps/web/test/documents/document-api-axios.spec.ts`

- [ ] **Step 1: Write unit tests in `apps/web/test/documents/document-api-axios.spec.ts`**
  - Test `DocumentApi.list()`, `DocumentApi.get(id)`, `DocumentApi.create(...)`, `DocumentApi.save(...)`, `DocumentApi.putAsset(...)`.
  - Verify that requests go through `http` and include Bearer authentication.
- [ ] **Step 2: Refactor `DocumentApi` in `apps/web/src/lib/documents/document-api.ts`**
  - Remove raw `fetch` and `fetchImpl`.
  - Delegate all requests to `http` or `manuscriptApi` / `assetApi`.
  - Map Axios response and errors to `ApiError` for complete backward compatibility with `AutosaveController` and `DocumentSync`.
- [ ] **Step 3: Run unit tests**
  - Run `pnpm --filter @structpaper/web test` on document api tests.
- [ ] **Step 4: Commit changes**
  - Commit as `refactor(web): migrate DocumentApi from raw fetch to unified axios http client`.

---

### Task 5: Fix ID Synchronization & Query Invalidation in `usePaperStorage` and `CreatePaperModal`

**Files:**
- Modify: `apps/web/src/hooks/usePaperStorage.ts`
- Modify: `apps/web/src/components/modals/CreatePaperModal/CreatePaperModal.tsx`
- Test: `apps/web/test/hooks/use-paper-storage-sync.spec.tsx`

- [ ] **Step 1: Write test for ID propagation and cache invalidation**
  - Test that calling `savePaper` on a new local paper with temporary ID updates the paper's ID with the returned server UUID.
  - Test that `queryClient.invalidateQueries` is called on `['manuscripts']` (or `['/api/v1/manuscripts']`).
- [ ] **Step 2: Update `usePaperStorage.ts`**
  - When `createManuscript` is called, capture the returned manuscript:
    - Update `paper.id = created.id` and `(paper as any).version = created.version`.
    - Persist the updated paper with its new UUID to IndexedDB via `savePaperToIndexedDb`.
    - Trigger `queryClient.invalidateQueries`.
- [ ] **Step 3: Update `CreatePaperModal.tsx`**
  - On paper creation completion, invalidate manuscripts query cache so the paper hub updates immediately.
- [ ] **Step 4: Run tests**
  - Run `pnpm --filter @structpaper/web test`.
- [ ] **Step 5: Commit changes**
  - Commit as `fix(web): propagate server UUID on creation and invalidate react-query cache`.

---

### Task 6: Refactor LaTeX Compile Route (`/api/compile-latex`) & Integrate Backend/Worker

**Files:**
- Modify: `apps/api/src/modules/platform/presentation/platform.controller.ts` (or add compile endpoint)
- Modify: `apps/web/src/app/api/compile-latex/route.ts`
- Test: `apps/web/test/compile/compile-route.spec.ts`

- [ ] **Step 1: Write test for compile endpoint**
  - Test that `POST /api/compile-latex` invokes backend API and returns PDF stream with appropriate headers, falling back gracefully without complaining about host xelatex.
- [ ] **Step 2: Add NestJS Compile Endpoint in `apps/api`**
  - Add `POST /api/v1/compile/latex` in NestJS that handles compilation request via `LatexRunner` or fallback PDF.
- [ ] **Step 3: Update `apps/web/src/app/api/compile-latex/route.ts`**
  - Remove outdated Java Spring Boot 8080 probe.
  - Forward compilation request to `/api/proxy/api/v1/compile/latex` using `compileApi` or Axios `http`.
  - Remove Windows `where xelatex` error response.
- [ ] **Step 4: Run tests**
  - Verify compile tests pass.
- [ ] **Step 5: Commit changes**
  - Commit as `feat(compile): connect web compile route to nestjs backend and worker`.

---

### Task 7: Unify `/papers` Hub & Implement Background Auto-Sync Reconciler

**Files:**
- Modify: `apps/web/src/components/authoring/PaperHubView.tsx`
- Modify: `apps/web/src/hooks/usePapersHub.ts`
- Test: `apps/web/test/papers/unified-hub.spec.tsx`

- [ ] **Step 1: Write tests for unified hub and auto-sync reconciler**
  - Test that local-only papers in IndexedDB are detected and uploaded to server when online.
  - Test that manuscripts list displays unified papers with sync indicators.
- [ ] **Step 2: Implement auto-sync reconciler in `usePapersHub.ts`**
  - When authenticated, scan IndexedDB for manuscripts with `syncState: 'local'`.
  - Upload them via `manuscriptApi.create` and update local record to `synced`.
- [ ] **Step 3: Unify UI in `PaperHubView.tsx`**
  - Remove split 2-tab switcher.
  - Render unified list with badges (☁️ Synced, 💻 Local only, ⏳ Syncing).
- [ ] **Step 4: Run tests**
  - Run all hub tests.
- [ ] **Step 5: Commit changes**
  - Commit as `feat(papers): unify papers hub with automatic background sync reconciler`.

---

### Task 8: Verification & Sanity Checks

- [ ] **Step 1: Run full test suite**
  - Run Vitest across `packages/api-client`, `apps/api`, `apps/worker`, `apps/web`.
- [ ] **Step 2: Run linter and type-checker**
  - Ensure zero TypeScript compiler errors and clean linting.
- [ ] **Step 3: Final report to user**
