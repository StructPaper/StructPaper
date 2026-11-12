/**
 * Opt-in (RUN_TEX_E2E=1; PDFTOTEXT=path to poppler's pdftotext if another one comes first on PATH; needs the Spring
 * API on :8080 with XeLaTeX and poppler's pdfinfo on PATH). Compiles a real paper and drives the preview's own
 * algorithm: the anchor and the "next page" section are worked out from the text of the compiled pages with
 * `firstNewSectionOnPage`, exactly as the preview does, the page is turned, the turned PDF is read again, the page is
 * turned back, and everything is compared with the original. Unit tests cannot see a blank page, a spilled range or a
 * lost column; only a real compile can.
 */
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { CompletePaper, PaperSection } from '@/types/paper';
import { exportToLatex } from '@/lib/latex-template';
import { SAMPLE_PAPER_HS722 } from '@/lib/sample-papers';
import { rotatePageAt } from '@/lib/editor/page-turn';
import { buildSectionIndex, firstNewSectionOnPage } from '@/lib/editor/pdf-section-map';
import type { PageDefaults } from '@/lib/editor/page-groups';

const RUN = process.env.RUN_TEX_E2E === '1';
const TEXT = process.env.PDFTOTEXT || 'pdftotext';

interface Page {
  w: number;
  h: number;
  text: string;
  lines: string[];
  xmin: number;
}

async function compile(paper: CompletePaper): Promise<Page[]> {
  const res = await fetch('http://localhost:8080/api/v1/compile/latex', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ texContent: exportToLatex(paper), jobName: 'article', autoFontFallback: true, images: {} }),
  });
  if (!res.ok) throw new Error(`compile failed: ${res.status} ${(await res.text()).slice(0, 300)}`);
  const dir = mkdtempSync(path.join(tmpdir(), 'turn-'));
  const pdf = path.join(dir, 'a.pdf');
  writeFileSync(pdf, Buffer.from(await res.arrayBuffer()));
  const info = execFileSync('pdfinfo', ['-f', '1', '-l', '200', pdf]).toString();
  const sizes = [...info.matchAll(/Page\s+(\d+) size:\s+([\d.]+) x ([\d.]+)/g)].map((m) => {
    const rot = Number((info.match(new RegExp('Page\\s+' + m[1] + ' rot:\\s+(\\d+)')) || [])[1] || 0);
    const w = Number(m[2]);
    const h = Number(m[3]);
    return rot === 90 || rot === 270 ? { w: h, h: w } : { w, h };
  });
  const html = path.join(dir, 'a.html');
  execFileSync(TEXT, ['-bbox', pdf, html]);
  const bbox = readFileSync(html, 'utf-8').split('<page ');
  const raw = path.join(dir, 'a.txt');
  execFileSync(TEXT, ['-raw', pdf, raw]);
  const rawPages = readFileSync(raw, 'utf-8').split('\f');
  return sizes.map((sz, i) => {
    const chunk = bbox[i + 1] || '';
    const xs = [...chunk.matchAll(/xMin="([\d.]+)"/g)].map((x) => Number(x[1]));
    const words = [...chunk.matchAll(/>([^<]+)<\/word>/g)].map((x) => x[1]).join(' ');
    return { ...sz, text: words, lines: (rawPages[i] || '').split('\n').filter((l) => l.trim()), xmin: xs.length ? Math.min(...xs) : 0 };
  });
}

const landscape = (p: Page) => p.w > p.h;
const shape = (pages: Page[]) => pages.map((p) => [p.w, p.h]);

/** The page of `pages` whose first new section is `id` (the page a section opens). */
function pageOpenedBy(index: ReturnType<typeof buildSectionIndex>, pages: Page[], id: string): number {
  for (let p = 1; p < pages.length; p++) if (firstNewSectionOnPage(index, pages[p].lines, pages[p - 1].lines) === id) return p;
  return -1;
}

/** Turn the page at `page`, read the new PDF, turn the page that the anchor now opens back, compare with the original. */
async function turnAndBack(paper: CompletePaper, defaults: PageDefaults, page: number) {
  const index = buildSectionIndex(paper.sections);
  const original = await compile(paper);
  const to = landscape(original[page]) ? 'portrait' : 'landscape';
  const anchor = firstNewSectionOnPage(index, original[page].lines, original[page - 1].lines);
  const next = firstNewSectionOnPage(index, original[page + 1].lines, original[page].lines);
  expect(anchor, 'the page has a section that starts on it').toBeTruthy();

  const turnedSections = rotatePageAt(paper.sections, anchor!, next, to, defaults);
  expect(turnedSections).not.toBe(paper.sections);
  const turned = await compile({ ...paper, sections: turnedSections });
  expect(turned.some((p, i) => landscape(p) !== landscape(original[i] || p))).toBe(true);

  // the preview works out the anchor and the next section again from the turned PDF
  const p2 = pageOpenedBy(buildSectionIndex(turnedSections), turned, anchor!);
  expect(p2, 'the turned page is found again from its text').toBeGreaterThan(0);
  const index2 = buildSectionIndex(turnedSections);
  const next2 = p2 + 1 < turned.length ? firstNewSectionOnPage(index2, turned[p2 + 1].lines, turned[p2].lines) : null;
  const back = rotatePageAt(turnedSections, anchor!, next2, landscape(original[page]) ? 'landscape' : 'portrait', defaults);
  expect(back).toEqual(paper.sections);
  const again = await compile({ ...paper, sections: back });
  expect(again.length).toBe(original.length);
  expect(shape(again)).toEqual(shape(original));
  expect(again.map((p) => p.text)).toEqual(original.map((p) => p.text));

  // body text still starts at the left margin: no more pages with a gap there than before
  const farFromLeft = (pages: Page[]) => pages.slice(1, -1).filter((p) => !landscape(p) && p.xmin / p.w > 0.2).length;
  expect(farFromLeft(turned)).toBeLessThanOrEqual(farFromLeft(original));
  return { original, turned };
}

const base = SAMPLE_PAPER_HS722;
const firstBodyPage = (pages: Page[], from = 2) => {
  for (let p = from; p < pages.length - 2; p++) if (!landscape(pages[p]) && !landscape(pages[p + 1])) return p;
  return from;
};

describe.skipIf(!RUN)('turning a page on a real compile, driven the way the preview drives it', () => {
  it('two-column document: turn a portrait page and turn it back', async () => {
    const defaults = { oneColumn: false, landscape: false };
    const original = await compile(base);
    await turnAndBack(base, defaults, firstBodyPage(original));
  }, 420_000);

  it('one-column default with an existing landscape one-column group: turn a page inside and outside the group', async () => {
    const body = base.sections.filter((s) => s.type !== 'citation');
    const mid = body[Math.floor(body.length / 2)].id;
    const sections: PaperSection[] = base.sections.map((s) => (s.id === mid ? { ...s, pageLayout: { orientation: 'landscape', columns: '1-column' } } : s));
    const paper = { ...base, sections, layoutSettings: { ...base.layoutSettings, columnLayout: '1-column' } } as CompletePaper;
    const defaults = { oneColumn: true, landscape: false };
    const original = await compile(paper);
    await turnAndBack(paper, defaults, firstBodyPage(original, 2));
    const inside = original.findIndex((p, i) => i > 1 && landscape(p) && i < original.length - 2);
    if (inside > 0) await turnAndBack(paper, defaults, inside);
  }, 600_000);
});
