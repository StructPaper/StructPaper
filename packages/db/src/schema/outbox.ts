import { pgTable, uuid, varchar, integer, jsonb, timestamp } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './users';

export const outboxEvents = pgTable('outbox_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  aggregateType: varchar('aggregate_type', { length: 100 }).notNull(),
  aggregateId: uuid('aggregate_id').notNull(),
  eventType: varchar('event_type', { length: 100 }).notNull(),
  payload: jsonb('payload').$type<Record<string, any>>().notNull(),
  status: varchar('status', { length: 50 }).notNull().default('PENDING'),
  retryCount: integer('retry_count').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  processedAt: timestamp('processed_at', { withTimezone: true }),
});

export const idempotencyKeys = pgTable('idempotency_keys', {
  key: varchar('key', { length: 255 }).primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  requestHash: varchar('request_hash', { length: 64 }).notNull(),
  responseBody: jsonb('response_body').$type<Record<string, any>>(),
  statusCode: integer('status_code'),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const idempotencyKeysRelations = relations(idempotencyKeys, ({ one }) => ({
  user: one(users, {
    fields: [idempotencyKeys.userId],
    references: [users.id],
  }),
}));

export type OutboxEvent = typeof outboxEvents.$inferSelect;
export type NewOutboxEvent = typeof outboxEvents.$inferInsert;
export type IdempotencyKey = typeof idempotencyKeys.$inferSelect;
export type NewIdempotencyKey = typeof idempotencyKeys.$inferInsert;
