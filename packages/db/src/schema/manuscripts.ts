import { pgTable, uuid, varchar, text, integer, jsonb, timestamp, primaryKey } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { journals } from './journals';
import { users } from './users';
import { manuscriptDocs, manuscriptOps, manuscriptRevisions } from './sync';
import { assets } from './assets';
import { compileJobs } from './compile';

export const manuscripts = pgTable('manuscripts', {
  id: uuid('id').defaultRandom().primaryKey(),
  journalId: uuid('journal_id')
    .notNull()
    .references(() => journals.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 500 }).notNull(),
  abstract: text('abstract'),
  status: varchar('status', { length: 50 }).notNull().default('DRAFT'),
  generalAccess: varchar('general_access', { length: 20 }).notNull().default('RESTRICTED'),
  createdBy: uuid('created_by')
    .notNull()
    .references(() => users.id, { onDelete: 'restrict' }),
  currentServerRev: integer('current_server_rev').notNull().default(0),
  version: integer('version').notNull().default(1),
  metadata: jsonb('metadata').$type<Record<string, any>>().notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const manuscriptMembers = pgTable(
  'manuscript_members',
  {
    manuscriptId: uuid('manuscript_id')
      .notNull()
      .references(() => manuscripts.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: varchar('role', { length: 50 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.manuscriptId, table.userId] }),
  ],
);

/** Papers a signed-in user opened through a public link: the "Shared with me" list. */
export const manuscriptVisits = pgTable(
  'manuscript_visits',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    manuscriptId: uuid('manuscript_id')
      .notNull()
      .references(() => manuscripts.id, { onDelete: 'cascade' }),
    lastOpenedAt: timestamp('last_opened_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.manuscriptId] })],
);

export const manuscriptsRelations = relations(manuscripts, ({ one, many }) => ({
  journal: one(journals, {
    fields: [manuscripts.journalId],
    references: [journals.id],
  }),
  creator: one(users, {
    fields: [manuscripts.createdBy],
    references: [users.id],
  }),
  members: many(manuscriptMembers),
  doc: one(manuscriptDocs, {
    fields: [manuscripts.id],
    references: [manuscriptDocs.manuscriptId],
  }),
  ops: many(manuscriptOps),
  revisions: many(manuscriptRevisions),
  assets: many(assets),
  compileJobs: many(compileJobs),
}));

export const manuscriptMembersRelations = relations(manuscriptMembers, ({ one }) => ({
  manuscript: one(manuscripts, {
    fields: [manuscriptMembers.manuscriptId],
    references: [manuscripts.id],
  }),
  user: one(users, {
    fields: [manuscriptMembers.userId],
    references: [users.id],
  }),
}));

export type Manuscript = typeof manuscripts.$inferSelect;
export type NewManuscript = typeof manuscripts.$inferInsert;
export type ManuscriptMember = typeof manuscriptMembers.$inferSelect;
export type NewManuscriptMember = typeof manuscriptMembers.$inferInsert;
