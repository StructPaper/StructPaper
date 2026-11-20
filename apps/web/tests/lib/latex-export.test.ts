import { describe, it, expect } from 'vitest';
import { createEmptyPaper, DEFAULT_LAYOUT_SETTINGS, type CompletePaper } from '@/types/paper';
import { generateFullJournalLatex, escapeLatex } from '@/lib/latex-template';
import { sanitizeMathForLatex } from '@/lib/math-text';

function paperWithTable(rows: number, extra: Record<string, unknown> = {}): CompletePaper {
  const p = createEmptyPaper();
  p.metadata.title = 'Tiêu đề';
  p.sections = [
    { id: 'h', type: 'h1', title: 'Kết quả', content: '' },
    {
      id: 't',
      type: 'table',
      content: '',
      table: {
        id: 't',
        num: 1,
        caption: 'Bảng dài',
        source: 'Nguồn: Kết quả của nhóm tác giả',
        headers: ['Cột A', 'Cột B'],
        rows: Array.from({ length: rows }, (_, i) => [`a${i}`, `b${i}`]),
        ...extra,
      },
    },
  ];
  return p;
}

describe('LaTeX table export', () => {
  it('keeps short tables as floating tabular', () => {
    const tex = generateFullJournalLatex(paperWithTable(3));
    expect(tex).toContain('\\begin{tabular}');
    expect(tex).not.toContain('\\begin{supertabular}');
  });

  it('typesets long tables as breakable supertabular with a repeated header row', () => {
    const tex = generateFullJournalLatex(paperWithTable(40, { columnSpan: '1-column', isFullWidth: false }));
    expect(tex).toContain('\\begin{supertabular}');
    expect(tex).toContain('\\tablehead{');
    expect(tex).toContain('\\tablefirsthead{');
    expect(tex).not.toContain('\\begin{table}');
    expect(tex).toContain('Nguồn: Kết quả của nhóm tác giả');
  });

  it('can disable header repetition and move the long-table threshold', () => {
    const p = paperWithTable(5, { columnSpan: '1-column', isFullWidth: false });
    const settings = { ...DEFAULT_LAYOUT_SETTINGS, theme: { longTableRowThreshold: 3, repeatTableHeader: false } };
    const tex = generateFullJournalLatex(p, settings);
    expect(tex).toContain('\\begin{supertabular}');
    expect(tex).toContain('\\tablefirsthead{');
    // header off: the continuation line stays but the column-header row is not repeated
    expect(tex).not.toContain('\\tablehead{\\hline');
    expect(tex).toContain('\\tablehead{\\multicolumn');
  });
});

describe('LaTeX long table layouts (1 column / 2 columns / landscape)', () => {
  it('2-column long table goes on its own one-column page(s) with longtable and continuation markers', () => {
    const tex = generateFullJournalLatex(paperWithTable(40, { columnSpan: '2-column', isFullWidth: true }));
    expect(tex).toContain('\\onecolumn');
    expect(tex).toContain('\\begin{longtable}');
    expect(tex).toContain('\\endfirsthead');
    expect(tex).toContain('\\endhead');
    expect(tex).toContain('Table 1 continued');
    expect(tex).toContain('Continued on next page');
    expect(tex).not.toContain('\\begin{landscape}');
    expect(tex).toContain('\\twocolumn\n');
  });

  it('rotated long table is typeset on landscape pages', () => {
    const tex = generateFullJournalLatex(paperWithTable(40, { isRotated: true, columnSpan: '2-column' }));
    expect(tex).toContain('\\begin{landscape}');
    expect(tex).toContain('\\begin{longtable}');
    expect(tex).toContain('\\end{landscape}');
  });

  it('short rotated table stays a sidewaystable float', () => {
    const tex = generateFullJournalLatex(paperWithTable(3, { isRotated: true }));
    expect(tex).toContain('\\begin{sidewaystable');
    expect(tex).not.toContain('\\begin{longtable}');
  });

  it('breakAcrossPages "never" keeps a long table whole, "always" breaks a short one', () => {
    expect(generateFullJournalLatex(paperWithTable(40, { breakAcrossPages: 'never' }))).not.toContain('\\begin{longtable}');
    expect(generateFullJournalLatex(paperWithTable(3, { breakAcrossPages: 'always' }))).toContain('\\begin{longtable}');
  });

  it('continuation wording is configurable', () => {
    const tex = generateFullJournalLatex(paperWithTable(40), {
      ...DEFAULT_LAYOUT_SETTINGS,
      theme: { continuedTitleText: 'Bảng {n} (tiếp theo)', continuedFootText: 'Xem tiếp trang sau' },
    });
    expect(tex).toContain('Bảng 1 (tiếp theo)');
    expect(tex).toContain('Xem tiếp trang sau');
  });

  it('one-column documents do not switch column mode', () => {
    const tex = generateFullJournalLatex(paperWithTable(40), { ...DEFAULT_LAYOUT_SETTINGS, columnLayout: '1-column' });
    // already one column: the in-flow breakable table is used and no column switching is emitted
    expect(tex).toContain('\\begin{supertabular}');
    expect(tex).not.toContain('\\onecolumn\n');
  });
});

describe('LaTeX theme / margins', () => {
  it('uses dynamic colours instead of hard-coded ones', () => {
    const p = paperWithTable(2);
    const tex = generateFullJournalLatex(p, {
      ...DEFAULT_LAYOUT_SETTINGS,
      theme: { titleColor: '#FF0000', tableHeaderColor: '#112233', tableZebraColor: '#445566' },
    });
    expect(tex).toContain('\\definecolor{titlecolor}{RGB}{255, 0, 0}');
    expect(tex).toContain('\\definecolor{tableheadrcolor}{RGB}{17, 34, 51}');
    expect(tex).toContain('\\definecolor{tablezebracolor}{RGB}{68, 85, 102}');
  });

  it('applies configurable margins to the geometry', () => {
    const tex = generateFullJournalLatex(paperWithTable(2), {
      ...DEFAULT_LAYOUT_SETTINGS,
      theme: { margins: { left: 2.5, right: 2, top: 3, bottom: 2.8 } },
    });
    expect(tex).toContain('left=2.5cm,headsep=.2cm,right=2cm,top=3cm,bottom=2.8cm]');
    expect(tex).toContain('top=3cm}');
  });

  it('emits custom fonts only when they differ from defaults', () => {
    const base = generateFullJournalLatex(paperWithTable(2));
    expect(base).not.toContain('\\IfFontExistsTF{Georgia}');
    const tex = generateFullJournalLatex(paperWithTable(2), {
      ...DEFAULT_LAYOUT_SETTINGS,
      theme: { bodyFont: 'Georgia' },
    });
    expect(tex).toContain('\\IfFontExistsTF{Georgia}{\\setmainfont{Georgia}}{}');
  });
});

describe('LaTeX equations', () => {
  it('numbered equation uses the equation environment with a label', () => {
    const p = createEmptyPaper();
    p.sections = [
      { id: 'e', type: 'equation', content: '', equation: { latex: 'E = mc^2', numbered: true, num: 1 } },
    ];
    const tex = generateFullJournalLatex(p);
    expect(tex).toContain('\\begin{equation}\nE = mc^2\\tag{1}\n\\label{eq:1}\n\\end{equation}');
  });

  it('unnumbered equation uses equation*', () => {
    const p = createEmptyPaper();
    p.sections = [{ id: 'e', type: 'equation', content: '', equation: { latex: 'a=b', numbered: false } }];
    expect(generateFullJournalLatex(p)).toContain('\\begin{equation*}\na=b\n\\end{equation*}');
  });

  it('keeps inline and display math in paragraphs intact (regression: placeholder was escaped)', () => {
    expect(escapeLatex('giá trị $x_1^2$ và 50% tăng')).toBe('giá trị $x_1^2$ và 50\\% tăng');
    expect(escapeLatex('$$a_b = $1$$')).toBe('$$a_b = $1$$');
    expect(escapeLatex('a_b $E=mc^2$')).toBe('a\\_b $E=mc^2$');
  });

  it('strips dangerous primitives from formulas', () => {
    expect(sanitizeMathForLatex('x \\end{equation} \\input{/etc/passwd} \\write18{rm}')).not.toMatch(/\\(end|input|write)/);
  });
});
