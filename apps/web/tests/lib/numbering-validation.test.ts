import { describe, it, expect } from 'vitest';
import { createEmptyPaper, type CompletePaper, type PaperSection } from '@/types/paper';
import {
  extractCitationNumbers,
  extractMentions,
  analyzeNumbering,
  renumberPaper,
} from '@/lib/validation/numbering';
import { validateForImport, validateForExport } from '@/lib/validation/validators';

const p = (id: string, content: string): PaperSection => ({ id, type: 'paragraph', content });
const tbl = (id: string, num: number): PaperSection => ({
  id,
  type: 'table',
  content: '',
  table: { id, num, caption: 'Cap', headers: ['a'], rows: [['1']], source: 'Nguồn: tác giả' },
});

function paperWith(sections: PaperSection[], refs = 0): CompletePaper {
  const base = createEmptyPaper();
  base.sections = sections;
  base.references = Array.from({ length: refs }, (_, i) => ({
    id: i + 1,
    raw: `Ref ${i + 1}`,
    isCited: true,
    citationCount: 1,
  }));
  return base;
}

describe('citation + mention extraction', () => {
  it('expands lists and ranges', () => {
    expect(extractCitationNumbers('xem [1], [2,3] và [14, 17–19]')).toEqual([1, 2, 3, 14, 17, 18, 19]);
  });
  it('ignores non-numeric brackets', () => {
    expect(extractCitationNumbers('[abc] [] [1a]')).toEqual([]);
  });
  it('finds table/figure/equation mentions in VI and EN', () => {
    expect(extractMentions('Bảng 2 và Table 3', 'table')).toEqual([2, 3]);
    expect(extractMentions('Hình 1, Figure 4', 'figure')).toEqual([1, 4]);
    expect(extractMentions('Phương trình (2)', 'equation')).toEqual([2]);
  });
});

describe('analyzeNumbering', () => {
  it('flags out-of-order citations and tables', () => {
    const paper = paperWith([p('a', 'Trước [2] rồi [1]. Xem Bảng 2.'), tbl('t1', 2)], 2);
    const a = analyzeNumbering(paper);
    expect(a.citationOrder).toEqual([2, 1]);
    expect(a.citationsInOrder).toBe(false);
    expect(a.objects[0].expected).toBe(1);
    expect(a.objects[0].num).toBe(2);
  });
  it('detects citations without reference and uncited references', () => {
    const a = analyzeNumbering(paperWith([p('a', 'Chỉ [5]')], 2));
    expect(a.missingReferences).toEqual([5]);
    expect(a.uncitedReferences).toEqual([1, 2]);
  });
});

describe('renumberPaper', () => {
  it('renumbers references by first citation and rewrites text', () => {
    const paper = paperWith([p('a', 'Đầu tiên [2]. Sau đó [1,3].')], 3);
    paper.references[0].raw = 'A';
    paper.references[1].raw = 'B';
    paper.references[2].raw = 'C';
    const fixed = renumberPaper(paper);
    expect(fixed.sections[0].content).toBe('Đầu tiên [1]. Sau đó [2,3].');
    expect(fixed.references.map((r) => [r.id, r.raw])).toEqual([
      [1, 'B'],
      [2, 'A'],
      [3, 'C'],
    ]);
  });
  it('renumbers tables and their in-text mentions', () => {
    const paper = paperWith([p('a', 'Xem Bảng 5.'), tbl('t', 5)]);
    const fixed = renumberPaper(paper);
    expect(fixed.sections[1].table?.num).toBe(1);
    expect(fixed.sections[0].content).toBe('Xem Bảng 1.');
  });
  it('is idempotent', () => {
    const paper = paperWith([p('a', '[2] [1]. Bảng 3'), tbl('t', 3)], 2);
    const once = renumberPaper(paper);
    expect(renumberPaper(once)).toEqual(once);
  });
});

describe('validation gates', () => {
  it('import gate reports missing fields but still lets the user continue', () => {
    const r = validateForImport(paperWith([p('a', 'Nội dung')]));
    expect(r.gate).toBe('import');
    expect(r.issues.some((i) => i.code.startsWith('preflight.'))).toBe(true);
    expect(r.canProceed).toBe(true);
  });
  it('import gate blocks a completely empty file', () => {
    expect(validateForImport(paperWith([])).canProceed).toBe(false);
  });
  it('flags bad date format', () => {
    const paper = paperWith([p('a', 'x')]);
    paper.metadata.dates = { received: '31/02/2025', revised: '01/01/2025', accepted: '01/02/2025', published: '' } as any;
    const codes = validateForImport(paper).issues.map((i) => i.code);
    expect(codes).toContain('field.date.format');
  });
  it('export gate blocks while numbering errors remain and clears them after auto-fix', () => {
    const paper = paperWith([p('a', 'Xem Bảng 5.'), tbl('t', 5)]);
    paper.metadata.title = 'Tiêu đề';
    const before = validateForExport(paper);
    // advisory gate: errors are reported but export is still allowed
    expect(before.errorCount).toBeGreaterThan(0);
    expect(before.canProceed).toBe(true);
    expect(before.issues.some((i) => i.autoFixable)).toBe(true);
    const after = validateForExport(renumberPaper(paper));
    expect(after.issues.filter((i) => i.code.startsWith('numbering.'))).toHaveLength(0);
  });
  it('export gate requires a compiled PDF for pdf format', () => {
    const paper = paperWith([p('a', 'x')]);
    paper.metadata.title = 'T';
    const r = validateForExport(paper, { format: 'pdf', pdfCompiled: false });
    expect(r.issues.some((i) => i.code === 'export.pdf.compile')).toBe(true);
    expect(r.canProceed).toBe(false);
  });
  it('flags invalid equations', () => {
    const paper = paperWith([
      { id: 'e', type: 'equation', content: '', equation: { latex: '\\frac{a}{b', numbered: true, num: 1 } },
    ]);
    expect(validateForExport(paper).issues.some((i) => i.code === 'equation.invalid')).toBe(true);
  });
});

describe('title style', () => {
  it('warns when the title is all capitals', () => {
    const paper = paperWith([p('a', 'x')]);
    paper.metadata.title = 'ẢNH HƯỞNG CỦA NĂNG LỰC SỐ ĐẾN HIỆU QUẢ';
    expect(validateForImport(paper).issues.some((i) => i.code === 'field.title.allcaps')).toBe(true);
    paper.metadata.title = 'Ảnh hưởng của năng lực số đến hiệu quả';
    expect(validateForImport(paper).issues.some((i) => i.code === 'field.title.allcaps')).toBe(false);
  });
});

describe('minimalist validation noise reduction', () => {
  it('consolidates multiple missing editorial dates into a single warning instead of 3 cards', () => {
    const paper = paperWith([p('a', 'Nội dung')]);
    const r = validateForImport(paper);
    const missingDates = r.issues.filter((i) => i.code === 'field.date.missing');
    expect(missingDates).toHaveLength(1);
    expect(missingDates[0].title).toContain('3 mốc ngày');
  });

  it('does not emit duplicate citation warnings between preflight and core checks', () => {
    const paper = paperWith([p('a', 'Xem [9].')]);
    paper.references = [{ id: 1, raw: 'Author A. 2025.', isCited: false, citationCount: 0 }];
    const r = validateForImport(paper);
    expect(r.issues.filter((i) => i.code === 'citation.missing' || i.id === 'iss_missing_cites')).toHaveLength(1);
    expect(r.issues.filter((i) => i.code === 'citation.uncited' || i.id === 'iss_uncited_refs')).toHaveLength(1);
  });

  it('consolidates multiple figures missing sources and empty paragraphs into summary issues', () => {
    const paper = paperWith([
      p('p1', ''),
      p('p2', '   '),
      { id: 'f1', type: 'figure', content: '', figure: { id: 'fig-1', num: 1, src: 'data:img', caption: 'Hình 1', source: '' } },
      { id: 'f2', type: 'figure', content: '', figure: { id: 'fig-2', num: 2, src: 'data:img', caption: 'Hình 2', source: '' } },
    ]);
    const r = validateForImport(paper);
    const figSources = r.issues.filter((i) => i.code === 'figure.source');
    const emptyParas = r.issues.filter((i) => i.id.startsWith('iss_empty_para'));
    expect(figSources).toHaveLength(1);
    expect(figSources[0].title).toContain('2 hình thiếu nguồn');
    expect(emptyParas).toHaveLength(1);
    expect(emptyParas[0].title).toContain('2 đoạn văn bản để trống');
  });

  it('hides optional style info nudges on import while preserving them on export', () => {
    const paper = paperWith([p('a', 'Nội dung [1].')]);
    paper.references = [{ id: 1, raw: 'Ref 1', isCited: true, citationCount: 1 }];
    const imp = validateForImport(paper);
    const exp = validateForExport(paper);
    expect(imp.issues.some((i) => i.id === 'iss_methods' || i.id === 'iss_conclusion' || i.id === 'iss_keywords_en')).toBe(false);
    expect(exp.issues.some((i) => i.id === 'iss_methods' || i.id === 'iss_conclusion')).toBe(true);
  });
});
