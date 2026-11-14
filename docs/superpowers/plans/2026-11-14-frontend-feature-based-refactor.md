# Frontend Feature-Based Architecture Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor StructPaper's frontend (`apps/web/src`) from a fragmented layer-based structure (`components/`, `hooks/`) into a cohesive Feature-Based Architecture directly mirroring `eatzy_frontend/apps/customer/src/features`. Eliminate circular re-exports and backward-compatibility wrappers so the codebase natively embodies this clean structure.

**Architecture:** Deconstruct components and hooks into domain-driven feature folders under `apps/web/src/features/` (`auth`, `papers`, `editor`, `templates`, `permissions`, `preview`). Truly shared, cross-cutting UI stays in `apps/web/src/components/` (`layout`, `toast`, `titlebar`, `ui`, `modals/ModalPortal`). All imports across pages (`app/`), features, and test suites are updated to direct `@/features/<feature>` imports with zero wrapper shims.

**Tech Stack:** Next.js 14 (App Router), TypeScript, React 18, TanStack React Query, Vitest.

**Spec:** Structure pattern in `eatzy_frontend/apps/customer/src/features/` (`auth`, `orders`, `restaurant`, `checkout`).

## Global Constraints
- Native feature-based refactor: do NOT create wrapper re-exports or circular shims. Move files directly and update all import paths.
- Zero feature regression: All 69 web unit tests and monorepo suites must remain 100% green.
- Clean directory structure: Once files are moved, obsolete directories under `components/` and `hooks/` must be deleted.
- Preserved alias: Use `@/features/<feature>` and `@/components/<shared>` via existing tsconfig path aliases.

## Review Focus
1. Complete import migration: No orphaned references or broken relative paths (`../../components/papers`, `../../hooks`).
2. Clean separation of concerns: Feature-specific logic lives inside `src/features/<feature>`, while only generic cross-cutting elements remain in `src/components/` and `src/hooks/`.
3. Zero circular dependencies: Features may import from `@structpaper/*`, `@/lib/*`, `@/components/shared`, but avoid circular cross-feature dependencies.
4. Test suite green: All unit and component tests updated to point to `@/features/...` and passing.

---

### Task 1: Setup `features/auth` & Migrate Auth Logic

**Files:**
- Create: `apps/web/src/features/auth/hooks/useAuth.ts` (moved from `apps/web/src/hooks/useAuth.ts`)
- Create: `apps/web/src/features/auth/index.ts`
- Modify: `apps/web/src/components/layout/AppShell.tsx`
- Modify: `apps/web/src/app/login/page.tsx`
- Modify: `apps/web/test/auth/use-auth.spec.tsx`

- [ ] **Step 1: Move `useAuth.ts` into `src/features/auth/hooks/` and export via `src/features/auth/index.ts`**
- [ ] **Step 2: Update all import sites of `useAuth` to `@/features/auth`**
- [ ] **Step 3: Remove old `apps/web/src/hooks/useAuth.ts`**
- [ ] **Step 4: Run auth tests: `pnpm --filter @structpaper/web test test/auth`**
- [ ] **Step 5: Commit changes as `refactor(web): migrate auth to features/auth`**

---

### Task 2: Setup `features/papers` & Migrate Papers Hub, Cards, Modals, and Hooks

**Files:**
- Create: `apps/web/src/features/papers/components/` (move `PaperHubView.tsx`, `PaperCard.tsx`, `PaperTable.tsx`, `RecentPapersRow.tsx`, `PaperFiltersBar.tsx`, `EmptyPapersState.tsx`, `PaperQuickEditModal.tsx`, `PaperDeleteConfirmModal.tsx`, `PaginationControls.tsx`, `ServerManuscriptsView.tsx`, `ManuscriptTable.tsx`, `CreatePaperModal/`, `DuplicatePaperWarningModal.tsx`, `types.ts`)
- Create: `apps/web/src/features/papers/hooks/` (move `usePapersHub.ts`, `useCreatePaper.ts`, `useUpdatePaper.ts`, `useDeletePaper.ts`, `useLoadPaper.ts`, `useBatchImport.ts`, `usePaperUpload.ts`, `useEditorQuickEdit.ts`, `usePaperDuplicateWarning.ts`)
- Create: `apps/web/src/features/papers/index.ts`
- Modify: `apps/web/src/app/papers/page.tsx`
- Modify: `apps/web/test/papers/` and `apps/web/test/hooks/` tests

- [ ] **Step 1: Move components from `components/papers/`, `components/authoring/PaperHubView.tsx`, and `components/modals/CreatePaperModal` into `features/papers/components/`**
- [ ] **Step 2: Move papers hooks into `features/papers/hooks/`**
- [ ] **Step 3: Create `src/features/papers/index.ts` exporting public components, hooks, and types**
- [ ] **Step 4: Update all import paths in `app/papers/page.tsx`, `PaperHubView.tsx`, and tests**
- [ ] **Step 5: Remove old files and directories (`components/papers/`, `components/modals/CreatePaperModal/`, obsolete hooks)**
- [ ] **Step 6: Run papers & hooks tests: `pnpm --filter @structpaper/web test test/papers test/hooks`**
- [ ] **Step 7: Commit changes as `refactor(web): migrate papers hub and hooks to features/papers`**

---

### Task 3: Setup `features/editor` & Migrate Unified Editor, Toolbars, Menus, and Autosave

**Files:**
- Create: `apps/web/src/features/editor/components/` (move `UnifiedEditorView.tsx`, `PaperToolbar.tsx`, `editor/*`, `documents/*`)
- Create: `apps/web/src/features/editor/hooks/` (move `useDocumentAutosave.ts`, `usePaperStorage.ts`, `useAssetUpload.ts`, and editor sub-hooks)
- Create: `apps/web/src/features/editor/index.ts`
- Modify: `apps/web/src/app/editor/page.tsx`
- Modify: `apps/web/test/documents/` and editor tests

- [ ] **Step 1: Move editor components (`UnifiedEditorView.tsx`, `PaperToolbar.tsx`, sub-components from `components/editor/` and `components/documents/`) into `features/editor/components/`**
- [ ] **Step 2: Move editor hooks (`useDocumentAutosave.ts`, `usePaperStorage.ts`, `useAssetUpload.ts`, editor sub-hooks) into `features/editor/hooks/`**
- [ ] **Step 3: Create `src/features/editor/index.ts` exporting editor view and persistence hooks**
- [ ] **Step 4: Update import paths in `app/editor/page.tsx` and all consumers**
- [ ] **Step 5: Remove old directories (`components/editor/`, `components/documents/`, `components/authoring/`)**
- [ ] **Step 6: Run editor and document tests: `pnpm --filter @structpaper/web test test/documents test/hooks/use-paper-storage-sync.spec.tsx`**
- [ ] **Step 7: Commit changes as `refactor(web): migrate editor and document persistence to features/editor`**

---

### Task 4: Setup `features/templates` & Migrate Journal Hub, Template Editor, and Builder

**Files:**
- Create: `apps/web/src/features/templates/components/` (move `JournalHubView.tsx`, `JournalCard.tsx`, `TemplateEditor/*`, `template-builder/*`)
- Create: `apps/web/src/features/templates/hooks/` (move `useCustomTemplateSave.ts`, `useJournalEditorSave.ts`, `useManagedJournals.ts`)
- Create: `apps/web/src/features/templates/index.ts`
- Modify: `apps/web/src/app/templates/page.tsx`
- Modify: template tests

- [ ] **Step 1: Move template and journal hub components into `features/templates/components/`**
- [ ] **Step 2: Move template hooks into `features/templates/hooks/`**
- [ ] **Step 3: Create `src/features/templates/index.ts` exporting public components and hooks**
- [ ] **Step 4: Update import paths across `app/templates/page.tsx` and consumers**
- [ ] **Step 5: Remove old directories (`components/templates/`, `components/template-builder/`)**
- [ ] **Step 6: Run template tests: `pnpm --filter @structpaper/web test`**
- [ ] **Step 7: Commit changes as `refactor(web): migrate templates and journal hub to features/templates`**

---

### Task 5: Setup `features/permissions` & `features/preview` & Migrate Components & Hooks

**Files:**
- Create: `apps/web/src/features/permissions/components/` (move `InviteMemberModal.tsx`, `UserRoleAssignmentTab.tsx`, `ManuscriptMembersList.tsx`)
- Create: `apps/web/src/features/permissions/hooks/` (move `useManuscriptMembers.ts`)
- Create: `apps/web/src/features/permissions/index.ts`
- Create: `apps/web/src/features/preview/components/` (move `PublicationPreview.tsx`, `PreviewToolbar.tsx`, `PdfViewerToolbar.tsx`)
- Create: `apps/web/src/features/preview/index.ts`
- Modify: `apps/web/src/app/preview/page.tsx`
- Modify: permissions and preview tests

- [ ] **Step 1: Move permissions components and `useManuscriptMembers.ts` into `features/permissions/`**
- [ ] **Step 2: Move preview components into `features/preview/`**
- [ ] **Step 3: Create index exports for `permissions` and `preview`**
- [ ] **Step 4: Update all import paths across `app/preview/page.tsx` and consumers**
- [ ] **Step 5: Remove old directories (`components/permissions/`, `components/preview/`)**
- [ ] **Step 6: Run permissions & preview tests**
- [ ] **Step 7: Commit changes as `refactor(web): migrate permissions and preview to feature modules`**

---

### Task 6: Clean Up Shared Layout/UI Components & Remove Obsolete Hooks Barrel

**Files:**
- Clean up: `apps/web/src/components/` (keep only shared: `layout/`, `toast/`, `titlebar/`, `ui/`, `modals/ModalPortal.tsx`)
- Clean up: `apps/web/src/hooks/` (keep only cross-cutting generic hooks: `useSupportsCssFieldSizing.ts`)
- Update: all remaining test files across `apps/web/tests/` to use new feature imports

- [ ] **Step 1: Clean up empty or redundant directories in `components/` and `hooks/`**
- [ ] **Step 2: Update all test files in `apps/web/test/` and `apps/web/tests/` to import directly from `@/features/...`**
- [ ] **Step 3: Run full web test suite: `pnpm --filter @structpaper/web test`**
- [ ] **Step 4: Commit changes as `chore(web): clean up shared component directories and update test imports`**

---

### Task 7: Full Monorepo Verification & Type Checking

- [ ] **Step 1: Run type checking: `pnpm --filter @structpaper/web build` or `tsc --noEmit`**
- [ ] **Step 2: Run full monorepo tests across all packages: `pnpm test`**
- [ ] **Step 3: Report completion to user**
