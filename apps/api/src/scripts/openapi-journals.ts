/**
 * OpenAPI pieces of the journals module: the catalogue, journal admin, article types and the profile version
 * lifecycle. Kept apart from generate-openapi.ts so that file does not grow without bound.
 */
const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const json = (schema: unknown) => ({ 'application/json': { schema } });
const auth = [{ bearerAuth: [] }];
const problem = { description: 'Problem Details', content: json(ref('ProblemDetails')) };

const scopeParam = { name: 'scope', in: 'path', required: true, schema: { type: 'string', enum: ['base', 'journal', 'article_type'] } };
const idParam = { name: 'id', in: 'path', required: true, description: 'Journal id, slug or key ("hs"); "hs:research" for an article type; "base" for the base scope', schema: { type: 'string' } };
const versionParam = { name: 'version', in: 'path', required: true, schema: { type: 'integer', minimum: 1 } };

const body = (name: string) => ({ required: true, content: json(ref(name)) });
const ok = (description: string, schema: unknown) => ({ description, content: json(schema) });

const labels = { type: 'object', properties: { vi: { type: 'string' }, en: { type: 'string' } }, required: ['vi', 'en'] };
const tier = { type: 'object', properties: { version: { type: 'integer' }, config: { type: 'object', additionalProperties: true } }, required: ['version', 'config'] };

export const journalSchemas = {
  ProfilePin: {
    type: 'object',
    description: 'The profile versions a paper was written under',
    properties: { base: { type: 'integer' }, journal: { type: 'integer' }, articleType: { type: 'integer' } },
  },
  ArticleType: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      code: { type: 'string', description: 'research, review, case-report ...' },
      labels,
      label: { ...labels, description: 'Same as labels' },
      status: { type: 'string', enum: ['active', 'archived'] },
      sortOrder: { type: 'integer' },
      requiredSections: { type: 'array', items: { type: 'string' } },
    },
    required: ['id', 'code', 'labels', 'status', 'sortOrder'],
  },
  CreateArticleTypeRequest: {
    type: 'object',
    properties: {
      code: { type: 'string', pattern: '^[a-z][a-z0-9-]{1,49}$' },
      labels,
      sortOrder: { type: 'integer' },
    },
    required: ['code', 'labels'],
  },
  UpdateArticleTypeRequest: {
    type: 'object',
    properties: {
      labels,
      status: { type: 'string', enum: ['active', 'archived'] },
      sortOrder: { type: 'integer' },
    },
  },
  JournalAccess: {
    type: 'object',
    properties: { canEdit: { type: 'boolean' }, canCreate: { type: 'boolean' } },
    required: ['canEdit', 'canCreate'],
  },
  ChangeArticleTypeRequest: {
    type: 'object',
    properties: { articleType: { type: 'string', nullable: true, description: 'Code of one of the journal\'s article types; null for none' } },
    required: ['articleType'],
  },
  ArticleTypeChangeResult: {
    type: 'object',
    properties: {
      changed: { type: 'boolean' },
      articleType: { type: 'string', nullable: true },
      profilePin: ref('ProfilePin'),
      version: { type: 'integer', description: 'The paper\'s version after the change (its ETag)' },
    },
    required: ['changed', 'profilePin', 'version'],
  },
  ProfileUpgradeResult: {
    type: 'object',
    properties: { upgraded: { type: 'boolean' }, profilePin: ref('ProfilePin'), version: { type: 'integer', description: 'The paper\'s version after the change (its ETag)' } },
    required: ['upgraded', 'profilePin', 'version'],
  },
  Journal: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      slug: { type: 'string' },
      code: { type: 'string' },
      name: { type: 'string' },
      nameEn: { type: 'string', nullable: true },
      shortName: { type: 'string' },
      issn: { type: 'string', nullable: true },
      color: { type: 'string', description: '#RRGGBB' },
      status: { type: 'string', enum: ['draft', 'published', 'archived'] },
      sortOrder: { type: 'integer' },
      articleTypes: { type: 'array', items: { type: 'string' }, description: 'Codes of the active article types' },
      latexCls: { type: 'string' },
      version: { type: 'integer', description: 'Also the ETag; send it back as If-Match when editing' },
    },
    required: ['id', 'slug', 'code', 'name', 'shortName', 'color', 'status', 'version'],
  },
  CreateJournalRequest: {
    type: 'object',
    properties: {
      key: { type: 'string', description: 'The slug is "vnuhcm-" + key', pattern: '^[a-z][a-z0-9-]{1,30}$' },
      name: { type: 'string' },
      nameEn: { type: 'string' },
      code: { type: 'string', description: 'VNUHCM-HS', pattern: '^[A-Z0-9][A-Z0-9-]{1,30}$' },
      shortName: { type: 'string' },
      issn: { type: 'string', nullable: true },
      color: { type: 'string', pattern: '^#[0-9a-fA-F]{6}$' },
      status: { type: 'string', enum: ['draft', 'published', 'archived'], default: 'draft' },
      articleTypes: { type: 'array', items: { type: 'string' }, description: 'Codes of the article types to start with' },
    },
    required: ['key', 'name', 'color'],
  },
  UpdateJournalRequest: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      nameEn: { type: 'string' },
      code: { type: 'string', description: 'VNUHCM-HS', pattern: '^[A-Z0-9][A-Z0-9-]{1,30}$' },
      shortName: { type: 'string' },
      issn: { type: 'string', nullable: true },
      color: { type: 'string', pattern: '^#[0-9a-fA-F]{6}$' },
      status: { type: 'string', enum: ['draft', 'published', 'archived'] },
      sortOrder: { type: 'integer' },
    },
  },
  ProfileVersion: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      scope: { type: 'string', enum: ['base', 'journal', 'article_type'] },
      journalId: { type: 'string', format: 'uuid', nullable: true },
      version: { type: 'integer' },
      state: { type: 'string', enum: ['draft', 'validated', 'published', 'archived'] },
      config: { type: 'object', additionalProperties: true },
      schemaVersion: { type: 'integer' },
      changeNote: { type: 'string', nullable: true },
      createdBy: { type: 'string', format: 'uuid', nullable: true },
      createdAt: { type: 'string', format: 'date-time' },
      publishedAt: { type: 'string', format: 'date-time', nullable: true },
    },
    required: ['id', 'scope', 'version', 'state', 'config', 'createdAt'],
  },
  ProfileValidation: {
    type: 'object',
    properties: {
      ok: { type: 'boolean' },
      issues: {
        type: 'array',
        items: { type: 'object', properties: { path: { type: 'string' }, message: { type: 'string' } }, required: ['path', 'message'] },
      },
      version: ref('ProfileVersion'),
    },
    required: ['ok', 'issues', 'version'],
  },
  CreateProfileDraftRequest: {
    type: 'object',
    properties: { config: { type: 'object', additionalProperties: true }, changeNote: { type: 'string' } },
    required: ['config'],
  },
  UpdateProfileDraftRequest: {
    type: 'object',
    properties: { config: { type: 'object', additionalProperties: true }, changeNote: { type: 'string' } },
  },
  PublishProfileRequest: { type: 'object', properties: { changeNote: { type: 'string' } } },
  RollbackProfileRequest: {
    type: 'object',
    properties: { toVersion: { type: 'integer', minimum: 1 }, changeNote: { type: 'string' } },
    required: ['toVersion'],
  },
  ApplyProfileToPapersRequest: { type: 'object', properties: { password: { type: 'string' } }, required: ['password'] },
  ApplyProfileToPapersResult: {
    type: 'object',
    properties: { updated: { type: 'integer' }, unchanged: { type: 'integer' } },
    required: ['updated', 'unchanged'],
  },
  PublishedProfiles: {
    type: 'object',
    properties: {
      base: tier,
      journals: { type: 'object', additionalProperties: tier },
      articleTypes: {
        type: 'object',
        description: 'journal key -> article type code -> rules',
        additionalProperties: { type: 'object', additionalProperties: tier },
      },
      etag: { type: 'string' },
    },
    required: ['base', 'journals', 'articleTypes', 'etag'],
  },
};

export const journalPaths = {
  '/api/v1/journals': {
    get: { tags: ['Journals'], summary: 'List journals', operationId: 'listJournals', responses: { '200': ok('Journals, in the order the admins set', { type: 'array', items: ref('Journal') }) } },
    post: {
      tags: ['Journals'], summary: 'Create a journal', operationId: 'createJournal', security: auth,
      requestBody: body('CreateJournalRequest'),
      responses: { '201': ok('Created', ref('Journal')), '403': problem, '409': problem },
    },
  },
  '/api/v1/journals/{id}': {
    get: {
      tags: ['Journals'], summary: 'Get a journal by id, slug or key', operationId: 'getJournal',
      parameters: [idParam], responses: { '200': ok('Journal', ref('Journal')), '404': problem },
    },
    patch: {
      tags: ['Journals'], summary: 'Edit a journal (If-Match with its version)', operationId: 'updateJournal', security: auth,
      parameters: [idParam, { name: 'If-Match', in: 'header', required: false, schema: { type: 'string' } }],
      requestBody: body('UpdateJournalRequest'),
      responses: { '200': ok('Updated', ref('Journal')), '403': problem, '404': problem, '412': problem },
    },
  },
  '/api/v1/journals/{id}/access': {
    get: {
      tags: ['Journals'], summary: 'What the caller may do with a journal', operationId: 'getJournalAccess', security: auth,
      parameters: [idParam], responses: { '200': ok('Access', ref('JournalAccess')), '403': problem },
    },
  },
  '/api/v1/journals/{id}/apply-profile-to-papers': {
    post: {
      tags: ['Journals'], summary: 'Move every paper of the journal to the rules published now (irreversible, asks for the password)',
      operationId: 'applyProfileToPapers', security: auth, parameters: [idParam], requestBody: body('ApplyProfileToPapersRequest'),
      responses: { '200': ok('Papers moved', ref('ApplyProfileToPapersResult')), '403': problem, '404': problem },
    },
  },
  '/api/v1/journals/{id}/article-types': {
    get: {
      tags: ['Journals'], summary: 'The article types a journal accepts', operationId: 'listArticleTypes',
      parameters: [idParam, { name: 'includeArchived', in: 'query', required: false, schema: { type: 'boolean' } }],
      responses: { '200': ok('Article types, in order', { type: 'array', items: ref('ArticleType') }), '404': problem },
    },
    post: {
      tags: ['Journals'], summary: 'Add an article type to a journal', operationId: 'createArticleType', security: auth,
      parameters: [idParam], requestBody: body('CreateArticleTypeRequest'),
      responses: { '201': ok('Created', ref('ArticleType')), '403': problem, '404': problem, '409': problem },
    },
  },
  '/api/v1/journals/{id}/article-types/{code}': {
    patch: {
      tags: ['Journals'], summary: 'Rename, reorder or archive an article type', operationId: 'updateArticleType', security: auth,
      parameters: [idParam, { name: 'code', in: 'path', required: true, schema: { type: 'string' } }], requestBody: body('UpdateArticleTypeRequest'),
      responses: { '200': ok('Updated', ref('ArticleType')), '403': problem, '404': problem },
    },
  },
  '/api/v1/manuscripts/{id}/article-type': {
    put: {
      tags: ['Manuscripts'], summary: 'Move a paper to another article type of its journal', operationId: 'changeManuscriptArticleType', security: auth,
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
      requestBody: body('ChangeArticleTypeRequest'),
      responses: { '200': ok('Result', ref('ArticleTypeChangeResult')), '400': problem, '403': problem, '404': problem },
    },
  },
  '/api/v1/manuscripts/{id}/profile/upgrade': {
    post: {
      tags: ['Manuscripts'], summary: 'Move a paper to the rules now published for its journal and article type', operationId: 'upgradeManuscriptProfile', security: auth,
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
      responses: { '200': ok('Result', ref('ProfileUpgradeResult')), '403': problem, '404': problem },
    },
  },
  '/api/v1/profiles/published': {
    get: {
      tags: ['Profiles'], summary: 'The published layout rules of every journal', operationId: 'getPublishedProfiles',
      parameters: [{ name: 'If-None-Match', in: 'header', required: false, schema: { type: 'string' } }],
      responses: { '200': ok('Published tiers', ref('PublishedProfiles')), '304': { description: 'Unchanged' } },
    },
  },
  '/api/v1/profiles/resolve': {
    get: {
      tags: ['Profiles'], summary: 'The resolved profile of a journal (and article type), optionally pinned', operationId: 'resolveProfile',
      parameters: [
        { name: 'journal', in: 'query', required: true, schema: { type: 'string' } },
        { name: 'type', in: 'query', required: false, schema: { type: 'string' } },
        { name: 'pin', in: 'query', required: false, description: 'base:1,journal:3,type:2', schema: { type: 'string' } },
      ],
      responses: { '200': ok('Resolved profile', { type: 'object', additionalProperties: true }), '400': problem, '404': problem },
    },
  },
  '/api/v1/profiles/{scope}/{id}/versions': {
    get: {
      tags: ['Profiles'], summary: 'All versions of a scope, newest first', operationId: 'listProfileVersions', security: auth,
      parameters: [scopeParam, idParam], responses: { '200': ok('Versions', { type: 'array', items: ref('ProfileVersion') }), '403': problem, '404': problem },
    },
  },
  '/api/v1/profiles/{scope}/{id}/drafts': {
    post: {
      tags: ['Profiles'], summary: 'Start a new draft version', operationId: 'createProfileDraft', security: auth,
      parameters: [scopeParam, idParam], requestBody: body('CreateProfileDraftRequest'),
      responses: { '201': ok('Draft', ref('ProfileVersion')), '403': problem, '404': problem },
    },
  },
  '/api/v1/profiles/{scope}/{id}/drafts/{version}': {
    patch: {
      tags: ['Profiles'], summary: 'Edit a draft (a validated one goes back to draft)', operationId: 'updateProfileDraft', security: auth,
      parameters: [scopeParam, idParam, versionParam], requestBody: body('UpdateProfileDraftRequest'),
      responses: { '200': ok('Draft', ref('ProfileVersion')), '403': problem, '404': problem, '409': problem },
    },
  },
  '/api/v1/profiles/{scope}/{id}/drafts/{version}/validate': {
    post: {
      tags: ['Profiles'], summary: 'Check a draft produces a complete profile', operationId: 'validateProfileDraft', security: auth,
      parameters: [scopeParam, idParam, versionParam],
      responses: { '200': ok('Validation result', ref('ProfileValidation')), '403': problem, '404': problem, '409': problem },
    },
  },
  '/api/v1/profiles/{scope}/{id}/drafts/{version}/publish': {
    post: {
      tags: ['Profiles'], summary: 'Publish a validated draft; the current version is archived', operationId: 'publishProfileDraft', security: auth,
      parameters: [scopeParam, idParam, versionParam], requestBody: body('PublishProfileRequest'),
      responses: { '200': ok('Published', ref('ProfileVersion')), '403': problem, '404': problem, '409': problem },
    },
  },
  '/api/v1/profiles/{scope}/{id}/rollback': {
    post: {
      tags: ['Profiles'], summary: 'Publish a copy of an earlier version as a new version', operationId: 'rollbackProfile', security: auth,
      parameters: [scopeParam, idParam], requestBody: body('RollbackProfileRequest'),
      responses: { '200': ok('Published', ref('ProfileVersion')), '400': problem, '403': problem, '404': problem },
    },
  },
};
