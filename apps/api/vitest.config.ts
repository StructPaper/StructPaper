import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.{test,spec}.{ts,tsx}'],
    // The real-database specs take turns on one database (an advisory lock, see test/journals/db-lock.ts): a spec that is
    // waiting for its turn must not time out in beforeAll while the others run.
    hookTimeout: 180_000,
  },
});
