import { describe, it, expect } from 'vitest';
import {
  // Problem Details
  ProblemDetailsSchema,
  createProblemDetails,

  // Auth contracts
  LoginRequestSchema,
  TokenResponseSchema,
  InviteUserSchema,
  ResetPasswordSchema,

  // Access contracts
  RoleSchema,
  PermissionSchema,
  AssignRoleSchema,

  // Manuscripts contracts
  CreateManuscriptSchema,
  UpdateManuscriptSchema,
  ManuscriptQuerySchema,
  AddManuscriptMemberSchema,

  // Sync contracts
  SubmitOpsSchema,
  OpsDeltaResponseSchema,
  PatchSchema,

  // Assets contracts
  UploadIntentSchema,
  UploadCompleteSchema,

  // Compile contracts
  TriggerCompileSchema,
  CompileJobResponseSchema,
} from '../src/index';

describe('Contracts Package (@structpaper/contracts)', () => {
  describe('RFC 9457 Problem Details', () => {
    it('creates a standard ProblemDetails object with createProblemDetails', () => {
      const problem = createProblemDetails({
        status: 400,
        title: 'Bad Request',
        detail: 'The submitted request payload is invalid',
        instance: '/api/v1/manuscripts/123',
        code: 'VALIDATION_ERROR',
        invalidParams: [{ name: 'title', reason: 'Title cannot be blank' }],
      });

      expect(problem.status).toBe(400);
      expect(problem.title).toBe('Bad Request');
      expect(problem.detail).toBe('The submitted request payload is invalid');
      expect(problem.instance).toBe('/api/v1/manuscripts/123');
      expect(problem.code).toBe('VALIDATION_ERROR');
      expect(problem.invalidParams).toHaveLength(1);
      expect(problem.invalidParams?.[0].name).toBe('title');
      expect(problem.type).toBe('about:blank');
    });

    it('validates a valid RFC 9457 problem details schema', () => {
      const data = {
        type: 'https://api.structpaper.org/errors/out-of-sync',
        title: 'Document Out of Sync',
        status: 409,
        detail: 'Server revision is newer than client baseServerRev',
        code: 'OUT_OF_SYNC',
        instance: '/manuscripts/a0000000-0000-0000-0000-000000000001/sync/patches',
      };

      const parsed = ProblemDetailsSchema.parse(data);
      expect(parsed.status).toBe(409);
      expect(parsed.code).toBe('OUT_OF_SYNC');
    });

    it('rejects invalid problem details schema missing required fields', () => {
      expect(() => ProblemDetailsSchema.parse({ title: 'Bad' })).toThrow();
    });
  });

  describe('Auth Contracts', () => {
    it('validates valid LoginRequest and trims/lowercases email', () => {
      const input = {
        email: '  Author@University.edu  ',
        password: 'SecurePassword123!',
      };
      const parsed = LoginRequestSchema.parse(input);
      expect(parsed.email).toBe('author@university.edu');
      expect(parsed.password).toBe('SecurePassword123!');
    });

    it('rejects invalid LoginRequest with malformed email or short password', () => {
      expect(() =>
        LoginRequestSchema.parse({
          email: 'not-an-email',
          password: '123',
        }),
      ).toThrow();
    });

    it('validates TokenResponse', () => {
      const res = {
        accessToken: 'jwt-access-token',
        refreshToken: 'opaque-refresh-token',
        expiresIn: 900,
        tokenType: 'Bearer',
      };
      const parsed = TokenResponseSchema.parse(res);
      expect(parsed.tokenType).toBe('Bearer');
      expect(parsed.expiresIn).toBe(900);
    });

    it('validates InviteUser request', () => {
      const input = {
        email: 'reviewer@journal.org',
        role: 'Reviewer',
        journalId: '123e4567-e89b-12d3-a456-426614174000',
        displayName: 'Dr. Reviewer',
      };
      const parsed = InviteUserSchema.parse(input);
      expect(parsed.email).toBe('reviewer@journal.org');
      expect(parsed.role).toBe('Reviewer');
    });

    it('validates ResetPassword request', () => {
      const input = {
        token: 'token-abc-123',
        newPassword: 'BrandNewPassword123!',
      };
      const parsed = ResetPasswordSchema.parse(input);
      expect(parsed.newPassword).toBe('BrandNewPassword123!');
    });
  });

  describe('Access & Roles Contracts', () => {
    it('validates RoleSchema and PermissionSchema', () => {
      const permission = PermissionSchema.parse({
        id: '123e4567-e89b-12d3-a456-426614174001',
        action: 'manage',
        subject: 'Manuscript',
        conditions: { journalId: '123e4567-e89b-12d3-a456-426614174000' },
      });
      expect(permission.action).toBe('manage');

      const role = RoleSchema.parse({
        id: '123e4567-e89b-12d3-a456-426614174002',
        name: 'JournalManager',
        description: 'Journal administrator',
        journalId: '123e4567-e89b-12d3-a456-426614174000',
        isSystem: true,
        permissions: [permission],
      });
      expect(role.isSystem).toBe(true);
    });

    it('validates AssignRoleSchema', () => {
      const assign = AssignRoleSchema.parse({
        userId: '123e4567-e89b-12d3-a456-426614174003',
        roleId: '123e4567-e89b-12d3-a456-426614174002',
        journalId: '123e4567-e89b-12d3-a456-426614174000',
      });
      expect(assign.userId).toBe('123e4567-e89b-12d3-a456-426614174003');
    });

    it('rejects AssignRoleSchema when userId is not a valid UUID', () => {
      expect(() =>
        AssignRoleSchema.parse({
          userId: 'non-uuid',
          roleId: '123e4567-e89b-12d3-a456-426614174002',
        }),
      ).toThrow();
    });
  });

  describe('Manuscript Contracts', () => {
    it('validates CreateManuscriptSchema and applies default metadata', () => {
      const parsed = CreateManuscriptSchema.parse({
        journalId: '123e4567-e89b-12d3-a456-426614174000',
        title: 'Deep Learning Approaches in Automated Typesetting',
        abstract: 'An exploration of neural layout engines.',
      });
      expect(parsed.title).toBe('Deep Learning Approaches in Automated Typesetting');
      expect(parsed.metadata).toEqual({});
    });

    it('validates UpdateManuscriptSchema with valid status enum', () => {
      const parsed = UpdateManuscriptSchema.parse({
        title: 'Updated Title',
        status: 'IN_REVIEW',
      });
      expect(parsed.status).toBe('IN_REVIEW');
    });

    it('rejects UpdateManuscriptSchema with invalid status', () => {
      expect(() =>
        UpdateManuscriptSchema.parse({
          status: 'INVALID_STATUS',
        }),
      ).toThrow();
    });

    it('validates and coerces ManuscriptQuerySchema parameters', () => {
      const parsed = ManuscriptQuerySchema.parse({
        page: '2',
        limit: '10',
        search: 'machine learning',
        status: 'SUBMITTED',
      });
      expect(parsed.page).toBe(2);
      expect(parsed.limit).toBe(10);
      expect(parsed.search).toBe('machine learning');
    });

    it('validates AddManuscriptMemberSchema with correct roles', () => {
      const parsed = AddManuscriptMemberSchema.parse({
        userId: '123e4567-e89b-12d3-a456-426614174004',
        role: 'COAUTHOR',
      });
      expect(parsed.role).toBe('COAUTHOR');
    });

    it('rejects AddManuscriptMemberSchema with unknown role', () => {
      expect(() =>
        AddManuscriptMemberSchema.parse({
          userId: '123e4567-e89b-12d3-a456-426614174004',
          role: 'ADMINISTRATOR',
        }),
      ).toThrow();
    });
  });

  describe('Sync & Op-Log Contracts', () => {
    it('validates SubmitOpsSchema with valid patches', () => {
      const patch = PatchSchema.parse({
        op: 'replace',
        path: '/nodes/0/text',
        value: 'New Heading',
      });

      const parsed = SubmitOpsSchema.parse({
        baseServerRev: 5,
        clientRev: 6,
        opId: '123e4567-e89b-12d3-a456-426614174005',
        patches: [patch],
      });

      expect(parsed.baseServerRev).toBe(5);
      expect(parsed.clientRev).toBe(6);
      expect(parsed.patches).toHaveLength(1);
    });

    it('rejects SubmitOpsSchema with empty patches array or negative revisions', () => {
      expect(() =>
        SubmitOpsSchema.parse({
          baseServerRev: -1,
          clientRev: 0,
          opId: '123e4567-e89b-12d3-a456-426614174005',
          patches: [{ op: 'replace', path: '/title', value: 'Test' }],
        }),
      ).toThrow();

      expect(() =>
        SubmitOpsSchema.parse({
          baseServerRev: 0,
          clientRev: 1,
          opId: '123e4567-e89b-12d3-a456-426614174005',
          patches: [],
        }),
      ).toThrow();
    });

    it('validates OpsDeltaResponseSchema for sync updates and 409 conflict responses', () => {
      const delta = OpsDeltaResponseSchema.parse({
        serverRev: 10,
        ops: [
          {
            id: '123e4567-e89b-12d3-a456-426614174006',
            manuscriptId: '123e4567-e89b-12d3-a456-426614174000',
            serverRev: 10,
            clientRev: 7,
            opId: '123e4567-e89b-12d3-a456-426614174007',
            patches: [{ op: 'add', path: '/nodes/1', value: { type: 'paragraph' } }],
          },
        ],
        code: 'OUT_OF_SYNC',
      });

      expect(delta.serverRev).toBe(10);
      expect(delta.ops).toHaveLength(1);
      expect(delta.code).toBe('OUT_OF_SYNC');
    });
  });

  describe('Assets Contracts', () => {
    it('validates UploadIntentSchema', () => {
      const parsed = UploadIntentSchema.parse({
        filename: 'figure1.png',
        mimeType: 'image/png',
        fileSize: 1048576,
        manuscriptId: '123e4567-e89b-12d3-a456-426614174000',
      });
      expect(parsed.filename).toBe('figure1.png');
      expect(parsed.fileSize).toBe(1048576);
    });

    it('rejects UploadIntentSchema with non-positive fileSize', () => {
      expect(() =>
        UploadIntentSchema.parse({
          filename: 'figure1.png',
          mimeType: 'image/png',
          fileSize: 0,
        }),
      ).toThrow();
    });

    it('validates UploadCompleteSchema', () => {
      const parsed = UploadCompleteSchema.parse({
        storageKey: 'manuscripts/123/figure1.png',
        checksum: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        filename: 'figure1.png',
      });
      expect(parsed.storageKey).toBe('manuscripts/123/figure1.png');
    });
  });

  describe('Compile Contracts', () => {
    it('validates TriggerCompileSchema with defaults', () => {
      const parsed = TriggerCompileSchema.parse({
        manuscriptId: '123e4567-e89b-12d3-a456-426614174000',
      });
      expect(parsed.engine).toBe('XELATEX');
    });

    it('validates CompileJobResponseSchema', () => {
      const parsed = CompileJobResponseSchema.parse({
        id: '123e4567-e89b-12d3-a456-426614174008',
        manuscriptId: '123e4567-e89b-12d3-a456-426614174000',
        status: 'COMPLETED',
        engine: 'XELATEX',
        durationMs: 1420,
      });
      expect(parsed.status).toBe('COMPLETED');
      expect(parsed.durationMs).toBe(1420);
    });
  });
});
