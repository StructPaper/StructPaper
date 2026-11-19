import { createDbClient } from '@structpaper/db';

/**
 * The real-database specs wipe and re-seed the same tables, and vitest runs spec files in parallel.
 * A session-level advisory lock makes them take turns: each spec holds it from beforeAll to afterAll.
 */
export async function lockTestDatabase(url: string): Promise<() => Promise<void>> {
  const { client } = createDbClient(url, { max: 1, onnotice: () => undefined });
  await client`select pg_advisory_lock(424242)`;
  return async () => {
    await client`select pg_advisory_unlock(424242)`;
    await client.end();
  };
}
