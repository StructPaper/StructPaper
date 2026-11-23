import { describe, it, expect } from 'vitest';
import { tableToLatex } from '@/lib/latex-table';
import { buildDocxTable } from '@/lib/docx-table';
import { resolveTheme } from '@/lib/theme-config';
import { cleanSourceStyle, isNoteLine, sourceLinesOf, sourceLook } from '@/lib/table-source';
import type { PaperTable } from '@/types/paper';

const theme = resolveTheme({ theme: undefined });
const base = (extra: Partial<PaperTable> = {}): PaperTable => ({
  id: 't',
  num: 1,
  caption: 'Bảng thử',
  headers: ['Mẫu', 'pH'],
  rows: [['M1', '7,2']],
  columnSpan: '1-column',
  isFullWidth: false,
  ...extra,
});
const tex = (t: PaperTable) => tableToLatex(t, { isOneColumn: false, theme });

describe('how the lines under a table are set', () => {
  it('a note is italic and a source upright, both to the left, unless the author chose', () => {
    expect(sourceLook(undefined, 'Nguồn: Tác giả')).toEqual({ bold: false, italic: false, align: 'left' });
    expect(sourceLook(undefined, 'Chú thích: *, ** là mức ý nghĩa')).toEqual({ bold: false, italic: true, align: 'left' });
    expect(sourceLook(undefined, 'Notes: ns, not significant').italic).toBe(true);
    expect(sourceLook({ italic: true }, 'Nguồn: Tác giả').italic).toBe(true);
    expect(sourceLook({ italic: false }, 'Chú thích: …').italic).toBe(false);
    expect(sourceLook({ bold: true, align: 'center' }, 'Nguồn: Tác giả')).toEqual({ bold: true, italic: false, align: 'center' });
    expect(isNoteLine('<i>Ghi chú</i>: a')).toBe(true);
  });

  it('takes one line for every line typed and leaves out the empty ones', () => {
    expect(sourceLinesOf('Nguồn: A\n\n  Chú thích: B  \n')).toEqual(['Nguồn: A', 'Chú thích: B']);
    expect(sourceLinesOf(undefined)).toEqual([]);
  });

  it('keeps no setting that says what no setting says', () => {
    expect(cleanSourceStyle({ bold: false, align: 'left' })).toBeUndefined();
    expect(cleanSourceStyle({ italic: false })).toEqual({ italic: false });
    expect(cleanSourceStyle({ bold: true, italic: undefined, align: 'right' })).toEqual({ bold: true, align: 'right' });
  });
});

describe('the lines under a table in the PDF', () => {
  it('are each on a line of their own: the source upright, the note in italic, to the left, as the journal prints them', () => {
    const out = tex(base({ source: 'Chú thích: *, ** là mức ý nghĩa\nNguồn: Tác giả' }));
    expect(out).toContain('\\raggedright');
    expect(out).toContain('\\textit{Chú thích: *, ** là mức ý nghĩa} \\\\ Nguồn: Tác giả');
    expect(out).not.toContain('\\textit{Nguồn');
    // the paragraph ends inside the group, so that the alignment applies to it
    expect(out).toMatch(/Nguồn: Tác giả\\par\}/);
  });

  it('two lines typed are two lines printed; empty lines are not', () => {
    const out = tex(base({ source: 'Dòng một\n\nDòng hai' }));
    expect(out).toContain('Dòng một \\\\ Dòng hai');
  });

  it('follow the author’s choice of bold, italic and alignment', () => {
    expect(tex(base({ source: 'Nguồn: Tác giả', sourceStyle: { italic: true } }))).toContain('\\textit{Nguồn: Tác giả}');
    expect(tex(base({ source: 'Nguồn: Tác giả', sourceStyle: { bold: true } }))).toContain('\\textbf{Nguồn: Tác giả}');
    expect(tex(base({ source: 'Nguồn: Tác giả', sourceStyle: { align: 'center' } }))).toContain('\\centering Nguồn: Tác giả');
    expect(tex(base({ source: 'Nguồn: Tác giả', sourceStyle: { align: 'right' } }))).toContain('\\raggedleft Nguồn: Tác giả');
    // a note the author set upright
    expect(tex(base({ source: 'Chú thích: a', sourceStyle: { italic: false } }))).not.toContain('\\textit{Chú thích');
  });

  it('are not there for a table without any', () => {
    expect(tex(base())).not.toContain('\\footnotesize \\raggedright');
  });

  it('are set the same way in the Word export (bold, italic, alignment, each line a line)', () => {
    const items = buildDocxTable(base({ source: 'Chú thích: a\nNguồn: b', sourceStyle: { align: 'center', bold: true } }), theme);
    const para = items[items.length - 1] as unknown as { root: Array<{ rootKey?: string; root?: unknown[] }> };
    const xml = JSON.stringify(para);
    expect(xml).toContain('center');
    expect(xml).toContain('Chú thích: a');
    expect(xml).toContain('Nguồn: b');
  });
});

describe('a heading set in capitals', () => {
  it('keeps its italic as formatting: the tags are not capitalised into text', async () => {
    const { generateFullJournalLatex } = await import('@/lib/latex-template');
    const { createEmptyPaper } = await import('@/types/paper');
    const p = createEmptyPaper();
    p.sections = [{ id: 'h', type: 'h1', title: '<i>Results</i>', content: '' }];
    const out = generateFullJournalLatex(p);
    expect(out).toContain('\\textit{RESULTS}');
    expect(out).not.toContain('<I>');
  }, 60_000);
});
