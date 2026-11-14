# Implementation Plan: Frontend-Backend API Integration via Custom Hooks

- **Date:** 2026-11-14
- **Branch:** `feat/nestjs-backend-and-frontend-sync`
- **Scope:** Complete end-to-end integration of backend APIs (NestJS 10, Fastify, PostgreSQL 16, MinIO S3) into frontend (`apps/web`) using typed Custom React Hooks (TanStack Query mutations/queries) with loading, error states, and Local-First offline fallback.

---

## 1. Problem Statement & Architecture Goals

While the NestJS backend (`apps/api`) has implemented and tested 100% of the core modules (B0 to B6: Auth, Users, RBAC/ACL, Manuscripts CRUD, Revisions, S3 Presigned Assets, Op-Log Sync, Worker), and the frontend (`apps/web`) has connected Auth (`/login`), Roles (`/permissions`), and Server List (`ServerManuscriptsView`), the paper creation (`CreatePaperModal`), editor saving (`usePaperStorage`, `useDocumentAutosave`), asset upload, and revisions were previously saving to IndexedDB or pointing to a legacy Spring Boot endpoint (`http://localhost:8080/api/v1/documents`).

### Goals:
1. **Encapsulate all Backend API calls in dedicated Custom Hooks** in `apps/web/src/hooks/`.
2. **Provide consistent Loading and Error states**: Every hook exposes `isPending` / `isLoading`, `isError`, and normalized `error` (RFC 9457 Problem Details) for easy UI spinner and toast binding.
3. **Local-First Fallback & Dual-Write**:
   - When authenticated & online: Write to PostgreSQL / MinIO S3 via NestJS API **AND** write a cache copy into IndexedDB.
   - When in Mock mode or offline: Seamlessly fallback to IndexedDB without crashing.
4. **TanStack Query Cache Invalidation**: Automatic `queryClient.invalidateQueries({ queryKey: [...] })` when manuscripts or assets are created, updated, or deleted.

---

## 2. File Structure

```text
apps/web/src/
├── hooks/
│   ├── useCreatePaper.ts          # NEW: Create manuscript mutation with dual write & validation
│   ├── useUpdatePaper.ts          # NEW: Update manuscript mutation with optimistic locking (ETag/version)
│   ├── useDeletePaper.ts          # NEW: Delete manuscript mutation with cache invalidation
│   ├── useLoadPaper.ts            # NEW: Load manuscript (IndexedDB first, fallback to Cloud API)
│   ├── useAssetUpload.ts          # NEW: S3 Presigned upload intent -> S3 PUT -> complete upload
│   ├── useManuscriptRevisions.ts  # NEW: Snapshot version history (list & create revision)
│   ├── usePaperStorage.ts         # REFACTORED: Unified local + cloud storage adapter
│   └── useDocumentAutosave.ts     # UPDATED: Connected to new NestJS endpoints
├── lib/
│   └── documents/
│       └── document-api.ts        # REFACTORED: Truncate legacy :8080 logic, point to NestJS API
└── components/
    ├── modals/CreatePaperModal/
    │   └── CreatePaperModal.tsx   # UPDATED: Wire useCreatePaper
    └── papers/
        ├── ServerManuscriptsView.tsx # UPDATED: Wire useDeletePaper
        └── ManuscriptTable.tsx    # UPDATED: Delete & action integration
```

---

## 3. Step-by-Step Implementation Tasks

### Task 1: Manuscript CRUD Custom Hooks (`useCreatePaper`, `useUpdatePaper`, `useDeletePaper`)
- Create `apps/web/src/hooks/useCreatePaper.ts` wrapping `useCreateManuscript`.
- Create `apps/web/src/hooks/useUpdatePaper.ts` wrapping `useUpdateManuscript`.
- Create `apps/web/src/hooks/useDeletePaper.ts` wrapping `useDeleteManuscript`.
- Write unit tests in `apps/web/test/hooks/manuscript-crud-hooks.spec.tsx`.
- Verify tests pass.

### Task 2: Manuscript Loading & Unified Storage Hook (`useLoadPaper`, `usePaperStorage`)
- Create `apps/web/src/hooks/useLoadPaper.ts` that handles loading by ID (IndexedDB cache -> fallback to `useGetManuscript` -> cache in IndexedDB).
- Update `apps/web/src/hooks/usePaperStorage.ts` to seamlessly route to cloud when authenticated and online.
- Write unit tests in `apps/web/test/hooks/use-load-paper.spec.tsx`.
- Verify tests pass.

### Task 3: Modern Remote Autosave & Sync Integration in Editor
- Refactor `apps/web/src/lib/documents/document-api.ts` to use `@structpaper/api-client` (`PATCH /api/v1/manuscripts/:id` with `If-Match` ETag/version).
- Ensure `useDocumentAutosave.ts` handles `saved`, `saving`, `error` cleanly.
- Write unit tests in `apps/web/test/hooks/use-document-autosave-cloud.spec.tsx`.
- Verify tests pass.

### Task 4: Presigned S3 Asset Upload Custom Hook (`useAssetUpload`)
- Create `apps/web/src/hooks/useAssetUpload.ts`.
- Implements two-phase upload:
  1. `POST /api/v1/assets/upload-intent` -> receives `presignedUrl` and `assetId`.
  2. Direct S3 `PUT` with file binary.
  3. `POST /api/v1/assets/upload-complete` -> confirms S3 storage.
- Returns `{ uploadAsset, isUploading, progress, error }`.
- Write unit tests in `apps/web/test/hooks/use-asset-upload.spec.tsx`.
- Verify tests pass.

### Task 5: Manuscript Version History & Snapshots Hook (`useManuscriptRevisions`)
- Create `apps/web/src/hooks/useManuscriptRevisions.ts`.
- Wraps `useListManuscriptRevisions` and `useCreateManuscriptRevision`.
- Returns `{ revisions, isLoading, createSnapshot, isCreatingSnapshot }`.
- Write unit tests in `apps/web/test/hooks/use-manuscript-revisions.spec.tsx`.
- Verify tests pass.

### Task 6: Wire Hooks into UI Components & End-to-End Verification
- Update `CreatePaperModal` to call `useCreatePaper`.
- Update `ServerManuscriptsView` to call `useDeletePaper` on delete action with confirmation modal.
- Run `pnpm verify` to ensure all 4 layers, build, and tests pass.
- Commit all changes with descriptive commit messages.
