// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { applyMarkup, markupToHtml, markupToLatex, parseMarkup, serializeMarkup, stripMarkup, styleAt } from '@/lib/inline-markup';
import { htmlToMarkup } from '@/lib/table-markup-dom';
import { applyBorders, toGrid } from '@/lib/table-grid';
import { horizontalLine, verticalLines } from '@/lib/table-cell-lines';
import { tableRulesOf } from '@/lib/table-style';
import { tableToLatex } from '@/lib/latex-table';
import { resolveTheme } from '@/lib/theme-config';
import type { PaperTable } from '@/types/paper';

const esc = (s: string) => s;

describe('raised and lowered text in a cell', () => {
  it('is read, written and told apart from the plain text', () => {
    const segs = parseMarkup('H<sub>2</sub>O và m<sup>2</sup>');
    expect(segs.map((s) => [s.text, !!s.sub, !!s.sup])).toEqual([['H', false, false], ['2', true, false], ['O và m', false, false], ['2', false, true]]);
    expect(stripMarkup('H<sub>2</sub>O')).toBe('H2O');
    expect(serializeMarkup(segs)).toBe('H<sub>2</sub>O và m<sup>2</sup>');
  });

  it('is set in LaTeX and drawn in HTML', () => {
    expect(markupToLatex('H<sub>2</sub>O m<sup>2</sup>', esc)).toBe('H\\textsubscript{2}O m\\textsuperscript{2}');
    expect(markupToHtml('m<sup>2</sup>')).toBe('m<sup>2</sup>');
  });

  it('is put on a part of the text, one taking the other off', () => {
    const t = applyMarkup('H2O', 1, 2, { key: 'sub' });
    expect(t).toBe('H<sub>2</sub>O');
    expect(styleAt(t, 1, 2).sub).toBe(true);
    expect(applyMarkup(t, 1, 2, { key: 'sup' })).toBe('H<sup>2</sup>O');
    expect(applyMarkup(t, 1, 2, { key: 'sub' })).toBe('H2O');
  });

  it('is read back from what is typed in a cell', () => {
    const el = document.createElement('div');
    el.innerHTML = 'H<sub>2</sub>O m<sup>2</sup>';
    expect(htmlToMarkup(el)).toBe('H<sub>2</sub>O m<sup>2</sup>');
  });
});

const table = (): PaperTable => ({
  id: 't',
  num: 1,
  caption: 'B',
  headers: ['A', 'B'],
  rows: [['1', '2'], ['3', '4']],
  headerRows: [[{ text: 'A', isHeader: true }, { text: 'B', isHeader: true }]],
  bodyRows: [
    [{ text: '1' }, { text: '2' }],
    [{ text: '3' }, { text: '4' }],
  ],
  columnSpan: '1-column',
});
const latex = (t: PaperTable) => tableToLatex(t, { isOneColumn: false, theme: resolveTheme(undefined) });

describe('the colour of a line', () => {
  it('goes with the line a choice draws, on both cells it stands between', () => {
    const g = applyBorders(toGrid(table()), { r0: 1, c0: 0, r1: 1, c1: 1 }, 'bottom', 'line', '#FF0000');
    expect(g.cells[1][0].borderColors).toEqual({ bottom: '#FF0000' });
    expect(g.cells[2][0].borderColors).toEqual({ top: '#FF0000' });
  });

  it('is gone with a line taken away or given back to the table', () => {
    let g = applyBorders(toGrid(table()), { r0: 1, c0: 0, r1: 1, c1: 0 }, 'all', 'line', '#00AA00');
    expect(g.cells[1][0].borderColors?.top).toBe('#00AA00');
    g = applyBorders(g, { r0: 1, c0: 0, r1: 1, c1: 0 }, 'reset');
    expect(g.cells[1][0].borderColors).toBeUndefined();
  });

  it('is told for each line of a boundary', () => {
    const t = table();
    t.bodyRows![0][0] = { text: '1', borders: { bottom: 'line' }, borderColors: { bottom: '#0000FF' } };
    const rules = tableRulesOf(t);
    const h = horizontalLine(t, rules, 2, 2);
    expect(h.lines).toEqual([true, false]);
    expect(h.colors).toEqual(['#0000FF', undefined]);
    t.bodyRows![1][1] = { text: '4', borders: { right: 'line' }, borderColors: { right: '#FF00FF' } };
    expect(verticalLines(t, rules, 2, 2).colors[2]).toBe('#FF00FF');
  });

  it("is drawn in LaTeX, and the table's colour is put back after it", () => {
    const t = table();
    t.bodyRows![0][0] = { text: '1', borders: { bottom: 'line' }, borderColors: { bottom: '#FF0000' } };
    expect(latex(t)).toContain('\\arrayrulecolor[RGB]{255, 0, 0}\\cline{1-1}\\arrayrulecolor{black}');
    t.borderColor = '#112233';
    expect(latex(t)).toContain('\\cline{1-1}\\arrayrulecolor[RGB]{17, 34, 51}');
  });

  it('a vertical line in a colour is a rule with that colour', () => {
    const t = table();
    t.bodyRows![0][0] = { text: '1', borders: { right: 'line' }, borderColors: { right: '#0000FF' } };
    expect(latex(t)).toContain('!{\\color[RGB]{0, 0, 255}\\vrule width \\arrayrulewidth}');
  });
});
