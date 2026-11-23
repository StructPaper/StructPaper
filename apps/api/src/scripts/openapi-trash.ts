/**
 * OpenAPI pieces of the trash of deleted manuscripts: list, restore, delete for good. Journal managers and above only.
 * Kept apart from generate-openapi.ts so that file does not grow without bound.
 */
const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const json = (schema: unknown) => ({ 'application/json': { schema } });
const auth = [{ bearerAuth: [] }];
const problem = { description: 'Problem Details', content: json(ref('ProblemDetails')) };
const ok = (description: string, schema: unknown) => ({ description, content: json(schema) });
const idParam = { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } };

export const trashSchemas = {
  TrashedManuscript: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      title: { type: 'string' },
      status: { type: 'string' },
      journal: {
        nullable: true,
        type: 'object',
        properties: {
          id: { type: 'string' },
          slug: { type: 'string' },
          code: { type: 'string' },
          name: { type: 'string' },
          color: { type: 'string' },
          shortName: { type: 'string' },
        },
        required: ['id', 'slug', 'code', 'name', 'color', 'shortName'],
      },
      owner: { nullable: true, type: 'object', properties: { id: { type: 'string' }, displayName: { type: 'string' } }, required: ['id', 'displayName'] },
      deletedAt: { type: 'string', format: 'date-time' },
      deletedBy: { nullable: true, type: 'object', properties: { id: { type: 'string' }, displayName: { type: 'string' } }, required: ['id', 'displayName'] },
      purgeAt: { type: 'string', format: 'date-time', description: 'When the trash removes it for good' },
      daysLeft: { type: 'integer', description: 'Whole days left before that' },
      access: {
        type: 'object',
        description: 'What the caller may do with it: whoever deleted a paper restores or deletes it for good; managers do it for their journals papers',
        properties: { canRestore: { type: 'boolean' }, canPurge: { type: 'boolean' } },
        required: ['canRestore', 'canPurge'],
      },
    },
    required: ['id', 'title', 'status', 'journal', 'owner', 'deletedAt', 'deletedBy', 'purgeAt', 'daysLeft', 'access'],
  },
  TrashList: {
    type: 'object',
    properties: {
      items: { type: 'array', items: ref('TrashedManuscript') },
      retentionDays: { type: 'integer', description: 'Days a paper stays in the trash' },
    },
    required: ['items', 'retentionDays'],
  },
  TrashPreview: {
    allOf: [
      ref('TrashedManuscript'),
      { type: 'object', properties: { metadata: { type: 'object', additionalProperties: true, description: 'The stored content (read with docFromStored)' } }, required: ['metadata'] },
    ],
  },
  RestoredManuscript: {
    type: 'object',
    properties: { id: { type: 'string', format: 'uuid' }, title: { type: 'string' } },
    required: ['id', 'title'],
  },
  TrashBulkRequest: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['restore', 'purge'] },
      ids: { type: 'array', items: { type: 'string', format: 'uuid' }, maxItems: 500, description: 'Leave out for every paper the caller can see in the trash' },
    },
    required: ['action'],
  },
  TrashBulkResult: { type: 'object', properties: { done: { type: 'integer' }, skipped: { type: 'integer' } }, required: ['done', 'skipped'] },
  PurgeManuscriptResult: { type: 'object', properties: { success: { type: 'boolean' } }, required: ['success'] },
};

export const trashPaths = {
  '/api/v1/manuscripts/trash': {
    get: {
      tags: ['Manuscripts'], summary: 'Deleted manuscripts the caller can still restore (their own; journal managers: those of their journals)', operationId: 'listTrash', security: auth,
      parameters: [
        { name: 'search', in: 'query', required: false, schema: { type: 'string' } },
        { name: 'limit', in: 'query', required: false, schema: { type: 'integer', minimum: 1, maximum: 200, default: 100 } },
      ],
      responses: { '200': ok('The trash', ref('TrashList')), '403': problem },
    },
  },
  '/api/v1/manuscripts/trash/bulk': {
    post: {
      tags: ['Manuscripts'], summary: 'Restore or delete for good many trashed manuscripts at once (all of them when ids is left out); what the caller may not touch is skipped', operationId: 'bulkTrash', security: auth,
      requestBody: { required: true, content: json(ref('TrashBulkRequest')) },
      responses: { '200': ok('Done', ref('TrashBulkResult')), '400': problem },
    },
  },
  '/api/v1/manuscripts/trash/{id}/restore': {
    post: {
      tags: ['Manuscripts'], summary: 'Bring a deleted manuscript back', operationId: 'restoreFromTrash', security: auth,
      parameters: [idParam], responses: { '200': ok('Restored', ref('RestoredManuscript')), '403': problem, '404': problem, '409': problem },
    },
  },
  '/api/v1/manuscripts/trash/{id}': {
    get: {
      tags: ['Manuscripts'], summary: 'Read a deleted manuscript (who deleted it, or a manager of its journal)', operationId: 'getTrashedManuscript', security: auth,
      parameters: [idParam], responses: { '200': ok('The paper with its content', ref('TrashPreview')), '403': problem, '404': problem, '409': problem },
    },
    delete: {
      tags: ['Manuscripts'], summary: 'Delete a manuscript in the trash for good', operationId: 'purgeFromTrash', security: auth,
      parameters: [idParam], responses: { '200': ok('Deleted for good', ref('PurgeManuscriptResult')), '403': problem, '404': problem, '409': problem },
    },
  },
};
