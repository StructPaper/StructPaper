import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { createEmptyPaper, type PaperSection } from '@/types/paper';
import {
  attachTableFooterLine,
  placeLeftoverTable,
  stripCaptionLabel,
  landscapeResolver,
  applyTableLayoutHints,
} from '@/lib/docx-table-extras';
import { mergeBilingualAffiliations } from '@/lib/docx-affiliations';
import { articleTypeToEnglish, extractBalanced } from '@/lib/latex-english-page';
import { generateFullJournalLatex } from '@/lib/latex-template';
import { DEFAULT_LAYOUT_SETTINGS } from '@/types/paper';
import { parseDocxFile } from '@/lib/docx-parser';

const tableSec = (num: number, extra: Record<string, unknown> = {}): PaperSection => ({
  id: `t${num}`,
  type: 'table',
  content: '',
  table: { id: `t${num}`, num, caption: `Bảng ${num}: x`, headers: ['a', 'b'], rows: [['1', '2']], ...extra },
});
const para = (c: string): PaperSection => ({ id: c, type: 'paragraph', content: c });

describe('table footers, captions and placement', () => {
  it('attaches "Chú thích" / "Nguồn" lines that follow a table to that table', () => {
    const s = [tableSec(1)];
    expect(attachTableFooterLine(s, 'Chú thích: *, ** là mức ý nghĩa')).toBe(true);
    expect(attachTableFooterLine(s, 'Nguồn: Tác giả')).toBe(true);
    expect(s[0].table!.source).toBe('Chú thích: *, ** là mức ý nghĩa\nNguồn: Tác giả');
  });

  it('leaves ordinary text and lines that do not follow a table alone', () => {
    const s = [para('Đoạn văn bình thường')];
    expect(attachTableFooterLine(s, 'Nguồn: Tác giả')).toBe(false);
    const t = [tableSec(1)];
    expect(attachTableFooterLine(t, 'Bảng 1 cho thấy kết quả khả quan')).toBe(false);
  });

  it('unwraps "(Nguồn: …)" only when the parentheses are unbalanced', () => {
    const s = [tableSec(1)];
    attachTableFooterLine(s, '(Nguồn: Tác giả (2025)');
    expect(s[0].table!.source).toBe('Nguồn: Tác giả (2025)');
  });

  it('places a table the text pass missed in numeric order', () => {
    const sections: PaperSection[] = [para('a'), tableSec(1), para('b'), tableSec(3), para('c')];
    placeLeftoverTable(sections, tableSec(2));
    expect(sections.filter((s) => s.type === 'table').map((s) => s.table!.num)).toEqual([1, 2, 3]);
    expect(sections.findIndex((s) => s.table?.num === 2)).toBe(2);
  });

  it('strips the duplicated label from captions', () => {
    expect(stripCaptionLabel('Bảng 2: Mô hình đo lường')).toBe('Mô hình đo lường');
    expect(stripCaptionLabel('Hình 1. Mô hình đề xuất')).toBe('Mô hình đề xuất');
    expect(stripCaptionLabel('Table 3 - Results')).toBe('Results');
    expect(stripCaptionLabel('Mô hình không có nhãn')).toBe('Mô hình không có nhãn');
  });
});

describe('layout hints from the Word file', () => {
  const xml =
    '<w:body><w:p><w:pPr><w:sectPr><w:pgSz w:w="12240" w:h="15840"/></w:sectPr></w:pPr></w:p>' +
    '<w:tbl>L</w:tbl><w:p><w:pPr><w:sectPr><w:pgSz w:w="15840" w:h="12240" w:orient="landscape"/></w:sectPr></w:pPr></w:p>' +
    '<w:tbl>P</w:tbl><w:sectPr><w:pgSz w:w="12240" w:h="15840"/></w:sectPr></w:body>';

  it('finds tables inside a landscape section', () => {
    const at = landscapeResolver(xml);
    expect(at(xml.indexOf('<w:tbl>L'))).toBe(true);
    expect(at(xml.indexOf('<w:tbl>P'))).toBe(false);
  });

  it('decides one column, both columns or sideways from the size of the table', () => {
    const sentence = 'Một câu mô tả khá dài trong ô của bảng';
    const wide = tableSec(2, { headers: ['1', '2', '3', '4', '5', '6'], rows: [['Điểm số', sentence, '0,22', '0,19', '0,12', '0,11']] });
    const narrow = tableSec(1);
    // twelve columns of long unbreakable words do not fit even the page width: turned on its side (the Word file also had it landscape)
    const word = 'Quản_lý_chất_lượng_nước_thải_công_nghiệp';
    const land = tableSec(3, { headers: Array.from({ length: 12 }, (_, i) => word + i), rows: [Array.from({ length: 12 }, () => word)] });
    applyTableLayoutHints([narrow, wide, land], { t3: true });
    expect(narrow.table!.columnSpan).toBe('1-column');
    expect(wide.table!.columnSpan).toBe('2-column');
    expect(land.table!.isRotated).toBe(true);
  });

  it('never overrides what the user already chose', () => {
    const t = tableSec(1, { columnSpan: '2-column', isRotated: false });
    applyTableLayoutHints([t], { t1: true });
    expect(t.table!.columnSpan).toBe('2-column');
    expect(t.table!.isRotated).toBe(false);
  });
});

describe('bilingual affiliations', () => {
  it('folds the English line into nameEn of the Vietnamese one', () => {
    const out = mergeBilingualAffiliations([
      { id: 1, name: 'Khoa Thương mại và Du lịch, Trường Đại học Tài chính - Marketing' },
      { id: 1, name: 'Faculty of Commerce and Tourism, University of Finance - Marketing, Vietnam' },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].nameEn).toMatch(/^Faculty of Commerce/);
  });
  it('keeps genuinely different affiliations', () => {
    expect(
      mergeBilingualAffiliations([
        { id: 1, name: 'Trường Đại học A' },
        { id: 2, name: 'Trường Đại học B' },
      ])
    ).toHaveLength(2);
  });
});

describe('closing English summary page + 9pt body', () => {
  const base = () => {
    const p = createEmptyPaper('VNUHCM-EBL');
    p.metadata.title = 'Tiêu đề tiếng Việt';
    p.metadata.titleEn = 'English title of the paper';
    p.metadata.abstract = 'Tóm tắt.';
    p.metadata.abstractEn = 'English abstract text.';
    p.metadata.keywordsEn = ['alpha', 'beta'];
    p.metadata.authors = [{ id: 'a', name: 'Nguyễn Văn A', affiliationIds: [1], isCorresponding: true, email: 'a@x.vn' }];
    p.metadata.affiliations = [{ id: 1, name: 'Trường ĐH A', nameEn: 'University A' }];
    return p;
  };

  it('appends an English page (title, abstract, keywords, English affiliation, cite box)', () => {
    const tex = generateFullJournalLatex(base());
    const page = tex.slice(tex.lastIndexOf('\\clearpage'));
    expect(page).toContain('\\title{English title of the paper}');
    expect(page).toContain('English abstract text.');
    expect(page).toContain('Key words: ');
    expect(page).toContain('University A');
    expect(page).toContain('\\def\\citetext{Cite this article}');
    expect(page).toContain('\\def\\title#1{'); // \title is \relax after the first \maketitle
    expect(page).toContain('Research Article');
    expect(tex.indexOf('\\end{document}')).toBeGreaterThan(tex.lastIndexOf('\\clearpage'));
  });

  it('is omitted when disabled or when there is no English title/abstract', () => {
    const off = generateFullJournalLatex(base(), { ...DEFAULT_LAYOUT_SETTINGS, theme: { englishSummaryPage: false } });
    expect(off).not.toContain('Cite this article');
    const none = base();
    none.metadata.abstractEn = '';
    expect(generateFullJournalLatex(none)).not.toContain('Cite this article');
  });

  it('uses the journal English name in headers/citations for EBL', () => {
    const tex = generateFullJournalLatex(base());
    expect(tex).toContain('\\def\\actualjournal{VNUHCM Journal of Economics, Business and Law}');
    expect(tex).toContain('VNUHCM J. Econ. Bus. Law.');
  });

  it('typesets real 9pt bodies without extarticle/extsizes (works offline on any engine)', () => {
    const tex = generateFullJournalLatex(base());
    expect(tex).toContain('\\documentclass[10pt,twocolumn]{article}');
    expect(tex).toContain('\\@setfontsize\\normalsize{9}{11}');
    expect(tex).not.toContain('extarticle');
    expect(tex).not.toContain('extsizes');
    const ten = generateFullJournalLatex(base(), { ...DEFAULT_LAYOUT_SETTINGS, fontSize: '10pt' });
    expect(ten).toContain('{article}');
  });

  it('maps Vietnamese article types and extracts balanced TeX definitions', () => {
    expect(articleTypeToEnglish('Bài tổng quan')).toBe('Review Article');
    expect(articleTypeToEnglish('Bài nghiên cứu')).toBe('Research Article');
    expect(extractBalanced('\\def\\x#1{a{b}\\c{d}}z', '\\def\\x#1{')).toBe('a{b}\\c{d}');
  });
});

describe('real file: ID1750 (EBL) imported from Word', () => {
  const file = path.resolve(__dirname, '../../../../fixtures/golden/papers/eic_stdjelm,+Journal+editor,+3.+1750.docx');
  it.skipIf(!fs.existsSync(file))('is imported with the structure of the printed article', async () => {
    const buf = fs.readFileSync(file);
    const p = await parseDocxFile(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer, 'x.docx');

    expect(p.metadata.authors.map((a) => a.name)).toEqual(['Nguyễn Thanh Hùng']);
    expect(p.metadata.affiliations).toHaveLength(1);
    expect(p.metadata.affiliations[0].nameEn).toMatch(/^Faculty of Commerce/);

    // no invented publication data
    expect(p.metadata.doi).toBe('');
    expect(p.metadata.volume).toBe('');
    expect(p.metadata.firstPage).toBe(0);

    const tables = p.sections.filter((s) => s.type === 'table').map((s) => s.table!);
    expect(tables.map((t) => t.num)).toEqual([1, 2, 3]);
    // Table 2 sits right after the paragraph that first cites it (as in the printed article), not straight after table 1
    const idx = p.sections.findIndex((s) => s.type === 'table' && s.table!.num === 2);
    expect(p.sections.slice(0, idx).some((x) => /bảng 2/i.test(x.content || ""))).toBe(true);
    expect(p.sections[idx + 1]?.type).toBe("table");
    // table 2 (measurement model): caption row consumed, real header kept, landscape in the Word file
    const t2 = tables[1];
    expect(stripCaptionLabel(t2.caption)).toBe('Mô hình đo lường');
    expect(t2.headers[0]).toBe('Yếu tố');
    // the printed article turns the page for it; here the size decides (it fits across the page, so it stays upright)
    expect(typeof t2.isRotated).toBe('boolean');
    expect(t2.columnSpan).toBe('2-column');
    expect(tables[0].columnSpan).toBe('1-column');
    // multi-line cells keep their lines; "Nguồn" lines are table footers
    expect(tables[0].rows[0][1]).toContain('\n');
    expect(tables[0].source).toBe('Nguồn: Tác giả');
    expect(tables[2].source).toContain('Chú thích:');
    expect(p.sections.some((s) => s.type === 'paragraph' && /^Chú thích:/.test(s.content))).toBe(false);
  });
});

import { plainToMath, runsToScriptedText, enrichScriptRuns } from '@/lib/docx-richtext';

describe('superscripts / subscripts from Word formatting', () => {
  it('converts plain script text to math, keeping Vietnamese letters and arrows', () => {
    expect(plainToMath('2')).toBe('2');
    expect(plainToMath('DS → DT')).toBe(String.raw`\text{DS }\to \text{ DT}`);
    expect(plainToMath('Chỉ số 50%')).toBe(String.raw`\text{Chỉ số 50\%}`);
  });

  it('merges an adjacent superscript and subscript into one math group (f² with subscript)', () => {
    const text = runsToScriptedText([
      { text: 'f', isSup: false },
      { text: '2', isSup: true },
      { text: 'DS → DT', isSup: false, isSub: true },
      { text: ' = 0,01', isSup: false },
    ]);
    expect(text).toBe(String.raw`f$^{2}_{\text{DS }\to \text{ DT}}$ = 0,01`);
  });

  it('rebuilds only body paragraphs whose plain text matches the XML paragraph exactly', () => {
    const sections: PaperSection[] = [
      { id: '1', type: 'paragraph', content: 'Hệ số R2 bằng 0,5 và khác' },
      { id: '2', type: 'paragraph', content: 'Đoạn khác hoàn toàn' },
    ];
    const n = enrichScriptRuns(sections, [
      {
        text: 'Hệ số R2 bằng 0,5 và khác',
        runs: [
          { text: 'Hệ số R', isSup: false },
          { text: '2', isSup: true },
          { text: ' bằng 0,5 và khác', isSup: false },
        ],
      },
    ]);
    expect(n).toBe(1);
    expect(sections[0].content).toBe('Hệ số R$^{2}$ bằng 0,5 và khác');
    expect(sections[1].content).toBe('Đoạn khác hoàn toàn');
  });

  it('LaTeX keeps the scripted math intact', () => {
    const p = createEmptyPaper();
    p.metadata.title = 'T';
    const scripted = String.raw`f$^{2}_{\text{DS }\to \text{ DT}}$`;
    p.sections = [{ id: 'a', type: 'paragraph', content: `Giá trị ${scripted} lớn.` }];
    expect(generateFullJournalLatex(p)).toContain(`${scripted} lớn.`);
  });
});

import { mapFiguresToImages, parseImageRelationships } from '@/lib/docx-figures';

describe('figure picture pairing', () => {
  const rels =
    '<Relationships><Relationship Id="rId9" Type="x/image" Target="media/image1.png"/><Relationship Id="rId2" Type="x/styles" Target="styles.xml"/></Relationships>';
  const cap = (n: number) => `<w:p><w:r><w:t>Hình ${n}: Mô hình</w:t></w:r></w:p>`;
  const pic = '<w:p><w:r><w:drawing><a:blip r:embed="rId9"/></w:drawing></w:r></w:p>';
  const filler = '<w:p><w:r><w:t>' + 'x'.repeat(12000) + '</w:t></w:r></w:p>';

  it('reads only media relationships', () => {
    expect([...parseImageRelationships(rels)]).toEqual([['rId9', 'image1.png']]);
  });

  it('pairs a picture that follows its caption, and leaves a picture-less figure empty', () => {
    // Hình 1 is a native drawing (no picture); Hình 2 has the picture right after its caption.
    const doc = cap(1) + filler + cap(2) + pic;
    const m = mapFiguresToImages(doc, rels);
    expect(m.get(2)).toBe('image1.png');
    expect(m.has(1)).toBe(false);
  });

  it('pairs a picture that precedes its caption', () => {
    const m = mapFiguresToImages(pic + cap(1), rels);
    expect(m.get(1)).toBe('image1.png');
  });

  it('never uses one picture for two figures', () => {
    const m = mapFiguresToImages(cap(1) + pic + cap(2), rels);
    expect(m.size).toBe(1);
  });

  const file = path.resolve(__dirname, '../../../../fixtures/golden/papers/eic_stdjelm,+Journal+editor,+3.+1750.docx');
  it.skipIf(!fs.existsSync(file))('ID1750: the only picture goes to Hình 2, not Hình 1', async () => {
    const buf = fs.readFileSync(file);
    const p = await parseDocxFile(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer, 'x.docx');
    const figs = p.sections.filter((s) => s.type === 'figure').map((s) => s.figure!);
    expect(figs.find((f) => f.num === 2)?.src.startsWith('data:image')).toBe(true);
    expect(figs.find((f) => f.num === 1)?.src).toBe('');
  });
});

describe('real file: ID1750 list-numbered headings', () => {
  const file = path.resolve(__dirname, '../../../../fixtures/golden/papers/eic_stdjelm,+Journal+editor,+3.+1750.docx');
  it.skipIf(!fs.existsSync(file))('keeps "Tổng quan" and its sub-headings', async () => {
    const buf = fs.readFileSync(file);
    const p = await parseDocxFile(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer, 'x.docx');
    const heads = p.sections.filter((s) => ['h1', 'h2', 'h3'].includes(s.type)).map((s) => `${s.type}:${s.title}`);
    expect(heads).toContain('h1:Tổng quan');
    expect(heads).toContain('h2:Lý thuyết nền tảng');
    expect(heads).toContain('h2:Mô hình nghiên cứu');
  });
});
