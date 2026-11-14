# Permissions Page UI & Motion Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the StructPaper Permissions & Roles management page (`/permissions`) to achieve 100% visual, aesthetic, and motion parity with existing flagship features (Papers Hub, Template Hub, Unified Editor, Desktop Titlebar, and CreatePaperModal).

**Architecture:** Refactor `apps/web/src/app/permissions/page.tsx` and the 4 components in `apps/web/src/features/permissions/components/` using StructPaper Design System tokens (`#78C841`, `#1A1A1A`, `#F8F9FA`), Framer Motion spring physics, `ModalPortal`, Eatzy inner-shadow search inputs, segmented pill bar navigation with `AnimatePresence`, and `sileo` toasts.

**Tech Stack:** Next.js 15 (App Router), React 18, TypeScript, Tailwind CSS, Framer Motion, Lucide React, Sileo Toast, Vitest, React Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-14-permissions-page-ui-redesign.md`

## Global Constraints
- Brand accents: `#78C841` (primary vibrant accent), `#1A1A1A` (active dark pill/chip), `#F8F9FA` (app background).
- Motion: Framer Motion spring `{ type: 'spring', stiffness: 120, damping: 18, mass: 0.8 }`, disabled in test environments (`isTest ? { duration: 0 } : ...`).
- Modals: Must use `ModalPortal` from `@/components/modals/ModalPortal` with circular close button and backdrop blur `bg-black/40 backdrop-blur-sm`.
- Line limits: Every file must adhere to project limits (no file exceeding warning thresholds without allowlist; max 300 logic lines).
- Backward compatibility: Zero regression in CASL permissions logic, Scoped RBAC, instant revocation triggers, and existing tests in `permissions-page.spec.tsx`.

## Review Focus
1. Tab switching must not produce layout jumps; `AnimatePresence mode="wait"` must cleanly unmount previous tab before mounting new tab.
2. `InviteMemberModal` must open via `ModalPortal`, capture Esc/backdrop clicks, and reset cleanly on close.
3. Eatzy search inputs must handle Enter key and clear button clicks without breaking controlled state.
4. Role changes in `UserRoleAssignmentTab` must trigger `sileo.success` toast with `permissions_version` feedback.
5. In test environments (`process.env.NODE_ENV === 'test'`), animations must run with 0 duration to prevent Vitest timeouts.

---

### Task 1: Redesign `InviteMemberModal` with `ModalPortal` & Spring Physics

**Files:**
- Modify: `apps/web/src/features/permissions/components/InviteMemberModal.tsx`
- Test: `apps/web/test/permissions/permissions-page.spec.tsx`

**Interfaces:**
- Consumes: `ModalPortal` from `@/components/modals/ModalPortal`, `sileo` from `@/components/toast`, `useInviteUser` from `@structpaper/api-client`
- Produces: `InviteMemberModalProps: { isOpen: boolean; onClose: () => void; onInviteSuccess?: (userSummary: any) => void }`

- [x] **Step 1: Check existing modal tests in `permissions-page.spec.tsx`**
Run: `pnpm test apps/web/test/permissions/permissions-page.spec.tsx`
Expected: PASS (baseline check)

- [x] **Step 2: Refactor `InviteMemberModal.tsx` to use `ModalPortal` & Eatzy Design**
  - Wrap dialog in `<ModalPortal>` with `<AnimatePresence>`.
  - Add spring animation to backdrop (`bg-black/40 backdrop-blur-sm`) and modal card container (`bg-[#F8F9FA] rounded-[36px] sm:rounded-[40px] shadow-2xl border border-white/20`).
  - Style header with Eatzy title and circular close button (`w-11 h-11 rounded-full bg-gray-200/70 hover:bg-gray-200 text-gray-500 hover:text-gray-900 cursor-pointer`).
  - Style form inputs with `rounded-2xl bg-white border border-zinc-200 px-4 py-3 text-sm font-semibold focus:ring-2 focus:ring-lime-300 focus:border-[#78C841]`.
  - Style submit button with `bg-[#78C841] hover:bg-[#68B436] text-white font-bold rounded-2xl shadow-sm py-3 px-6 cursor-pointer`.
  - Integrate `sileo.success` upon successful invitation and animated copy button for activation link.

- [x] **Step 3: Run modal & permissions tests**
Run: `pnpm test apps/web/test/permissions/permissions-page.spec.tsx`
Expected: PASS

- [x] **Step 4: Commit**
```bash
git add apps/web/src/features/permissions/components/InviteMemberModal.tsx
git commit -m "refactor(permissions): modernize InviteMemberModal with ModalPortal and spring motion"
```

---

### Task 2: Redesign `UserRoleAssignmentTab` with Eatzy Search, Status Chips & Sileo Toasts

**Files:**
- Modify: `apps/web/src/features/permissions/components/UserRoleAssignmentTab.tsx`
- Test: `apps/web/test/permissions/permissions-page.spec.tsx`

**Interfaces:**
- Consumes: `sileo` from `@/components/toast`, `useAssignRole` from `@structpaper/api-client`, `Select` from `@/components/ui/Select`
- Produces: `UserRoleAssignmentTab: React.FC<UserRoleAssignmentTabProps>`

- [x] **Step 1: Update `UserRoleAssignmentTab.tsx` with Eatzy Search and Filter Chips**
  - Implement Eatzy Search bar with `shadow-eatzy-inner`, search icon, divider, and clear button.
  - Implement Status Filter Chips (`Tất cả`, `ACTIVE`, `INVITED`, `SUSPENDED`) using `motion.button` with `whileHover` and `whileTap`.
  - Add Role Select dropdown using rounded Eatzy styling.
  - Style User Table with `rounded-[32px] bg-white border border-slate-200/80 shadow-sm overflow-hidden`.
  - User avatars with initial badges, role select in table cell with rounded pill styling.
  - Trigger `sileo.success` on role change instead of inline banner, providing instant feedback on `permissions_version (pv)` revocation.
  - Add signature Eatzy end-of-list divider (`CheckCircle2` with gradient dividers).

- [x] **Step 2: Run permissions tests**
Run: `pnpm test apps/web/test/permissions/permissions-page.spec.tsx`
Expected: PASS

- [x] **Step 3: Commit**
```bash
git add apps/web/src/features/permissions/components/UserRoleAssignmentTab.tsx
git commit -m "refactor(permissions): modernize UserRoleAssignmentTab with Eatzy search, chips, and sileo toasts"
```

---

### Task 3: Redesign `PermissionMatrixTab` with Subject Pill Chips & High-Fidelity Grid

**Files:**
- Modify: `apps/web/src/features/permissions/components/PermissionMatrixTab.tsx`
- Test: `apps/web/test/permissions/permissions-page.spec.tsx`

**Interfaces:**
- Produces: `PermissionMatrixTab: React.FC`

- [x] **Step 1: Refactor `PermissionMatrixTab.tsx`**
  - Redesign Immutable System Roles Banner as an elevated amber glassmorphism card (`bg-amber-50/70 border border-amber-200/80 rounded-3xl p-5`).
  - Upgrade Subject Filters to segmented pill chips with `motion.button` and smooth active state (`bg-[#1A1A1A] text-white shadow-md font-extrabold`).
  - Redesign Permission Matrix Table:
    - Rounded table shell `rounded-[32px] bg-white border border-slate-200/80 shadow-sm overflow-hidden`.
    - Allowed indicator: `w-7 h-7 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center border border-emerald-300 shadow-2xs`.
    - Disallowed indicator: `w-7 h-7 rounded-full bg-slate-100 text-slate-300 flex items-center justify-center border border-slate-200`.
    - Scoped note badge: `text-[10px] text-slate-600 font-mono bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200/80 font-bold`.
  - Add Eatzy signature end-of-matrix divider.

- [x] **Step 2: Run permissions tests**
Run: `pnpm test apps/web/test/permissions/permissions-page.spec.tsx`
Expected: PASS

- [x] **Step 3: Commit**
```bash
git add apps/web/src/features/permissions/components/PermissionMatrixTab.tsx
git commit -m "refactor(permissions): modernize PermissionMatrixTab with subject chips and high-fidelity matrix"
```

---

### Task 4: Redesign `InvitationsTab` with Search, Token Micro-Interactions & Resend Feedback

**Files:**
- Modify: `apps/web/src/features/permissions/components/InvitationsTab.tsx`
- Test: `apps/web/test/permissions/permissions-page.spec.tsx`

**Interfaces:**
- Consumes: `sileo` from `@/components/toast`
- Produces: `InvitationsTab: React.FC<InvitationsTabProps>`

- [x] **Step 1: Refactor `InvitationsTab.tsx`**
  - Add search input for invitations (matching email or journal).
  - Copy activation link with instant feedback and `sileo.success` toast.
  - Resend invite action with rotating icon animation (`RotateCw`) and `sileo.info` toast.
  - Style table in `rounded-[32px] bg-white border border-slate-200/80 shadow-sm`.
  - Add signature Eatzy end-of-list divider.

- [x] **Step 2: Run permissions tests**
Run: `pnpm test apps/web/test/permissions/permissions-page.spec.tsx`
Expected: PASS

- [x] **Step 3: Commit**
```bash
git add apps/web/src/features/permissions/components/InvitationsTab.tsx
git commit -m "refactor(permissions): modernize InvitationsTab with copy link feedback and Eatzy table styling"
```

---

### Task 5: Redesign Permissions Page (`app/permissions/page.tsx`) Header, KPI Cards & Tab Transitions

**Files:**
- Modify: `apps/web/src/app/permissions/page.tsx`
- Test: `apps/web/test/permissions/permissions-page.spec.tsx`

**Interfaces:**
- Produces: `PermissionsPage: React.FC`

- [x] **Step 1: Refactor `apps/web/src/app/permissions/page.tsx`**
  - Background set to `#F8F9FA`.
  - Hero header: Title `text-xl sm:text-2xl font-black text-slate-900 tracking-tight`, icon with `#78C841`, quick action button `bg-[#78C841] hover:bg-[#68B436] text-white font-bold rounded-2xl shadow-sm`.
  - Instant Revocation info banner: Collapsible glass card with smooth expand/collapse transition.
  - 4 elevated KPI cards:
    - `bg-white/80 backdrop-blur-md rounded-2xl sm:rounded-3xl border border-white/60 p-4 shadow-sm hover:shadow-md transition-all group relative overflow-hidden`.
  - Segmented pill container for tabs:
    - Container: `bg-zinc-200/70 backdrop-blur-md p-1.5 rounded-2xl sm:rounded-3xl flex items-center gap-1.5 inline-flex`.
    - Buttons: `motion.button` with active `bg-[#1A1A1A] text-white shadow-md font-extrabold rounded-xl sm:rounded-2xl` and inactive `text-zinc-600 hover:text-zinc-950 hover:bg-white/50 font-bold`.
  - Tab body: `<AnimatePresence mode="wait">` with `<motion.div>` slide & fade animation between `users`, `matrix`, and `invitations`.

- [x] **Step 2: Run permissions tests & update tests if needed**
Run: `pnpm test apps/web/test/permissions/permissions-page.spec.tsx`
Expected: PASS

- [x] **Step 3: Commit**
```bash
git add apps/web/src/app/permissions/page.tsx
git commit -m "refactor(permissions): modernize permissions page layout, KPI cards, and spring tab transitions"
```

---

### Task 6: Full Verification, TypeScript Check & Monorepo Health Check

- [x] **Step 1: Run TypeScript compiler check**
Run: `pnpm --filter @structpaper/web exec tsc --noEmit`
Expected: 0 errors (Exit code 0)

- [x] **Step 2: Run line limit verification**
Run: `node scripts/verify-line-limits.js`
Expected: PASS

- [x] **Step 3: Run full web test suite**
Run: `pnpm test apps/web/test/permissions/`
Expected: All tests pass cleanly

- [x] **Step 4: Update plan checklist and commit**
```bash
git add docs/superpowers/plans/2026-11-14-permissions-page-ui-redesign.md
git commit -m "docs: complete permissions page ui redesign plan"
```
