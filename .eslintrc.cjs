const path = require('path');
const fs = require('fs');

const baselinePath = path.resolve(__dirname, 'scripts/baseline-line-limits.json');
let allowlist = [];
if (fs.existsSync(baselinePath)) {
  try {
    const data = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
    allowlist = data.allowlist || [];
  } catch (e) {
    allowlist = [];
  }
}

// Map allowlisted paths so they match whether ESLint runs from root or inside workspace
const allowlistGlobs = [];
for (const p of allowlist) {
  allowlistGlobs.push(p);
  allowlistGlobs.push(p.replace(/^apps\/web\//, ''));
  allowlistGlobs.push('**/' + path.basename(p));
}

const ignoredFilePatterns = [
  '**/*.test.*',
  '**/*.spec.*',
  '**/fixtures/**',
  '**/*.generated.*',
  '**/generated/**',
  ...allowlistGlobs,
];

module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  env: {
    browser: true,
    node: true,
    es2022: true,
  },
  ignorePatterns: [
    'node_modules/',
    '.next/',
    'dist/',
    'out/',
    'coverage/',
    '*.d.ts',
    'apps/api/',
    'fixtures/',
    'scripts/',
    'scratch*',
    '**/scratch/**',
    'public/',
    'playwright-report/',
    'test-results/',
    '**/generated/**',
  ],
  overrides: [
    // Pure logic: packages/*/src/**/*.ts and apps/web/src/**/*.ts
    {
      files: ['packages/*/src/**/*.ts', 'apps/web/src/**/*.ts'],
      excludedFiles: ignoredFilePatterns,
      rules: {
        'max-lines': [
          'error',
          {
            max: 500,
            skipBlankLines: true,
            skipComments: true,
          },
        ],
      },
    },
    // UI components: apps/web/src/**/*.tsx and packages/*/src/**/*.tsx
    {
      files: ['apps/web/src/**/*.tsx', 'packages/*/src/**/*.tsx'],
      excludedFiles: ignoredFilePatterns,
      rules: {
        'max-lines': [
          'error',
          {
            max: 700,
            skipBlankLines: true,
            skipComments: true,
          },
        ],
      },
    },
  ],
};
