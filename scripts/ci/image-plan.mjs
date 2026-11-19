#!/usr/bin/env node
/**
 * Computes a content hash ("source hash") per deployable image.
 *
 * Why: `rules:changes` compares against the previous push, so a failed/cancelled pipeline or a
 * missed workspace dependency silently produces stale images. A content hash does not depend on
 * pipeline history: if an image tagged `src-<hash>` already exists in the registry, the sources
 * that feed it are byte-identical and the build can be skipped safely.
 *
 * Inputs hashed per image:
 *   - the app directory and every workspace package it (transitively) depends on
 *   - its Dockerfile and any extra paths (e.g. docker/fonts)
 *   - root files that affect every build (lockfile, workspace config, tsconfig, package.json, .dockerignore)
 *   - FORCE_HASH_SALT (set it, or run a scheduled pipeline, to force a rebuild)
 *
 * Binary safety:
 *   Files are read as Buffer. Only whitelisted text files are CRLF-normalized.
 *   Each file is hashed with framing: `<relativePath>\0<byteLength>\0<bytes>`.
 *
 * Usage:  node scripts/ci/image-plan.mjs [--out plan.env]
 * Output: dotenv lines `HASH_<SERVICE>=<sha256 hex, 16 chars>`; also printed to stdout.
 */
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, existsSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const repoRoot = process.cwd();

export const CANDIDATE_ROOT_FILES = [
  'package.json',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
  'tsconfig.json',
  '.dockerignore',
  '.npmrc',
  '.nvmrc',
];

export const IMAGES = {
  API: {
    packageName: '@structpaper/api',
    extraPaths: ['docker/fonts', 'apps/api/Dockerfile'],
    usesAllPackages: true,
  },
  WORKER: {
    packageName: '@structpaper/worker',
    extraPaths: ['docker/fonts', 'apps/worker/Dockerfile'],
    usesAllPackages: true,
  },
  WEB: {
    packageName: '@structpaper/web',
    extraPaths: ['apps/web/Dockerfile'],
    usesAllPackages: true,
  },
  DB_INIT: {
    packageName: '@structpaper/db',
    extraPaths: ['docker/db-init.Dockerfile'],
    usesAllPackages: true,
  },
};

const IGNORED_DIRECTORIES = new Set([
  'node_modules',
  'dist',
  '.next',
  '.turbo',
  'coverage',
  '.pnpm-store',
  'test',
  'tests',
  '__tests__',
  'e2e',
]);

const IGNORED_FILE_PATTERN = /\.(spec|test)\.[cm]?[jt]sx?$|\.md$|\.log$|\.tsbuildinfo$/;

const TEXT_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.json',
  '.yml',
  '.yaml',
  '.toml',
  '.cls',
  '.tex',
  '.sty',
  '.bib',
  '.bst',
  '.css',
  '.scss',
  '.html',
  '.svg',
  '.sh',
  '.bash',
  '.sql',
  '.txt',
  '.env',
]);

export function isTextFile(filePath) {
  const normalized = filePath.split(sep).join('/');
  const base = normalized.split('/').pop() || '';
  if (base.startsWith('.env') || base === '.dockerignore' || base === '.gitignore' || base === '.npmrc' || base === '.nvmrc') {
    return true;
  }
  const dotIndex = base.lastIndexOf('.');
  if (dotIndex === -1) return false;
  const ext = base.slice(dotIndex).toLowerCase();
  return TEXT_EXTENSIONS.has(ext);
}

export function readFileNormalized(absolutePath, relativePath) {
  if (isTextFile(relativePath)) {
    const text = readFileSync(absolutePath, 'utf8').replace(/\r\n/g, '\n');
    return Buffer.from(text, 'utf8');
  }
  return readFileSync(absolutePath);
}

/** Reads pnpm-workspace.yaml globs of the form `dir/*` (excludes `!dir/name`). */
export function listWorkspacePackages(customRoot = repoRoot) {
  const workspacePath = join(customRoot, 'pnpm-workspace.yaml');
  if (!existsSync(workspacePath)) {
    return new Map();
  }
  const workspaceYaml = readFileSync(workspacePath, 'utf8');
  const patterns = [...workspaceYaml.matchAll(/^\s*-\s*['"]?([^'"\n]+?)['"]?\s*$/gm)].map((m) => m[1]);
  const excluded = new Set(patterns.filter((p) => p.startsWith('!')).map((p) => p.slice(1)));
  const packages = new Map();
  for (const pattern of patterns.filter((p) => p.endsWith('/*'))) {
    const parent = pattern.slice(0, -2);
    const parentDir = join(customRoot, parent);
    if (!existsSync(parentDir)) continue;
    for (const entry of readdirSync(parentDir, { withFileTypes: true })) {
      const directory = `${parent}/${entry.name}`;
      const manifestPath = join(customRoot, directory, 'package.json');
      if (!entry.isDirectory() || excluded.has(directory) || !existsSync(manifestPath)) continue;
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
      packages.set(manifest.name, { directory, manifest });
    }
  }
  return packages;
}

/** Lists files under `path` (file or directory) in deterministic order, minus ignored ones. */
export function listFiles(path, customRoot = repoRoot) {
  const absolute = join(customRoot, path);
  if (!existsSync(absolute)) return [];
  if (statSync(absolute).isFile()) {
    const normalized = relative(customRoot, absolute).split(sep).join('/');
    return [normalized];
  }
  const files = [];
  const walk = (directory) => {
    const entries = readdirSync(directory, { withFileTypes: true })
      .sort((a, b) => (a.name < b.name ? -1 : 1));
    for (const entry of entries) {
      const entryPath = join(directory, entry.name);
      if (entry.isDirectory()) {
        if (!IGNORED_DIRECTORIES.has(entry.name)) walk(entryPath);
      } else if (!IGNORED_FILE_PATTERN.test(entry.name)) {
        files.push(relative(customRoot, entryPath).split(sep).join('/'));
      }
    }
  };
  walk(absolute);
  return files;
}

/** Hashes path names, lengths and raw/normalized buffer contents. */
export function hashPaths(paths, customRoot = repoRoot) {
  const hash = createHash('sha256');
  hash.update(`salt:${process.env.FORCE_HASH_SALT ?? ''}\n`);
  const files = [...new Set(paths.flatMap((p) => listFiles(p, customRoot)))].sort();
  for (const file of files) {
    const absolute = join(customRoot, file);
    const contentBuffer = readFileNormalized(absolute, file);
    hash.update(`${file}\0${contentBuffer.length}\0`);
    hash.update(contentBuffer);
  }
  return hash.digest('hex').slice(0, 16);
}

export function planImage(packages, config, customRoot = repoRoot) {
  const pkgInfo = packages.get(config.packageName);
  const appDirectory = pkgInfo ? pkgInfo.directory : null;
  const existingRootFiles = CANDIDATE_ROOT_FILES.filter((f) => existsSync(join(customRoot, f)));
  const paths = [...existingRootFiles];
  if (appDirectory) {
    paths.push(appDirectory);
  }
  if (config.extraPaths) {
    paths.push(...config.extraPaths);
  }
  if (config.usesAllPackages) {
    paths.push('packages');
  }
  return hashPaths(paths, customRoot);
}

export function generatePlan(customRoot = repoRoot) {
  const packages = listWorkspacePackages(customRoot);
  const lines = Object.entries(IMAGES).map(
    ([key, config]) => `HASH_${key}=${planImage(packages, config, customRoot)}`,
  );
  return `${lines.join('\n')}\n`;
}

function main() {
  const output = generatePlan(repoRoot);
  const outFlagIndex = process.argv.indexOf('--out');
  if (outFlagIndex !== -1 && process.argv[outFlagIndex + 1]) {
    writeFileSync(process.argv[outFlagIndex + 1], output);
  }
  process.stdout.write(output);
}

if (
  import.meta.url === `file:///${process.argv[1]?.replace(/\\/g, '/')}` ||
  process.argv[1]?.replace(/\\/g, '/').endsWith('scripts/ci/image-plan.mjs')
) {
  main();
}
