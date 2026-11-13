import { pgTable, uuid, varchar, integer, timestamp } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { citext } from './types';
import { userRoles, refreshTokens } from './access';
import { manuscriptMembers } from './manuscripts';

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: citext('email').notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }),
  displayName: varchar('display_name', { length: 255 }),
  avatarUrl: varchar('avatar_url', { length: 1024 }),
  status: varchar('status', { length: 50 }).notNull().default('INVITED'),
  permissionsVersion: integer('permissions_version').notNull().default(1),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const userTokens = pgTable('user_tokens', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  type: varchar('type', { length: 50 }).notNull(),
  tokenHash: varchar('token_hash', { length: 255 }).notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  consumedAt: timestamp('consumed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const usersRelations = relations(users, ({ many }) => ({
  tokens: many(userTokens),
  roles: many(userRoles),
  refreshTokens: many(refreshTokens),
  manuscriptMembers: many(manuscriptMembers),
}));

export const userTokensRelations = relations(userTokens, ({ one }) => ({
  user: one(users, {
    fields: [userTokens.userId],
    references: [users.id],
  }),
}));

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type UserToken = typeof userTokens.$inferSelect;
export type NewUserToken = typeof userTokens.$inferInsert;
