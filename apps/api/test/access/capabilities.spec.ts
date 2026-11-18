import 'reflect-metadata';
import { describe, it, expect } from 'vitest';
import { CAPABILITY_KEYS, type Capability } from '@structpaper/contracts';
import {
  CAPABILITY_RULES,
  canAssignRoles,
  canManageMembers,
  capabilitiesForRoles,
  evaluateCapabilities,
} from '../../src/modules/access/domain/capabilities';
import { AbilityFactory } from '../../src/modules/access/domain/ability.factory';
import { CHECK_POLICIES_KEY } from '../../src/modules/access/presentation/decorators/check-policies.decorator';
import { UserController } from '../../src/modules/users/presentation/user.controller';
import { AccessController } from '../../src/modules/access/presentation/access.controller';

/**
 * The capabilities sent to the UI (GET /auth/me) must be exactly what the API enforces.
 * Personas x capability matrix: what each kind of user is told they can do.
 */
const PERSONAS: Record<string, { roles: Array<{ roleName: string; scopeJournalId: string | null; scopeJournalName: string | null }>; expected: Capability[] }> = {
  'SuperAdmin': {
    roles: [{ roleName: 'SuperAdmin', scopeJournalId: null, scopeJournalName: null }],
    expected: ['member:manage', 'role:assign', 'role:grant_superadmin', 'journal:manage', 'manuscript:read_all'],
  },
  'JournalManager (whole system)': {
    roles: [{ roleName: 'JournalManager', scopeJournalId: null, scopeJournalName: null }],
    expected: ['member:manage', 'role:assign', 'journal:manage', 'manuscript:read_all'],
  },
  'JournalManager (one journal)': {
    roles: [{ roleName: 'JournalManager', scopeJournalId: 'j-std', scopeJournalName: 'STD' }],
    expected: ['member:manage', 'role:assign'],
  },
  'Editor': { roles: [{ roleName: 'Editor', scopeJournalId: 'j-std', scopeJournalName: 'STD' }], expected: [] },
  'Reviewer': { roles: [{ roleName: 'Reviewer', scopeJournalId: null, scopeJournalName: null }], expected: [] },
  'Author': { roles: [{ roleName: 'Author', scopeJournalId: null, scopeJournalName: null }], expected: [] },
  'no role at all': { roles: [], expected: [] },
  'Editor + JournalManager (mixed)': {
    roles: [
      { roleName: 'Editor', scopeJournalId: 'j-ssh', scopeJournalName: 'SSH' },
      { roleName: 'JournalManager', scopeJournalId: 'j-std', scopeJournalName: 'STD' },
    ],
    expected: ['member:manage', 'role:assign'],
  },
};

describe('capabilities sent to the UI', () => {
  for (const [name, persona] of Object.entries(PERSONAS)) {
    it(`${name} gets: [${persona.expected.join(', ') || 'nothing'}]`, async () => {
      expect(await capabilitiesForRoles(persona.roles)).toEqual(persona.expected);
    });
  }

  it('every capability in the shared catalogue has a rule (and nothing extra)', () => {
    expect(Object.keys(CAPABILITY_RULES).sort()).toEqual([...CAPABILITY_KEYS].sort());
  });

  it('capabilities are returned in the order of the catalogue (stable output)', async () => {
    const ability = await new AbilityFactory().createForUser({ roles: ['SuperAdmin'] });
    expect(evaluateCapabilities(ability)).toEqual(CAPABILITY_KEYS);
  });

  it('a role name alone grants nothing unknown (default deny)', async () => {
    expect(await capabilitiesForRoles([{ roleName: 'Wizard', scopeJournalId: null, scopeJournalName: null }])).toEqual([]);
  });
});

describe('the UI capabilities and the API guards share the SAME predicates', () => {
  const policyOf = (target: any, key?: string): unknown[] =>
    key
      ? Reflect.getMetadata(CHECK_POLICIES_KEY, target.prototype[key]) ?? []
      : Reflect.getMetadata(CHECK_POLICIES_KEY, target) ?? [];

  it('the member endpoints are guarded by the very function behind "member:manage"', () => {
    expect(policyOf(UserController)).toEqual([canManageMembers]);
    expect(CAPABILITY_RULES['member:manage']).toBe(canManageMembers);
  });

  it('the role endpoints are guarded by the very function behind "role:assign"', () => {
    expect(policyOf(AccessController, 'assignRole')).toEqual([canAssignRoles]);
    expect(policyOf(AccessController, 'revokeRoleBody')).toEqual([canAssignRoles]);
    expect(CAPABILITY_RULES['role:assign']).toBe(canAssignRoles);
  });
});
