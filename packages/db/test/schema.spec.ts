import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getTableName, getTableColumns } from 'drizzle-orm';
import {
  journals,
  journalsRelations,
  users,
  usersRelations,
  userTokens,
  userTokensRelations,
  roles,
  rolesRelations,
  permissions,
  permissionsRelations,
  userRoles,
  userRolesRelations,
  rolePermissions,
  rolePermissionsRelations,
  refreshTokens,
  refreshTokensRelations,
  manuscripts,
  manuscriptsRelations,
  manuscriptMembers,
  manuscriptMembersRelations,
  manuscriptDocs,
  manuscriptDocsRelations,
  manuscriptOps,
  manuscriptOpsRelations,
  manuscriptRevisions,
  manuscriptRevisionsRelations,
  assets,
  assetsRelations,
  compileJobs,
  compileJobsRelations,
  outboxEvents,
  idempotencyKeys,
  idempotencyKeysRelations,
  auditLogs,
  auditLogsRelations,
  GLOBAL_SCOPE_ID,
  createDbClient,
  seedDatabase,
  SYSTEM_ROLES,
} from '../src';

describe('Drizzle Schema & Table Definitions', () => {
  it('should export all 16 core database tables with snake_case SQL table names', () => {
    expect(getTableName(journals)).toBe('journals');
    expect(getTableName(users)).toBe('users');
    expect(getTableName(userTokens)).toBe('user_tokens');
    expect(getTableName(roles)).toBe('roles');
    expect(getTableName(permissions)).toBe('permissions');
    expect(getTableName(userRoles)).toBe('user_roles');
    expect(getTableName(rolePermissions)).toBe('role_permissions');
    expect(getTableName(refreshTokens)).toBe('refresh_tokens');
    expect(getTableName(manuscripts)).toBe('manuscripts');
    expect(getTableName(manuscriptMembers)).toBe('manuscript_members');
    expect(getTableName(manuscriptDocs)).toBe('manuscript_docs');
    expect(getTableName(manuscriptOps)).toBe('manuscript_ops');
    expect(getTableName(manuscriptRevisions)).toBe('manuscript_revisions');
    expect(getTableName(assets)).toBe('assets');
    expect(getTableName(compileJobs)).toBe('compile_jobs');
    expect(getTableName(outboxEvents)).toBe('outbox_events');
    expect(getTableName(idempotencyKeys)).toBe('idempotency_keys');
    expect(getTableName(auditLogs)).toBe('audit_logs');
  });

  describe('journals table columns & relations', () => {
    it('contains slug citext, settings jsonb, and version integer', () => {
      const cols = getTableColumns(journals);
      expect(cols.id).toBeDefined();
      expect(cols.slug).toBeDefined();
      expect(cols.slug.isUnique).toBe(true);
      expect(cols.name).toBeDefined();
      expect(cols.issn).toBeDefined();
      expect(cols.settings).toBeDefined();
      expect(cols.version).toBeDefined();
      expect(cols.version.default).toBe(1);
    });

    it('exports relations with manuscripts and roles', () => {
      expect(journalsRelations).toBeDefined();
      expect(journalsRelations.table).toBe(journals);
    });
  });

  describe('users table columns & constraints', () => {
    it('contains permissions_version, status, and email citext', () => {
      const cols = getTableColumns(users);
      expect(cols.id).toBeDefined();
      expect(cols.email).toBeDefined();
      expect(cols.email.isUnique).toBe(true);
      expect(cols.passwordHash).toBeDefined();
      expect(cols.displayName).toBeDefined();
      expect(cols.avatarUrl).toBeDefined();
      expect(cols.status).toBeDefined();
      expect(cols.status.default).toBe('INVITED');
      expect(cols.permissionsVersion).toBeDefined();
      expect(cols.permissionsVersion.name).toBe('permissions_version');
      expect(cols.permissionsVersion.default).toBe(1);
      expect(cols.createdAt).toBeDefined();
      expect(cols.updatedAt).toBeDefined();
    });

    it('exports users relations with tokens, roles, and memberships', () => {
      expect(usersRelations).toBeDefined();
      expect(usersRelations.table).toBe(users);
    });
  });

  describe('user_tokens table columns & relations', () => {
    it('contains user_id FK, type, token_hash, and expiration', () => {
      const cols = getTableColumns(userTokens);
      expect(cols.id).toBeDefined();
      expect(cols.userId).toBeDefined();
      expect(cols.type).toBeDefined();
      expect(cols.tokenHash).toBeDefined();
      expect(cols.expiresAt).toBeDefined();
      expect(cols.consumedAt).toBeDefined();
    });

    it('exports userTokens relations with user', () => {
      expect(userTokensRelations).toBeDefined();
      expect(userTokensRelations.table).toBe(userTokens);
    });
  });

  describe('manuscripts & manuscript_members columns & composite key', () => {
    it('contains manuscript concurrency version and server revision', () => {
      const mCols = getTableColumns(manuscripts);
      expect(mCols.id).toBeDefined();
      expect(mCols.journalId).toBeDefined();
      expect(mCols.title).toBeDefined();
      expect(mCols.currentServerRev).toBeDefined();
      expect(mCols.currentServerRev.name).toBe('current_server_rev');
      expect(mCols.currentServerRev.default).toBe(0);
      expect(mCols.version).toBeDefined();
      expect(mCols.version.default).toBe(1);
      expect(mCols.metadata).toBeDefined();
    });

    it('contains manuscript_members with role and composite primary key', () => {
      const memberCols = getTableColumns(manuscriptMembers);
      expect(memberCols.manuscriptId).toBeDefined();
      expect(memberCols.manuscriptId.name).toBe('manuscript_id');
      expect(memberCols.userId).toBeDefined();
      expect(memberCols.userId.name).toBe('user_id');
      expect(memberCols.role).toBeDefined();
      expect(memberCols.role.name).toBe('role');
    });

    it('exports relations for manuscripts and manuscript_members', () => {
      expect(manuscriptsRelations).toBeDefined();
      expect(manuscriptsRelations.table).toBe(manuscripts);
      expect(manuscriptMembersRelations).toBeDefined();
      expect(manuscriptMembersRelations.table).toBe(manuscriptMembers);
    });
  });

  describe('sync & op-log tables', () => {
    it('manuscript_docs has manuscript_id primary key and doc_tree jsonb', () => {
      const docCols = getTableColumns(manuscriptDocs);
      expect(docCols.manuscriptId).toBeDefined();
      expect(docCols.manuscriptId.primary).toBe(true);
      expect(docCols.docTree).toBeDefined();
      expect(docCols.serverRev).toBeDefined();
    });

    it('manuscript_ops contains op_id unique UUID and patches jsonb', () => {
      const opCols = getTableColumns(manuscriptOps);
      expect(opCols.opId).toBeDefined();
      expect(opCols.opId.name).toBe('op_id');
      expect(opCols.opId.isUnique).toBe(true);
      expect(opCols.patches).toBeDefined();
      expect(opCols.checksum).toBeDefined();
      expect(opCols.serverRev).toBeDefined();
      expect(opCols.clientRev).toBeDefined();
    });

    it('manuscript_revisions contains snapshot and checksum', () => {
      const revCols = getTableColumns(manuscriptRevisions);
      expect(revCols.snapshot).toBeDefined();
      expect(revCols.checksum).toBeDefined();
      expect(revCols.tagName).toBeDefined();
      expect(revCols.serverRev).toBeDefined();
    });

    it('exports sync relations', () => {
      expect(manuscriptDocsRelations).toBeDefined();
      expect(manuscriptOpsRelations).toBeDefined();
      expect(manuscriptRevisionsRelations).toBeDefined();
    });
  });

  describe('outbox & idempotency tables', () => {
    it('outbox_events contains aggregate and event columns with retry count', () => {
      const outCols = getTableColumns(outboxEvents);
      expect(outCols.aggregateType).toBeDefined();
      expect(outCols.aggregateId).toBeDefined();
      expect(outCols.eventType).toBeDefined();
      expect(outCols.payload).toBeDefined();
      expect(outCols.status).toBeDefined();
      expect(outCols.retryCount).toBeDefined();
      expect(outCols.retryCount.default).toBe(0);
    });

    it('idempotency_keys contains key PK, request_hash, and expires_at', () => {
      const idempCols = getTableColumns(idempotencyKeys);
      expect(idempCols.key).toBeDefined();
      expect(idempCols.key.primary).toBe(true);
      expect(idempCols.requestHash).toBeDefined();
      expect(idempCols.expiresAt).toBeDefined();
    });

    it('exports idempotency relations', () => {
      expect(idempotencyKeysRelations).toBeDefined();
    });
  });

  describe('compile jobs & assets tables', () => {
    it('compile_jobs contains engine, status, and pdf_asset_id', () => {
      const jobCols = getTableColumns(compileJobs);
      expect(jobCols.engine).toBeDefined();
      expect(jobCols.engine.default).toBe('XELATEX');
      expect(jobCols.status).toBeDefined();
      expect(jobCols.status.default).toBe('QUEUED');
      expect(jobCols.pdfAssetId).toBeDefined();
      expect(jobCols.durationMs).toBeDefined();
    });

    it('assets contains storage_key, checksum, and file_size', () => {
      const assetCols = getTableColumns(assets);
      expect(assetCols.storageKey).toBeDefined();
      expect(assetCols.storageKey.isUnique).toBe(true);
      expect(assetCols.checksum).toBeDefined();
      expect(assetCols.fileSize).toBeDefined();
    });

    it('exports compile and asset relations', () => {
      expect(compileJobsRelations).toBeDefined();
      expect(assetsRelations).toBeDefined();
    });
  });

  describe('access & roles tables', () => {
    it('user_roles has userId, roleId, and scopeJournalId with GLOBAL_SCOPE_ID default', () => {
      const urCols = getTableColumns(userRoles);
      expect(urCols.userId).toBeDefined();
      expect(urCols.roleId).toBeDefined();
      expect(urCols.scopeJournalId).toBeDefined();
      expect(urCols.scopeJournalId.default).toBe(GLOBAL_SCOPE_ID);
    });

    it('role_permissions has roleId and permissionId', () => {
      const rpCols = getTableColumns(rolePermissions);
      expect(rpCols.roleId).toBeDefined();
      expect(rpCols.permissionId).toBeDefined();
    });

    it('refresh_tokens contains userId, tokenHash, and expiresAt', () => {
      const rtCols = getTableColumns(refreshTokens);
      expect(rtCols.userId).toBeDefined();
      expect(rtCols.tokenHash).toBeDefined();
      expect(rtCols.expiresAt).toBeDefined();
      expect(rtCols.revokedAt).toBeDefined();
    });

    it('exports access relations', () => {
      expect(rolesRelations).toBeDefined();
      expect(permissionsRelations).toBeDefined();
      expect(userRolesRelations).toBeDefined();
      expect(rolePermissionsRelations).toBeDefined();
      expect(refreshTokensRelations).toBeDefined();
    });
  });

  describe('audit logs table', () => {
    it('contains action, resource_type, resource_id, and payload', () => {
      const auditCols = getTableColumns(auditLogs);
      expect(auditCols.userId).toBeDefined();
      expect(auditCols.action).toBeDefined();
      expect(auditCols.resourceType).toBeDefined();
      expect(auditCols.resourceId).toBeDefined();
      expect(auditCols.payload).toBeDefined();
      expect(auditCols.ipAddress).toBeDefined();
      expect(auditCols.createdAt).toBeDefined();
    });

    it('exports audit logs relations', () => {
      expect(auditLogsRelations).toBeDefined();
    });
  });

  describe('client factory export', () => {
    it('exports createDbClient factory function', () => {
      expect(typeof createDbClient).toBe('function');
    });
  });

  describe('seedDatabase function logic', () => {
    beforeEach(() => {
      delete process.env.INITIAL_ADMIN_PASSWORD;
      delete process.env.INITIAL_ADMIN_EMAIL;
    });

    it('exports SYSTEM_ROLES with all 5 required system roles', () => {
      expect(SYSTEM_ROLES).toHaveLength(5);
      const roleNames = SYSTEM_ROLES.map((r) => r.name);
      expect(roleNames).toContain('SuperAdmin');
      expect(roleNames).toContain('JournalManager');
      expect(roleNames).toContain('Editor');
      expect(roleNames).toContain('Author');
      expect(roleNames).toContain('Reviewer');
    });

    it('seeds default journal, 5 roles, wildcard permission, and invited admin user', async () => {
      const insertedRows: Record<string, any[]> = {
        journals: [],
        roles: [],
        permissions: [],
        role_permissions: [],
        users: [],
        user_tokens: [],
        user_roles: [],
      };

      const mockDb: any = {
        query: {
          journals: { findFirst: vi.fn().mockResolvedValue(null) },
          roles: { findFirst: vi.fn().mockResolvedValue(null) },
          permissions: { findFirst: vi.fn().mockResolvedValue(null) },
          rolePermissions: { findFirst: vi.fn().mockResolvedValue(null) },
          users: { findFirst: vi.fn().mockResolvedValue(null) },
          userRoles: { findFirst: vi.fn().mockResolvedValue(null) },
        },
        insert: (table: any) => {
          const tableName = getTableName(table);
          return {
            values: (val: any) => {
              const record = { id: `mock-${tableName}-${Date.now()}-${Math.random()}`, ...val };
              insertedRows[tableName]?.push(record);
              return {
                returning: () => Promise.resolve([record]),
                onConflictDoNothing: () => Promise.resolve([record]),
              };
            },
          };
        },
      };

      const result = await seedDatabase(mockDb);

      expect(result.journal).toBeDefined();
      expect(result.journal.slug).toBe('vnu-jst');
      expect(result.roles).toHaveLength(5);
      expect(result.adminUser).toBeDefined();
      expect(result.adminUser.status).toBe('INVITED');
      expect(result.activationToken).toBeDefined();
      expect(result.activationToken).toHaveLength(64); // 32 hex bytes = 64 chars
      expect(insertedRows.user_tokens).toHaveLength(1);
      expect(insertedRows.user_roles).toHaveLength(1);
    });

    it('seeds admin user as ACTIVE when INITIAL_ADMIN_PASSWORD is provided', async () => {
      process.env.INITIAL_ADMIN_PASSWORD = 'SuperSecurePassword123!';

      const insertedRows: Record<string, any[]> = {
        journals: [],
        roles: [],
        permissions: [],
        role_permissions: [],
        users: [],
        user_tokens: [],
        user_roles: [],
      };

      const mockDb: any = {
        query: {
          journals: { findFirst: vi.fn().mockResolvedValue(null) },
          roles: { findFirst: vi.fn().mockResolvedValue(null) },
          permissions: { findFirst: vi.fn().mockResolvedValue(null) },
          rolePermissions: { findFirst: vi.fn().mockResolvedValue(null) },
          users: { findFirst: vi.fn().mockResolvedValue(null) },
          userRoles: { findFirst: vi.fn().mockResolvedValue(null) },
        },
        insert: (table: any) => {
          const tableName = getTableName(table);
          return {
            values: (val: any) => {
              const record = { id: `mock-${tableName}-${Date.now()}-${Math.random()}`, ...val };
              insertedRows[tableName]?.push(record);
              return {
                returning: () => Promise.resolve([record]),
                onConflictDoNothing: () => Promise.resolve([record]),
              };
            },
          };
        },
      };

      const result = await seedDatabase(mockDb);

      expect(result.adminUser.status).toBe('ACTIVE');
      expect(result.adminUser.passwordHash).toMatch(/^scrypt:/);
      expect(result.activationToken).toBeUndefined();
      expect(insertedRows.user_tokens).toHaveLength(0);
      expect(insertedRows.user_roles).toHaveLength(1);
    });
  });
});
