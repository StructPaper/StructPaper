/**
 * OpenAPI pieces of a paper's content history: the list of versions, one version with its content, naming,
 * deleting, restoring and making a copy. Kept apart from generate-openapi.ts so that file does not grow without bound.
 */
const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const json = (schema: unknown) => ({ 'application/json': { schema } });
const auth = [{ bearerAuth: [] }];
const problem = { description: 'Problem Details', content: json(ref('ProblemDetails')) };
const ok = (description: string, schema: unknown) => ({ description, content: json(schema) });
const body = (name: string) => ({ required: true, content: json(ref(name)) });

const idParam = { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } };
const revisionParam = { name: 'revisionId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } };

const KINDS = ['auto', 'named', 'pre-risk', 'profile-upgrade', 'restore', 'import'];

export const revisionSchemas = {
  RevisionStats: {
    type: 'object',
    description: 'What changed since the version before it',
    properties: {
      blocksAdded: { type: 'integer' },
      blocksRemoved: { type: 'integer' },
      blocksModified: { type: 'integer' },
      blocksMoved: { type: 'integer' },
      wordsDelta: { type: 'integer' },
      refsDelta: { type: 'integer' },
      fieldsChanged: { type: 'integer' },
      itemsChanged: { type: 'integer' },
      layoutChanged: { type: 'boolean' },
    },
    required: ['blocksAdded', 'blocksRemoved', 'blocksModified', 'blocksMoved', 'wordsDelta', 'refsDelta', 'fieldsChanged', 'itemsChanged', 'layoutChanged'],
  },
  RevisionAuthor: {
    type: 'object',
    properties: { id: { type: 'string' }, displayName: { type: 'string' } },
    required: ['id', 'displayName'],
  },
  RevisionSummary: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      manuscriptId: { type: 'string', format: 'uuid' },
      kind: { type: 'string', enum: KINDS },
      name: { type: 'string', nullable: true },
      description: { type: 'string', nullable: true },
      pinned: { type: 'boolean' },
      createdAt: { type: 'string', format: 'date-time' },
      author: { nullable: true, allOf: [ref('RevisionAuthor')] },
      stats: ref('RevisionStats'),
      sizeBytes: { type: 'integer' },
    },
    required: ['id', 'manuscriptId', 'kind', 'name', 'description', 'pinned', 'createdAt', 'author', 'stats', 'sizeBytes'],
  },
  Revision: {
    type: 'object',
    description: 'A version with the paper as it was',
    allOf: [
      ref('RevisionSummary'),
      { type: 'object', properties: { doc: { type: 'object', additionalProperties: true } }, required: ['doc'] },
    ],
  },
  RevisionList: {
    type: 'object',
    properties: {
      items: { type: 'array', items: ref('RevisionSummary') },
      nextBefore: { type: 'string', nullable: true, description: 'Pass as `before` for the next page' },
    },
    required: ['items', 'nextBefore'],
  },
  CreateRevisionRequest: {
    type: 'object',
    properties: {
      name: { type: 'string', minLength: 1, maxLength: 120 },
      description: { type: 'string', maxLength: 1000 },
      kind: { type: 'string', enum: ['named', 'pre-risk'], default: 'named' },
    },
    required: ['name'],
  },
  UpdateRevisionRequest: {
    type: 'object',
    properties: {
      name: { type: 'string', minLength: 1, maxLength: 120 },
      description: { type: 'string', maxLength: 1000, nullable: true },
    },
  },
  RestoreRevisionResult: {
    type: 'object',
    properties: { version: { type: 'integer' }, restoredAs: ref('RevisionSummary') },
    required: ['version', 'restoredAs'],
  },
  DeleteRevisionResult: { type: 'object', properties: { success: { type: 'boolean' } }, required: ['success'] },
};

export const revisionPaths = {
  '/api/v1/manuscripts/{id}/revisions': {
    get: {
      tags: ['Manuscripts'], summary: 'The versions of a paper, newest first', operationId: 'listManuscriptRevisions', security: auth,
      parameters: [
        idParam,
        { name: 'kind', in: 'query', required: false, schema: { type: 'string', enum: KINDS } },
        { name: 'limit', in: 'query', required: false, schema: { type: 'integer', minimum: 1, maximum: 200, default: 50 } },
        { name: 'before', in: 'query', required: false, schema: { type: 'string' } },
      ],
      responses: { '200': ok('Versions', ref('RevisionList')), '403': problem, '404': problem },
    },
    post: {
      tags: ['Manuscripts'], summary: 'Keep the paper as it is now under a name', operationId: 'createManuscriptRevision', security: auth,
      parameters: [idParam], requestBody: body('CreateRevisionRequest'),
      responses: { '201': ok('Version', ref('RevisionSummary')), '400': problem, '403': problem, '404': problem },
    },
  },
  '/api/v1/manuscripts/{id}/revisions/{revisionId}': {
    get: {
      tags: ['Manuscripts'], summary: 'One version with the paper as it was', operationId: 'getManuscriptRevision', security: auth,
      parameters: [idParam, revisionParam], responses: { '200': ok('Version', ref('Revision')), '403': problem, '404': problem },
    },
    patch: {
      tags: ['Manuscripts'], summary: 'Rename a version or change its description', operationId: 'updateManuscriptRevision', security: auth,
      parameters: [idParam, revisionParam], requestBody: body('UpdateRevisionRequest'),
      responses: { '200': ok('Version', ref('RevisionSummary')), '403': problem, '404': problem },
    },
    delete: {
      tags: ['Manuscripts'], summary: 'Delete a named version', operationId: 'deleteManuscriptRevision', security: auth,
      parameters: [idParam, revisionParam], responses: { '200': ok('Deleted', ref('DeleteRevisionResult')), '400': problem, '403': problem, '404': problem },
    },
  },
  '/api/v1/manuscripts/{id}/revisions/{revisionId}/restore': {
    post: {
      tags: ['Manuscripts'], summary: 'Put the paper back to a version (adds a version, rewrites nothing)', operationId: 'restoreManuscriptRevision', security: auth,
      parameters: [idParam, revisionParam], responses: { '200': ok('Restored', ref('RestoreRevisionResult')), '400': problem, '403': problem, '404': problem },
    },
  },
  '/api/v1/manuscripts/{id}/revisions/{revisionId}/duplicate': {
    post: {
      tags: ['Manuscripts'], summary: 'A new paper made from a version', operationId: 'duplicateManuscriptRevision', security: auth,
      parameters: [idParam, revisionParam], responses: { '201': ok('The new paper', ref('Manuscript')), '403': problem, '404': problem },
    },
  },
};
