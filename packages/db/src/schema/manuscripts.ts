import { pgTable, uuid, varchar, text, integer, jsonb, timestamp, primaryKey, index, check } from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import { journals, articleTypes } from './journals';
import { users } from './users';
import { manuscriptDocs, manuscriptOps, manuscriptRevisions } from './sync';
import { assets } from './assets';
import { compileJobs } from './compile';

export const manuscripts = pgTable(
  'manuscripts',
  {
  id: uuid('id').defaultRandom().primaryKey(),
  journalId: uuid('journal_id')
    .notNull()
    .references(() => journals.id, { onDelete: 'cascade' }),
  articleTypeId: uuid('article_type_id').references(() => articleTypes.id, { onDelete: 'set null' }),
  /**
   * The profile versions the paper was written under: { base, journal, articleType? }. Set when the paper is
   * created and moved only by an explicit upgrade, so publishing new journal rules never changes an old paper.
   */
  profilePin: jsonb('profile_pin').$type<{ base?: number; journal?: number; articleType?: number }>().notNull().default({}),
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
  /** Set when the paper is moved to the trash; null = a live paper. The trash purges it for good after the retention period. */
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  deletedBy: uuid('deleted_by').references(() => users.id, { onDelete: 'set null' }),
  },
  (t) => [
    check('chk_manuscripts_profile_pin', sql`jsonb_typeof(${t.profilePin}) = 'object'`),
    index('idx_manuscripts_journal').on(t.journalId),
    index('idx_manuscripts_deleted_at').on(t.deletedAt),
  ],
);

/**
 * The resolved profile a paper was typeset with, kept as it was: even if profile versions were ever pruned,
 * the paper can still be laid out the way it was. One row per (re)pin.
 */
export const manuscriptProfileSnapshots = pgTable(
  'manuscript_profile_snapshots',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    manuscriptId: uuid('manuscript_id')
      .notNull()
      .references(() => manuscripts.id, { onDelete: 'cascade' }),
    pin: jsonb('pin').$type<{ base?: number; journal?: number; articleType?: number }>().notNull(),
    resolved: jsonb('resolved').$type<Record<string, any>>().notNull(),
    hash: varchar('hash', { length: 64 }).notNull(),
    /** 'create' | 'profile_upgrade' */
    reason: varchar('reason', { length: 30 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('idx_profile_snapshots_ms').on(t.manuscriptId, t.createdAt)],
);

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
