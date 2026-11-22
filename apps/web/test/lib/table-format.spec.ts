import { describe, it, expect } from 'vitest';
import { applyMarkup, markupToHtml, parseMarkup, stripMarkup, toggleWholeMarkup, wholeStyle, serializeMarkup } from '@/lib/inline-markup';
import { escapeLatex } from '@/lib/latex-escape';
import { tableToLatex } from '@/lib/latex-table';
import { resolveTheme } from '@/lib/theme-config';
import type { PaperTable } from '@/types/paper';

const theme = resolveTheme({ theme: undefined });
const base = (extra: Partial<PaperTable> = {}): PaperTable => ({
  id: 't',
  num: 1,
  caption: 'Bảng thử',
  headers: ['Mẫu', 'pH', 'COD'],
  rows: [['M1', '7,2', '30'], ['M2', '7,4', '28'], ['M3', '6,9', '35']],
  columnSpan: '1-column',
  isFullWidth: false,
  ...extra,
});
const tex = (t: PaperTable) => tableToLatex(t, { isOneColumn: false, theme });

describe('emphasis inside text', () => {
  it('reads tags into runs and prints them away', () => {
    expect(parseMarkup('a <b>b</b> <i><u>c</u></i>')).toEqual([
      { text: 'a ' },
      { text: 'b', b: true },
      { text: ' ' },
      { text: 'c', i: true, u: true },
    ]);
    expect(stripMarkup('a <b>b</b> <color=#FF0000>c</color>')).toBe('a b c');
    expect(stripMarkup('p < 0.05 và 2 > 1')).toBe('p < 0.05 và 2 > 1');
  });
  it('becomes LaTeX formatting, each run escaped on its own', () => {
    expect(escapeLatex('50% <b>và 10%</b>')).toBe('50\\% \\textbf{và 10\\%}');
    expect(escapeLatex('<i>x_1</i> <color=#FF0000>đỏ</color>')).toBe('\\textit{x\\_1} {\\color[RGB]{255, 0, 0}đỏ}');
  });
  it('becomes HTML for the preview', () => {
    expect(markupToHtml('a & <b>b</b>\nc')).toBe('a &amp; <strong>b</strong><br>c');
  });
  it('is applied to a selection of the plain text and toggled off again', () => {
    const t = applyMarkup('Hello world', 6, 11, { key: 'b' });
    expect(t).toBe('Hello <b>world</b>');
    expect(applyMarkup(t, 6, 11, { key: 'b' })).toBe('Hello world');
    // a selection across a styled and a plain part makes the whole selection styled
    expect(applyMarkup(t, 3, 9, { key: 'b' })).toBe('Hel<b>lo world</b>');
    expect(applyMarkup('abc', 0, 3, { key: 'color', color: '#00ff00' })).toBe('<color=#00FF00>abc</color>');
    expect(serializeMarkup(parseMarkup('<b>a</b><b>b</b>'))).toBe('<b>ab</b>');
  });
  it('can style a whole cell', () => {
    const t = toggleWholeMarkup('Tổng', 'b');
    expect(t).toBe('<b>Tổng</b>');
    expect(wholeStyle(t)).toEqual({ b: true, i: false, u: false });
    expect(toggleWholeMarkup(t, 'b')).toBe('Tổng');
  });
});

describe('table lines, fills and heights', () => {
  it('keeps the journal look unless told otherwise', () => {
    const out = tex(base());
    expect(out).toContain('\\hline \\rowcolor{tableheadrcolor}');
    expect(out).not.toContain('\\arrayrulecolor');
    expect(out).toMatch(/\\begin\{tabular\}\{>\{[^}]*\}p\{[^}]*\}>\{/);
    expect(out).not.toContain('|>');
  });
  it('draws lines between rows', () => {
    const out = tex(base({ borderStyle: 'horizontal' }));
    expect(out.match(/\\hline/g)!.length).toBe(5); // top + under header + 3 body rows (the last is the bottom line)
  });
  it('draws a full grid with vertical lines, and merged cells carry them', () => {
    const out = tex(base({ borderStyle: 'grid', headerRows: [[{ text: 'A', colSpan: 2 }, { text: 'B' }], [{ text: 'a' }, { text: 'b' }, { text: 'c' }]] }));
    expect(out).toMatch(/\\begin\{tabular\}\{\|>\{[^}]*\}p\{[^}]*\}\|>/);
    expect(out).toContain('\\multicolumn{2}{|c|}');
  });
  it('draws no lines at all, or only the outline', () => {
    expect(tex(base({ borderStyle: 'none' }))).not.toContain('\\hline \\rowcolor');
    expect(tex(base({ borderStyle: 'none' }))).not.toMatch(/\\hline\n\\end\{tabular\}/);
    const outline = tex(base({ borderStyle: 'outer' }));
    expect(outline).toMatch(/\{\|>\{/);
    expect(outline).toMatch(/\}\|\}\n/);
  });
  it('colours and thickens the lines', () => {
    const out = tex(base({ borderStyle: 'grid', borderColor: '#336699', borderWidth: 1 }));
    expect(out).toContain('\\arrayrulecolor[RGB]{51, 102, 153}');
    expect(out).toContain('\\setlength{\\arrayrulewidth}{1pt}');
  });
  it('fills a cell, the header band and the tinted rows', () => {
    const t = base({
      bodyFill: 'shaded',
      headerFill: '#FFEEAA',
      bodyTint: '#EEFFEE',
      bodyRows: [[{ text: 'M1', fill: '#FF0000' }, { text: '7' }, { text: '3' }]],
    });
    const out = tex(t);
    expect(out).toContain('\\rowcolor[RGB]{255, 238, 170}');
    expect(out).toContain('\\rowcolor[RGB]{238, 255, 238}');
    expect(out).toContain('\\cellcolor[RGB]{255, 0, 0}M1');
  });
  it('gives a row its least height, and the header too', () => {
    const out = tex(base({ rowHeights: [null, 30], headerHeight: 24 }));
    expect(out).toMatch(/\\rule\[-[\d.]+pt\]\{0pt\}\{30pt\}/);
    expect(out).toMatch(/\\rule\[-[\d.]+pt\]\{0pt\}\{24pt\}/);
    expect(out.match(/\\rule\[/g)!.length).toBe(2);
  });
  it('uses the column widths it was given', () => {
    const out = tex(base({ colWeights: [1, 1, 2] }));
    expect(out).toContain('*100/400');
    expect(out).toContain('*200/400');
  });
  it('prints bold and italic in cells', () => {
    const out = tex(base({ bodyRows: [[{ text: '<b>Tổng</b>' }, { text: '<i>7,2</i>' }, { text: '30' }]] }));
    expect(out).toContain('\\textbf{Tổng}');
    expect(out).toContain('\\textit{7,2}');
  });
});

import { Document, Packer } from 'docx';
import JSZip from 'jszip';
import { buildDocxTable } from '@/lib/docx-table';
import { richRuns } from '@/lib/docx-export-body';
import { Paragraph } from 'docx';

async function documentXml(children: any[]): Promise<string> {
  const buf = await Packer.toBuffer(new Document({ sections: [{ children }] }));
  const zip = await JSZip.loadAsync(buf);
  return zip.file('word/document.xml')!.async('string');
}

describe('Word export of the same formatting', () => {
  it('writes lines, fills, heights and emphasis for a formatted table', async () => {
    const xml = await documentXml(
      buildDocxTable(
        base({
          borderStyle: 'grid',
          borderColor: '#336699',
          borderWidth: 1,
          headerFill: '#FFEEAA',
          rowHeights: [30],
          bodyRows: [[{ text: '<b>M1</b>', fill: '#FF0000' }, { text: '<i>7</i>' }, { text: '3' }]],
        }),
        theme,
        8000
      )
    );
    expect(xml).toContain('<w:insideV');
    expect(xml).toContain('w:color="336699"');
    expect(xml).toContain('w:fill="FFEEAA"');
    expect(xml).toContain('w:fill="FF0000"');
    expect(xml).toMatch(/<w:trHeight w:val="600" w:hRule="atLeast"/);
    expect(xml).toMatch(/<w:b\/>[\s\S]*?M1/);
    expect(xml).toMatch(/<w:i\/>[\s\S]*?>7</);
  });
  it('leaves the table lines to the document defaults for the journal look', async () => {
    const xml = await documentXml(buildDocxTable(base(), theme, 8000));
    expect(xml).not.toContain('w:color="336699"');
    const none = await documentXml(buildDocxTable(base({ borderStyle: 'none' }), theme, 8000));
    expect(none).toContain('w:val="none"');
  });
  it('keeps emphasis in paragraphs', async () => {
    const xml = await documentXml([new Paragraph({ children: richRuns('a <b>b</b> <i>c</i> <u>d</u> <color=#CC0000>e</color>', '000000') as any })]);
    expect(xml).toContain('<w:b/>');
    expect(xml).toContain('<w:i/>');
    expect(xml).toContain('<w:u ');
    expect(xml).toContain('w:val="CC0000"');
  });
});

import { runsToScriptedText, enrichScriptRuns } from '@/lib/docx-richtext';

describe('bold and italic read from Word', () => {
  it('keeps emphasis that stands out from plain text, in the order it was written', () => {
    const runs = [
      { text: 'Loài ', isSup: false },
      { text: 'E. coli', isSup: false, isItalic: true },
      { text: ' và ', isSup: false },
      { text: 'p', isSup: false, isBold: true },
      { text: '<0,05', isSup: false, isBold: true },
    ];
    expect(runsToScriptedText(runs)).toBe('Loài <i>E. coli</i> và <b>p<0,05</b>'.replace('<0,05', '<0,05'));
  });
  it('leaves a paragraph set entirely in one style alone', () => {
    expect(runsToScriptedText([{ text: 'Cả đoạn nghiêng', isSup: false, isItalic: true }])).toBe('Cả đoạn nghiêng');
  });
  it('rewrites the paragraph of the paper only when the Word runs carry emphasis', () => {
    const sections: any[] = [{ id: 'a', type: 'paragraph', content: 'Loài E. coli phổ biến' }, { id: 'b', type: 'paragraph', content: 'Không gì cả' }];
    const n = enrichScriptRuns(
      sections,
      [
        { text: 'Loài E. coli phổ biến', runs: [{ text: 'Loài ', isSup: false }, { text: 'E. coli', isSup: false, isItalic: true }, { text: ' phổ biến', isSup: false }] },
        { text: 'Không gì cả', runs: [{ text: 'Không gì cả', isSup: false }] },
      ] as any
    );
    expect(n).toBe(1);
    expect(sections[0].content).toBe('Loài <i>E. coli</i> phổ biến');
    expect(sections[1].content).toBe('Không gì cả');
  });
});

import { emphasiseText } from '@/lib/docx-richtext';
describe('the abstract keeps the emphasis of the Word paragraphs it came from', () => {
  const para = (parts: Array<[string, { b?: boolean; i?: boolean }?]>) => ({
    text: parts.map((x) => x[0]).join(''),
    runs: parts.map(([text, f]) => ({ text, isSup: false, isBold: !!f?.b, isItalic: !!f?.i })),
  });
  it('adds the tags when the paragraphs say exactly the plain text', () => {
    const paras = [para([['Tóm tắt'], ]), para([['Nghiên cứu về '], ['E. coli', { i: true }], [' trong nước.']]), para([['Kết luận '], ['quan trọng', { b: true }], ['.']])];
    const plain = 'Nghiên cứu về E. coli trong nước. Kết luận quan trọng.';
    expect(emphasiseText(plain, paras as any)).toBe('Nghiên cứu về <i>E. coli</i> trong nước. Kết luận <b>quan trọng</b>.');
  });
  it('leaves the text alone when the paragraphs do not say it, or nothing stands out', () => {
    expect(emphasiseText('Một văn bản khác hẳn', [para([['Nghiên cứu về '], ['E. coli', { i: true }]]) as any])).toBe('Một văn bản khác hẳn');
    expect(emphasiseText('Cả đoạn nghiêng', [para([['Cả đoạn nghiêng', { i: true }]]) as any])).toBe('Cả đoạn nghiêng');
  });
});
