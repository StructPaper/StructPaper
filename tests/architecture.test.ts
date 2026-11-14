import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { verifyLineLimits } from '../scripts/verify-line-limits.js';

describe('Architecture Guardrails', () => {
  it('enforces tiered line limits and baseline allowlist (no legacy file may grow)', () => {
    const { errors, warnings } = verifyLineLimits();
    if (errors.length > 0) {
      console.error('Line limit errors:', errors);
    }
    expect(errors).toEqual([]);
  });

  it('verifies baseline allowlist file exists and is valid JSON', () => {
    const baselinePath = path.resolve(__dirname, '../scripts/baseline-line-limits.json');
    expect(fs.existsSync(baselinePath)).toBe(true);

    const data = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
    expect(Array.isArray(data.allowlist)).toBe(true);
    expect(data.allowlist.length).toBeGreaterThan(0);
    expect(data.allowlist).toContain('apps/web/src/lib/docx-parser.ts');
    expect(data.allowlist).toContain('apps/web/src/features/editor/components/UnifiedEditorView.tsx');
  });

  it('verifies dependency-cruiser configuration exists and has required rules', () => {
    const depCruisePath = path.resolve(__dirname, '../.dependency-cruiser.js');
    expect(fs.existsSync(depCruisePath)).toBe(true);

    const config = require(depCruisePath);
    const ruleNames = (config.forbidden || []).map((r: { name: string }) => r.name);
    expect(ruleNames).toContain('no-doc-model-contamination');
    expect(ruleNames).toContain('strict-downward-dependencies');
  });
});
