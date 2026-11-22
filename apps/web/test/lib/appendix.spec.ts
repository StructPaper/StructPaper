import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import type { CompletePaper } from '@/types/paper';
import { parseDocxFile } from '@/lib/docx-parser';
import { analyzeNumbering } from '@/lib/validation/numbering';
import { crossRefTargets } from '@/lib/cross-refs';
import { tableToLatex } from '@/lib/latex-table';
import { resolveTheme } from '@/lib/theme-config';

const DIR = path.resolve(__dirname, '../../../../docs/Yêu cầu phần mềm, Template, các file mẫu của Tạp chí/Mẫu VNUHCM-HS');
const FILE = fs.existsSync(DIR) ? fs.readdirSync(DIR).find((x) => x.endsWith('.docx')) : undefined;

describe.skipIf(!FILE)('the appendix of a Word file (HS 722)', () => {
  let paper: CompletePaper;
  beforeAll(async () => {
    const buf = fs.readFileSync(path.join(DIR, FILE!));
    paper = await parseDocxFile(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer, FILE!);
  }, 120_000);

  it('is read at the end, in the order of the file: tables and pictures numbered Phụ lục 1 to 6', () => {
    const app = paper.sections.filter((s) => (s.type === 'table' && s.table?.appendix) || (s.type === 'figure' && s.figure?.appendix));
    expect(app.map((s) => (s.table ?? s.figure)!.num)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(app.map((s) => s.type)).toEqual(['table', 'table', 'table', 'figure', 'figure', 'table']);
    // every appendix stands after everything of the text
    const firstApp = paper.sections.indexOf(app[0]);
    expect(paper.sections.slice(firstApp).every((s) => app.includes(s))).toBe(true);
    expect(app[3].figure!.src).toMatch(/^data:image/);
    expect(app[4].figure!.src).toMatch(/^data:image/);
  });

  it('the text keeps its own numbering: Bảng 1, Hình 1 to 4, and the references do not swallow the appendix', () => {
    const tables = paper.sections.filter((s) => s.type === 'table' && !s.table?.appendix).map((s) => s.table!.num);
    expect(tables).toEqual([1]);
    const figures = paper.sections.filter((s) => s.type === 'figure' && !s.figure?.appendix).map((s) => s.figure!.num);
    expect(figures).toEqual([1, 2, 3, 4]);
    expect(paper.references.some((r) => /Phụ lục/i.test(r.raw))).toBe(false);
    expect(analyzeNumbering(paper).objects.filter((o) => o.kind === 'table')).toHaveLength(1);
    expect(crossRefTargets(paper).filter((t) => t.kind === 'table')).toHaveLength(1);
  });

  it('is printed as "Phụ lục N." with no label of the table counter', () => {
    const t = paper.sections.find((s) => s.type === 'table' && s.table?.appendix)!.table!;
    const tex = tableToLatex(t, { isOneColumn: false, theme: resolveTheme(undefined) });
    // (the label as the journal sets "Bảng 1": in the title colour, then the title; no counter)
    expect(tex).toMatch(/\\caption\*\{\{\{\\color\{titlecolor\}Phụ lục 1\.\}\\ /);
    // each appendix table is set across the whole page and turned, as its own settings say (the sheet itself stays upright)
    expect(tex).toContain('\\spwidegeometry');
    expect(tex).toContain('\\begin{landscape}');
    expect(tex).toContain('Phụ lục 1 (tiếp theo)');
    expect(tex).not.toContain('\\label{tab:');
  });
});
