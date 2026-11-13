import { pgTable, uuid, varchar, integer, timestamp } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { manuscripts } from './manuscripts';
import { users } from './users';
import { compileJobs } from './compile';

export const assets = pgTable('assets', {
  id: uuid('id').defaultRandom().primaryKey(),
  manuscriptId: uuid('manuscript_id').references(() => manuscripts.id, { onDelete: 'cascade' }),
  filename: varchar('filename', { length: 255 }).notNull(),
  fileSize: integer('file_size').notNull(),
  mimeType: varchar('mime_type', { length: 100 }).notNull(),
  storageKey: varchar('storage_key', { length: 500 }).notNull().unique(),
  checksum: varchar('checksum', { length: 64 }).notNull(),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const assetsRelations = relations(assets, ({ one, many }) => ({
  manuscript: one(manuscripts, {
    fields: [assets.manuscriptId],
    references: [manuscripts.id],
  }),
  creator: one(users, {
    fields: [assets.createdBy],
    references: [users.id],
  }),
  compileJobs: many(compileJobs),
}));

export type Asset = typeof assets.$inferSelect;
export type NewAsset = typeof assets.$inferInsert;
