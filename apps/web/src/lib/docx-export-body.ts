import {
  AlignmentType,
  ImageRun,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TabStopType,
  TextRun,
  WidthType,
  BorderStyle,
} from 'docx';
import type { PaperReference, PaperSection } from '@/types/paper';
import { inlineFootnotes } from './footnotes';
import { listMarkOf } from './list-marks';
import type { ResolvedTheme } from './theme-config';
import { latexToDocxMath, splitTextWithMath } from './docx-math';
import { displayHeading } from './headings';
import { buildDocxTable } from './docx-table';
import { stripCaptionLabel } from './docx-table-extras';
import { parseMarkup } from './inline-markup';
import type { DocxImage } from './docx-export-assets';
import { ABSTRACT_FILL, FONT_SANS, FONT_SERIF } from './docx-export-front';
import { SegmentBuilder, type Block, type Segment } from './docx-export-layout';

export type { Block, Segment };

const BODY_SIZE = 18; // 9 pt, as printed
const CITE_RE = /\s*\[(\d+(?:\s*[,–-]\s*\d+)*)\]/g;

/** Text with inline $…$ math and "[3,4]" citations (printed as coloured superscripts, like the PDF). */
export function richRuns(text: string, color: string, font = FONT_SERIF, size = BODY_SIZE): Array<TextRun | ReturnType<typeof latexToDocxMath>> {
  const out: Array<TextRun | ReturnType<typeof latexToDocxMath>> = [];
  // <b>, <i>, <u>, <color=…> runs keep their emphasis; each run is then split into text, math and citations
  for (const seg of parseMarkup(text)) {
    const style = { bold: seg.b || undefined, italics: seg.i || undefined, underline: seg.u ? {} : undefined, ...(seg.color ? { color: seg.color.slice(1) } : {}) };
    const body = seg.text;
    let last = 0;
    const pushText = (t: string) => {
      for (const c of splitTextWithMath(t)) out.push(c.kind === 'text' ? new TextRun({ text: c.value, font, size, ...style }) : c.math);
    };
    for (const m of body.matchAll(CITE_RE)) {
      pushText(body.slice(last, m.index));
      out.push(new TextRun({ text: m[1].replace(/\s+/g, ''), font, size, superScript: true, color }));
      last = (m.index ?? 0) + m[0].length;
    }
    pushText(body.slice(last));
  }
  return out;
}

// Word footnotes need their own part of the file: here a note is kept as a parenthesis right after the sentence it belongs to
const bodyPara = (text: string, color: string) =>
  new Paragraph({
    style: 'BodyText',
    alignment: AlignmentType.JUSTIFIED,
    // an item of a list: its mark hangs out to the left of the text
    ...(listMarkOf(text) ? { indent: { left: 340, hanging: 227 } } : {}),
    children: richRuns(inlineFootnotes(text), color),
  });

function headingPara(sec: PaperSection, theme: ResolvedTheme, color: string): Paragraph {
  const title = displayHeading(sec.title || '', theme.keepSectionNumbers);
  const level = sec.type === 'h1' ? 1 : sec.type === 'h2' ? 2 : 3;
  return new Paragraph({
    style: `Heading${level}`,
    keepNext: true,
    children: [
      new TextRun({
        text: level === 1 ? title.toUpperCase() : title,
        font: FONT_SANS,
        size: level === 1 ? 24 : 20,
        bold: true,
        italics: level === 3,
        color,
      }),
    ],
  });
}

/** Figure in a light-blue box: picture, then "Hình N: caption", like the printed journal. */
function figureBlock(sec: PaperSection, image: DocxImage | undefined, boxW: number, color: string, lang: 'vi' | 'en'): Table {
  const fig = sec.figure!;
  const scale = Math.min(100, fig.scalePercent ?? 100) / 100;
  const widthPx = Math.round(((boxW - 300) / 15) * scale);
  const pic = image
    ? [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          keepNext: true,
          children: [new ImageRun({ type: image.type, data: image.data, transformation: { width: widthPx, height: Math.round((widthPx * image.height) / image.width) } })],
        }),
      ]
    : [];
  const caption = new Paragraph({
    style: 'FigureCaption',
    children: [
      new TextRun({ text: `${fig.appendix ? (lang === 'en' ? 'Appendix' : 'Phụ lục') : lang === 'en' ? 'Figure' : 'Hình'} ${fig.num}: `, font: FONT_SANS, size: 17, bold: true, color }),
      new TextRun({ text: stripCaptionLabel(fig.caption || ''), font: FONT_SANS, size: 17 }),
      ...(fig.source ? [new TextRun({ text: ` ${fig.source}`, font: FONT_SANS, size: 17 })] : []),
    ],
  });
  const none = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
  return new Table({
    width: { size: boxW, type: WidthType.DXA },
    columnWidths: [boxW],
    borders: { top: none, bottom: none, left: none, right: none, insideHorizontal: none, insideVertical: none },
    rows: [
      new TableRow({
        cantSplit: true,
        children: [
          new TableCell({
            width: { size: boxW, type: WidthType.DXA },
            shading: { type: ShadingType.CLEAR, fill: ABSTRACT_FILL, color: 'auto' },
            margins: { top: 120, bottom: 120, left: 150, right: 150 },
            children: [...pic, caption],
          }),
        ],
      }),
    ],
  });
}

function equationPara(sec: PaperSection, width: number): Paragraph {
  const children: Array<TextRun | ReturnType<typeof latexToDocxMath>> = [new TextRun({ text: '\t' }), latexToDocxMath(sec.equation!.latex)];
  if (sec.equation!.numbered) children.push(new TextRun({ text: `\t(${sec.equation!.num ?? ''})`, font: FONT_SERIF, size: BODY_SIZE }));
  return new Paragraph({
    style: 'Equation',
    tabStops: [
      { type: TabStopType.CENTER, position: Math.round(width / 2) },
      { type: TabStopType.RIGHT, position: width },
    ],
    children,
  });
}

/**
 * Body sections and references, split into Word segments: 2-column runs, full-width figure/table/equation runs,
 * and page-layout switches (document default, section markers, rotated tables) — see docx-export-layout.
 */
export function buildBody(
  sections: PaperSection[],
  references: PaperReference[],
  ctx: {
    theme: ResolvedTheme;
    color: string;
    figures: Map<string, DocxImage>;
    lang: 'vi' | 'en';
    refTitle: string;
    /** Document default: one-column body (layoutSettings.columnLayout). */
    oneColumn?: boolean;
    /** Document default: the whole body on landscape pages (layoutSettings.orientation). */
    landscape?: boolean;
    /** The appendices that are printed after the references (arrangeForOutput), and whether their pages are turned. */
    appendices?: PaperSection[];
    appendixLandscape?: boolean;
  }
): Segment[] {
  const layout = new SegmentBuilder(!!ctx.oneColumn, !!ctx.landscape);
  const push = (full: boolean, ...blocks: Block[]) => layout.push(full, ...blocks);
  const { theme, color } = ctx;
  const emit = (sec: PaperSection) => {
    layout.enter(sec.pageLayout);
    if ((sec.type === 'h1' || sec.type === 'h2' || sec.type === 'h3') && sec.title) {
      push(false, headingPara(sec, theme, color));
      if (sec.content) push(false, bodyPara(sec.content, color));
    } else if (sec.type === 'paragraph' && sec.content) {
      push(false, bodyPara(sec.content, color));
    } else if ((sec.type === 'quote' || sec.type === 'box') && sec.content) {
      push(false, new Paragraph({ style: 'BodyText', indent: { left: 360, right: 360 }, children: richRuns(sec.content, color).map((r) => r) }));
    } else if (sec.type === 'equation' && sec.equation?.latex.trim()) {
      const full = layout.spans(sec.equation.columnSpan === '2-column');
      push(full, equationPara(sec, layout.width(full)));
    } else if (sec.type === 'figure' && sec.figure) {
      const full = sec.figure.columnSpan === '2-column' || (sec.figure.columnSpan !== '1-column' && !!sec.figure.isFullWidth);
      push(full, figureBlock(sec, ctx.figures.get(sec.id), layout.width(full), color, ctx.lang), new Paragraph({ spacing: { after: 120 }, children: [] }));
    } else if (sec.type === 'table' && sec.table) {
      const t = sec.table;
      const full = t.columnSpan === '2-column' || (t.columnSpan !== '1-column' && t.isFullWidth !== false && (t.headers?.length ?? 0) > 3);
      if (t.isRotated && !layout.isLandscape) layout.rotated((w) => buildDocxTable(t, theme, w));
      else push(full, ...buildDocxTable(t, theme, layout.width(full)));
    }
  };
  sections.forEach(emit);
  if (references.length > 0) {
    push(false, new Paragraph({ style: 'SectionReferences', keepNext: true, children: [new TextRun({ text: ctx.refTitle, font: FONT_SANS, size: 24, bold: true, color })] }));
    for (const ref of references) {
      push(
        false,
        new Paragraph({
          style: 'Reference',
          alignment: AlignmentType.JUSTIFIED,
          indent: { left: 280, hanging: 280 },
          children: [new TextRun({ text: `${ref.id}.\t`, font: FONT_SANS, size: 15, color }), new TextRun({ text: ref.raw, font: FONT_SANS, size: 15 })],
          tabStops: [{ type: TabStopType.LEFT, position: 280 }],
        })
      );
    }
  }
  // the appendices after the references (see lib/appendix), on pages turned on their side when the paper asks
  if (ctx.appendices && ctx.appendices.length > 0) {
    layout.enter({ columns: '1-column', orientation: ctx.appendixLandscape === false ? 'portrait' : 'landscape' });
    ctx.appendices.forEach((sec) => emit(sec.type === 'table' && sec.table ? { ...sec, table: { ...sec.table, isRotated: false } } : sec));
  }
  return layout.done();
}
