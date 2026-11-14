# Implementation Plan: Privilege Escalation Prevention, Role Revocation, and Manuscript Status Outbox

## 1. Objectives
1. **Privilege Escalation Prevention & Role Revocation**:
   - Enhance `AccessService.assignRole` with strict privilege escalation prevention.
   - Implement `AccessService.revokeRole` and expose endpoints `DELETE /admin/users/:id/roles/:roleId` (and aliases).
   - Invalidate ability cache and increment `users.permissionsVersion` upon role revocation for instant session invalidation.
2. **Manuscript Status Transition with Transactional Outbox**:
   - Add `ChangeManuscriptStatusSchema` in `@structpaper/contracts`.
   - Implement `ManuscriptService.changeStatus` with state machine validation and atomic `outbox_events` insertion (`ManuscriptStatusChanged`).
   - Expose `POST /manuscripts/:id/status` in `ManuscriptController`.
3. **Audit Documentation Synchronization**:
   - Update `docs/Architecture/Bao_Cao_Doi_Soat_Backend_Frontend_va_Tai_Lieu_Chi_Tiet.md` reflecting completed items.

---

## 2. Technical Details

### A. Access Control & Role Revocation
- **Contract**: `RevokeRoleSchema` in `packages/contracts/src/access/access.contract.ts`.
- **Privilege Escalation Logic**:
  - SuperAdmin (`can('manage', 'all')`): unrestricted.
  - Non-SuperAdmin:
    - Cannot assign or revoke `SuperAdmin`.
    - Cannot assign roles exceeding caller rank/permissions.
    - Cannot escalate self.
- **Endpoints**:
  - `POST /roles/assign` (existing, with caller ability checks).
  - `DELETE /roles/assign` / `POST /roles/revoke` (accepts body).
  - `DELETE /admin/users/:id/roles/:roleId` (standard RESTful path from PDF).

### B. Manuscript Status State Machine & Outbox Event
- **Allowed Transitions**:
  - `DRAFT` -> `SUBMITTED`
  - `SUBMITTED` -> `IN_REVIEW`, `REJECTED`, `DRAFT`
  - `IN_REVIEW` -> `ACCEPTED`, `REJECTED`, `DRAFT`
  - `ACCEPTED` -> `PUBLISHED`, `DRAFT`
  - `REJECTED` -> `DRAFT`
  - `PUBLISHED` -> `DRAFT`
- **Transactional Outbox Event**:
  - Insert into `outbox_events` with:
    - `aggregateType`: `'manuscript'`
    - `aggregateId`: manuscriptId
    - `eventType`: `'ManuscriptStatusChanged'`
    - `payload`: `{ manuscriptId, previousStatus, newStatus, changedBy, reason, note, timestamp }`

---

## 3. Verification
- `apps/api/test/access/privilege-escalation.spec.ts`
- `apps/api/test/manuscripts/manuscript-status.spec.ts`
- Full test pass in `@structpaper/api`.
