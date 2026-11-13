import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from './schema';

export interface DbClientOptions extends postgres.Options<any> {
  max?: number;
  idle_timeout?: number;
  connect_timeout?: number;
}

export function createDbClient(
  connectionString: string = process.env.DATABASE_URL || 'postgres://structpaper:structpaper@localhost:5432/structpaper',
  options?: DbClientOptions,
) {
  const client = postgres(connectionString, {
    max: options?.max ?? 10,
    idle_timeout: options?.idle_timeout ?? 20,
    connect_timeout: options?.connect_timeout ?? 10,
    ...options,
  });

  const db = drizzle(client, { schema });

  return { db, client };
}

export type DbClient = ReturnType<typeof createDbClient>['db'];
export type PostgresClient = ReturnType<typeof createDbClient>['client'];
