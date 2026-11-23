import { describe, it, expect } from 'vitest';
import { crossRefTargets, markerOf, refLabel, resolveCrossRefs } from '@/lib/cross-refs';
import { cleanLatex, latexFromClipboard } from '@/lib/math-paste';
import { createEmptyPaper } from '@/types/paper';

const paper = () => {
  const p: any = createEmptyPaper();
  p.sections = [
    { id: 'a', type: 'paragraph', content: 'Xem [[tbl:t2]] và [[fig:f1]], rồi [[tbl:gone]].' },
    { id: 'b', type: 'figure', content: '', figure: { id: 'f1', num: 1, caption: 'Mô hình, như [[tbl:t1]]', src: 'x', source: 'Nguồn: xem [[tbl:t2]]' } },
    { id: 'c', type: 'table', content: '', table: { id: 't1', num: 1, caption: 'Bảng một', headers: ['A'], rows: [['1']] } },
    { id: 'd', type: 'table', content: '', table: { id: 't2', num: 2, caption: 'Bảng hai', headers: ['A'], rows: [['1']], source: 'Theo [[fig:f1]]' } },
  ];
  return p;
};

describe('references to a table or a figure', () => {
  it('are numbered by where the block stands, not by anything stored', () => {
    const t = crossRefTargets(paper());
    expect(t.map((x) => `${x.kind}:${x.id}:${x.order}`)).toEqual(['figure:f1:1', 'table:t1:1', 'table:t2:2']);
    expect(markerOf('table', 't2')).toBe('[[tbl:t2]]');
    expect(refLabel('table', 2, 'en')).toBe('Table 2');
    expect(refLabel('figure', 1, 'vi')).toBe('Hình 1');
  });

  it('are printed as labels everywhere there is text: paragraphs, captions, sources', () => {
    const out = resolveCrossRefs(paper(), 'vi');
    expect(out.sections[0].content).toBe('Xem Bảng 2 và Hình 1, rồi Bảng ?.');
    expect(out.sections[1].figure!.caption).toBe('Mô hình, như Bảng 1');
    expect(out.sections[1].figure!.source).toBe('Nguồn: xem Bảng 2');
    expect(out.sections[3].table!.source).toBe('Theo Hình 1');
    expect(resolveCrossRefs(paper(), 'en').sections[0].content).toContain('Table 2');
  });

  it('leave a paper without any untouched', () => {
    const p = paper();
    p.sections = [p.sections[2]];
    expect(resolveCrossRefs(p, 'vi')).toBe(p);
  });

  it('are in the LaTeX of the paper as labels, never as the marker', async () => {
    const { generateFullJournalLatex } = await import('@/lib/latex-template');
    const tex = generateFullJournalLatex(paper());
    expect(tex).not.toContain('[[tbl');
    expect(tex).toContain('Bảng 2');
  }, 60_000);
});

describe('a formula that was copied', () => {
  it('loses the signs around it', () => {
    expect(cleanLatex('$$E = mc^2$$')).toBe('E = mc^2');
    expect(cleanLatex('\\[ a+b \\]')).toBe('a+b');
    expect(cleanLatex('\\begin{equation}x^2\\end{equation}')).toBe('x^2');
    expect(cleanLatex('  $\\alpha$ ')).toBe('\\alpha');
  });

  it('is read from where the source of it travels: a web page, or Word', () => {
    expect(latexFromClipboard('<math><semantics><mi>x</mi><annotation encoding="application/x-tex">\\frac{a}{b}</annotation></semantics></math>', 'x')).toBe('\\frac{a}{b}');
    expect(latexFromClipboard('<span data-latex="a^2 &lt; b">', '')).toBe('a^2 < b');
    const omml = '<m:oMath><m:sSup><m:e><m:r><m:t>x</m:t></m:r></m:e><m:sup><m:r><m:t>2</m:t></m:r></m:sup></m:sSup></m:oMath>';
    expect(latexFromClipboard(`<p><!--[if gte msEquation 12]>${omml}<![endif]--></p>`, 'x2').replace(/\s/g, '')).toBe('x^2');
    expect(latexFromClipboard('', '$$y = 2x$$')).toBe('y = 2x');
  });
});

describe('references to an appendix', () => {
  const withAppendix = (numbering?: 'number' | 'letter') => {
    const p: any = createEmptyPaper();
    if (numbering) p.metadata.appendix = { numbering };
    p.sections = [
      { id: 'a', type: 'paragraph', content: 'Xem [[app:a2]] và [[tbl:t1]].' },
      { id: 'c', type: 'table', content: '', table: { id: 't1', num: 1, caption: 'Bảng một', headers: ['A'], rows: [['1']] } },
      { id: 'x', type: 'table', content: '', table: { id: 'a1', num: 7, caption: 'Phụ lục 7. Một', headers: ['A'], rows: [['1']], appendix: true } },
      { id: 'y', type: 'figure', content: '', figure: { id: 'a2', num: 9, caption: 'Phụ lục 9. Hai', src: 'x', appendix: true } },
    ];
    return p;
  };
  it('are numbered on their own, apart from the tables and figures, and listed last', () => {
    const t = crossRefTargets(withAppendix());
    expect(t.map((x) => `${x.kind}:${x.id}:${x.order}`)).toEqual(['table:t1:1', 'appendix:a1:1', 'appendix:a2:2']);
    expect(markerOf('appendix', 'a2')).toBe('[[app:a2]]');
  });
  it('are printed as "Phụ lục 2", or with a letter, in either language', () => {
    expect(resolveCrossRefs(withAppendix()).sections[0].content).toBe('Xem Phụ lục 2 và Bảng 1.');
    expect(resolveCrossRefs(withAppendix('letter')).sections[0].content).toBe('Xem Phụ lục B và Bảng 1.');
    expect(resolveCrossRefs(withAppendix('letter'), 'en').sections[0].content).toBe('Xem Appendix B và Table 1.');
  });
});
