#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const baselinePath = path.join(__dirname, 'baseline-line-limits.json');
const baselineData = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
const allowlistSet = new Set(baselineData.allowlist || []);
const limitsMap = baselineData.limits || {};

function countLines(content) {
  const lines = content.split(/\r?\n/);
  let count = 0;
  let inBlockComment = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (inBlockComment) {
      if (trimmed.includes('*/')) inBlockComment = false;
      continue;
    }
    if (trimmed.startsWith('/*')) {
      if (!trimmed.includes('*/')) inBlockComment = true;
      continue;
    }
    if (trimmed.startsWith('//')) continue;
    count++;
  }
  return { codeLines: count, totalLines: lines.length };
}

function isIgnored(relPath) {
  const normalized = relPath.replace(/\\/g, '/');
  if (
    normalized.includes('.test.') ||
    normalized.includes('.spec.') ||
    normalized.includes('/fixtures/') ||
    normalized.includes('.generated.') ||
    normalized.endsWith('.d.ts') ||
    normalized.includes('/node_modules/') ||
    normalized.includes('/.next/') ||
    normalized.includes('/dist/') ||
    normalized.includes('/scripts/')
  ) {
    return true;
  }
  return false;
}

function walk(dir) {
  let res = [];
  if (!fs.existsSync(dir)) return res;
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, item.name);
    if (item.isDirectory()) {
      if (item.name !== 'node_modules' && item.name !== '.next' && item.name !== 'dist') {
        res = res.concat(walk(p));
      }
    } else if (item.name.endsWith('.ts') || item.name.endsWith('.tsx')) {
      res.push(p);
    }
  }
  return res;
}

function verifyLineLimits() {
  const errors = [];
  const warnings = [];

  // 1. Scan packages/ and apps/
  const filesToScan = [
    ...walk(path.join(rootDir, 'packages')),
    ...walk(path.join(rootDir, 'apps')),
  ];

  for (const fullPath of filesToScan) {
    const relPath = path.relative(rootDir, fullPath).replace(/\\/g, '/');
    if (isIgnored(relPath)) continue;

    const content = fs.readFileSync(fullPath, 'utf8');
    const { codeLines, totalLines } = countLines(content);

    // Baseline check for allowlisted legacy files: must only decrease, never grow
    if (allowlistSet.has(relPath)) {
      const baseline = limitsMap[relPath];
      if (baseline && totalLines > baseline.maxAllowedTotal) {
        errors.push(
          `[REGRESSION] Allowlisted file ${relPath} grew: current ${totalLines} > baseline ${baseline.maxAllowedTotal}`
        );
      }
      continue;
    }

    // Tiered limits for non-allowlisted files
    const isUI = relPath.endsWith('.tsx');
    const isLogic = relPath.endsWith('.ts');

    if (isLogic) {
      // Pure logic: error > 500, warn > 300
      if (codeLines > 500) {
        errors.push(
          `[ERROR] Logic file ${relPath} exceeds 500 lines limit (current: ${codeLines} code lines, ${totalLines} total lines)`
        );
      } else if (codeLines > 300) {
        warnings.push(
          `[WARN] Logic file ${relPath} exceeds 300 lines warning threshold (current: ${codeLines} code lines, ${totalLines} total lines)`
        );
      }
    } else if (isUI) {
      // UI component: error > 700, warn > 400
      if (codeLines > 700) {
        errors.push(
          `[ERROR] UI file ${relPath} exceeds 700 lines limit (current: ${codeLines} code lines, ${totalLines} total lines)`
        );
      } else if (codeLines > 400) {
        warnings.push(
          `[WARN] UI file ${relPath} exceeds 400 lines warning threshold (current: ${codeLines} code lines, ${totalLines} total lines)`
        );
      }
    }
  }

  return { errors, warnings };
}

if (require.main === module) {
  const { errors, warnings } = verifyLineLimits();

  if (warnings.length > 0) {
    console.warn(`\n=== Line Limit Warnings (${warnings.length}) ===`);
    warnings.forEach((w) => console.warn(w));
  }

  if (errors.length > 0) {
    console.error(`\n=== Line Limit Violations (${errors.length}) ===`);
    errors.forEach((e) => console.error(e));
    process.exit(1);
  } else {
    console.log('\n[PASS] All files adhere to tiered line limits and baseline allowlist.');
    process.exit(0);
  }
}

module.exports = { verifyLineLimits, countLines, isIgnored };
