import { describe, it, expect } from 'vitest';
import { tableToLatex } from '@/lib/latex-table';
import { resolveTheme } from '@/lib/theme-config';
import type { PaperTable } from '@/types/paper';

const latex = (t: PaperTable) => tableToLatex(t, { isOneColumn: false, theme: resolveTheme(undefined) });

const table = (extra: Partial<PaperTable> = {}): PaperTable => ({
  id: 't',
  num: 1,
  caption: 'B',
  headers: ['A', 'B'],
  rows: [],
  headerRows: [[{ text: 'A', isHeader: true }, { text: 'B', isHeader: true }]],
  bodyRows: [
    [{ text: 'một đoạn khá dài để căn đều hai bên', align: 'justify' }, { text: 'b' }],
    [{ text: 'c', align: 'center' }, { text: 'd', align: 'right' }],
  ],
  columnSpan: '1-column',
  ...extra,
});

describe('a cell set with both edges straight', () => {
  it('is set justified, and the other cells keep their own edge', () => {
    const tex = latex(table());
    expect(tex).toContain('\\justifying\\arraybackslash một đoạn');
    expect(tex).toContain('\\centering\\arraybackslash c');
    expect(tex).toContain('\\raggedleft\\arraybackslash d');
  });

  it('a merged cell says so in its column spec', () => {
    const t = table();
    t.bodyRows![0] = [{ text: 'gộp lại', align: 'justify', colSpan: 2 }];
    expect(latex(t)).toMatch(/\\multicolumn\{2\}\{>\{\\justifying\\arraybackslash\}p\{/);
  });
});

describe('splitting a word at the end of a line', () => {
  it('is forbidden by default: a word is never broken', () => {
    const tex = latex(table());
    expect(tex).toContain('\\hyphenpenalty=10000');
    expect(tex).not.toContain('\\RaggedRight');
    expect(tex).not.toContain('\\Centering');
  });

  it('is allowed when the table says so, with the commands that may split a word', () => {
    const tex = latex(table({ hyphenate: true }));
    expect(tex).toContain('\\hyphenpenalty=80');
    expect(tex).not.toContain('\\hyphenpenalty=10000');
    expect(tex).toContain('\\RaggedRight');
    expect(tex).toContain('\\Centering');
    expect(tex).toContain('\\RaggedLeft');
    // (the packages that give those commands are in the preamble)
  });
});

describe('the table lines', () => {
  it('share the line spacing of the paper, as the reference journals set them (8 pt type on 11.3 pt lines)', () => {
    const tex = latex(table());
    expect(tex).not.toContain('baselinestretch');
    expect(tex).toContain('\\fontsize{8pt}{10pt}\\selectfont');
  });
});
