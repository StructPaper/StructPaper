# Editor Platform Slot, Desktop TitleBar Integration & Edge-Case Fixes Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` (or `superpowers:subagent-driven-development`) to implement this plan task-by-task cleanly with TDD.

**Goal:** Fix remaining editor edge cases (`handleRename` dirty state, `saveNow` error/conflict outcome reporting, `autoSaveEnabled=false` dirty/baseline consistency, `SectionsTab.jumpToSection` filter sync, `equation` virtual height estimate) and apply the existing `@structpaper/platform` `<Slot />` mechanism to hide `DocumentMenuBar` on Desktop (`kind === 'desktop'`) while surfacing its actions cleanly inside `DesktopTitleBar`.

**Architecture:**
- Keep `DocumentMenuBar` rendered via `@structpaper/platform`'s `'editor-document-menubar'` slot on Web (`kind === 'web'`) and `null` on Desktop (`kind === 'desktop'`), wrapped by a safe `EditorDocumentMenuBarSlot` that falls back to `<DocumentMenuBar />` when rendered outside `PlatformProvider` in legacy tests.
- Extend `EditorDocumentSession` and `useSyncEditorSession` with optional document menu actions (`rawSaveState`, `savedAt`, `exporting`, `onRename`, `onNew`, `onOpen`, `onExport`, `onKeepMine`), keeping existing `TypstPaperEditorView` and `DesktopTitleBar` callers backward-compatible.
- Keep `UnifiedEditorView.tsx` strictly within `scripts/baseline-line-limits.json` (`<= 567` total lines, `<= 491` code lines).

---

### Task 1: Fix 5 Editor & Autosave Edge Cases (TDD)

**Files:**
- Modify: `apps/web/src/lib/documents/autosave-controller.ts`
- Modify: `apps/web/src/hooks/useDocumentAutosave.ts`
- Modify: `apps/web/src/components/editor/SectionsTab.tsx`
- Modify: `apps/web/src/components/editor/sections/useSectionVirtualizer.ts`
- Test: `apps/web/tests/lib/autosave-controller.test.ts`
- Test: `apps/web/tests/hooks/use-document-autosave.test.tsx`
- Test: `apps/web/tests/components/sections-virtualization.test.tsx`

- [ ] **Step 1: Write failing unit tests for Task 1 edge cases**
  - In `apps/web/tests/lib/autosave-controller.test.ts`:
    - `saveNow()` resolves to `'error'` when `saveLocal` returns `false`, `'conflict'` on HTTP 412, and `'saved'` / `'saved-local'` on success, waiting through any queued `rerun`.
    - `markDirty(paper)` transitions `'idle'`/`'saved'` -> `'dirty'` without invoking `saveLocal`.
  - In `apps/web/tests/hooks/use-document-autosave.test.tsx`:
    - When `enabled: false`, editing sets `result.current.state` to `'dirty'` without calling `saveLocal`; calling `saveNow(edited)` updates baseline so toggling `enabled: true` afterwards without new edits does NOT trigger a redundant `saveLocal`.
  - In `apps/web/tests/components/sections-virtualization.test.tsx`:
    - `estimateSectionHeight` returns `220` for `{ id: 'eq1', type: 'equation', content: 'E=mc^2' }`.

- [ ] **Step 2: Run targeted vitest files to confirm new assertions fail**
  - Run: `pnpm --dir StructPaper --filter @structpaper/web exec vitest run tests/lib/autosave-controller.test.ts tests/hooks/use-document-autosave.test.tsx tests/components/sections-virtualization.test.tsx`

- [ ] **Step 3: Implement minimal edge-case fixes**
  - `apps/web/src/lib/documents/autosave-controller.ts`:
    - Extend `AutosaveOptions.onState` info with `paper?: CompletePaper`.
    - Add `markDirty(paper?: CompletePaper): void` to set state `'dirty'` (if not saving/dirty) without starting timer.
    - Make `run(): Promise<void>` async and loop `while (this.running) await this.running;` so callers wait through queued reruns.
    - Change `saveNow(paper?: CompletePaper): Promise<SaveState>` to `await this.run(); return this.state;`.
    - Pass `paper` inside `info` on `'saved'` and `'saved-local'` emits in `execute()` and `resolveKeepMine()`.
  - `apps/web/src/hooks/useDocumentAutosave.ts`:
    - On `'saved'` or `'saved-local'` with `info?.paper`, update `baseline.current = info.paper`.
    - When `paper !== baseline.current`: call `controller.notify(paper)` if `enabled`, else call `controller.markDirty(paper)`.
  - `apps/web/src/components/editor/SectionsTab.tsx`:
    - In `jumpToSection`, call `updateSectionsFilter('all')` (alongside `filterTypeRef.current = 'all'; setFilterType('all');`) with `[updateSectionsFilter]` dependency.
  - `apps/web/src/components/editor/sections/useSectionVirtualizer.ts`:
    - Add `case 'equation': return 220;` in `estimateSectionHeight`.

- [ ] **Step 4: Re-run targeted tests and verify pass**

---

### Task 2: Platform Slot Registration & Extended EditorSession Contracts

**Files:**
- Modify: `packages/platform/src/context.tsx`
- Modify: `apps/web/src/platform/slots.ts`
- Create: `apps/web/src/components/documents/EditorDocumentMenuBarSlot.tsx`
- Modify: `apps/web/src/context/EditorSessionContext.tsx`
- Modify: `apps/web/src/components/editor/hooks/useSyncEditorSession.ts`
- Test: `packages/platform/tests/slots-and-context.test.tsx`
- Test: `apps/web/tests/components/editor-menubar-slot.test.tsx`

- [ ] **Step 1: Write failing tests for safe optional platform hook & `'editor-document-menubar'` slot**
  - `packages/platform/tests/slots-and-context.test.tsx`: `useOptionalPlatform()` returns `null` outside `PlatformProvider` and returns services inside it.
  - `apps/web/tests/components/editor-menubar-slot.test.tsx`: `<EditorDocumentMenuBarSlot {...props} />` renders `DocumentMenuBar` when `kind === 'web'`, renders `null` when `kind === 'desktop'`, and falls back to `DocumentMenuBar` when outside `PlatformProvider`.

- [ ] **Step 2: Run targeted vitest files to confirm new assertions fail**

- [ ] **Step 3: Implement Task 2**
  - Export `useOptionalPlatform(): PlatformServices | null` in `packages/platform/src/context.tsx`.
  - Register `'editor-document-menubar'` (`{ web: DocumentMenuBar, desktop: null }`) in `apps/web/src/platform/slots.ts`.
  - Create `apps/web/src/components/documents/EditorDocumentMenuBarSlot.tsx` calling `registerAppSlots()`, using `useOptionalPlatform()`: if `!platform`, render `<DocumentMenuBar {...props} />`; otherwise render `<Slot id="editor-document-menubar" {...props} />`.
  - Extend `EditorDocumentSession` (`rawSaveState?: SaveState`, `savedAt?: number | null`, `exporting?: { docx?: boolean; pdf?: boolean; xml?: boolean }`, `onRename?: (name: string) => void`, `onNew?: () => void`, `onOpen?: () => void`, `onExport?: (format: ExportFormat) => void`, `onKeepMine?: () => Promise<void> | void`) and update `useSyncEditorSession` with stable ref wrappers for all optional callbacks.

- [ ] **Step 4: Run targeted tests to verify pass**

---

### Task 3: Desktop TitleBar File Menu, Inline Rename, Local-Only Cloud Icon & Conflict Action

**Files:**
- Create: `apps/web/src/components/titlebar/TitleBarFileMenu.tsx`
- Modify: `apps/web/src/components/titlebar/DocumentStatusIndicator.tsx`
- Modify: `apps/web/src/components/titlebar/DesktopTitleBar.tsx`
- Modify: `apps/web/src/components/titlebar/index.ts`
- Test: `apps/web/tests/components/desktop-titlebar.test.tsx`

- [ ] **Step 1: Write failing component tests in `apps/web/tests/components/desktop-titlebar.test.tsx`**
  - Renders `Tệp` menu trigger (`titlebar-file-menu-trigger`) when session provides `onNew`/`onOpen`/`onManualSave`/`onExport`, opens dropdown with `Mới…`, `Mở…`, `Lưu` (`Ctrl+S`), and `Xuất Word (.docx)` / `Xuất PDF (.pdf)` / `Xuất XML (JATS)`, and invokes callbacks cleanly without triggering window drag.
  - Supports clicking `titlebar-paper-title` when `onRename` is provided to enter inline edit input (`titlebar-paper-title-input`), committing on Enter and cancelling on Escape.
  - Renders `CloudOff` icon (`titlebar-local-only-icon`) and local-only tooltip inside `titlebar-save-state` when `saveState === 'saved'` and `rawSaveState === 'saved-local'`, while keeping `data-save-state="saved"`.
  - Renders `Ghi đè` conflict action (`titlebar-conflict-resolve`) when `rawSaveState === 'conflict'` and `onKeepMine` is provided.

- [ ] **Step 2: Run `desktop-titlebar.test.tsx` to verify failure**

- [ ] **Step 3: Implement `TitleBarFileMenu.tsx`, update `DocumentStatusIndicator.tsx`, `DesktopTitleBar.tsx`, and `index.ts`**
  - Match existing zinc/glass/`#78C841` compact `38px` titlebar styling, add `data-no-drag="true"` on interactive controls, show subtle exporting indicator when `exporting` flags are active.

- [ ] **Step 4: Re-run `desktop-titlebar.test.tsx` to verify all existing and new tests pass**

---

### Task 4: Wire `UnifiedEditorView` + End-to-End Integration Tests & Full Verification

**Files:**
- Modify: `apps/web/src/components/editor/UnifiedEditorView.tsx`
- Test: `apps/web/tests/integration/titlebar-editor-autosave.test.tsx`
- Test: `apps/web/tests/components/unified-editor-view.test.tsx`

- [ ] **Step 1: Write failing integration & component tests**
  - In `apps/web/tests/integration/titlebar-editor-autosave.test.tsx`:
    - Desktop hides `DocumentMenuBar` (`queryByTestId('save-status')` is `null`) while exposing `Tệp` menu, inline rename via TitleBar updates `displayName` and marks unsaved, and offline local-only save displays `titlebar-local-only-icon` inside `Saved` pill.
    - When `saveNow` returns `'error'`, `handleSave` shows an error toast and does NOT show success toast or set `Saved` state.
  - In `apps/web/tests/components/unified-editor-view.test.tsx`:
    - Web / default rendering still displays `DocumentMenuBar`, and renaming via `DocumentMenuBar` triggers dirty/save flow.

- [ ] **Step 2: Update `UnifiedEditorView.tsx` cleanly (staying within baseline limits: <= 567 total / <= 491 code lines)**
  - Replace `<DocumentMenuBar ... />` with `<EditorDocumentMenuBarSlot ... />`.
  - In `handleRename`: set `displayName` AND call `setIsDirty(true)`.
  - In `handleSave`: inspect `const result = await saveNow(formData)`; show error/warning toast on `'error'`/`'conflict'` without calling `setSaveSuccess(true)`; differentiate `'saved-local'` vs `'saved'` success toast message.
  - Pass `rawSaveState: saveState`, `savedAt`, `exporting`, `onRename: handleRename`, `onNew`, `onOpen`, `onExport: requestExport`, `onKeepMine: resolveKeepMine` into `useSyncEditorSession`.

- [ ] **Step 3: Run targeted integration & component tests**
  - Run: `pnpm --dir StructPaper --filter @structpaper/web exec vitest run tests/integration/titlebar-editor-autosave.test.tsx tests/components/unified-editor-view.test.tsx tests/components/tab-scroll-restoration.test.tsx tests/components/document-workflow.test.tsx`

- [ ] **Step 4: Run full project checks & clean scratch/generated artifacts**
  - `pnpm --dir StructPaper/apps/web exec tsc --noEmit`
  - `pnpm --dir StructPaper depcruise`
  - `node StructPaper/scripts/verify-line-limits.js`
  - `pnpm --dir StructPaper test`
  - `pnpm --dir StructPaper --filter @structpaper/web build:desktop`
