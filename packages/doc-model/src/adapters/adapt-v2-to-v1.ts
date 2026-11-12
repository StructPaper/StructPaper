import type {
  Manuscript,
  Section,
  Block,
  Cell,
  Inline,
} from '../types';
import { computeNumbering } from '../numbering';
import type {
  V1CompletePaper,
  V1PaperMetadata,
  V1Author,
  V1Affiliation,
  V1PaperSection,
  V1PaperReference,
  V1TableCell,
} from './types';
import { inlineToPlainText } from './text-citation-utils';

function countCitationsAcrossManuscript(doc: Manuscript, targetRefId: string): number {
  let count = 0;

  function scanInlines(inlines?: Inline[]) {
    if (!inlines) return;
    for (const il of inlines) {
      if (il.t === 'cite' && il.refIds.includes(targetRefId)) {
        count++;
      } else if (il.t === 'link' && il.content) {
        scanInlines(il.content);
      }
    }
  }

  function scanBlocks(blocks?: Block[]) {
    if (!blocks) return;
    for (const b of blocks) {
      if (b.type === 'paragraph') scanInlines(b.content);
      else if (b.type === 'figure') {
        scanInlines(b.caption);
        scanInlines(b.source);
      } else if (b.type === 'table') {
        scanInlines(b.caption);
        scanInlines(b.source);
        scanInlines(b.notes);
        if (b.grid) {
          for (const row of b.grid) {
            for (const cell of row) {
              scanInlines(cell.content);
            }
          }
        }
      } else if (b.type === 'quote' || b.type === 'box') {
        scanBlocks(b.content);
      }
    }
  }

  function scanSections(sections?: Section[]) {
    if (!sections) return;
    for (const s of sections) {
      scanInlines(s.title);
      scanBlocks(s.blocks);
      scanSections(s.children);
    }
  }

  scanSections(doc.body);
  return count;
}

/**
 * Converts a v2 Manuscript back to a legacy v1 CompletePaper.
 */
export function adaptV2toV1(v2Doc: Manuscript): V1CompletePaper {
  const numbering = computeNumbering(v2Doc);

  // 1. Build ref ID to numeric ID map
  const refMap = new Map<string, number>();
  let nextUncitedNum = numbering.citationOrder.length + 1;

  for (const ref of v2Doc.references) {
    if (numbering.citations.has(ref.id)) {
      refMap.set(ref.id, numbering.citations.get(ref.id)!);
    } else {
      const v1Id = (ref.csl as any)?._v1Id;
      if (typeof v1Id === 'number') {
        refMap.set(ref.id, v1Id);
      } else {
        refMap.set(ref.id, nextUncitedNum++);
      }
    }
  }

  // 2. References
  const references: V1PaperReference[] = v2Doc.references.map((ref) => {
    const numId = refMap.get(ref.id) || 1;
    const isCited = numbering.citations.has(ref.id);
    const count = isCited ? countCitationsAcrossManuscript(v2Doc, ref.id) : 0;

    let authorStr: string | undefined;
    const cslAuthors = (ref.csl as any)?.author;
    if (Array.isArray(cslAuthors)) {
      authorStr = cslAuthors
        .map((a: any) => a.literal || a.name || `${a.family || ''} ${a.given || ''}`.trim())
        .filter(Boolean)
        .join(', ');
    }

    let yearStr: string | undefined;
    const cslIssued = (ref.csl as any)?.issued?.['date-parts']?.[0]?.[0];
    if (cslIssued) {
      yearStr = String(cslIssued);
    }

    return {
      id: numId,
      raw: ref.raw,
      title: (ref.csl as any)?.title,
      authors: authorStr,
      journal: (ref.csl as any)?.['container-title'],
      year: yearStr,
      doi: ref.doi || (ref.csl as any)?.DOI,
      isCited,
      citationCount: count,
    };
  });
  references.sort((a, b) => a.id - b.id);

  // 3. Affiliations
  const affIdMap = new Map<string, number>();
  const affiliations: V1Affiliation[] = (v2Doc.meta.affiliations || []).map((aff, index) => {
    const num = index + 1;
    affIdMap.set(aff.id, num);
    return {
      id: num,
      name: aff.institution,
      nameEn: aff.department,
    };
  });

  // 4. Authors
  const authors: V1Author[] = (v2Doc.meta.authors || []).map((auth, index) => {
    const affiliationIds = (auth.affiliationIds || []).map((id) => {
      if (affIdMap.has(id)) return affIdMap.get(id)!;
      const numMatch = id.match(/\d+/);
      return numMatch ? parseInt(numMatch[0], 10) : 1;
    });

    return {
      id: auth.id || `author_${index + 1}`,
      name: auth.name,
      affiliationIds,
      email: auth.email,
      isCorresponding: auth.isCorresponding,
      orcid: auth.orcid,
    };
  });

  // 5. Corresponding Author
  const corrAuthor = authors.find((a) => a.isCorresponding);
  let corrAffName = '';
  if (corrAuthor && corrAuthor.affiliationIds.length > 0) {
    const matchedAff = affiliations.find((af) => af.id === corrAuthor.affiliationIds[0]);
    if (matchedAff) corrAffName = matchedAff.name;
  }

  // 6. Metadata
  const metadata: V1PaperMetadata = {
    title: inlineToPlainText(v2Doc.meta.title, numbering, refMap),
    titleEn: v2Doc.meta.translations?.en
      ? inlineToPlainText(v2Doc.meta.translations.en as Inline[], numbering, refMap)
      : undefined,
    articleType: v2Doc.articleType,
    journalId: v2Doc.journalId,
    journalName: 'Tạp chí Phát triển Khoa học & Công nghệ – Health Sciences',
    journalAbbv: 'Sci. Tech. Dev. J. - Health Sci.',
    authors,
    affiliations,
    corresponding: {
      name: corrAuthor?.name || '',
      email: corrAuthor?.email || '',
      affiliation: corrAffName,
    },
    abstract: (v2Doc.meta.abstract || [])
      .map((p) => inlineToPlainText(p, numbering, refMap))
      .filter((p) => p.length > 0)
      .join('\n\n'),
    keywords: v2Doc.meta.keywords || [],
    dates: {
      received: v2Doc.meta.dates?.received || '',
      revised: v2Doc.meta.dates?.revised || '',
      accepted: v2Doc.meta.dates?.accepted || '',
      published: v2Doc.meta.dates?.published || '',
    },
    doi: v2Doc.meta.doi || '',
    volume: v2Doc.meta.volume || '1',
    issue: v2Doc.meta.issue || '1',
    year: v2Doc.meta.dates?.published
      ? new Date(v2Doc.meta.dates.published).getFullYear().toString()
      : '2026',
    firstPage: v2Doc.meta.pages?.[0] ?? 1,
    lastPage: v2Doc.meta.pages?.[1] ?? 1,
  };

  // 7. Flatten Body Sections
  const sections: V1PaperSection[] = [];
  let equationCounter = 0;

  function flattenSection(sec: Section) {
    const titleText = inlineToPlainText(sec.title, numbering, refMap);
    if (titleText.length > 0) {
      sections.push({
        id: sec.id,
        type: sec.level === 1 ? 'h1' : sec.level === 2 ? 'h2' : 'h3',
        title: titleText,
        content: '',
      });
    }

    for (const block of sec.blocks || []) {
      switch (block.type) {
        case 'paragraph': {
          sections.push({
            id: block.id,
            type: 'paragraph',
            content: inlineToPlainText(block.content, numbering, refMap),
          });
          break;
        }
        case 'figure': {
          const figNum = numbering.figures.get(block.id) || (block.layout as any)?.figNum || 1;
          const src =
            (block.layout as any)?.originalSrc ||
            v2Doc.assets[block.assetId]?.fileName ||
            block.assetId;
          const caption = inlineToPlainText(block.caption, numbering, refMap);
          const source = block.source
            ? inlineToPlainText(block.source, numbering, refMap)
            : undefined;

          sections.push({
            id: block.id,
            type: 'figure',
            content: caption,
            figure: {
              id: block.id,
              num: figNum,
              caption,
              src,
              source,
              columnSpan: (block.layout as any)?.columnSpan || '1-column',
              isFullWidth: (block.layout as any)?.columnSpan === '2-column',
              alignment: (block.layout as any)?.alignment,
              scalePercent: (block.layout as any)?.scalePercent,
              placement: (block.layout as any)?.placement,
              hasBorder: (block.layout as any)?.hasBorder,
            },
          });
          break;
        }
        case 'table': {
          const tblNum = numbering.tables.get(block.id) || (block.layout as any)?.tblNum || 1;
          const caption = inlineToPlainText(block.caption, numbering, refMap);

          let headers: string[] = [];
          let rows: string[][] = [];
          let headerRows: V1TableCell[][] = [];
          let bodyRows: V1TableCell[][] = [];

          if (block.grid && block.grid.length > 0) {
            const hCount = block.headerRows || 0;
            if (hCount > 0 && block.grid.length >= hCount) {
              headers = block.grid[0].map((c) => inlineToPlainText(c.content, numbering, refMap));
              rows = block.grid
                .slice(hCount)
                .map((row) => row.map((c) => inlineToPlainText(c.content, numbering, refMap)));
              headerRows = block.grid.slice(0, hCount).map((row) =>
                row.map((c) => ({
                  text: inlineToPlainText(c.content, numbering, refMap),
                  rowSpan: c.rowSpan,
                  colSpan: c.colSpan,
                  align: c.align === 'c' ? 'center' : c.align === 'r' ? 'right' : 'left',
                  isHeader: true,
                }))
              );
              bodyRows = block.grid.slice(hCount).map((row) =>
                row.map((c) => ({
                  text: inlineToPlainText(c.content, numbering, refMap),
                  rowSpan: c.rowSpan,
                  colSpan: c.colSpan,
                  align: c.align === 'c' ? 'center' : c.align === 'r' ? 'right' : 'left',
                  isHeader: false,
                }))
              );
            } else {
              rows = block.grid.map((row) =>
                row.map((c) => inlineToPlainText(c.content, numbering, refMap))
              );
              bodyRows = block.grid.map((row) =>
                row.map((c) => ({
                  text: inlineToPlainText(c.content, numbering, refMap),
                  rowSpan: c.rowSpan,
                  colSpan: c.colSpan,
                  align: c.align === 'c' ? 'center' : c.align === 'r' ? 'right' : 'left',
                  isHeader: false,
                }))
              );
            }
          }

          sections.push({
            id: block.id,
            type: 'table',
            content: caption,
            table: {
              id: block.id,
              num: tblNum,
              caption,
              source: block.source ? inlineToPlainText(block.source, numbering, refMap) : undefined,
              headers,
              rows,
              headerRows: headerRows.length > 0 ? headerRows : undefined,
              bodyRows: bodyRows.length > 0 ? bodyRows : undefined,
              columnSpan: (block.layout as any)?.columnSpan || '1-column',
              isFullWidth: (block.layout as any)?.columnSpan === '2-column',
              isRotated: (block.layout as any)?.isRotated,
              fontSize: (block.layout as any)?.fontSize,
              rowStretch: (block.layout as any)?.rowStretch,
              hasZebraStripes: (block.layout as any)?.hasZebraStripes,
              placement: (block.layout as any)?.placement,
              breakAcrossPages: (block.layout as any)?.breakAcrossPages,
              bodyFill: (block.layout as any)?.bodyFill,
            },
          });
          break;
        }
        case 'quote': {
          const innerText = block.content
            ? block.content
                .filter((b) => b.type === 'paragraph')
                .map((b) => inlineToPlainText((b as any).content, numbering, refMap))
                .join('\n\n')
            : '';
          sections.push({
            id: block.id,
            type: 'quote',
            content: innerText,
          });
          break;
        }
        case 'box': {
          const innerText = block.content
            ? block.content
                .filter((b) => b.type === 'paragraph')
                .map((b) => inlineToPlainText((b as any).content, numbering, refMap))
                .join('\n\n')
            : '';
          sections.push({
            id: block.id,
            type: 'box',
            content: innerText,
          });
          break;
        }
        case 'equation': {
          sections.push({
            id: block.id,
            type: 'equation',
            content: '',
            equation: {
              latex: block.latex,
              omml: block.omml,
              numbered: block.numbered,
              num: block.numbered ? ++equationCounter : undefined,
            },
          });
          break;
        }
      }
    }

    for (const child of sec.children || []) {
      flattenSection(child);
    }
  }

  for (const rootSec of v2Doc.body || []) {
    flattenSection(rootSec);
  }

  // publication data ("?"/blank semantics) is kept in layoutOverrides
  const publication = v2Doc.layoutOverrides?.publication as Record<string, string> | undefined;
  if (publication) (metadata as any).publication = publication;
  // Restore the per-section options kept aside by migrateV1toV2 (page layout, page break, formula number/width)
  const extras = (v2Doc.layoutOverrides?.sectionExtras || {}) as Record<string, Record<string, any>>;
  for (const sec of sections) {
    const e = extras[sec.id];
    if (!e) continue;
    if (e.pageLayout) sec.pageLayout = e.pageLayout;
    if (e.pageBreakAfter) sec.pageBreakAfter = true;
    if (sec.equation) {
      if (e.eqNum !== undefined && sec.equation.numbered) sec.equation.num = e.eqNum;
      if (e.eqSpan) sec.equation.columnSpan = e.eqSpan;
    }
  }
  const titleOriginal = v2Doc.layoutOverrides?.titleOriginal as string | undefined;
  if (titleOriginal) (metadata as any).titleOriginal = titleOriginal;
  const articleTypeEn = v2Doc.layoutOverrides?.articleTypeEn as string | undefined;
  if (articleTypeEn) (metadata as any).articleTypeEn = articleTypeEn;

  return {
    id: v2Doc.id,
    metadata,
    sections,
    references,
    layoutSettings: (v2Doc.layoutOverrides?.layoutSettings as any) || undefined,
    templateId: (v2Doc.layoutOverrides?.templateId as string) || undefined,
    templateName: (v2Doc.layoutOverrides?.templateName as string) || undefined,
    status: (v2Doc.layoutOverrides?.status as any) || undefined,
  };
}
