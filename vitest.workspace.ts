import { defineWorkspace } from 'vitest/config';
import path from 'path';

export default defineWorkspace([
  'packages/*/vitest.config.ts',
  'apps/*/vitest.config.ts',
  {
    resolve: {
      preserveSymlinks: true,
      alias: {
        '@structpaper/doc-model': path.resolve(__dirname, 'packages/doc-model/src'),
        '@structpaper/journal-profiles': path.resolve(__dirname, 'packages/journal-profiles/src'),
      '@structpaper/doc-diff': path.resolve(__dirname, 'packages/doc-diff/src'),
        '@structpaper/editor-core': path.resolve(__dirname, 'packages/editor-core/src'),
        '@structpaper/storage': path.resolve(__dirname, 'packages/storage/src'),
        '@structpaper/ingest-docx': path.resolve(__dirname, 'packages/ingest-docx/src'),
        '@structpaper/compiler-client': path.resolve(__dirname, 'packages/compiler-client/src'),
        '@structpaper/qc-engine': path.resolve(__dirname, 'packages/qc-engine/src'),
        '@structpaper/exporters': path.resolve(__dirname, 'packages/exporters/src'),
        '@structpaper/platform': path.resolve(__dirname, 'packages/platform/src'),
        '@structpaper/platform-web': path.resolve(__dirname, 'packages/platform-web/src'),
        '@structpaper/platform-desktop': path.resolve(__dirname, 'packages/platform-desktop/src'),
        '@': path.resolve(__dirname, 'apps/web/src'),
      },
    },
    test: {
      name: 'monorepo',
      include: [
        'packages/**/*.{test,spec}.{ts,tsx}',
        'apps/**/*.{test,spec}.{ts,tsx}',
        'tests/**/*.{test,spec}.{ts,tsx}',
        'test/**/*.{test,spec}.{ts,tsx}',
        'contracts/**/*.{test,spec}.{ts,tsx}',
      ],
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        '**/.next/**',
        '**/e2e/**',
        '**/*.e2e.{test,spec}.{ts,tsx}',
      ],
      environment: 'node',
      setupFiles: [path.resolve(__dirname, 'apps/web/test/setup/skip-animations.ts')],
    },
  },
]);
