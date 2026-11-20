import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import type { CompletePaper } from '@/types/paper';
import { parseDocxFile } from '@/lib/docx-parser';
import { findEnglishBackMatter, splitKeywords } from '@/lib/docx-english-backmatter';
import { extractDisplayEquations } from '@/lib/docx-equations';
import { tableToLatex } from '@/lib/latex-table';
import { resolveTheme } from '@/lib/theme-config';

const FIXTURE = path.resolve(
  __dirname,
  '../../../../fixtures/golden/papers/tranhien05,+Production+editor,+VNUHCM-EES+ID850+Copyedited.docx'
);

describe('real file: EES ID850 imported from Word', () => {
  let paper: CompletePaper;
  beforeAll(async () => {
    const buf = fs.readFileSync(FIXTURE);
    paper = await parseDocxFile(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer, path.basename(FIXTURE));
  }, 60_000);

  it('keeps all 26 references, including those that end with "DOI: …"', () => {
    expect(paper.references).toHaveLength(26);
    expect(paper.references.map((r) => r.id)).toEqual(Array.from({ length: 26 }, (_, i) => i + 1));
    expect(paper.references[0].raw).toMatch(/^W\. C\. Skamarock/);
    expect(paper.references[24].raw).toContain('10.1029/2024MS004556');
    expect(paper.references.some((r) => /Correspondence|Research Article|Sub-Institute|Email:/.test(r.raw))).toBe(false);
  });

  it('never takes a DOI quoted in a reference as the article DOI', () => {
    expect(paper.metadata.doi || '').toBe('');
  });

  it('reads the English summary page after the references as metadata', () => {
    const m = paper.metadata;
    expect(m.titleEn).toBe('Experimental heavy rainfall forecasting using the WRF model in the southeastern area of Vinh Long Province');
    expect(m.keywordsEn).toEqual(['Weather Research and Forecasting (WRF) model', 'heavy rainfall forecasting', 'Vinh Long Province']);
    expect(m.abstractEn).toMatch(/^This study presents/);
    expect(m.abstractEn).not.toMatch(/Keyw/);
    expect(m.affiliations[0].nameEn).toMatch(/^Sub-Institute of HydroMeteorology/);
  });

  it('marks only the starred author as corresponding; keywords have no trailing period', () => {
    expect(paper.metadata.authors.filter((a) => a.isCorresponding).map((a) => a.name)).toEqual(['Võ Thị Nguyên']);
    expect(paper.metadata.keywords).toEqual(['Mô hình Nghiên cứu và Dự báo Thời tiết (WRF)', 'dự báo mưa lớn', 'tỉnh Vĩnh Long']);
  });

  it('recovers the 7 numbered Word equations with their source numbers', () => {
    const eqs = paper.sections.filter((s) => s.type === 'equation').map((s) => [s.equation!.num, s.equation!.latex]);
    expect(eqs.map((e) => e[0])).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(eqs[0][1]).toBe(String.raw`ME= \frac{1}{n}\sum_{i=1}^n (F_i-O_i)`);
    expect(eqs[6][1]).toBe(String.raw`CSI=\frac{A}{A+B+C}`);
    // the short "where" line under the formulas is kept
    expect(paper.sections.some((s) => s.type === 'paragraph' && s.content === 'n là số lượng mẫu')).toBe(true);
  });

  it('turns the picture grids with a "Hình N" caption cell into figures 3–5, not data tables', () => {
    const figs = paper.sections.filter((s) => s.type === 'figure').map((s) => s.figure!.num);
    const tabs = paper.sections.filter((s) => s.type === 'table').map((s) => s.table!);
    expect(figs).toEqual([1, 2, 3, 4, 5]);
    expect(tabs.map((t) => t.num)).toEqual([1, 2]);
    // the figure follows the paragraph that introduces it
    const i3 = paper.sections.findIndex((s) => s.type === 'figure' && s.figure!.num === 3);
    expect(paper.sections[i3 - 1].content).toMatch(/^Hình 3 thể hiện/);
  });

  it('keeps Word field codes out of captions and keeps merged header cells', () => {
    const t2 = paper.sections.find((s) => s.type === 'table' && s.table!.num === 2)!.table!;
    expect(t2.caption).toBe('Bảng 2. Sai số dự báo của mô hình WRF [Nguồn: Nhóm tác giả]');
    const t1 = paper.sections.find((s) => s.type === 'table' && s.table!.num === 1)!.table!;
    expect(t1.headerRows?.[0].map((c) => [c.text, c.colSpan ?? 1])).toEqual([['', 2], ['Quan trắc', 3]]);
    // LaTeX keeps the merged cells and the row-merged 'Dự báo' (no shifted second row)
    const tex = tableToLatex(t1, { isOneColumn: false, theme: resolveTheme(undefined) });
    expect(tex).toContain(String.raw`\multicolumn{3}{c}{\textbf{Quan trắc}}`);
    expect(tex).toContain(' & Không & C & D & C \\\\');
    expect(tex).toContain(String.raw`\multirow{-2}{*}{Dự báo}`);
  });

  it('lists the abbreviation table under its heading', () => {
    const h = paper.sections.findIndex((s) => s.type === 'h1' && /VIẾT TẮT/.test(s.title || ''));
    expect(paper.sections[h + 1].content).toBe('AI (Artificial Intelligence): Trí tuệ nhân tạo');
    expect(paper.sections.filter((s) => /^s_abbr_/.test(s.id))).toHaveLength(21); // 22 rows minus the label row
  });
});

describe('real file: the journal Vietnamese template sample', () => {
  it('leaves the author-guide page out and keeps back-matter titles as headings', async () => {
    const f = path.resolve(__dirname, '../../../../fixtures/golden/templates/Bài mẫu template tiếng Việt.docx');
    const buf = fs.readFileSync(f);
    const p = await parseDocxFile(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer, 'vi.docx');
    expect(p.sections.some((s) => /Hướng dẫn dành cho tác giả|không thuộc nội dung bài báo/.test(s.content || s.title || ''))).toBe(false);
    const h1 = p.sections.filter((s) => s.type === 'h1').map((s) => s.title);
    expect(h1).toEqual(expect.arrayContaining(['Đóng góp của các tác giả', 'Xung đột lợi ích', 'Tính khả dụng của dữ liệu']));
    expect(p.metadata.titleEn).toMatch(/^Factors affecting/);
  }, 60_000);
});

describe('helpers', () => {
  it('splits keywords without the final period', () => {
    expect(splitKeywords('a, b; c.')).toEqual(['a', 'b', 'c']);
  });

  it('finds no English page without a marker and an Abstract after the references', () => {
    expect(findEnglishBackMatter(['TÀI LIỆU THAM KHẢO', 'A. Ref one, 2020.', 'B. Ref two, 2021.'])).toBeNull();
  });

  it('accepts an equation followed only by its number, and does not anchor on "(4)"', () => {
    const omml = '<m:oMath><m:r><m:t>x</m:t></m:r></m:oMath>';
    const eqs = extractDisplayEquations([
      { text: 'Công thức:', hasMath: false, rawXml: '' },
      { text: '\t\t(4)', hasMath: true, rawXml: `<w:p>${omml}<w:r><w:t>(4)</w:t></w:r></w:p>` },
      { text: '', hasMath: true, rawXml: `<w:p>${omml}</w:p>` },
    ]);
    expect(eqs.map((e) => [e.num, e.prevText])).toEqual([
      [4, 'Công thức:'],
      [undefined, 'Công thức:'],
    ]);
  });
});
