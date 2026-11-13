import { pgTable, uuid, varchar, jsonb, integer, timestamp } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { citext } from './types';
import { manuscripts } from './manuscripts';
import { roles } from './access';

export const journals = pgTable('journals', {
  id: uuid('id').defaultRandom().primaryKey(),
  slug: citext('slug').notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  issn: varchar('issn', { length: 50 }),
  settings: jsonb('settings').$type<Record<string, any>>().notNull().default({}),
  version: integer('version').notNull().default(1),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const journalsRelations = relations(journals, ({ many }) => ({
  manuscripts: many(manuscripts),
  roles: many(roles),
}));

export type Journal = typeof journals.$inferSelect;
export type NewJournal = typeof journals.$inferInsert;
