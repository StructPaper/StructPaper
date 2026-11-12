import { Document, Packer, Paragraph, SectionType, type ISectionOptions } from 'docx';
import type { CompletePaper, PaperMetadata } from '@/types/paper';
import { resolveTheme } from './theme-config';
import { getJournalTemplate } from './templates';
import { hasPublicationValue, resolvePublication, UNKNOWN } from './publication';
import { hasEnglishPageContent, toAsciiName } from './latex-english-page';
import { articleTypeEnglish } from './article-types';
import { collectExportAssets, defaultImageLoader, type ImageLoader } from './docx-export-assets';
import { buildFrontMatter, buildHeadersFooters, FONT_SANS, FONT_SERIF, type FrontMatter } from './docx-export-front';
import { pageFor, segmentSections } from './docx-export-layout';
import { buildBody } from './docx-export-body';

/**
 * Word export laid out like the printed journal (same page size, margins and look as the PDF):
 * page-1 header (journal line, Open Access, article type), title and authors, the side column
 * (QR from the DOI, affiliation, correspondence, history, DOI, "Check for updates", copyright) next
 * to the shaded abstract box, the citation box in the page-1 footer, a two-column body with
 * pictures, native Word equations and merged-cell tables, odd/even running headers and page
 * numbers from the issue's first page, and the closing English summary page.
 * Paragraph styles carry the template's names (ArticleTitle, Authors, Abstract, Keywords,
 * BodyText, TableCaption, FigureCaption, Equation, Reference …) so the file re-imports cleanly.
 */

/** dd/mm/yyyy, d-m-yyyy or yyyy-mm-dd -> dd-mm-yyyy; "?" when missing (as on the PDF). */
function journalDate(s?: string): string {
  const t = (s || '').trim();
  const a = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (a) return `${a[1].padStart(2, '0')}-${a[2].padStart(2, '0')}-${a[3]}`;
  const b = t.match(/^(\d{4})[/.-](\d{1,2})[/.-](\d{1,2})$/);
  if (b) return `${b[3].padStart(2, '0')}-${b[2].padStart(2, '0')}-${b[1]}`;
  return t || UNKNOWN;
}

/** "Long P T, Nguyên V T" (family name last in Vietnamese order, then initials). */
function citeAuthorList(md: PaperMetadata): string {
  return (md.authors || [])
    .map((a) => {
      const parts = (a.name || '').trim().split(/\s+/);
      const last = parts.pop() || '';
      return `${last} ${parts.map((p) => p[0]).join(' ')}`.trim();
    })
    .join(', ');
}

const cleanKeywords = (ks?: string[]) => (ks || []).map((k) => k.trim().replace(/[.;,]+$/, '')).filter(Boolean);

function frontMatterFor(paper: CompletePaper, lang: 'vi' | 'en'): FrontMatter {
  const md = paper.metadata;
  const tmpl = getJournalTemplate(md.journalId);
  const pub = resolvePublication(md);
  const year = md.year || String(new Date().getFullYear());
  const affs = md.affiliations || [];
  const multi = affs.length > 1;
  const en = lang === 'en';
  const name = (s: string) => (en ? toAsciiName(s) : s);
  const corrAuthor = (md.authors || []).find((a) => a.isCorresponding);
  const affName = (a: { name: string; nameEn?: string }) => (en ? a.nameEn || a.name : a.name || a.nameEn || '');
  const abbv = (tmpl.officialAbbvEn || md.journalAbbv || tmpl.shortName || '').replace(/\.$/, '');
  const published = hasPublicationValue(pub.published) ? journalDate(pub.published) : pub.published;
  return {
    lang,
    articleType: en ? articleTypeEnglish(md) : md.articleType || 'Bài nghiên cứu',
    title: (en ? md.titleEn : md.title) || '',
    authors: (md.authors || []).map((a) => {
      const aff = multi && a.affiliationIds?.length ? a.affiliationIds.join(',') : '';
      return { name: name(a.name), sup: [aff, a.isCorresponding ? '*' : ''].filter(Boolean).join(',') };
    }),
    affiliations: affs.map((a) => `${multi ? `${a.id} ` : ''}${affName(a)}`.trim()).filter(Boolean),
    corrName: name(md.corresponding?.name || corrAuthor?.name || ''),
    corrAffiliation: en ? affs[0]?.nameEn || md.corresponding?.affiliation || '' : md.corresponding?.affiliation || affs[0]?.name || '',
    corrEmail: (md.corresponding?.email || corrAuthor?.email || '').replace(/\.+$/, ''),
    dates: {
      received: journalDate(md.dates?.received),
      revised: journalDate(md.dates?.revised),
      accepted: journalDate(md.dates?.accepted),
      published,
    },
    doi: pub.doi,
    abstract: (en ? md.abstractEn : md.abstract) || '',
    keywords: cleanKeywords(en ? md.keywordsEn : md.keywords),
    cite: {
      authors: name(citeAuthorList(md)),
      title: (en ? md.titleEn : md.title) || '',
      journal: `${abbv}.`,
      tail: `${year}; ${pub.volume}(${pub.issue}):${pub.firstPage}-${pub.lastPage}.`,
    },
    journalLine: `${tmpl.officialNameEn || md.journalName || tmpl.name} ${year}, ${pub.volume}(${pub.issue}):${pub.firstPage}-${pub.lastPage}`,
  };
}

/** Named paragraph styles (ids follow the journal's Word template). */
function styles(color: string) {
  const p = (id: string, name: string, run: Record<string, unknown>, paragraph: Record<string, unknown> = {}) => ({
    id,
    name,
    basedOn: 'Normal',
    next: 'BodyText',
    quickFormat: true,
    run,
    paragraph,
  });
  const heading = (n: number, size: number, italics = false) =>
    p(`Heading${n}`, `heading ${n}`, { font: FONT_SANS, size, bold: true, italics, color }, { spacing: { before: n === 1 ? 240 : 180, after: 80 }, keepNext: true, outlineLevel: n - 1 });
  return {
    default: { document: { run: { font: FONT_SERIF, size: 18 }, paragraph: { spacing: { after: 0, line: 271 } } } },
    paragraphStyles: [
      p('ArticleTitle', 'Article Title', { font: FONT_SANS, size: 36, bold: true, color }, { spacing: { before: 120, after: 200 } }),
      p('Authors', 'Authors', { font: FONT_SANS, size: 22, bold: true, color }, { spacing: { after: 240 } }),
      p('SectionAbstract', 'Section Abstract', { font: FONT_SANS, size: 18, bold: true, color }, { spacing: { after: 60 } }),
      p('Abstract', 'Abstract', { font: FONT_SANS, size: 19 }, { spacing: { after: 0, line: 254 } }),
      p('Keywords', 'Keywords', { font: FONT_SANS, size: 19 }, { spacing: { before: 40 } }),
      p('BodyText', 'Body Text', { font: FONT_SERIF, size: 18 }, { spacing: { after: 0, line: 271 } }),
      heading(1, 24),
      heading(2, 20),
      heading(3, 20, true),
      p('TableCaption', 'Table Caption', { font: FONT_SANS, size: 17, bold: true }, { keepNext: true }),
      p('FigureCaption', 'Figure Caption', { font: FONT_SANS, size: 17 }, { spacing: { before: 80 } }),
      p('SourceLine', 'Source Line', { font: FONT_SANS, size: 15, italics: true }),
      p('Equation', 'Equation', { font: FONT_SERIF, size: 18 }, { spacing: { before: 100, after: 100 } }),
      p('SectionReferences', 'Section References', { font: FONT_SANS, size: 24, bold: true, color }, { spacing: { before: 240, after: 100 }, keepNext: true }),
      p('Reference', 'Reference', { font: FONT_SANS, size: 15 }, { spacing: { after: 20 } }),
    ],
  };
}

export interface DocxExportOptions {
  /** Loads picture bytes for figure src / artwork paths (defaults to data-URL decode + fetch). */
  loadImage?: ImageLoader;
}

export async function exportPaperToDocx(paper: CompletePaper, opts: DocxExportOptions = {}): Promise<Blob> {
  const theme = resolveTheme(paper.layoutSettings);
  const color = theme.titleColor.slice(1);
  const pub = resolvePublication(paper.metadata);
  const assets = await collectExportAssets(paper, pub.doi, opts.loadImage ?? defaultImageLoader);
  const vi = frontMatterFor(paper, 'vi');
  const firstPage = parseInt(pub.firstPage, 10);
  const page = pageFor(false);
  const ls = paper.layoutSettings;

  const segments = buildBody(paper.sections || [], paper.references || [], {
    theme,
    color,
    figures: assets.figures,
    lang: 'vi',
    refTitle: 'TÀI LIỆU THAM KHẢO',
    oneColumn: ls?.columnLayout === '1-column',
    landscape: ls?.orientation === 'landscape',
  });
  const hf = buildHeadersFooters(vi, color, assets.openAccess);
  const sections: ISectionOptions[] = [
    {
      properties: {
        titlePage: true,
        page: { ...page, pageNumbers: Number.isFinite(firstPage) && firstPage > 0 ? { start: firstPage } : undefined },
      },
      ...hf,
      children: buildFrontMatter(vi, color, assets),
    },
    ...segmentSections(segments),
  ];

  if (theme.englishSummaryPage && hasEnglishPageContent(paper.metadata)) {
    const en = frontMatterFor(paper, 'en');
    sections.push({
      properties: { type: SectionType.NEXT_PAGE, titlePage: true, page },
      ...buildHeadersFooters(en, color, assets.openAccess),
      children: [...buildFrontMatter(en, color, assets), new Paragraph({ children: [] })],
    });
  }

  const doc = new Document({
    creator: 'StructPaper',
    title: paper.metadata.title,
    evenAndOddHeaderAndFooters: true,
    styles: styles(color),
    sections,
  });
  return Packer.toBlob(doc);
}
