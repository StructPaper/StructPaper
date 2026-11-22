'use client';

import { useEffect, useState } from 'react';
import type { PdfTextItem } from '@/lib/editor/pdf-section-map';
import { PAGE } from './overview-pages';
import type { AlignLine } from './overview-align';

/** The text of the compiled PDF, line by line, with the page and column each line was printed in. */
export interface PdfLines {
  lines: AlignLine[];
  pageCount: number;
}

/** Where the body of a page is on the sheet (points), as measured on the journal's PDFs. Everything outside is not the paper's text. */
const BODY = {
  /** Text left of this is the column of QR code, affiliations and contact details (and the title block). */
  left: PAGE.left - 4,
  /** The middle of the gap between the two columns. */
  mid: PAGE.left + (PAGE.w - PAGE.right - PAGE.left) / 2,
  /** A line that starts left of this and ends right of the next one runs over both columns. */
  gapLeft: PAGE.left + (PAGE.w - PAGE.right - PAGE.left) / 2 - 4,
  gapRight: PAGE.left + (PAGE.w - PAGE.right - PAGE.left) / 2 + 4,
  /** A baseline above this is the running head (the first line of the text is at 61). */
  headBottom: 52,
  /** A baseline below this is the foot (page number; the "how to cite" strip on the first page). The last line of text is at 696. */
  footTop: 706,
} as const;

/** One printed line of a page, as the text items that make it up. */
interface RawLine {
  y: number;
  height: number;
  items: PdfTextItem[];
}

/**
 * Joins the items of a page into printed lines, in the order the PDF draws them. An item belongs to the line before it when it is on
 * (almost) the same baseline and goes on to the right: a superscript (a citation number) sits a little higher and is smaller, and does
 * not start a line of its own; it is left out, as the paper keeps citations apart from its words.
 */
function printedLines(items: PdfTextItem[]): RawLine[] {
  const lines: RawLine[] = [];
  for (const it of items) {
    if (!it.str) continue;
    const last = lines[lines.length - 1];
    const lastItem = last?.items[last.items.length - 1];
    if (last && lastItem && Math.abs(it.y - last.y) < 4.2 && it.x >= lastItem.x - 3) {
      const raised = it.y - last.y > 1.2 && it.height < last.height * 0.85;
      if (!raised) last.items.push(it);
    } else lines.push({ y: it.y, height: it.height || 9, items: [it] });
  }
  return lines;
}

/**
 * Turns the text items of one PDF page into lines of the paper's text: the head, the foot and the column on the left are left out, and
 * each line is given the column it is in.
 */
export function pageLines(items: PdfTextItem[], page: number, pageHeight: number): AlignLine[] {
  const out: AlignLine[] = [];
  for (const ln of printedLines(items)) {
    const parts = ln.items.filter((it) => it.str.trim());
    if (parts.length === 0) continue;
    const x0 = Math.min(...parts.map((p) => p.x));
    const x1 = Math.max(...parts.map((p) => p.x + p.width));
    const top = pageHeight - ln.y;
    if (x0 < BODY.left || top < BODY.headBottom || top > BODY.footTop) continue;
    const col = x0 < BODY.gapLeft && x1 > BODY.gapRight ? 2 : x0 < BODY.mid ? 0 : 1;
    out.push({ page, col, text: ln.items.map((it) => it.str).join('') });
  }
  return out;
}

/**
 * Reads the compiled PDF's text once per PDF, in the background. Used to find where the printed pages and columns break, so the
 * overview can break them in the same places.
 */
export function usePdfLines(url: string | null, enabled: boolean): PdfLines | null {
  const [result, setResult] = useState<PdfLines | null>(null);
  useEffect(() => {
    if (!url || !enabled) {
      setResult(null);
      return;
    }
    let dead = false;
    const timer = setTimeout(async () => {
      try {
        const pdfjs: any = await import('pdfjs-dist');
        pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
        const data = await (await fetch(url)).arrayBuffer();
        const doc = await pdfjs.getDocument({ data }).promise;
        const lines: AlignLine[] = [];
        for (let n = 1; n <= doc.numPages && !dead; n++) {
          const page = await doc.getPage(n);
          const view: number[] = page.view;
          const content = await page.getTextContent();
          const items: PdfTextItem[] = content.items
            .filter((it: any) => typeof it.str === 'string')
            .map((it: any) => ({ str: it.str, x: it.transform[4], y: it.transform[5], width: it.width, height: it.height }));
          lines.push(...pageLines(items, n, view[3] - view[1]));
        }
        const pageCount = doc.numPages as number;
        await doc.destroy?.();
        if (!dead) setResult({ lines, pageCount });
      } catch {
        if (!dead) setResult(null);
      }
    }, 400);
    return () => {
      dead = true;
      clearTimeout(timer);
    };
  }, [url, enabled]);
  return result;
}
