#!/usr/bin/env tsx
/**
 * StructPaper Monorepo End-to-End Verification Script
 *
 * Verifies:
 * 1. Build compilation across all active workspaces (contracts, db, api, worker, api-client, web)
 * 2. Database schema & migration integrity
 * 3. Vitest test execution for backend packages and new frontend suites
 * 4. Architecture layer boundary validation via dependency-cruiser (4-layer Clean Architecture)
 *    and line-limit guardrails
 */

import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

interface StepResult {
  phase: string;
  name: string;
  command?: string;
  passed: boolean;
  durationMs: number;
  message?: string;
  error?: string;
}

const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

const rootDir = path.resolve(__dirname, '..');

function runCommand(
  cmd: string,
  cwd: string = rootDir,
  timeoutMs: number = 300000
): Promise<{ exitCode: number; stdout: string; stderr: string; durationMs: number }> {
  return new Promise((resolve) => {
    const start = Date.now();
    const child = spawn(cmd, {
      cwd,
      shell: true,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, FORCE_COLOR: '1' },
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (d) => {
      stdout += d.toString();
    });
    child.stderr.on('data', (d) => {
      stderr += d.toString();
    });

    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      resolve({
        exitCode: 124,
        stdout,
        stderr: stderr + `\nCommand timed out after ${timeoutMs}ms`,
        durationMs: Date.now() - start,
      });
    }, timeoutMs);

    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({
        exitCode: code ?? 1,
        stdout,
        stderr,
        durationMs: Date.now() - start,
      });
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      resolve({
        exitCode: 1,
        stdout,
        stderr: stderr + '\n' + err.message,
        durationMs: Date.now() - start,
      });
    });
  });
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function printHeader(title: string): void {
  console.log('\n' + colors.bold + colors.cyan + '═'.repeat(78) + colors.reset);
  console.log(colors.bold + colors.cyan + `  ${title}` + colors.reset);
  console.log(colors.bold + colors.cyan + '═'.repeat(78) + colors.reset);
}

function printStepResult(res: StepResult): void {
  const statusBadge = res.passed
    ? `${colors.bold}${colors.green}✓ PASS${colors.reset}`
    : `${colors.bold}${colors.red}✗ FAIL${colors.reset}`;
  const dur = colors.dim + `(${formatDuration(res.durationMs)})` + colors.reset;
  const name = `${colors.bold}${res.name}${colors.reset}`;
  console.log(`  ${statusBadge}  ${name} ${dur}`);
  if (res.message && res.passed) {
    console.log(`         ${colors.dim}${res.message}${colors.reset}`);
  }
  if (!res.passed && res.error) {
    console.log(`\n${colors.red}${res.error.trim()}${colors.reset}\n`);
  }
}

async function validateDrizzleSchema(): Promise<{ passed: boolean; message: string; durationMs: number }> {
  const start = Date.now();
  const drizzleConfig = path.join(rootDir, 'packages', 'db', 'drizzle.config.ts');
  const journalPath = path.join(rootDir, 'packages', 'db', 'drizzle', 'meta', '_journal.json');
  const migrationSql = path.join(rootDir, 'packages', 'db', 'drizzle', '0000_peaceful_kang.sql');

  if (!fs.existsSync(drizzleConfig)) {
    return { passed: false, message: 'Missing packages/db/drizzle.config.ts', durationMs: Date.now() - start };
  }
  if (!fs.existsSync(journalPath)) {
    return { passed: false, message: 'Missing packages/db/drizzle/meta/_journal.json', durationMs: Date.now() - start };
  }
  if (!fs.existsSync(migrationSql)) {
    return { passed: false, message: 'Missing initial migration SQL in packages/db/drizzle/', durationMs: Date.now() - start };
  }

  try {
    const journal = JSON.parse(fs.readFileSync(journalPath, 'utf8'));
    if (!journal.entries || journal.entries.length === 0) {
      return { passed: false, message: 'Drizzle journal contains no migration entries', durationMs: Date.now() - start };
    }

    const schemaDir = path.join(rootDir, 'packages', 'db', 'src', 'schema');
    const expectedSchemas = ['access.ts', 'audit.ts', 'compile.ts', 'journals.ts', 'manuscripts.ts', 'users.ts'];
    for (const s of expectedSchemas) {
      if (!fs.existsSync(path.join(schemaDir, s))) {
        return { passed: false, message: `Missing schema file: ${s}`, durationMs: Date.now() - start };
      }
    }

    return {
      passed: true,
      message: `Verified migration "${journal.entries[0].tag}" & ${expectedSchemas.length} core schema modules`,
      durationMs: Date.now() - start,
    };
  } catch (err: any) {
    return { passed: false, message: err.message, durationMs: Date.now() - start };
  }
}

async function main() {
  const overallStart = Date.now();
  const results: StepResult[] = [];
  const args = process.argv.slice(2);
  const skipWebBuild = args.includes('--skip-web-build');

  console.log(colors.bold + colors.magenta + '\n╔════════════════════════════════════════════════════════════════════════════╗');
  console.log('║       STRUCTPAPER MONOREPO END-TO-END VERIFICATION & ARCHITECTURE          ║');
  console.log('╚════════════════════════════════════════════════════════════════════════════╝' + colors.reset);

  // -------------------------------------------------------------------------
  // PHASE 1: Build Compilation Across Active Workspaces
  // -------------------------------------------------------------------------
  printHeader('PHASE 1: Workspace Build & Compilation');

  const buildTargets = [
    { name: '@structpaper/contracts', cmd: 'pnpm --filter @structpaper/contracts build' },
    { name: '@structpaper/db', cmd: 'pnpm --filter @structpaper/db build' },
    { name: '@structpaper/api-client', cmd: 'pnpm --filter @structpaper/api-client build' },
    { name: '@structpaper/api', cmd: 'pnpm --filter @structpaper/api build' },
    { name: '@structpaper/worker', cmd: 'pnpm --filter @structpaper/worker build' },
  ];

  if (!skipWebBuild) {
    buildTargets.push({ name: '@structpaper/web', cmd: 'pnpm --filter @structpaper/web build' });
  }

  for (const target of buildTargets) {
    const res = await runCommand(target.cmd);
    const stepRes: StepResult = {
      phase: 'Phase 1: Build Compilation',
      name: `Build: ${target.name}`,
      command: target.cmd,
      passed: res.exitCode === 0,
      durationMs: res.durationMs,
      error: res.exitCode !== 0 ? res.stderr || res.stdout : undefined,
    };
    results.push(stepRes);
    printStepResult(stepRes);
  }

  if (skipWebBuild) {
    console.log(`  ${colors.dim}ℹ [SKIP] @structpaper/web build (--skip-web-build specified)${colors.reset}`);
  }

  // -------------------------------------------------------------------------
  // PHASE 2: Database Schema & Migration Validation
  // -------------------------------------------------------------------------
  printHeader('PHASE 2: Database Schema & Migration Validation');

  const dbValidation = await validateDrizzleSchema();
  const dbStep: StepResult = {
    phase: 'Phase 2: Database Schema',
    name: 'Drizzle Schema & Migration Journal',
    passed: dbValidation.passed,
    durationMs: dbValidation.durationMs,
    message: dbValidation.message,
    error: !dbValidation.passed ? dbValidation.message : undefined,
  };
  results.push(dbStep);
  printStepResult(dbStep);

  // -------------------------------------------------------------------------
  // PHASE 3: Vitest Test Execution
  // -------------------------------------------------------------------------
  printHeader('PHASE 3: Test Execution Across Packages & Apps');

  const testSuites = [
    { name: '@structpaper/contracts', cmd: 'pnpm --filter @structpaper/contracts test' },
    { name: '@structpaper/db', cmd: 'pnpm --filter @structpaper/db test' },
    { name: '@structpaper/api', cmd: 'pnpm --filter @structpaper/api test' },
    { name: '@structpaper/worker', cmd: 'pnpm --filter @structpaper/worker test' },
    { name: '@structpaper/api-client', cmd: 'pnpm --filter @structpaper/api-client test' },
    { name: 'apps/web/test/papers', cmd: 'pnpm exec vitest run apps/web/test/papers' },
    { name: 'apps/web/test/permissions', cmd: 'pnpm exec vitest run apps/web/test/permissions' },
  ];

  for (const suite of testSuites) {
    const res = await runCommand(suite.cmd);
    const stepRes: StepResult = {
      phase: 'Phase 3: Vitest Test Suites',
      name: `Tests: ${suite.name}`,
      command: suite.cmd,
      passed: res.exitCode === 0,
      durationMs: res.durationMs,
      error: res.exitCode !== 0 ? res.stderr || res.stdout : undefined,
    };
    results.push(stepRes);
    printStepResult(stepRes);
  }

  // -------------------------------------------------------------------------
  // PHASE 4: Architecture & Layer Boundary Validation
  // -------------------------------------------------------------------------
  printHeader('PHASE 4: Architecture & Dependency Boundary Validation');

  const archChecks = [
    {
      name: 'Monorepo & 4-Layer Boundaries (dependency-cruiser)',
      cmd: 'pnpm exec depcruise --config .dependency-cruiser.js packages apps',
    },
    {
      name: 'API Clean Architecture 4-Layer Rules (apps/api)',
      cmd: 'pnpm --filter @structpaper/api depcruise',
    },
    {
      name: 'Architecture Guardrails & Line Limits',
      cmd: 'pnpm exec vitest run tests/architecture.test.ts',
    },
  ];

  for (const arch of archChecks) {
    const res = await runCommand(arch.cmd);
    const stepRes: StepResult = {
      phase: 'Phase 4: Architecture Validation',
      name: arch.name,
      command: arch.cmd,
      passed: res.exitCode === 0,
      durationMs: res.durationMs,
      error: res.exitCode !== 0 ? res.stderr || res.stdout : undefined,
    };
    results.push(stepRes);
    printStepResult(stepRes);
  }

  // -------------------------------------------------------------------------
  // SUMMARY REPORT
  // -------------------------------------------------------------------------
  const totalDuration = Date.now() - overallStart;
  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = results.filter((r) => !r.passed).length;
  const allPassed = failedCount === 0;

  console.log('\n' + colors.bold + colors.cyan + '═'.repeat(78) + colors.reset);
  console.log(colors.bold + (allPassed ? colors.green : colors.red) + `  VERIFICATION SUMMARY REPORT: ${allPassed ? 'ALL PHASES PASSED' : 'FAILURES DETECTED'}` + colors.reset);
  console.log(colors.bold + colors.cyan + '═'.repeat(78) + colors.reset);

  console.log(`  Total Checks Executed : ${colors.bold}${results.length}${colors.reset}`);
  console.log(`  Passed Checks         : ${colors.bold}${colors.green}${passedCount}${colors.reset}`);
  console.log(`  Failed Checks         : ${colors.bold}${failedCount > 0 ? colors.red : colors.green}${failedCount}${colors.reset}`);
  console.log(`  Total Duration        : ${colors.bold}${colors.yellow}${formatDuration(totalDuration)}${colors.reset}\n`);

  if (!allPassed) {
    console.log(colors.bold + colors.red + '  FAILED CHECKS:' + colors.reset);
    for (const r of results.filter((r) => !r.passed)) {
      console.log(`    ${colors.red}✗ [${r.phase}] ${r.name}${colors.reset}`);
      if (r.command) {
        console.log(`      ${colors.dim}Command: ${r.command}${colors.reset}`);
      }
    }
    console.log('');
    process.exit(1);
  }

  console.log(colors.bold + colors.green + '  🎉  Monorepo architecture, builds, and test suites are 100% healthy!' + colors.reset + '\n');
  process.exit(0);
}

main().catch((err) => {
  console.error('\nFatal error during verification execution:', err);
  process.exit(1);
});
