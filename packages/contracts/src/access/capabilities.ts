/**
 * Capabilities: what the user can DO, named by business meaning.
 *
 * The UI asks "can I manage members?", never "am I a SuperAdmin?". Role names are only shown to
 * people; whether a button or page appears is decided by capabilities. The backend computes the
 * effective capabilities of the logged-in user (GET /auth/me) with the SAME predicates its guards
 * use, so the screen and the API can not disagree.
 *
 * Add a capability here, give it a rule in apps/api/src/modules/access/domain/capabilities.ts,
 * then use it in the UI through useAccess() / <Gate>.
 */
export const CAPABILITIES = {
  /** See the member list and invitations; invite, resend, revoke; suspend / reactivate accounts. */
  'member:manage': 'Manage members and invitations',
  /** Assign or revoke roles of other users. */
  'role:assign': 'Assign and revoke roles',
  /** Grant or revoke the SuperAdmin role (only SuperAdmin). */
  'role:grant_superadmin': 'Grant the SuperAdmin role',
  /** Add or change journals / templates. Without it the journal list is view-only. */
  'journal:manage': 'Manage journals and templates',
  /** Read every manuscript (so the public library / shared-with-me shortcuts are not needed). */
  'manuscript:read_all': 'Read all manuscripts',
  /** The trash of everybody's papers (not only your own): restore them and delete for good. Journal managers and above. */
  'trash:manage': "Manage everybody's deleted manuscripts and delete them for good",
} as const;

export type Capability = keyof typeof CAPABILITIES;

export const CAPABILITY_KEYS = Object.keys(CAPABILITIES) as Capability[];

export const isCapability = (value: unknown): value is Capability =>
  typeof value === 'string' && value in CAPABILITIES;
