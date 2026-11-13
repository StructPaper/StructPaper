import { pgTable, uuid, varchar, text, integer, timestamp } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { manuscripts } from './manuscripts';
import { manuscriptRevisions } from './sync';
import { assets } from './assets';

export const compileJobs = pgTable('compile_jobs', {
  id: uuid('id').defaultRandom().primaryKey(),
  manuscriptId: uuid('manuscript_id')
    .notNull()
    .references(() => manuscripts.id, { onDelete: 'cascade' }),
  revisionId: uuid('revision_id').references(() => manuscriptRevisions.id, { onDelete: 'set null' }),
  serverRev: integer('server_rev').notNull().default(0),
  status: varchar('status', { length: 50 }).notNull().default('QUEUED'),
  engine: varchar('engine', { length: 50 }).notNull().default('XELATEX'),
  logOutput: text('log_output'),
  pdfAssetId: uuid('pdf_asset_id').references(() => assets.id, { onDelete: 'set null' }),
  durationMs: integer('duration_ms'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const compileJobsRelations = relations(compileJobs, ({ one }) => ({
  manuscript: one(manuscripts, {
    fields: [compileJobs.manuscriptId],
    references: [manuscripts.id],
  }),
  revision: one(manuscriptRevisions, {
    fields: [compileJobs.revisionId],
    references: [manuscriptRevisions.id],
  }),
  pdfAsset: one(assets, {
    fields: [compileJobs.pdfAssetId],
    references: [assets.id],
  }),
}));

export type CompileJob = typeof compileJobs.$inferSelect;
export type NewCompileJob = typeof compileJobs.$inferInsert;
