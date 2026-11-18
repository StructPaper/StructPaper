import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AbilityFactory, subject } from '../../src/modules/access/domain/ability.factory';

describe('AbilityFactory (CASL RBAC & Manuscript ACL)', () => {
  let factory: AbilityFactory;

  beforeEach(() => {
    factory = new AbilityFactory();
  });

  describe('1. Global SuperAdmin permissions', () => {
    it('SuperAdmin has global wildcard ability manage all', async () => {
      const ability = await factory.createForUser('user-admin-1', {
        roles: [{ name: 'SuperAdmin' }],
      });

      expect(ability.can('manage', 'all')).toBe(true);
      expect(ability.can('create', 'Manuscript')).toBe(true);
      expect(ability.can('update', subject('Manuscript', { id: 'm-123', journalId: 'j-456' }))).toBe(true);
      expect(ability.can('delete', 'User')).toBe(true);
      expect(ability.can('manage', 'Journal')).toBe(true);
    });
  });

  describe('2. Journal Scoped permissions (JournalManager & Editor)', () => {
    const journalA = '00000000-0000-0000-0000-000000000001';
    const journalB = '00000000-0000-0000-0000-000000000002';

    it('JournalManager can manage manuscripts only within their scoped journal', async () => {
      const ability = await factory.createForUser('user-jm-1', {
        roles: [{ name: 'JournalManager', scopeJournalId: journalA }],
      });

      // Allowed for scoped journal A
      expect(
        ability.can('manage', subject('Manuscript', { journalId: journalA, id: 'm-1' })),
      ).toBe(true);
      expect(
        ability.can('update', subject('Manuscript', { journalId: journalA, id: 'm-1' })),
      ).toBe(true);
      expect(
        ability.can('read', subject('Manuscript', { journalId: journalA, id: 'm-1' })),
      ).toBe(true);

      // Denied for journal B
      expect(
        ability.can('manage', subject('Manuscript', { journalId: journalB, id: 'm-2' })),
      ).toBe(false);
      expect(
        ability.can('update', subject('Manuscript', { journalId: journalB, id: 'm-2' })),
      ).toBe(false);

      // Not a global superadmin
      expect(ability.can('manage', 'all')).toBe(false);
    });

    it('Editor has NO blanket access to manuscripts, only journal visibility and the right to create', async () => {
      const ability = await factory.createForUser('user-ed-1', {
        roles: [{ name: 'Editor', scopeJournalId: journalA }],
      });
      const others = subject('Manuscript', { journalId: journalA, id: 'm-1', createdBy: 'someone-else' });

      expect(ability.can('read', others)).toBe(false);
      expect(ability.can('update', others)).toBe(false);
      expect(ability.can('create', 'Manuscript')).toBe(true);
      expect(ability.can('read', subject('Journal', { id: journalA }))).toBe(true);
      expect(ability.can('update', subject('Journal', { id: journalA }))).toBe(false);
      expect(ability.can('manage', subject('Journal', { id: journalA }))).toBe(false);
    });
  });

  describe('3. Manuscript ACL (Author & Reviewer)', () => {
    it('Author can create manuscripts and update manuscript only if listed in manuscript_members as OWNER or COAUTHOR', async () => {
      const manuscriptOwned = 'm-owned-1';
      const manuscriptCoauthored = 'm-coauthor-2';
      const manuscriptUnrelated = 'm-unrelated-3';
      const manuscriptReviewing = 'm-reviewing-4';

      const ability = await factory.createForUser('author-1', {
        roles: [{ name: 'Author' }],
        manuscriptMemberships: [
          { manuscriptId: manuscriptOwned, role: 'OWNER' },
          { manuscriptId: manuscriptCoauthored, role: 'COAUTHOR' },
          { manuscriptId: manuscriptReviewing, role: 'REVIEWER' },
        ],
      });

      // Can create manuscripts
      expect(ability.can('create', 'Manuscript')).toBe(true);

      // Can update owned manuscript
      expect(ability.can('update', subject('Manuscript', { id: manuscriptOwned }))).toBe(true);
      expect(ability.can('read', subject('Manuscript', { id: manuscriptOwned }))).toBe(true);

      // Can update coauthored manuscript
      expect(ability.can('update', subject('Manuscript', { id: manuscriptCoauthored }))).toBe(true);
      expect(ability.can('read', subject('Manuscript', { id: manuscriptCoauthored }))).toBe(true);

      // CANNOT update unassociated manuscript
      expect(ability.can('update', subject('Manuscript', { id: manuscriptUnrelated }))).toBe(false);

      // CANNOT update manuscript where user is only a REVIEWER
      expect(ability.can('update', subject('Manuscript', { id: manuscriptReviewing }))).toBe(false);
    });

    it('Reviewer can read assigned manuscripts in manuscript_members but cannot update or delete them', async () => {
      const assignedManuscript = 'm-rev-1';
      const unassignedManuscript = 'm-other-2';

      const ability = await factory.createForUser('reviewer-1', {
        roles: [{ name: 'Reviewer' }],
        manuscriptMemberships: [
          { manuscriptId: assignedManuscript, role: 'REVIEWER' },
        ],
      });

      // Can read assigned manuscript
      expect(ability.can('read', subject('Manuscript', { id: assignedManuscript }))).toBe(true);

      // Cannot update assigned manuscript
      expect(ability.can('update', subject('Manuscript', { id: assignedManuscript }))).toBe(false);
      expect(ability.can('delete', subject('Manuscript', { id: assignedManuscript }))).toBe(false);

      // Cannot read unassigned manuscript
      expect(ability.can('read', subject('Manuscript', { id: unassignedManuscript }))).toBe(false);

      // Cannot create manuscripts
      expect(ability.can('create', 'Manuscript')).toBe(false);
    });
  });

  describe('4. Database integration lookup when db is provided', () => {
    it('queries user_roles and manuscript_members from db when explicit context is not passed', async () => {
      const mockDb = {
        select: vi.fn(),
      };

      // Mock user roles query
      const mockRolesSelect = {
        from: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([
          {
            roleId: 'role-superadmin',
            roleName: 'SuperAdmin',
            scopeJournalId: null,
          },
        ]),
      };

      // Mock manuscript members query
      const mockMembersSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([]),
      };

      mockDb.select
        .mockReturnValueOnce(mockRolesSelect)
        .mockReturnValueOnce(mockMembersSelect);

      const dbFactory = new AbilityFactory(mockDb as any);
      const ability = await dbFactory.createForUser('user-db-admin');

      expect(ability.can('manage', 'all')).toBe(true);
      expect(mockDb.select).toHaveBeenCalled();
    });
  });
});
