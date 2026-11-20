import { describe, it, expect } from 'vitest';
import { extractListHeadings, headingStyleLevels } from '@/lib/docx-headings';
import { generateFullJournalLatex } from '@/lib/latex-template';
import { extractPaperImagesAsync } from '@/lib/media/figure-image-utils';
import { identifyJournal } from '@/lib/journal-identify';
import { createEmptyPaper, type CompletePaper } from '@/types/paper';

const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
const para = (text: string, o: { style?: string; bold?: boolean; italic?: boolean; outline?: number; num?: number } = {}) =>
  `<w:p><w:pPr>${o.style ? `<w:pStyle w:val="${o.style}"/>` : ''}${o.outline !== undefined ? `<w:outlineLvl w:val="${o.outline}"/>` : ''}${o.num !== undefined ? `<w:numPr><w:ilvl w:val="${o.num}"/></w:numPr>` : ''}</w:pPr><w:r><w:rPr>${o.bold ? '<w:b/>' : ''}${o.italic ? '<w:i/>' : ''}</w:rPr><w:t>${text}</w:t></w:r></w:p>`;
const doc = (...p: string[]) => `<w:document ${W}><w:body>${p.join('')}</w:body></w:document>`;

describe('which paragraphs are headings', () => {
  it('a paragraph in the Heading 1/2/3 styles is a heading of that level', () => {
    const map = extractListHeadings(doc(para('Kết quả', { style: 'Heading1' }), para('Quá trình lựa chọn nghiên cứu', { style: 'Heading2' }), para('Chi tiết', { style: 'Heading3' })));
    expect([...map]).toEqual([['Kết quả', 0], ['Quá trình lựa chọn nghiên cứu', 1], ['Chi tiết', 2]]);
  });

  it('styles are found by name too, including the Vietnamese ones', () => {
    const styles = `<w:styles ${W}><w:style w:styleId="Tieude2"><w:name w:val="Tiêu đề 2"/></w:style><w:style w:styleId="Custom"><w:name w:val="x"/><w:pPr><w:outlineLvl w:val="0"/></w:pPr></w:style></w:styles>`;
    const levels = headingStyleLevels(styles);
    expect(levels.get('Tieude2')).toBe(1);
    expect(levels.get('Custom')).toBe(0);
    expect(extractListHeadings(doc(para('Phương pháp', { style: 'Tieude2' })), styles).get('Phương pháp')).toBe(1);
  });

  it('a short paragraph typed in bold is a heading: capitals make it a section, otherwise a sub-section', () => {
    const map = extractListHeadings(doc(para('VẬT LIỆU VÀ PHƯƠNG PHÁP', { bold: true }), para('Hóa chất', { bold: true }), para('Thiết bị', { bold: true })));
    expect(map.get('VẬT LIỆU VÀ PHƯƠNG PHÁP')).toBe(0);
    expect(map.get('Hóa chất')).toBe(1);
    expect(map.get('Thiết bị')).toBe(1);
  });

  it('bold text that is a caption, a source line, a sentence or too long stays text', () => {
    const map = extractListHeadings(
      doc(
        para('Hình 1. Sơ đồ', { bold: true }),
        para('Bảng 2: Kết quả', { bold: true }),
        para('Nguồn: Nhóm tác giả', { bold: true }),
        para('Đây là một câu kết thúc bằng dấu chấm.', { bold: true }),
        para('a'.repeat(120), { bold: true }),
        para('Chỉ một phần đậm', {}),
      ),
    );
    expect(map.size).toBe(0);
  });

  it('a numbered list heading keeps the level of its list; bold and italic by hand is a sub-heading', () => {
    const map = extractListHeadings(doc(para('Tổng quan', { bold: true, num: 1 }), para('Mô hình nghiên cứu', { bold: true, italic: true })));
    expect(map.get('Tổng quan')).toBe(1);
    expect(map.get('Mô hình nghiên cứu')).toBe(1);
  });
});

const withRefs = (journalId: string, settings: Partial<CompletePaper['layoutSettings']> = {}): string => {
  const paper = createEmptyPaper(journalId);
  paper.metadata.title = 'Tiêu đề thử';
  paper.metadata.journalId = journalId;
  paper.sections = [
    { id: 'h', type: 'h1', title: 'Giới thiệu', content: 'Giai đoạn 2016-2023 có 10-20 mẫu.[[fn: Nguồn: Tổng cục Thống kê.]]' },
    { id: 'f', type: 'figure', content: '', figure: { num: 2, caption: 'Hình 2: Sơ đồ', src: '' } as any },
  ];
  paper.metadata.authors = [{ id: 'a1', name: 'Nguyễn An', affiliationIds: [1], isCorresponding: true, orcid: '0000-0002-1825-0097' } as any];
  paper.metadata.affiliations = [{ id: 1, name: 'Trường A' } as any];
  paper.references = [
    { id: 1, raw: 'Tang SY. Green Chem. 2008;10(3):268-9.', doi: '10.1039/b719469m', isCited: true, citationCount: 1 } as any,
    { id: 2, raw: 'Smith J. A book. 2019.', isCited: true, citationCount: 1 } as any,
  ];
  paper.layoutSettings = settings;
  return generateFullJournalLatex(paper);
};

describe('what the generated LaTeX does with the rules of the published journals', () => {
  it('prints a reference\'s DOI as a link after "Available from:", with the en dash in page ranges', () => {
    const tex = withRefs('VNUHCM-HS');
    expect(tex).toContain(String.raw`268–9. Available from: \url{https://doi.org/10.1039/b719469m}.`);
    expect(tex).toContain('Smith J. A book. 2019.');
  });

  it('the Science and Technology Development journal prints the link alone', () => {
    const tex = withRefs('VNUHCM-STD');
    expect(tex).toContain(String.raw`268–9. \url{https://doi.org/10.1039/b719469m}.`);
    expect(tex).not.toContain('Available from');
  });

  it('the author can choose how the DOI is printed, or not at all', () => {
    expect(withRefs('VNUHCM-STD', { referenceDoi: 'available' })).toContain('Available from:');
    expect(withRefs('VNUHCM-HS', { referenceDoi: 'link' })).not.toContain('Available from');
    expect(withRefs('VNUHCM-HS', { referenceDoi: 'none' })).not.toContain('doi.org/10.1039');
  });

  it('number ranges get the en dash in the text, unless that is turned off', () => {
    expect(withRefs('VNUHCM-HS')).toContain('2016–2023 có 10–20 mẫu');
    const off = withRefs('VNUHCM-HS', { rangeDash: false });
    expect(off).toContain('2016-2023 có 10-20 mẫu');
    expect(off).toContain('268-9.');
  });

  it('the columns of the last page are balanced, unless that is turned off', () => {
    expect(withRefs('VNUHCM-HS')).toContain(String.raw`\beforepage{\balance}`);
    expect(withRefs('VNUHCM-HS', { balanceColumns: false })).not.toContain(String.raw`\beforepage{\balance}`);
  });

  it('a footnote is printed at the foot of the page, an ORCID is a link, the PDF has its information and bookmarks', () => {
    const tex = withRefs('VNUHCM-HS');
    expect(tex).toContain(String.raw`\footnote{Nguồn: Tổng cục Thống kê.}`);
    expect(tex).toContain('https://orcid.org/0000-0002-1825-0097');
    expect(tex).toMatch(/\\hypersetup\{pdftitle=\{Tiêu đề thử\}/);
    expect(tex).toContain(String.raw`\phantomsection\addcontentsline{toc}{section}{GIỚI THIỆU}`);
  });

  it('a figure with no picture says so instead of showing another figure or a logo', () => {
    const tex = withRefs('VNUHCM-HS');
    expect(tex).toContain('Chưa có ảnh cho Hình 2');
    expect(tex).toMatch(/Chưa có ảnh cho Hình 2[\s\S]*\\iffalse/);
  });
});

describe('a figure never takes the picture of another', () => {
  const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
  it('position aliases skip the numbers of figures that have no picture', async () => {
    const paper = createEmptyPaper('VNUHCM-HS');
    // figure 1 (no picture) is at section 0; figure 2 (with a picture) is at section 1, whose position alias would be "fig2"
    paper.sections = [
      { id: 'a', type: 'figure', content: '', figure: { num: 1, caption: 'Hình 1', src: '' } as any },
      { id: 'b', type: 'figure', content: '', figure: { num: 3, caption: 'Hình 3', src: png } as any },
    ];
    const images = await extractPaperImagesAsync(paper);
    expect(images['fig3.png']).toBeTruthy();
    // figure 1 has nothing, and no alias of figure 3 is called "fig1"
    expect(Object.keys(images).filter((k) => k.startsWith('fig1.') || k.startsWith('image1.'))).toEqual([]);
  });
});

describe('journals named in the name of a file', () => {
  it.each([
    ['tranhien05,+Journal+editor,+VNUHCM+-+HS+ID+722+copyedited.docx', 'VNUHCM-HS'],
    ['tranhien05,+Production+editor,+VNUHCM-EES+ID850+Copyedited.docx', 'VNUHCM-EES'],
    ['[SSH]+ID+1102+copyedited+(4-2025).docx', 'VNUHCM-SSH'],
  ])('%s', (name, id) => {
    expect(identifyJournal('', name.replace(/\+/g, ' '))).toBe(id);
  });

  it('says nothing about a file that names no journal', () => {
    expect(identifyJournal('', '4581_clean.docx')).toBeNull();
  });
});
