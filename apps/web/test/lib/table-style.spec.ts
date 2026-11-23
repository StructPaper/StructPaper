import { describe, it, expect } from 'vitest';
import { tableToLatex } from '@/lib/latex-table';
import { resolveTheme } from '@/lib/theme-config';
import { applyTableLayoutHints, wantsFullWidth } from '@/lib/docx-table-extras';
import { replaceSymbolFont } from '@/lib/docx-prepare';
import type { PaperTable, PaperSection } from '@/types/paper';

const theme = resolveTheme({ columnLayout: '2-column', paperSize: 'custom' } as any, '#000099');
const table = (over: Partial<PaperTable> = {}): PaperTable =>
  ({
    id: 't1',
    num: 1,
    caption: 'Bảng 1: Tổng hợp',
    headers: ['Nghiên cứu', 'Phạm vi áp dụng'],
    rows: [
      ['Yoon et al. (2008)', 'BE dài 3-5 mm, đất nạo vét và đất sét mềm, độ sâu khảo sát 30 m, khoảng cách mũi đầu dò 50 mm'],
      ['Xin Kang et al. (2020)', 'BE dài 3 mm, đất cát, thí nghiệm mô hình'],
    ],
    ...over,
  }) as PaperTable;
const tex = (t: PaperTable, one = false) => tableToLatex(t, { isOneColumn: one, theme });

describe('a table as the journals print it', () => {
  it('has a grey header band with bold centred titles and no rule between the band and the body', () => {
    const out = tex(table());
    expect(out).toContain(String.raw`\rowcolor{tableheadrcolor}`);
    expect(out).toContain(String.raw`\centering\arraybackslash\textbf{Nghiên cứu}`);
    // the rules are above the header and below the last row only
    expect(out).not.toMatch(/\\textbf\{Phạm vi áp dụng\} \\\\ \\hline/);
    expect(out.match(/\\hline/g)?.length).toBe(2);
  });

  it('the caption is as wide as the table and starts at its left edge', () => {
    expect(tex(table())).toContain(String.raw`\captionsetup{width=\linewidth,justification=raggedright,singlelinecheck=false,font={small,sf,bf}}\caption`);
  });

  it('the columns fill the width, a column of short names getting about a third of it next to long sentences', () => {
    const out = tex(table());
    const widths = [...out.matchAll(/p\{\\dimexpr\(\\linewidth-\d+\\tabcolsep\)\*(\d+)\/(\d+)\\relax\}/g)].map((m) => Number(m[1]) / Number(m[2]));
    expect(widths).toHaveLength(2);
    expect(widths[0]).toBeGreaterThan(0.25);
    expect(widths[0]).toBeLessThan(0.45);
    expect(widths[0] + widths[1]).toBeCloseTo(1, 1);
  });

  it('the whole body is on the pale blue tint when the table is shaded', () => {
    const out = tex(table({ bodyFill: 'shaded' }));
    expect(out.match(/\\rowcolor\{tablezebracolor\}/g)?.length).toBe(2);
    expect(tex(table({ bodyFill: 'plain' }))).not.toContain('tablezebracolor}\n');
  });
});

describe('tables brought in from Word and tables added in the editor follow the printed journals', () => {
  const section = (t: PaperTable): PaperSection => ({ id: 's', type: 'table', content: '', table: t }) as PaperSection;

  it('an imported table is shaded, unless the Word table explicitly had stripes', () => {
    const plain = table();
    applyTableLayoutHints([section(plain)], {});
    expect(plain.bodyFill).toBe('shaded');
    const striped = table({ hasZebraStripes: true } as any);
    applyTableLayoutHints([section(striped)], {});
    expect(striped.bodyFill).toBeUndefined();
  });

  it('one column or both is decided by the width of the content', () => {
    // research summaries with long rows run across both columns; a short table of numbers stays in one column
    expect(wantsFullWidth(table(), false, 2)).toBe(true);
    expect(wantsFullWidth({ headers: ['A', 'B', 'C', 'D'], rows: [['1', '2', '3', '4'], ['5', '6', '7', '8']] }, false, 4)).toBe(false);
    expect(wantsFullWidth({ headers: ['A', 'B'], rows: [['1', '2']] }, true, 2)).toBe(true);
    expect(wantsFullWidth({ headers: ['A', 'B', 'C', 'D', 'E'], rows: [['1', '2', '3', '4', '5']] }, false, 5)).toBe(true);
    expect(wantsFullWidth({ headers: ['A'], rows: [] }, false, 1)).toBe(false);
  });

  it('a table that already says one or both columns keeps its choice', () => {
    const t = table({ columnSpan: '1-column' });
    applyTableLayoutHints([section(t)], {});
    expect(t.columnSpan).toBe('1-column');
  });
});

describe('symbols inserted from the Symbol font of Word', () => {
  it('become the characters they stand for', () => {
    const xml = '<w:r><w:sym w:font="Symbol" w:char="F0A3"/></w:r><w:r><w:t>10</w:t></w:r><w:r><w:sym w:font="Symbol" w:char="F0B1"/></w:r><w:r><w:sym w:font="Symbol" w:char="F061"/></w:r>';
    const out = replaceSymbolFont(xml);
    expect(out.replaced).toBe(3);
    expect(out.xml).toContain('>≤</w:t>');
    expect(out.xml).toContain('>±</w:t>');
    expect(out.xml).toContain('>α</w:t>');
    expect(out.xml).not.toContain('w:sym');
  });

  it('leaves a symbol it does not know, and other fonts, alone', () => {
    const xml = '<w:sym w:font="Symbol" w:char="F0FF"/><w:sym w:font="Wingdings" w:char="F0A3"/>';
    expect(replaceSymbolFont(xml).xml).toBe(xml);
  });
});
