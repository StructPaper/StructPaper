# Design Document: StructPaper Permissions Page UI & Motion Overhaul

**Date:** 2026-11-14  
**Author:** Antigravity  
**Status:** Approved  
**Target Module:** `apps/web/src/app/permissions/page.tsx` & `apps/web/src/features/permissions/components/*`

---

## 1. Intent & Context
The user requested a comprehensive, premium redesign of the StructPaper Permissions & Roles management page (`/permissions`), bringing it into 100% aesthetic, visual, and motion parity with existing flagship pages and components (e.g., Papers Hub, Template Hub, Unified Editor, Desktop Titlebar, and CreatePaperModal).

The current implementation in `features/permissions` functionally works but uses generic Tailwind forms and boxy borders without the signature Eatzy / StructPaper design elements:
- Brand accents (`#78C841` lime green, `#1A1A1A` premium dark, `#F8F9FA` background)
- Framer Motion spring physics (`type: 'spring', stiffness: 120, damping: 18, mass: 0.8`)
- Eatzy inner-shadow search inputs (`shadow-eatzy-inner`, `focus:ring-4 focus:ring-[#78C841]/5`)
- Segmented pill container navigation with smooth slide-and-fade tab transitions
- `ModalPortal` with spring scale/opacity backdrop physics
- LiquidGlass / Sileo toast notifications for asynchronous state changes

---

## 2. Goals, Non-Goals & Anti-Goals

### Goals
- **Full Parity with StructPaper Design System:**
  - Standard app background `#F8F9FA` with glassmorphic cards and elevated surfaces (`rounded-3xl`, `rounded-[32px]`).
  - Eatzy brand accent `#78C841` for primary actions and active states.
  - KPI metric cards styled with elevated glass, clean typography (`font-black text-slate-900`), and soft micro-badges.
  - Collapsible, modern banner for the CASL Instant Revocation (`permissions_version (pv)`) explanation.
- **Smooth Motion & Transitions:**
  - Segmented tab bar (`bg-zinc-200/70 rounded-2xl p-1.5`) with Framer Motion spring tab switching and `AnimatePresence mode="wait"`.
  - Micro-interactions on buttons, chips (`whileHover: { scale: 1.03 }`, `whileTap: { scale: 0.97 }`), and copy links.
  - Redesign `InviteMemberModal` using `ModalPortal` and spring animation matching `CreatePaperModal`.
- **Search & Filter Excellence:**
  - Eatzy search input with search icon, subtle vertical divider, clear button, and `shadow-eatzy-inner`.
  - Filter chips for status and role with active dark/vibrant styling.
  - Custom `<Select>` integration from `@/components/ui/Select` where applicable.
- **Feedback & Toasts:**
  - Replace raw timeout alerts with `sileo` / `toast` notifications for role updates, copy link actions, and invitations.
- **Preserve All Functionality & Tests:**
  - Zero regression in CASL permissions logic, Scoped RBAC, instant revocation triggers, and existing tests in `permissions-page.spec.tsx`.

### Non-Goals
- Changing backend API contracts or Casl abilities logic in `@structpaper/permissions`.
- Changing database schemas or access token verification mechanisms.

### Anti-Goals
- No jarring layout shifts during tab switching.
- No bulky, unstyled native select boxes or sharp-cornered form inputs.
- No inline style spaghetti; maintain strict TypeScript types and Tailwind tokens.

---

## 3. Approaches Considered

### Approach 1: Full StructPaper / Eatzy Design System Alignment (Chosen)
- Redesign `page.tsx`, `UserRoleAssignmentTab.tsx`, `PermissionMatrixTab.tsx`, `InvitationsTab.tsx`, and `InviteMemberModal.tsx`.
- Bring in Framer Motion spring animations, `ModalPortal`, Eatzy search input, pill navigation, and `sileo` toasts.
- **Pros:** Total visual harmony with the rest of the application, responsive, fluid 60fps micro-animations, delightful user experience.
- **Trade-offs:** Touches multiple UI files and requires testing motion states (with test environment safeguards `isTest ? { duration: 0 } : ...`).

### Approach 2: Minimal CSS Restyle
- Only change colors and borders in existing components without adding Framer Motion or ModalPortal.
- **Pros:** Fewer lines changed.
- **Cons:** Fails user requirement for smooth motion and parity with modals and flagship pages; feels stiff and inconsistent.

**Selected Approach:** Approach 1.

---

## 4. Detailed Component Design

### 4.1 Page Header & KPI Cards (`apps/web/src/app/permissions/page.tsx`)
- **Header:**
  - Title: `text-xl sm:text-2xl font-black text-slate-900 tracking-tight` with `ShieldCheck` icon styled in `#78C841`.
  - Primary button: "Mời thành viên mới" styled as `bg-[#78C841] hover:bg-[#68B436] text-white font-bold rounded-2xl shadow-sm px-5 py-2.5 flex items-center gap-2 cursor-pointer transition-all`.
  - Instant Revocation Card: Collapsible glass card with subtle border `border-indigo-100 bg-indigo-50/50 backdrop-blur-sm rounded-2xl p-4`.
- **KPI Summary Grid:**
  - 4 glass cards with `bg-white/80 backdrop-blur-md rounded-2xl sm:rounded-3xl border border-white/60 p-4 shadow-sm hover:shadow-md transition-all`:
    1. Tổng thành viên (Total users)
    2. Vai trò hệ thống (6 Roles - Immutable Baseline)
    3. Tạp chí ĐHQG-HCM (7 Tạp chí)
    4. Lời mời đang chờ (Pending invites)
- **Segmented Pill Tab Navigation:**
  - Container: `bg-zinc-200/70 backdrop-blur-md p-1.5 rounded-2xl sm:rounded-3xl flex items-center gap-1.5 inline-flex`.
  - Tabs: `Users` (Người dùng & Vai trò), `Matrix` (Ma trận Phân quyền), `Invitations` (Lời mời tham gia).
  - Active tab: `bg-[#1A1A1A] text-white font-extrabold rounded-xl sm:rounded-2xl shadow-md`.
  - Content transition: `<AnimatePresence mode="wait">` with `<motion.div>` slide & fade.

### 4.2 User & Role Assignment Tab (`UserRoleAssignmentTab.tsx`)
- **Toolbar:**
  - Eatzy Search Input with inner shadow, clear button, and `rounded-3xl`.
  - Status filter chips: `Tất cả`, `ACTIVE`, `INVITED`, `SUSPENDED` with `whileHover` / `whileTap`.
  - Custom Select for Roles (`ALL`, `SuperAdmin`, `JournalManager`, etc.).
- **User Table:**
  - Container: `bg-white rounded-[32px] border border-slate-200/80 shadow-sm overflow-hidden`.
  - Header: `bg-slate-50/60 text-[11px] font-bold text-slate-400 uppercase tracking-wider py-4 px-6`.
  - User avatar with initial and role badge.
  - Role dropdown in table row with smooth rounded pill styling.
  - Sileo toast on successful role change (with instant revocation notice).
  - Eatzy signature end-of-list divider.

### 4.3 Permission Matrix Tab (`PermissionMatrixTab.tsx`)
- **Immutable Roles Banner:**
  - Styled with amber/gold glassmorphism, lock icon, and clear explanation of CASL baseline.
- **Subject Filter Pills:**
  - Smooth pill buttons (`Tất cả`, `Manuscript`, `User`, `Journal`, `Asset`, `System`).
- **Matrix Table:**
  - Modern typography, emerald allowed checkmarks (`bg-emerald-100 text-emerald-700 w-7 h-7 rounded-full`), slate disallowed cross marks.
  - Scoped condition badges formatted as crisp mono tags.

### 4.4 Invitations Tab (`InvitationsTab.tsx`)
- **Toolbar:**
  - Search box and quick invite trigger.
- **Cards / Table of Pending Invites:**
  - Token badge with one-click copy and animated checkmark feedback.
  - Resend invitation button with rotating spinner animation during action.
  - Expiry countdown badge.

### 4.5 Invite Member Modal (`InviteMemberModal.tsx`)
- Reimplemented using `ModalPortal`.
- Modal card: `max-w-lg w-full bg-[#F8F9FA] rounded-[36px] sm:rounded-[40px] shadow-2xl border border-white/20 overflow-hidden flex flex-col`.
- Spring entrance animation:
  `initial={{ opacity: 0, scale: 0.9, y: 20 }}` -> `animate={{ opacity: 1, scale: 1, y: 0 }}` with spring transition.
- Close button: `w-11 h-11 rounded-full bg-gray-200/70 hover:bg-gray-200 text-gray-500 hover:text-gray-900`.
- Form inputs: `rounded-2xl bg-white border border-zinc-200 px-4 py-3 text-sm font-semibold focus:ring-2 focus:ring-lime-300 focus:border-[#78C841]`.
- Primary Submit: `bg-[#78C841] hover:bg-[#68B436] text-white font-bold rounded-2xl shadow-sm py-3 px-6`.
- Sileo success toast and animated activation link copy box on success.

---

## 5. Verification Plan
- `pnpm --filter @structpaper/web exec tsc --noEmit` must pass with 0 errors.
- `node scripts/verify-line-limits.js` must pass.
- Web tests in `apps/web/test/permissions/` must pass cleanly.
