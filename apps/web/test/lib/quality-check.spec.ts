import { describe, it, expect } from 'vitest';
import { createEmptyPaper } from '@/types/paper';
import { collectIssues, validateForImport, validateForExport } from '@/lib/validation/validators';
import { computeQualityCheck } from '@/lib/validation/quality';

const base = (): any => {
  const p: any = createEmptyPaper('VNUHCM-STD');
  p.metadata = {
    ...p.metadata,
    title: 'Một bài báo hoàn chỉnh về giấc ngủ',
    titleEn: 'A complete paper about sleep',
    abstract: Array.from({ length: 300 }, (_, i) => `từ${i}`).join(' '),
    abstractEn: Array.from({ length: 300 }, (_, i) => `word${i}`).join(' '),
    keywords: ['một', 'hai', 'ba'],
    keywordsEn: ['one', 'two', 'three'],
    authors: [{ id: 'a1', name: 'Nguyễn Văn A', affiliationIds: [1], isCorresponding: true, email: 'a@x.org' }],
    affiliations: [{ id: 1, name: 'Trường X' }],
    corresponding: { name: 'Nguyễn Văn A', email: 'a@x.org', affiliation: 'Trường X' },
    articleType: 'Bài báo nghiên cứu',
    dates: { received: '01-01-2025', revised: '02-02-2025', accepted: '03-03-2025', published: '' },
  };
  p.sections = [];
  p.references = [];
  return p;
};
const codes = (paper: any, gate: 'import' | 'export' = 'export') => collectIssues(paper, gate).map((i) => i.code);

describe('one list of problems for the upload and the QC tab', () => {
  it('the QC check shows every problem the import gate reports (and more, never fewer)', () => {
    const paper = base();
    paper.metadata.abstract = 'quá ngắn';
    paper.metadata.keywords = ['một'];
    paper.metadata.dates.revised = '01-01-2020'; // before it was received
    paper.references = [{ id: 1, raw: 'x' }];

    const gate = new Set(validateForImport(paper).issues.map((i) => i.id));
    const qc = new Set(computeQualityCheck(paper).issues.map((i) => i.id));

    expect(gate.size).toBeGreaterThan(0);
    for (const id of gate) expect(qc.has(id)).toBe(true);
  });

  it('the QC check and the export gate list exactly the same problems', () => {
    const paper = base();
    paper.metadata.keywords = [];
    const qc = computeQualityCheck(paper).issues.map((i) => i.id).sort();
    const exp = validateForExport(paper).issues.map((i) => i.id).sort();
    expect(qc).toEqual(exp);
  });

  it('keeps the machine code, so the QC tab words each problem like the upload does', () => {
    const paper = base();
    paper.metadata.dates.received = '99/99/2025';
    const issue = computeQualityCheck(paper).issues.find((i) => i.code === 'field.date.format');
    expect(issue).toBeDefined();
    expect(issue!.fixTab).toBe('metadata');
  });

  it('extra problems lower the score, and a clean paper keeps the preflight score', () => {
    const clean = computeQualityCheck(base());
    const worse = base();
    worse.metadata.authors[0].name = '';
    expect(computeQualityCheck(worse).score).toBeLessThan(clean.score);
  });
});

describe('what the shared rules now catch', () => {
  it('a clean paper raises none of the new problems', () => {
    const new_ = codes(base()).filter((c) => /^(author\.|affiliation\.|field\.(email|doi|publication\.(pages|number)|articleType|abstractEn|keywordsEn|date\.future)|content\.placeholder)/.test(c));
    expect(new_).toEqual([]);
  });

  it('authors and affiliations', () => {
    const p = base();
    p.metadata.authors.push({ id: 'a2', name: '', affiliationIds: [] }, { id: 'a3', name: 'Nguyễn Văn A', affiliationIds: [9] });
    p.metadata.affiliations.push({ id: 2, name: 'Cơ quan thừa' });
    const found = codes(p);
    for (const c of ['author.name.empty', 'author.duplicate', 'author.affiliation.missing', 'author.affiliation.unknown', 'affiliation.unused']) {
      expect(found).toContain(c);
    }
  });

  it('formats: email, DOI, pages, dates in the future', () => {
    const p = base();
    p.metadata.corresponding.email = 'khong-phai-email';
    p.metadata.publication = { doi: 'doi-sai', firstPage: '20', lastPage: '10' };
    p.metadata.dates.accepted = '01-01-2999';
    const found = codes(p);
    for (const c of ['field.email.format', 'field.doi.format', 'field.publication.pages', 'field.date.future']) expect(found).toContain(c);
  });

  it('second language: abstract length, keyword count', () => {
    const p = base();
    p.metadata.abstractEn = 'too short';
    p.metadata.keywordsEn = ['a', 'b', 'c', 'd', 'e', 'f'];
    expect(codes(p)).toEqual(expect.arrayContaining(['field.abstractEn.length', 'field.keywordsEn.count']));
  });

  it('text the template leaves as a prompt', () => {
    const p = base();
    p.metadata.title = '[Tiêu đề đầy đủ của bài báo]';
    expect(codes(p)).toContain('content.placeholder');
    const q = base();
    q.sections = [{ id: 's1', type: 'paragraph', content: 'Mở đầu. [Nội dung phần giới thiệu.]' }];
    expect(codes(q)).toContain('content.placeholder');
  });

  it('tables, figures, equations and heading levels', () => {
    const p = base();
    p.sections = [
      { id: 'h1', type: 'h1', title: 'Giới thiệu' },
      { id: 'h3', type: 'h3', title: 'Nhảy cấp' },
      { id: 't', type: 'table', table: { id: 't1', num: 1, caption: 'B', source: 's', headers: ['a', 'b'], rows: [['1', '2'], ['3']] } },
      { id: 'f', type: 'figure', figure: { id: 'f1', num: 1, caption: 'H', source: 's', src: '' } },
      { id: 'e', type: 'equation', equation: { latex: '  ' } },
    ];
    const found = codes(p);
    for (const c of ['structure.heading.level', 'table.ragged', 'figure.image.missing', 'equation.empty']) expect(found).toContain(c);
  });

  it('references: too short, no year, repeated', () => {
    const p = base();
    p.references = [
      { id: 1, raw: 'ngắn' },
      { id: 2, raw: 'Một tài liệu dài nhưng chẳng ghi năm xuất bản nào cả' },
      { id: 3, raw: 'Giống hệt. Tạp chí A. 2020;1(1):1-2. doi:10.1/x' },
      { id: 4, raw: 'Giống hệt. Tạp chí A. 2020;1(1):1-2. doi:10.1/x' },
    ];
    expect(codes(p)).toEqual(expect.arrayContaining(['reference.short', 'reference.noyear', 'reference.duplicate']));
  });

  it('statements the template asks for after the conclusion are reported once', () => {
    const p = base();
    p.sections = ['Giới thiệu', 'Phương pháp', 'Kết quả', 'Kết luận'].map((t, i) => ({ id: `s${i}`, type: 'h1', title: t }));
    const issues = collectIssues(p, 'export').filter((i) => i.code === 'structure.statements');
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toMatch(/Xung đột lợi ích/);

    p.sections.push({ id: 'x', type: 'h1', title: 'Xung đột lợi ích' });
    const after = collectIssues(p, 'export').find((i) => i.code === 'structure.statements');
    expect(after?.message ?? '').not.toMatch(/Xung đột lợi ích/);
  });
});
