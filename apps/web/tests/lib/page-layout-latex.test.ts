import { describe, it, expect } from 'vitest';
import { createEmptyPaper, normalizeCompletePaper, type CompletePaper, type PaperSection } from '@/types/paper';
import { PageLayoutTracker } from '@/lib/latex-page-layout';
import { equationToLatex } from '@/lib/latex-equation';
import { exportToLatex } from '@/lib/latex-template';

const LONG = String.raw`y_{i,t}=\beta_1+\beta_2 a_{i,t}+\beta_3 b_{i,t}+\beta_4 c_{i,t}+\beta_5 d_{i,t}+\beta_6 e_{i,t}+\beta_7 f_{i,t}+\beta_8 g_{i,t}+\beta_9 h_{i,t}+\epsilon_{i,t}`;
const para = (id: string, extra: Partial<PaperSection> = {}): PaperSection => ({ id, type: 'paragraph', content: `Đoạn ${id}`, ...extra });
const eq = (id: string, columnSpan?: '1-column' | '2-column', latex = LONG): PaperSection => ({
  id,
  type: 'equation',
  content: '',
  equation: { latex, numbered: true, num: 1, columnSpan },
});

describe('equationToLatex', () => {
  it('breaks a long formula inside the column by default', () => {
    const tex = equationToLatex(eq('e'), 0, false);
    expect(tex).toContain('\\begin{aligned}');
    expect(tex).not.toContain('figure*');
  });

  it('has no column setting of its own: an old 2-column value changes nothing', () => {
    const withSpan = equationToLatex(eq('e', '2-column'), 0, false);
    expect(withSpan).toBe(equationToLatex(eq('e'), 0, false));
    expect(withSpan).not.toContain('figure*');
    expect(withSpan).toContain(String.raw`\tag{1}`);
  });

  it('follows the paper: a one-column paper gives the formula the whole page text, so it is broken less', () => {
    const inColumn = equationToLatex(eq('e'), 0, false);
    const onPage = equationToLatex(eq('e'), 0, true);
    expect(inColumn).toContain(String.raw`\begin{aligned}`);
    // each line break of a formula is a `\\`
    expect(onPage.split('\\\\').length).toBeLessThan(inColumn.split('\\\\').length);
  });
});

describe('PageLayoutTracker', () => {
  it('does nothing without markers', () => {
    const t = new PageLayoutTracker(false, false);
    expect(t.enter(para('a'), 0)).toBe('');
    expect(t.close()).toBe('');
  });

  it('switches to one column on a new page and back at the next marker', () => {
    const t = new PageLayoutTracker(false, false);
    const a = t.enter(para('a', { pageLayout: { columns: '1-column' } }), 1);
    expect(a).toContain('\\clearpage');
    expect(a).toContain('\\onecolumn');
    expect(t.oneColumn).toBe(true);
    const b = t.enter(para('b', { pageLayout: {} }), 2);
    expect(b).toContain('\\twocolumn');
    expect(t.oneColumn).toBe(false);
  });

  it('opens and closes a landscape page', () => {
    const t = new PageLayoutTracker(false, false);
    expect(t.enter(para('a', { pageLayout: { orientation: 'landscape' } }), 1)).toContain('\\begin{landscape}');
    expect(t.landscape).toBe(true);
    const back = t.enter(para('b', { pageLayout: { orientation: 'portrait' } }), 2);
    expect(back.indexOf('\\end{landscape}')).toBeGreaterThanOrEqual(0);
    expect(back).not.toContain('\\begin{landscape}');
    expect(t.landscape).toBe(false);
  });

  it('a landscape document turns landscape at the first body section and leaves it before the English page', () => {
    const t = new PageLayoutTracker(false, true);
    expect(t.enter(para('a'), 0)).toContain('\\begin{landscape}');
    expect(t.enter(para('b'), 1)).toBe('');
    expect(t.close()).toContain('\\end{landscape}');
    expect(t.landscape).toBe(false);
  });

  it('a marker without orientation keeps the document orientation (landscape document)', () => {
    const t = new PageLayoutTracker(false, true);
    t.enter(para('a'), 0);
    const x = t.enter(para('b', { pageLayout: { columns: '1-column' } }), 1);
    expect(x).toContain('\\end{landscape}');
    expect(x).toContain('\\begin{landscape}');
    expect(x).toContain('\\onecolumn');
  });

  it('closes a one-column stretch back to the document default columns', () => {
    const t = new PageLayoutTracker(false, false);
    t.enter(para('a', { pageLayout: { columns: '1-column' } }), 1);
    expect(t.close()).toContain('\\twocolumn');
  });
});

function paperWith(sections: PaperSection[], settings: Partial<CompletePaper['layoutSettings']> = {}): CompletePaper {
  const p = createEmptyPaper('VNUHCM-STD');
  p.metadata.title = 'Thử';
  p.sections = sections;
  p.layoutSettings = { ...(p.layoutSettings || { paperSize: 'a4', columnLayout: '2-column' }), ...settings } as any;
  return normalizeCompletePaper(p);
}

describe('exportToLatex page layout', () => {
  it('emits the markers around the sections they belong to, in order', () => {
    const tex = exportToLatex(
      paperWith([
        para('a'),
        para('b', { content: 'MARK-LANDSCAPE', pageLayout: { orientation: 'landscape' } }),
        para('c', { content: 'MARK-ONECOL', pageLayout: { columns: '1-column' } }),
        para('d', { content: 'MARK-BACK', pageLayout: {} }),
      ])
    );
    const at = (s: string, from = 0) => tex.indexOf(s, from);
    expect(at('\\begin{landscape}')).toBeGreaterThan(0);
    expect(at('\\begin{landscape}')).toBeLessThan(at('MARK-LANDSCAPE'));
    expect(at('\\end{landscape}')).toBeGreaterThan(at('MARK-LANDSCAPE'));
    expect(at('\\end{landscape}')).toBeLessThan(at('MARK-ONECOL'));
    expect(at('\\onecolumn', at('MARK-LANDSCAPE'))).toBeLessThan(at('MARK-ONECOL'));
    expect(at('\\twocolumn', at('MARK-ONECOL'))).toBeLessThan(at('MARK-BACK'));
    // everything that was opened is closed
    expect((tex.match(/\\begin\{landscape\}/g) || []).length).toBe((tex.match(/\\end\{landscape\}/g) || []).length);
  });

  it('does not rotate a table again inside a landscape page', () => {
    const table: PaperSection = {
      id: 't',
      type: 'table',
      content: '',
      pageLayout: { orientation: 'landscape' },
      table: { id: 't', num: 1, caption: 'Bảng 1. X', headers: ['A', 'B'], rows: [['1', '2']], isRotated: true } as any,
    };
    expect(exportToLatex(paperWith([table]))).not.toContain('\begin{sidewaystable');
  });

  it('whole-document landscape starts at the first body section', () => {
    const tex = exportToLatex(paperWith([para('a'), para('b')], { orientation: 'landscape' }));
    expect(tex).toContain('\\begin{landscape}');
    expect(tex.indexOf('\\begin{landscape}')).toBeLessThan(tex.indexOf('Đoạn a'));
    expect((tex.match(/\\begin\{landscape\}/g) || []).length).toBe((tex.match(/\\end\{landscape\}/g) || []).length);
  });

  it('a one-column document never emits a column switch for a plain paper', () => {
    const tex = exportToLatex(paperWith([para('a')], { columnLayout: '1-column' }));
    expect(tex).not.toMatch(/\\clearpage\s*\\twocolumn/);
  });
});
