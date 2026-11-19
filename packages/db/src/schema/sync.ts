import { pgTable, uuid, varchar, text, integer, boolean, jsonb, timestamp, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { manuscripts } from './manuscripts';
import { users } from './users';
import { compileJobs } from './compile';

export const manuscriptDocs = pgTable('manuscript_docs', {
  manuscriptId: uuid('manuscript_id')
    .primaryKey()
    .references(() => manuscripts.id, { onDelete: 'cascade' }),
  docTree: jsonb('doc_tree').$type<Record<string, any>>().notNull(),
  serverRev: integer('server_rev').notNull().default(0),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const manuscriptOps = pgTable('manuscript_ops', {
  id: uuid('id').defaultRandom().primaryKey(),
  manuscriptId: uuid('manuscript_id')
    .notNull()
    .references(() => manuscripts.id, { onDelete: 'cascade' }),
  serverRev: integer('server_rev').notNull(),
  clientRev: integer('client_rev').notNull(),
  opId: uuid('op_id').notNull().unique(),
  patches: jsonb('patches').$type<any[]>().notNull(),
  checksum: varchar('checksum', { length: 64 }),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

/**
 * Kinds of revision. 'sync' is the checkpoint the op log writes (not shown in a paper's history); the others are
 * the history an author sees: automatic ones, named ones, the safety copy taken before a risky step, and a restore.
 */
export const REVISION_KINDS = ['auto', 'named', 'pre-risk', 'profile-upgrade', 'restore', 'import', 'sync'] as const;
export type RevisionKind = (typeof REVISION_KINDS)[number];

export const manuscriptRevisions = pgTable(
  'manuscript_revisions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    manuscriptId: uuid('manuscript_id')
      .notNull()
      .references(() => manuscripts.id, { onDelete: 'cascade' }),
    serverRev: integer('server_rev').notNull(),
    /** The name of a named version, or the label of an automatic one ("Trước khi đổi loại bài"). */
    tagName: varchar('tag_name', { length: 255 }),
    description: text('description'),
    /** One of REVISION_KINDS. */
    kind: varchar('kind', { length: 30 }).notNull().default('auto'),
    /** The whole paper as it was (metadata.doc of the manuscript). */
    snapshot: jsonb('snapshot').$type<Record<string, any>>().notNull(),
    /** Fingerprint of the content (see contentFingerprintSource): two revisions with the same one are the same text. */
    checksum: varchar('checksum', { length: 64 }),
    /** What changed since the revision before it (blocks added/removed/edited, words...), for the list. */
    stats: jsonb('stats').$type<Record<string, any>>().notNull().default({}),
    /** Named versions are pinned: pruning never removes them. */
    pinned: boolean('pinned').notNull().default(false),
    sizeBytes: integer('size_bytes').notNull().default(0),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('idx_revisions_ms_created').on(t.manuscriptId, t.createdAt)],
);

export const manuscriptDocsRelations = relations(manuscriptDocs, ({ one }) => ({
  manuscript: one(manuscripts, {
    fields: [manuscriptDocs.manuscriptId],
    references: [manuscripts.id],
  }),
}));

export const manuscriptOpsRelations = relations(manuscriptOps, ({ one }) => ({
  manuscript: one(manuscripts, {
    fields: [manuscriptOps.manuscriptId],
    references: [manuscripts.id],
  }),
  creator: one(users, {
    fields: [manuscriptOps.createdBy],
    references: [users.id],
  }),
}));

export const manuscriptRevisionsRelations = relations(manuscriptRevisions, ({ one, many }) => ({
  manuscript: one(manuscripts, {
    fields: [manuscriptRevisions.manuscriptId],
    references: [manuscripts.id],
  }),
  creator: one(users, {
    fields: [manuscriptRevisions.createdBy],
    references: [users.id],
  }),
  compileJobs: many(compileJobs),
}));

export type ManuscriptDoc = typeof manuscriptDocs.$inferSelect;
export type NewManuscriptDoc = typeof manuscriptDocs.$inferInsert;
export type ManuscriptOp = typeof manuscriptOps.$inferSelect;
export type NewManuscriptOp = typeof manuscriptOps.$inferInsert;
export type ManuscriptRevision = typeof manuscriptRevisions.$inferSelect;
export type NewManuscriptRevision = typeof manuscriptRevisions.$inferInsert;
