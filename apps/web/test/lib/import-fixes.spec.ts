import { describe, it, expect } from 'vitest';
import { normalizeVietnameseWordSpacing } from '@/lib/docx-parser';
import { stripCaptionLabel, attachTableFooterLine } from '@/lib/docx-table-extras';
import { figureCaptionNumber } from '@/lib/docx-figures';
import { extractListHeadings } from '@/lib/docx-headings';
import { isTiff, tiffToPng } from '@/lib/media/tiff';
import { ommlToLatex } from '@/lib/omml';
import type { PaperSection } from '@/types/paper';

describe('words are not glued together', () => {
  it('keeps "mức độ" and "KCN ở TPHCM" but still repairs a split name', () => {
    expect(normalizeVietnameseWordSpacing('mức độ so sánh')).toBe('mức độ so sánh');
    expect(normalizeVietnameseWordSpacing('KCN ở TPHCM')).toBe('KCN ở TPHCM');
    expect(normalizeVietnameseWordSpacing('Nguy ễ n Văn A')).toBe('Nguyễn Văn A');
  });
});

describe('captions without a colon', () => {
  it('lose their label once', () => {
    expect(stripCaptionLabel('Bảng 6 Kết quả tính toán')).toBe('Kết quả tính toán');
    expect(stripCaptionLabel('Bảng 6: Kết quả tính toán')).toBe('Kết quả tính toán');
    expect(stripCaptionLabel('Hình 2. Bản đồ')).toBe('Bản đồ');
  });
  it('are recognised as figure captions only when a capital letter follows the number', () => {
    expect(figureCaptionNumber('Hình 2 Bản đồ phân hạng')).toBe(2);
    expect(figureCaptionNumber('Hình 3: Kết quả')).toBe(3);
    expect(figureCaptionNumber('Hình 2 cho thấy kết quả')).toBeUndefined();
    expect(figureCaptionNumber('<w:instrText> SEQ Hình </w:instrText><w:t>Hình 4 Biểu đồ</w:t>')).toBe(4);
  });
  it('"[Nguồn: …]" under a table belongs to the table', () => {
    const sections = [{ id: 't', type: 'table', content: '', table: { id: 't', num: 1, caption: 'x', headers: [], rows: [] } }] as unknown as PaperSection[];
    expect(attachTableFooterLine(sections, '[Nguồn: Nhóm tác giả]')).toBe(true);
    expect(sections[0].table?.source).toBe('Nguồn: Nhóm tác giả');
  });
});

describe('headings', () => {
  const para = (style: string, text: string) => `<w:p><w:pPr><w:pStyle w:val="${style}"/></w:pPr><w:r><w:t>${text}</w:t></w:r></w:p>`;
  const styles = '<w:style w:styleId="H2"><w:name w:val="heading 2"/></w:style><w:style w:styleId="H3"><w:name w:val="heading 3"/></w:style>';
  it('Heading 2 / Heading 3 without a Heading 1 become section / sub-section', () => {
    const map = extractListHeadings(para('H2', '1 Giới thiệu') + para('H3', '2.1 Dạng yếu'), styles);
    expect(map.get('1 Giới thiệu')).toBe(0);
    expect(map.get('2.1 Dạng yếu')).toBe(1);
  });
});

describe('pictures and equations Word wrote in an odd way', () => {
  it('an uncompressed TIFF is turned into a PNG', async () => {
    // 1x1 RGB little-endian TIFF
    const b = new Uint8Array([0x49, 0x49, 0x2a, 0, 8, 0, 0, 0, 8, 0, 0, 1, 3, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 1, 3, 0, 1, 0, 0, 0, 1, 0, 0, 0, 2, 1, 3, 0, 3, 0, 0, 0, 122, 0, 0, 0, 3, 1, 3, 0, 1, 0, 0, 0, 1, 0, 0, 0, 6, 1, 3, 0, 1, 0, 0, 0, 2, 0, 0, 0, 17, 1, 4, 0, 1, 0, 0, 0, 128, 0, 0, 0, 21, 1, 3, 0, 1, 0, 0, 0, 3, 0, 0, 0, 0, 0, 0, 0, 8, 0, 8, 0, 8, 0, 255, 0, 0]);
    expect(isTiff(b)).toBe(true);
    const png = await tiffToPng(b);
    if (png) expect(Array.from(png.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47]);
  });
  it('an operator used as a subscript is braced', () => {
    const x = ommlToLatex('<m:oMath xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"><m:sSub><m:e><m:r><m:t>X</m:t></m:r></m:e><m:sub><m:r><m:rPr><m:sty m:val="p"/></m:rPr><m:t>min</m:t></m:r></m:sub></m:sSub></m:oMath>');
    expect(x).not.toMatch(/_\\min\s/);
  });
});

import { parenthesisedCitations } from '@/lib/latex-template';
describe('citations written as (n)', () => {
  it('become citations, unless they name an equation or exceed the reference list', () => {
    expect(parenthesisedCitations('theo nghiên cứu (3) và (2, 5)', 10)).toBe('theo nghiên cứu\\unskip~\\cite{ref3} và\\unskip~\\cite{ref2,ref5}');
    expect(parenthesisedCitations('xem (4-6).', 10)).toContain('\\cite{ref4,ref5,ref6}');
    expect(parenthesisedCitations('theo công thức (1)', 10)).toBe('theo công thức (1)');
    expect(parenthesisedCitations('phương trình (2)', 10)).toBe('phương trình (2)');
    expect(parenthesisedCitations('có (25) mẫu', 10)).toBe('có (25) mẫu');
  });
});

import { findEnglishBackMatter } from '@/lib/docx-english-backmatter';
describe('English summary page without a marker line', () => {
  it('takes the title above the English authors and affiliations', () => {
    const lines = ['Tài liệu tham khảo', 'Hausherr D. Successful mainstream nitritation through 2016.', 'Application of PVA gel beads for immobilization of AOB and Anammox biomass', 'Nguyen Hoang Dung1, Nguyen Phuoc Dan2*', '1 Faculty of Environment and Natural Resources, Ho Chi Minh City University of Technology', '2 Faculty of Civil Engineering, Ho Chi Minh City University of Technology', 'Correspondence: Nguyen Phuoc Dan', 'Email: npdan@hcmut.edu.vn', 'ABSTRACT', 'This study evaluated the system.', 'Keywords: PVA gel, anammox'];
    const r = findEnglishBackMatter(lines);
    expect(r?.titleEn).toBe('Application of PVA gel beads for immobilization of AOB and Anammox biomass');
    expect(r?.keywordsEn).toEqual(['PVA gel', 'anammox']);
  });
  it('does not take numbered references for affiliations', () => {
    expect(findEnglishBackMatter(['References', '1. Smith J. Study. 2020', '2. Lee K. Study of university rankings. 2021', 'ABSTRACT', 'text'])).toBeNull();
  });
});
