import { pgTable, uuid, varchar, integer, jsonb, timestamp } from 'drizzle-orm/pg-core';
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

export const manuscriptRevisions = pgTable('manuscript_revisions', {
  id: uuid('id').defaultRandom().primaryKey(),
  manuscriptId: uuid('manuscript_id')
    .notNull()
    .references(() => manuscripts.id, { onDelete: 'cascade' }),
  serverRev: integer('server_rev').notNull(),
  tagName: varchar('tag_name', { length: 255 }),
  snapshot: jsonb('snapshot').$type<Record<string, any>>().notNull(),
  checksum: varchar('checksum', { length: 64 }),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

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
