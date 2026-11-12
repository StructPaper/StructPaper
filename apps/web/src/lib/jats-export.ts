import type { CompletePaper, PaperSection } from '@/types/paper';
import { splitMathSegments, xmlEscape } from '@/lib/math-text';

import { stripCaptionLabel } from './docx-table-extras';
import { resolvePublication, hasPublicationValue } from './publication';
import { displayHeading } from './headings';
import { resolveTheme } from './theme-config';
import { articleTypeJats } from './article-types';
/**
 * JATS 1.2 XML export for the VNUHCM journal platform.
 *
 * Image URLs follow the platform convention described in the project README:
 *   https://static.vnuhcmjournal.com.vn/articles/<journal-initial>/v-<volume>/i-<issue>/a-<article>/img-<n>.<ext>
 * When the article id is unknown the graphic keeps a relative "images/img-<n>.<ext>" path.
 */

export interface JatsOptions {
  /** Numeric/string article id on the platform (the "a-#" segment). */
  articleId?: string;
  staticBaseUrl?: string;
  /** File extension actually written for a figure (when the image was converted while packing). */
  extByFigure?: Record<number, string>;
}

const DEFAULT_STATIC_BASE = 'https://static.vnuhcmjournal.com.vn/articles';

/** "VNUHCM-HS" -> "hs", "VNUHCMJ-ET" -> "et". */
export function journalInitial(journalId: string): string {
  const tail = (journalId || '').split('-').pop() || journalId || 'std';
  return tail.toLowerCase().replace(/[^a-z0-9]/g, '') || 'std';
}

function imageExt(src: string): string {
  const data = src.match(/^data:image\/(png|jpe?g|gif|webp|svg\+xml)/i);
  if (data) return data[1].toLowerCase().replace('jpeg', 'jpg').replace('svg+xml', 'svg');
  const file = src.split('?')[0].split('.').pop() || '';
  return /^(png|jpe?g|gif|webp|svg)$/i.test(file) ? file.toLowerCase().replace('jpeg', 'jpg') : 'png';
}

/**
 * Path of a figure file relative to the static root: `<initial>/v-#/i-#/a-#/img-n.ext` when the volume, issue and
 * article id are known (the platform convention), else `images/img-n.ext`.
 */
export function figureRelPath(paper: CompletePaper, figNum: number, src: string, opts: JatsOptions): { path: string; onPlatform: boolean } {
  const ext = opts.extByFigure?.[figNum] || imageExt(src || '');
  const md = paper.metadata;
  const pubInfo = resolvePublication(md);
  const articleId = (opts.articleId || md.publication?.articleId || '').trim();
  if (!articleId || !hasPublicationValue(pubInfo.volume) || !hasPublicationValue(pubInfo.issue)) {
    return { path: `images/img-${figNum}.${ext}`, onPlatform: false };
  }
  return {
    path: `${journalInitial(md.journalId)}/v-${pubInfo.volume.trim()}/i-${pubInfo.issue.trim()}/a-${articleId}/img-${figNum}.${ext}`,
    onPlatform: true,
  };
}

export function figureHref(paper: CompletePaper, figNum: number, src: string, opts: JatsOptions): string {
  const { path, onPlatform } = figureRelPath(paper, figNum, src, opts);
  return onPlatform ? `${(opts.staticBaseUrl || DEFAULT_STATIC_BASE).replace(/\/$/, '')}/${path}` : path;
}

/** The figures of a paper with the number the XML gives them (same rule as the body: own number, else order). */
export function listJatsFigures(paper: CompletePaper): { num: number; src: string }[] {
  const out: { num: number; src: string }[] = [];
  let figId = 0;
  for (const s of paper.sections as PaperSection[]) {
    if (s.type === 'figure' && s.figure) {
      figId += 1;
      out.push({ num: s.figure.num || figId, src: s.figure.src || '' });
    }
  }
  return out;
}

// Per-export context: ids that must be unique (xml:id) and the reference ids that actually exist.
let usedIds = new Set<string>();
let knownRefs: Set<number> | null = null;

/** xml:id values must be unique in the whole document (the DTD rejects duplicates). */
function uniqueId(base: string): string {
  let id = base;
  for (let n = 2; usedIds.has(id); n++) id = `${base}_${n}`;
  usedIds.add(id);
  return id;
}

const CITE_RE = /\[(\d+(?:\s*[,–-]\s*\d+)*)\]/g;

/** Text -> JATS inline XML: formulas become <inline-formula>, [n] becomes <xref ref-type="bibr">. */
export function inlineToJats(text: string): string {
  return splitMathSegments(text || '')
    .map((seg) => {
      if (seg.kind === 'text') {
        return xmlEscape(seg.value).replace(CITE_RE, (all, inner: string) => {
          const first = Number(inner.split(/[,–-]/)[0]);
          // Only link citations that have a bibliography entry (IDREF must resolve).
          return Number.isFinite(first) && (!knownRefs || knownRefs.has(first)) ? `<xref ref-type="bibr" rid="R${first}">${all}</xref>` : all;
        });
      }
      const tex = seg.value.replace(/]]>/g, ']] >');
      return seg.kind === 'display'
        ? `<disp-formula><tex-math><![CDATA[${tex}]]></tex-math></disp-formula>`
        : `<inline-formula><tex-math><![CDATA[${tex}]]></tex-math></inline-formula>`;
    })
    .join('');
}

function splitName(full: string): { surname: string; given: string } {
  const parts = (full || '').trim().split(/\s+/);
  // Vietnamese convention used by the platform: surname = last token.
  const surname = parts.pop() || '';
  return { surname, given: parts.join(' ') };
}

type JatsCell = { text: string; colSpan?: number; rowSpan?: number };

/** <table> that satisfies the DTD: (thead?, tbody+) or, when there are no body rows, plain tr+. */
function tableXml(
  headRows: JatsCell[][],
  bodyRows: JatsCell[][],
  cell: (tag: 'th' | 'td', c: JatsCell) => string
): string {
  const head = headRows.filter((r) => r.length);
  const body = bodyRows.filter((r) => r.length);
  const tr = (tag: 'th' | 'td') => (r: JatsCell[]) => `<tr>${r.map((c) => cell(tag, c)).join('')}</tr>`;
  if (!head.length && !body.length) return '';
  if (!body.length) return `<table>${head.map(tr('th')).join('')}</table>`;
  return `<table>${head.length ? `<thead>${head.map(tr('th')).join('')}</thead>` : ''}<tbody>${body.map(tr('td')).join('')}</tbody></table>`;
}

interface OpenSec {
  level: number;
}

function bodyToJats(paper: CompletePaper, opts: JatsOptions): string {
  const keepNumbers = resolveTheme(paper.layoutSettings).keepSectionNumbers;
  const out: string[] = [];
  const stack: OpenSec[] = [];
  const closeTo = (level: number) => {
    while (stack.length && stack[stack.length - 1].level >= level) {
      stack.pop();
      out.push('</sec>');
    }
  };
  let tableId = 0;
  let figId = 0;
  let eqId = 0;

  (paper.sections as PaperSection[]).forEach((s) => {
    const heading = s.type === 'h1' ? 1 : s.type === 'h2' ? 2 : s.type === 'h3' ? 3 : 0;
    if (heading) {
      closeTo(heading);
      out.push('<sec>', `<title>${xmlEscape(displayHeading(s.title || '', keepNumbers))}</title>`);
      stack.push({ level: heading });
      return;
    }
    if (s.type === 'paragraph' && s.content) {
      out.push(`<p>${inlineToJats(s.content)}</p>`);
    } else if (s.type === 'quote' && s.content) {
      out.push(`<disp-quote><p>${inlineToJats(s.content)}</p></disp-quote>`);
    } else if (s.type === 'box' && s.content) {
      out.push(`<boxed-text><p>${inlineToJats(s.content)}</p></boxed-text>`);
    } else if (s.type === 'equation' && s.equation?.latex.trim()) {
      eqId += 1;
      const tex = s.equation.latex.replace(/]]>/g, ']] >');
      const label = s.equation.numbered ? `<label>(${s.equation.num ?? eqId})</label>` : '';
      out.push(`<disp-formula id="${uniqueId(`eq${s.equation.num ?? eqId}`)}">${label}<tex-math><![CDATA[${tex}]]></tex-math></disp-formula>`);
    } else if (s.type === 'figure' && s.figure) {
      figId += 1;
      const n = s.figure.num || figId;
      out.push(
        `<fig id="${uniqueId(`fig${n}`)}"><label>Hình ${n}</label><caption><p>${inlineToJats(stripCaptionLabel(s.figure.caption))}</p></caption>` +
          `<graphic xlink:href="${xmlEscape(figureHref(paper, n, s.figure.src || '', opts))}"/>` +
          (s.figure.source ? `<attrib>${xmlEscape(s.figure.source)}</attrib>` : '') +
          `</fig>`
      );
    } else if (s.type === 'table' && s.table) {
      tableId += 1;
      const t = s.table;
      const n = t.num || tableId;
      const headRows = t.headerRows && t.headerRows.length ? t.headerRows : [(t.headers || []).map((h) => ({ text: h }))];
      const bodyRows = t.bodyRows && t.bodyRows.length ? t.bodyRows : (t.rows || []).map((r) => r.map((c) => ({ text: c })));
      const cell = (tag: 'th' | 'td', c: { text: string; colSpan?: number; rowSpan?: number }) =>
        `<${tag}${c.colSpan && c.colSpan > 1 ? ` colspan="${c.colSpan}"` : ''}${c.rowSpan && c.rowSpan > 1 ? ` rowspan="${c.rowSpan}"` : ''}>${inlineToJats(c.text)}</${tag}>`;
      out.push(
        `<table-wrap id="${uniqueId(`tbl${n}`)}"><label>Bảng ${n}</label><caption><p>${inlineToJats(stripCaptionLabel(t.caption))}</p></caption>` +
          tableXml(headRows, bodyRows, cell) +
          (t.source ? `<table-wrap-foot><p>${xmlEscape(t.source)}</p></table-wrap-foot>` : '') +
          `</table-wrap>`
      );
    }
  });
  closeTo(0);
  return out.join('\n');
}

export function exportToJatsXml(paper: CompletePaper, opts: JatsOptions = {}): string {
  usedIds = new Set<string>();
  knownRefs = new Set((paper.references || []).map((r) => r.id));
  // reserve R<n> first so duplicated numbers cannot steal a citation target
  const refsXmlIds = (paper.references || []).map((r) => ({ r, id: uniqueId(`R${r.id}`) }));
  const md = paper.metadata;
  const pubInfo = resolvePublication(md);
  const val = (v: string) => (hasPublicationValue(v) ? v.trim() : '');
  const doi = val(pubInfo.doi).replace(/^https?:\/\/doi\.org\//, '');
  const affByNumber = new Map<number, string>();
  const aff = (md.affiliations || [])
    .map((a) => {
      const id = uniqueId(`aff${a.id}`);
      if (!affByNumber.has(a.id)) affByNumber.set(a.id, id);
      return `<aff id="${id}"><institution>${xmlEscape(a.name)}</institution></aff>`;
    })
    .join('\n');
  const contribs = (md.authors || [])
    .map((a) => {
      const { surname, given } = splitName(a.name);
      return (
        `<contrib contrib-type="author"${a.isCorresponding ? ' corresp="yes"' : ''}>` +
        `<name><surname>${xmlEscape(surname)}</surname><given-names>${xmlEscape(given)}</given-names></name>` +
        (a.orcid ? `<contrib-id contrib-id-type="orcid">${xmlEscape(a.orcid)}</contrib-id>` : '') +
        (a.email ? `<email>${xmlEscape(a.email)}</email>` : '') +
        (a.affiliationIds || []).filter((id) => affByNumber.has(id)).map((id) => `<xref ref-type="aff" rid="${affByNumber.get(id)}"/>`).join('') +
        `</contrib>`
      );
    })
    .join('\n');

  const dateEl = (type: string, v?: string) => {
    const m = (v || '').trim().match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
    return m
      ? `<date date-type="${type}"><day>${m[1].padStart(2, '0')}</day><month>${m[2].padStart(2, '0')}</month><year>${m[3]}</year></date>`
      : '';
  };
  const history = [dateEl('received', md.dates?.received), dateEl('rev-recd', md.dates?.revised), dateEl('accepted', md.dates?.accepted)]
    .filter(Boolean)
    .join('');
  const pub = dateEl('pub', val(pubInfo.published)).replace('<date date-type="pub">', '<pub-date pub-type="epub">').replace('</date>', '</pub-date>');

  const refs = refsXmlIds
    .map(({ r, id }) => `<ref id="${id}"><label>${r.id}</label><mixed-citation>${xmlEscape(r.raw)}</mixed-citation></ref>`)
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE article PUBLIC "-//NLM//DTD JATS (Z39.96) Journal Archiving and Interchange DTD v1.2 20190208//EN" "JATS-archivearticle1.dtd">
<article xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:mml="http://www.w3.org/1998/Math/MathML" dtd-version="1.2" article-type="${xmlEscape(articleTypeJats(md))}" xml:lang="vi">
<front>
<journal-meta>
<journal-id journal-id-type="publisher-id">${xmlEscape(md.journalId)}</journal-id>
<journal-title-group><journal-title>${xmlEscape(md.journalName)}</journal-title>${md.journalAbbv ? `<abbrev-journal-title>${xmlEscape(md.journalAbbv)}</abbrev-journal-title>` : ''}</journal-title-group>
<publisher><publisher-name>ĐHQG TP.HCM</publisher-name></publisher>
</journal-meta>
<article-meta>
${doi ? `<article-id pub-id-type="doi">${xmlEscape(doi)}</article-id>` : ''}
<title-group><article-title>${inlineToJats(md.title)}</article-title>${md.titleEn ? `<trans-title-group xml:lang="en"><trans-title>${xmlEscape(md.titleEn)}</trans-title></trans-title-group>` : ''}</title-group>
<contrib-group>
${contribs}
</contrib-group>
${aff}
${pub}
${val(pubInfo.volume) ? `<volume>${xmlEscape(val(pubInfo.volume))}</volume>` : ''}
${val(pubInfo.issue) ? `<issue>${xmlEscape(val(pubInfo.issue))}</issue>` : ''}
${val(pubInfo.firstPage) ? `<fpage>${xmlEscape(val(pubInfo.firstPage))}</fpage>` : ''}${val(pubInfo.lastPage) ? `<lpage>${xmlEscape(val(pubInfo.lastPage))}</lpage>` : ''}
${history ? `<history>${history}</history>` : ''}
<abstract><p>${inlineToJats(md.abstract || '')}</p></abstract>
${md.abstractEn ? `<trans-abstract xml:lang="en"><p>${xmlEscape(md.abstractEn)}</p></trans-abstract>` : ''}
<kwd-group kwd-group-type="author">${(md.keywords || []).map((k) => `<kwd>${xmlEscape(k)}</kwd>`).join('')}</kwd-group>
</article-meta>
</front>
<body>
${bodyToJats(paper, opts)}
</body>
<back>
<ref-list><title>Tài liệu tham khảo</title>
${refs}
</ref-list>
</back>
</article>
`;
}
