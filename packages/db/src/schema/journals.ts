import { pgTable, uuid, varchar, jsonb, integer, text, timestamp, uniqueIndex, index, check } from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import { citext } from './types';
import { manuscripts } from './manuscripts';
import { roles } from './access';
import { users } from './users';

/** draft: being prepared, not offered to authors yet; published: live; archived: kept for old papers only. */
export const JOURNAL_STATUSES = ['draft', 'published', 'archived'] as const;
export type JournalStatus = (typeof JOURNAL_STATUSES)[number];

/**
 * Who a journal is. The layout rules are not here: they are versioned in `profile_versions`.
 * Changing a name, colour or ISSN needs no new profile version; it is laid over the published rules when they are served.
 */
export const journals = pgTable(
  'journals',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    /** "vnuhcm-hs": addresses the journal in URLs; the key ("hs") is the slug without the prefix. */
    slug: citext('slug').notNull().unique(),
    /** "VNUHCM-HS": what the journal calls itself in headers and lists. */
    code: varchar('code', { length: 40 }).notNull().unique(),
    /** Vietnamese name. */
    name: varchar('name', { length: 255 }).notNull(),
    nameEn: varchar('name_en', { length: 255 }),
    /** "HS" */
    shortName: varchar('short_name', { length: 20 }).notNull(),
    color: varchar('color', { length: 7 }).notNull(),
    issn: varchar('issn', { length: 9 }),
    /** LaTeX class the PDF is typeset with. */
    latexCls: varchar('latex_cls', { length: 100 }).notNull().default('structpaper-std.cls'),
    status: varchar('status', { length: 20 }).$type<JournalStatus>().notNull().default('draft'),
    sortOrder: integer('sort_order').notNull().default(0),
    /** Bumped on every edit of the identity; sent as the ETag. */
    version: integer('version').notNull().default(1),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    check('chk_journals_status', sql`${t.status} in ('draft','published','archived')`),
    check('chk_journals_color', sql`${t.color} ~ '^#[0-9A-Fa-f]{6}$'`),
    check('chk_journals_issn', sql`${t.issn} is null or ${t.issn} ~ '^[0-9]{4}-[0-9]{3}[0-9Xx]$'`),
    index('idx_journals_sort').on(t.sortOrder),
  ],
);

/** The kinds of paper a journal accepts (research, review, ...). Their rules are versioned in `profile_versions`. */
export const articleTypes = pgTable(
  'article_types',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    journalId: uuid('journal_id')
      .notNull()
      .references(() => journals.id, { onDelete: 'cascade' }),
    /** "research", "case-report" */
    code: varchar('code', { length: 50 }).notNull(),
    labels: jsonb('labels').$type<{ vi: string; en: string }>().notNull(),
    status: varchar('status', { length: 20 }).$type<'active' | 'archived'>().notNull().default('active'),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('uq_article_types_code').on(t.journalId, t.code),
    check('chk_article_types_status', sql`${t.status} in ('active','archived')`),
    check('chk_article_types_code', sql`${t.code} ~ '^[a-z][a-z0-9-]{1,49}$'`),
  ],
);

/** base: rules shared by every journal; journal: one journal's own rules; article_type: one article type of a journal. */
export const PROFILE_SCOPES = ['base', 'journal', 'article_type'] as const;
export type ProfileScope = (typeof PROFILE_SCOPES)[number];

/** draft -> validated -> published -> archived (replaced by a newer published version). */
export const PROFILE_STATES = ['draft', 'validated', 'published', 'archived'] as const;
export type ProfileState = (typeof PROFILE_STATES)[number];

/**
 * Versioned layout rules (tiers 1-3 of the profile). Once published, a version never changes (a database
 * trigger refuses it), so a paper pinned to version N keeps resolving to exactly the rules it was written under.
 */
export const profileVersions = pgTable(
  'profile_versions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    scopeType: varchar('scope_type', { length: 20 }).$type<ProfileScope>().notNull(),
    /** set for the journal scope only */
    journalId: uuid('journal_id').references(() => journals.id, { onDelete: 'cascade' }),
    /** set for the article_type scope only */
    articleTypeId: uuid('article_type_id').references(() => articleTypes.id, { onDelete: 'cascade' }),
    version: integer('version').notNull(),
    state: varchar('state', { length: 20 }).$type<ProfileState>().notNull().default('draft'),
    config: jsonb('config').$type<Record<string, any>>().notNull(),
    schemaVersion: integer('schema_version').notNull().default(1),
    changeNote: text('change_note'),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    publishedAt: timestamp('published_at', { withTimezone: true }),
  },
  (t) => [
    check('chk_profile_scope_type', sql`${t.scopeType} in ('base','journal','article_type')`),
    check('chk_profile_state', sql`${t.state} in ('draft','validated','published','archived')`),
    check(
      'chk_profile_scope',
      sql`(${t.scopeType} = 'base' and ${t.journalId} is null and ${t.articleTypeId} is null)
        or (${t.scopeType} = 'journal' and ${t.journalId} is not null and ${t.articleTypeId} is null)
        or (${t.scopeType} = 'article_type' and ${t.journalId} is null and ${t.articleTypeId} is not null)`,
    ),
    // version numbers are unique inside a scope
    uniqueIndex('uq_profile_version_journal').on(t.journalId, t.version).where(sql`${t.scopeType} = 'journal'`),
    uniqueIndex('uq_profile_version_article_type').on(t.articleTypeId, t.version).where(sql`${t.scopeType} = 'article_type'`),
    uniqueIndex('uq_profile_version_base').on(t.version).where(sql`${t.scopeType} = 'base'`),
    // at most one published version per scope
    uniqueIndex('uq_profile_published_journal').on(t.journalId).where(sql`${t.state} = 'published' and ${t.scopeType} = 'journal'`),
    uniqueIndex('uq_profile_published_article_type').on(t.articleTypeId).where(sql`${t.state} = 'published' and ${t.scopeType} = 'article_type'`),
    uniqueIndex('uq_profile_published_base').on(t.scopeType).where(sql`${t.state} = 'published' and ${t.scopeType} = 'base'`),
    index('idx_profile_versions_journal').on(t.journalId, t.version),
  ],
);

export const journalsRelations = relations(journals, ({ many }) => ({
  manuscripts: many(manuscripts),
  roles: many(roles),
  articleTypes: many(articleTypes),
  profileVersions: many(profileVersions),
}));

export const articleTypesRelations = relations(articleTypes, ({ one, many }) => ({
  journal: one(journals, { fields: [articleTypes.journalId], references: [journals.id] }),
  profileVersions: many(profileVersions),
}));

export const profileVersionsRelations = relations(profileVersions, ({ one }) => ({
  journal: one(journals, { fields: [profileVersions.journalId], references: [journals.id] }),
  articleType: one(articleTypes, { fields: [profileVersions.articleTypeId], references: [articleTypes.id] }),
}));

export type Journal = typeof journals.$inferSelect;
export type NewJournal = typeof journals.$inferInsert;
export type ArticleType = typeof articleTypes.$inferSelect;
export type NewArticleType = typeof articleTypes.$inferInsert;
export type ProfileVersion = typeof profileVersions.$inferSelect;
export type NewProfileVersion = typeof profileVersions.$inferInsert;
