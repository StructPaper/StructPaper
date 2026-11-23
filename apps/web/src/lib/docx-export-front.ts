import { parseMarkup } from './inline-markup';
import {
  AlignmentType,
  BorderStyle,
  Footer,
  Header,
  ImageRun,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TabStopType,
  TextRun,
  VerticalAlign,
  WidthType,
} from 'docx';
import type { DocxImage } from './docx-export-assets';

/** Page geometry of the printed journal (same as the LaTeX template), in twips. */
export const GEOM = {
  pageW: 12254, // 8.51 in
  pageH: 15840, // 11 in
  left: 964, // 1.7 cm
  right: 737, // 1.3 cm
  top: 1021, // 1.8 cm
  bottom: 1134, // 2 cm
  gap: 240, // 1 pc between columns
  sidebar: 2495, // 4.4 cm side column on page 1
} as const;
export const TEXT_W = GEOM.pageW - GEOM.left - GEOM.right;
export const COL_W = Math.floor((TEXT_W - GEOM.gap) / 2);

export const FONT_SERIF = 'Times New Roman';
export const FONT_SANS = 'Calibri';
export const ABSTRACT_FILL = 'E7ECF7'; // "unitednationsblue" box of the printed journal
export const CITE_FILL = 'D9E1F2';

export interface FrontLabels {
  abstract: string;
  keywords: string;
  correspondence: string;
  history: string;
  received: string;
  revised: string;
  accepted: string;
  published: string;
  copyright: string;
  copyrightText: string;
  cite: string;
  scan: string;
}

export const LABELS: Record<'vi' | 'en', FrontLabels> = {
  vi: {
    abstract: 'TÓM TẮT',
    keywords: 'Từ khoá: ',
    correspondence: 'Liên hệ',
    history: 'Lịch sử',
    received: 'Ngày nhận: ',
    revised: 'Ngày sửa đổi: ',
    accepted: 'Ngày chấp nhận: ',
    published: 'Ngày đăng: ',
    copyright: 'Bản quyền',
    copyrightText:
      '© ĐHQG Tp.HCM. Đây là bài báo công bố mở được phát hành theo các điều khoản của the Creative Commons Attribution 4.0 International license.',
    cite: 'Trích dẫn bài báo này: ',
    scan: 'Use your smartphone to scan this QR code and download this article',
  },
  en: {
    abstract: 'ABSTRACT',
    keywords: 'Key words: ',
    correspondence: 'Correspondence',
    history: 'History',
    received: 'Received: ',
    revised: 'Revised: ',
    accepted: 'Accepted: ',
    published: 'Published Online: ',
    copyright: 'Copyright',
    copyrightText:
      '© VNUHCM Journal. This is an open-access article distributed under the terms of the Creative Commons Attribution 4.0 International license.',
    cite: 'Cite this article: ',
    scan: 'Use your smartphone to scan this QR code and download this article',
  },
};

export interface FrontMatter {
  lang: 'vi' | 'en';
  articleType: string;
  title: string;
  authors: { name: string; sup: string }[];
  affiliations: string[];
  corrName: string;
  corrAffiliation: string;
  corrEmail: string;
  dates: { received: string; revised: string; accepted: string; published: string };
  doi: string;
  abstract: string;
  keywords: string[];
  /** "Long P T, Nguyen V T. <b>Title</b>. <i>Abbrev</i> 2026; 10(1):1237-1246." pieces */
  cite: { authors: string; title: string; journal: string; tail: string };
  journalLine: string;
}

const run = (text: string, o: Record<string, unknown> = {}) => new TextRun({ text, font: FONT_SANS, size: 14, ...o });
const img = (i: DocxImage, widthPx: number) =>
  new ImageRun({ type: i.type, data: i.data, transformation: { width: widthPx, height: Math.round((widthPx * i.height) / i.width) } });
const NO_BORDERS = {
  top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  insideHorizontal: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  insideVertical: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
};

/** Title, authors, then the side column (QR, affiliation, contact, history, DOI, badge, copyright) next to the abstract box. */
export function buildFrontMatter(fm: FrontMatter, color: string, art: { qr: DocxImage | null; checkUpdate: DocxImage | null }): Array<Paragraph | Table> {
  const L = LABELS[fm.lang];
  const label = (t: string) => new Paragraph({ spacing: { before: 140, after: 50 }, children: [run(t, { bold: true, color, font: FONT_SERIF })] });
  const side: Paragraph[] = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: art.qr ? [img(art.qr, 56)] : [run(' ')],
      spacing: { after: 40 },
    }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 240 }, children: [run(L.scan, { size: 15, color: '808080', font: FONT_SERIF })] }),
    ...fm.affiliations.map(
      (a) => new Paragraph({ spacing: { after: 60 }, border: { top: { style: BorderStyle.SINGLE, size: 4, color: '000000', space: 4 } }, children: [run(a, { italics: true, size: 15, font: FONT_SERIF })] })
    ),
    label(L.correspondence),
    new Paragraph({ children: [run(fm.corrName, { bold: true }), run(`, ${fm.corrAffiliation}`)] }),
    new Paragraph({ spacing: { before: 60 }, children: [run(`Email: ${fm.corrEmail}`)] }),
    label(L.history),
    ...([
      [L.received, fm.dates.received],
      [L.revised, fm.dates.revised],
      [L.accepted, fm.dates.accepted],
      [L.published, fm.dates.published],
    ] as const).map(([k, v]) => new Paragraph({ children: [run('• ', { color, bold: true, size: 15 }), run(k, { font: FONT_SERIF, size: 15 }), run(v, { size: 15 })] })),
    new Paragraph({ spacing: { before: 140, after: 100 }, children: [run('DOI : ', { bold: true, color }), run(fm.doi, { bold: true, font: FONT_SERIF })] }),
    ...(art.checkUpdate ? [new Paragraph({ spacing: { after: 100 }, children: [img(art.checkUpdate, 143)] })] : []),
    label(L.copyright),
    new Paragraph({ children: [run(L.copyrightText)] }),
  ];
  const abstractParas = fm.abstract
    .split(/\n+/)
    .filter((t) => t.trim())
    .map((t) => new Paragraph({ alignment: AlignmentType.JUSTIFIED, style: 'Abstract', children: parseMarkup(t.trim()).map((seg) => run(seg.text, { size: 19, ...(seg.b ? { bold: true } : {}), ...(seg.i ? { italics: true } : {}), ...(seg.u ? { underline: {} } : {}), ...(seg.color ? { color: seg.color.slice(1) } : {}) })) }));
  const box: Paragraph[] = [
    new Paragraph({ style: 'SectionAbstract', children: [run(L.abstract, { bold: true, color, size: 18 })] }),
    ...abstractParas,
    new Paragraph({
      style: 'Keywords',
      children: [run(L.keywords, { bold: true, color, size: 19 }), run(fm.keywords.join(', '), { size: 19 })],
    }),
  ];

  const authorRuns: TextRun[] = [];
  fm.authors.forEach((a, i) => {
    authorRuns.push(new TextRun({ text: a.name, font: FONT_SANS, size: 22, bold: true, color }));
    if (a.sup) authorRuns.push(new TextRun({ text: a.sup, font: FONT_SANS, size: 22, bold: true, color, superScript: true }));
    if (i < fm.authors.length - 1) authorRuns.push(new TextRun({ text: ', ', font: FONT_SANS, size: 22, bold: true, color }));
  });

  return [
    new Paragraph({ style: 'ArticleTitle', children: [new TextRun({ text: fm.title, font: FONT_SANS, size: 36, bold: true, color })] }),
    new Paragraph({ style: 'Authors', children: authorRuns }),
    new Table({
      width: { size: TEXT_W, type: WidthType.DXA },
      columnWidths: [GEOM.sidebar, TEXT_W - GEOM.sidebar],
      borders: NO_BORDERS,
      rows: [
        new TableRow({
          children: [
            new TableCell({ width: { size: GEOM.sidebar, type: WidthType.DXA }, margins: { right: 200 }, children: side }),
            new TableCell({
              width: { size: TEXT_W - GEOM.sidebar, type: WidthType.DXA },
              verticalAlign: VerticalAlign.TOP,
              shading: { type: ShadingType.CLEAR, fill: ABSTRACT_FILL, color: 'auto' },
              margins: { top: 240, bottom: 240, left: 240, right: 240 },
              children: box,
            }),
          ],
        }),
      ],
    }),
    new Paragraph({ spacing: { after: 120 }, children: [] }),
  ];
}

/** Running headers/footers: page 1 (journal line, Open Access, article type; citation box + page number), then odd/even. */
export function buildHeadersFooters(fm: FrontMatter, color: string, openAccess: DocxImage | null) {
  const L = LABELS[fm.lang];
  const jl = (size: number) => new TextRun({ text: fm.journalLine, font: FONT_SANS, size, bold: true, italics: true });
  const pageNo = (alignment: (typeof AlignmentType)[keyof typeof AlignmentType]) =>
    new Paragraph({ alignment, children: [new TextRun({ children: [PageNumber.CURRENT], font: FONT_SANS, size: 20, bold: true, color })] });
  const first = new Header({
    children: [
      new Paragraph({ children: [jl(16)] }),
      new Paragraph({
        tabStops: [{ type: TabStopType.RIGHT, position: TEXT_W }],
        children: [
          ...(openAccess ? [img(openAccess, 9)] : []),
          new TextRun({ text: ' Open Access Full Text Article', font: FONT_SERIF, size: 16, bold: true, color: '808080' }),
          new TextRun({ text: `\t${fm.articleType}`, font: FONT_SERIF, size: 24, bold: true, italics: true, underline: {} }),
        ],
      }),
    ],
  });
  const running = new Header({
    children: [new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: '000000', space: 2 } }, children: [jl(17)] })],
  });
  const citeFooter = new Footer({
    children: [
      new Paragraph({
        shading: { type: ShadingType.CLEAR, fill: CITE_FILL, color: 'auto' },
        spacing: { after: 80 },
        children: [
          new TextRun({ text: L.cite, font: FONT_SANS, size: 18, bold: true, color }),
          new TextRun({ text: `${fm.cite.authors}. `, font: FONT_SANS, size: 18 }),
          new TextRun({ text: fm.cite.title, font: FONT_SANS, size: 18, bold: true }),
          new TextRun({ text: '. ', font: FONT_SANS, size: 18 }),
          new TextRun({ text: fm.cite.journal, font: FONT_SANS, size: 18, italics: true }),
          new TextRun({ text: ` ${fm.cite.tail}`, font: FONT_SANS, size: 18 }),
        ],
      }),
      pageNo(AlignmentType.RIGHT),
    ],
  });
  return {
    headers: { first, default: running, even: running },
    footers: { first: citeFooter, default: new Footer({ children: [pageNo(AlignmentType.RIGHT)] }), even: new Footer({ children: [pageNo(AlignmentType.LEFT)] }) },
  };
}
