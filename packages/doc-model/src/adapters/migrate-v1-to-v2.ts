import type {
  Manuscript,
  Section,
  Block,
  Cell,
  TableBlock,
  FigureBlock,
  ParagraphBlock,
  Reference,
  Author,
  Affiliation,
  AssetMeta,
} from '../types';
import type { IdGenerator } from '../utils';
import { UlidIdGenerator } from '../utils';
import type { V1CompletePaper, V1PaperSection } from './types';
import {
  parseTextWithCitations,
  computeSha256,
  extractMimeType,
  mimeToExt,
} from './text-citation-utils';

/**
 * Migrates a legacy StructPaper v1 CompletePaper into a clean v2 Manuscript.
 */
export function migrateV1toV2(
  v1Paper: V1CompletePaper | any,
  idGen?: IdGenerator
): Manuscript {
  const gen = idGen || new UlidIdGenerator();
  const docId = v1Paper.id || gen.nextId('doc');

  // Determine primary language
  let lang: 'vi' | 'en' = 'vi';
  const articleTypeStr = (v1Paper.metadata?.articleType || '').toLowerCase();
  const templateIdStr = (v1Paper.templateId || '').toLowerCase();
  if (articleTypeStr.includes('english') || templateIdStr.includes('en')) {
    lang = 'en';
  } else if (
    v1Paper.metadata?.title &&
    !/[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(
      v1Paper.metadata.title
    ) &&
    v1Paper.metadata.titleEn &&
    v1Paper.metadata.titleEn === v1Paper.metadata.title
  ) {
    lang = 'en';
  }

  // 1. References Mapping
  const refIdMap = new Map<number, string>();
  const references: Reference[] = (v1Paper.references || []).map((ref: any) => {
    const v2Id = gen.nextId('ref');
    const rawId = typeof ref.id === 'number' ? ref.id : parseInt(String(ref.id), 10);
    if (!isNaN(rawId)) {
      refIdMap.set(rawId, v2Id);
    }

    const csl: Record<string, unknown> = {
      _v1Id: ref.id,
    };
    if (ref.title) csl.title = ref.title;
    if (ref.authors) csl.author = [{ literal: ref.authors }];
    if (ref.journal) csl['container-title'] = ref.journal;
    if (ref.year) {
      const parsedYr = parseInt(ref.year, 10);
      if (!isNaN(parsedYr)) {
        csl.issued = { 'date-parts': [[parsedYr]] };
      }
    }
    if (ref.doi) csl.DOI = ref.doi;

    const parseStatus: 'ok' | 'partial' | 'failed' =
      ref.title && ref.authors ? 'ok' : ref.raw ? 'partial' : 'failed';

    return {
      id: v2Id,
      raw: ref.raw || '',
      doi: ref.doi || undefined,
      csl,
      parse: parseStatus,
    };
  });

  // 2. Affiliations Mapping
  const affIdMap = new Map<number, string>();
  const affiliations: Affiliation[] = (v1Paper.metadata?.affiliations || []).map(
    (aff: any, idx: number) => {
      const v2AffId = gen.nextId('aff');
      const numericId = typeof aff.id === 'number' ? aff.id : idx + 1;
      affIdMap.set(numericId, v2AffId);

      return {
        id: v2AffId,
        institution: aff.name || aff.institution || `Đơn vị ${numericId}`,
        department: aff.nameEn || aff.department || undefined,
      };
    }
  );

  // 3. Authors Mapping
  const authors: Author[] = (v1Paper.metadata?.authors || []).map((auth: any) => {
    const v2AuthorId = auth.id || gen.nextId('author');
    const affiliationIds: string[] = (auth.affiliationIds || []).map((id: number) => {
      return affIdMap.get(id) || String(id);
    });

    let isCorresponding = Boolean(auth.isCorresponding);
    let email = auth.email;

    if (
      v1Paper.metadata?.corresponding?.name &&
      auth.name &&
      auth.name.trim().toLowerCase() === v1Paper.metadata.corresponding.name.trim().toLowerCase()
    ) {
      isCorresponding = true;
      if (!email && v1Paper.metadata.corresponding.email) {
        email = v1Paper.metadata.corresponding.email;
      }
    }

    return {
      id: v2AuthorId,
      name: auth.name || '',
      affiliationIds,
      email: email || undefined,
      isCorresponding: isCorresponding || undefined,
      orcid: auth.orcid || undefined,
    };
  });

  // 4. FrontMatter
  const title = parseTextWithCitations(v1Paper.metadata?.title || '', refIdMap, gen);
  const translations: Record<string, any> = {};
  if (v1Paper.metadata?.titleEn) {
    translations.en = parseTextWithCitations(v1Paper.metadata.titleEn, refIdMap, gen);
  }

  const rawAbstract = v1Paper.metadata?.abstract || '';
  const abstractParagraphs = rawAbstract
    ? rawAbstract
        .split(/\n\s*\n|\n/)
        .map((p: string) => p.trim())
        .filter((p: string) => p.length > 0)
        .map((p: string) => parseTextWithCitations(p, refIdMap, gen))
    : [];

  const abstract = abstractParagraphs.length > 0 ? abstractParagraphs : [[{ t: 'text' as const, v: '' }]];

  const dates = {
    received: v1Paper.metadata?.dates?.received || undefined,
    revised: v1Paper.metadata?.dates?.revised || undefined,
    accepted: v1Paper.metadata?.dates?.accepted || undefined,
    published: v1Paper.metadata?.dates?.published || undefined,
  };

  const pages: [number, number] | undefined =
    v1Paper.metadata?.firstPage && v1Paper.metadata?.lastPage
      ? [Number(v1Paper.metadata.firstPage), Number(v1Paper.metadata.lastPage)]
      : undefined;

  // 5. Assets Dictionary
  const assets: Record<string, AssetMeta> = {};

  // 6. Body Sections Assembly
  const body: Section[] = [];
  let currentH1: Section | null = null;
  let currentH2: Section | null = null;
  let currentH3: Section | null = null;

  function addBlockToCurrent(block: Block): void {
    const target = currentH3 || currentH2 || currentH1;
    if (target) {
      target.blocks.push(block);
    } else {
      currentH1 = {
        id: gen.nextId('sec'),
        level: 1,
        title: [],
        blocks: [block],
        children: [],
      };
      body.push(currentH1);
    }
  }

  for (const sec of v1Paper.sections || []) {
    switch (sec.type) {
      case 'h1': {
        const secTitle = parseTextWithCitations(sec.title || sec.content || '', refIdMap, gen);
        currentH1 = {
          id: sec.id || gen.nextId('sec'),
          level: 1,
          title: secTitle,
          blocks: [],
          children: [],
        };
        body.push(currentH1);
        currentH2 = null;
        currentH3 = null;
        if (sec.title && sec.content && sec.content.trim()) {
          currentH1.blocks.push({
            type: 'paragraph',
            id: gen.nextId('p'),
            content: parseTextWithCitations(sec.content, refIdMap, gen),
          });
        }
        break;
      }
      case 'h2': {
        const secTitle = parseTextWithCitations(sec.title || sec.content || '', refIdMap, gen);
        const h2Sec: Section = {
          id: sec.id || gen.nextId('sec'),
          level: 2,
          title: secTitle,
          blocks: [],
          children: [],
        };
        if (currentH1) {
          currentH1.children.push(h2Sec);
        } else {
          currentH1 = {
            id: gen.nextId('sec'),
            level: 1,
            title: [],
            blocks: [],
            children: [h2Sec],
          };
          body.push(currentH1);
        }
        currentH2 = h2Sec;
        currentH3 = null;
        if (sec.title && sec.content && sec.content.trim()) {
          currentH2.blocks.push({
            type: 'paragraph',
            id: gen.nextId('p'),
            content: parseTextWithCitations(sec.content, refIdMap, gen),
          });
        }
        break;
      }
      case 'h3': {
        const secTitle = parseTextWithCitations(sec.title || sec.content || '', refIdMap, gen);
        const h3Sec: Section = {
          id: sec.id || gen.nextId('sec'),
          level: 3,
          title: secTitle,
          blocks: [],
          children: [],
        };
        if (currentH2) {
          currentH2.children.push(h3Sec);
        } else if (currentH1) {
          currentH1.children.push(h3Sec);
        } else {
          currentH1 = {
            id: gen.nextId('sec'),
            level: 1,
            title: [],
            blocks: [],
            children: [h3Sec],
          };
          body.push(currentH1);
        }
        currentH3 = h3Sec;
        if (sec.title && sec.content && sec.content.trim()) {
          currentH3.blocks.push({
            type: 'paragraph',
            id: gen.nextId('p'),
            content: parseTextWithCitations(sec.content, refIdMap, gen),
          });
        }
        break;
      }
      case 'figure': {
        const fig = sec.figure || {};
        const src = fig.src || '';
        const sha256 = computeSha256(src || fig.id || sec.id || gen.nextId('fig_asset'));
        const mimeType = extractMimeType(src);
        const ext = mimeToExt(mimeType);

        assets[sha256] = {
          id: sha256,
          sha256,
          mimeType,
          fileName: `figure-${fig.num || 1}.${ext}`,
        };

        const captionText = fig.caption || sec.content || '';
        const caption = parseTextWithCitations(captionText, refIdMap, gen);
        const source = fig.source ? parseTextWithCitations(fig.source, refIdMap, gen) : undefined;

        const figBlock: FigureBlock = {
          type: 'figure',
          id: fig.id || sec.id || gen.nextId('fig'),
          assetId: sha256,
          caption,
          source,
          layout: {
            columnSpan: fig.columnSpan || (fig.isFullWidth ? '2-column' : '1-column'),
            alignment: fig.alignment,
            scalePercent: fig.scalePercent,
            placement: fig.placement,
            hasBorder: fig.hasBorder,
            originalSrc: src,
            figNum: fig.num,
          },
        };
        addBlockToCurrent(figBlock);
        break;
      }
      case 'table': {
        const tbl = sec.table || {};
        const captionText = tbl.caption || sec.content || '';
        const caption = parseTextWithCitations(captionText, refIdMap, gen);

        let grid: Cell[][] = [];
        let headerRowsCount = 0;

        if (tbl.headerRows && tbl.headerRows.length > 0) {
          headerRowsCount = tbl.headerRows.length;
          const headerCells: Cell[][] = tbl.headerRows.map((row: any[]) =>
            row.map((c: any) => ({
              content: parseTextWithCitations(c.text || '', refIdMap, gen),
              rowSpan: c.rowSpan || 1,
              colSpan: c.colSpan || 1,
              align: c.align === 'center' ? 'c' : c.align === 'right' ? 'r' : 'l',
              header: true,
            }))
          );
          const bodyCells: Cell[][] = (tbl.bodyRows || []).map((row: any[]) =>
            row.map((c: any) => ({
              content: parseTextWithCitations(c.text || '', refIdMap, gen),
              rowSpan: c.rowSpan || 1,
              colSpan: c.colSpan || 1,
              align: c.align === 'center' ? 'c' : c.align === 'right' ? 'r' : 'l',
              header: false,
            }))
          );
          grid = [...headerCells, ...bodyCells];
        } else if (tbl.headers && tbl.headers.length > 0) {
          headerRowsCount = 1;
          const headerRow: Cell[] = tbl.headers.map((h: string) => ({
            content: parseTextWithCitations(h || '', refIdMap, gen),
            rowSpan: 1,
            colSpan: 1,
            align: 'l' as const,
            header: true,
          }));
          const bodyRows: Cell[][] = (tbl.rows || []).map((row: string[]) =>
            row.map((cellText: string) => ({
              content: parseTextWithCitations(cellText || '', refIdMap, gen),
              rowSpan: 1,
              colSpan: 1,
              align: 'l' as const,
              header: false,
            }))
          );
          grid = [headerRow, ...bodyRows];
        } else if (tbl.rows && tbl.rows.length > 0) {
          grid = tbl.rows.map((row: string[]) =>
            row.map((cellText: string) => ({
              content: parseTextWithCitations(cellText || '', refIdMap, gen),
              rowSpan: 1,
              colSpan: 1,
              align: 'l' as const,
              header: false,
            }))
          );
        }

        const tableBlock: TableBlock = {
          type: 'table',
          id: tbl.id || sec.id || gen.nextId('tbl'),
          caption,
          source: tbl.source ? parseTextWithCitations(tbl.source, refIdMap, gen) : undefined,
          grid,
          headerRows: headerRowsCount,
          layout: {
            columnSpan: tbl.columnSpan || (tbl.isFullWidth ? '2-column' : '1-column'),
            isRotated: tbl.isRotated,
            fontSize: tbl.fontSize,
            rowStretch: tbl.rowStretch,
            hasZebraStripes: tbl.hasZebraStripes,
            placement: tbl.placement,
            breakAcrossPages: tbl.breakAcrossPages,
            bodyFill: tbl.bodyFill,
            tblNum: tbl.num,
          },
        };
        addBlockToCurrent(tableBlock);
        break;
      }
      case 'equation': {
        addBlockToCurrent({
          type: 'equation',
          id: sec.id || gen.nextId('eq'),
          latex: sec.equation?.latex || '',
          omml: sec.equation?.omml,
          numbered: sec.equation?.numbered ?? true,
          status: 'ok',
        });
        break;
      }
      case 'quote': {
        addBlockToCurrent({
          type: 'quote',
          id: sec.id || gen.nextId('quote'),
          content: [
            {
              type: 'paragraph',
              id: gen.nextId('p'),
              content: parseTextWithCitations(sec.content || '', refIdMap, gen),
            },
          ],
        });
        break;
      }
      case 'box':
      case 'citation': {
        addBlockToCurrent({
          type: 'box',
          id: sec.id || gen.nextId('box'),
          content: [
            {
              type: 'paragraph',
              id: gen.nextId('p'),
              content: parseTextWithCitations(sec.content || '', refIdMap, gen),
            },
          ],
        });
        break;
      }
      case 'paragraph':
      default: {
        const pBlock: ParagraphBlock = {
          type: 'paragraph',
          id: sec.id || gen.nextId('p'),
          content: parseTextWithCitations(sec.content || '', refIdMap, gen),
        };
        addBlockToCurrent(pBlock);
        break;
      }
    }
  }

  return {
    schemaVersion: 2,
    id: docId,
    lang,
    journalId: v1Paper.metadata?.journalId || 'VNUHCM-HS',
    articleType: v1Paper.metadata?.articleType || 'Bài báo nghiên cứu',
    meta: {
      title,
      translations: Object.keys(translations).length > 0 ? translations : undefined,
      authors,
      affiliations,
      abstract,
      keywords: Array.isArray(v1Paper.metadata?.keywords) ? v1Paper.metadata.keywords : [],
      dates,
      doi: v1Paper.metadata?.doi || undefined,
      volume: v1Paper.metadata?.volume || undefined,
      issue: v1Paper.metadata?.issue || undefined,
      pages,
    },
    body,
    back: [],
    references,
    assets,
    layoutOverrides: {
      layoutSettings: v1Paper.layoutSettings,
      sectionExtras: collectSectionExtras(v1Paper.sections),
      publication: (v1Paper.metadata as any)?.publication,
      titleOriginal: (v1Paper.metadata as any)?.titleOriginal,
      articleTypeEn: (v1Paper.metadata as any)?.articleTypeEn,
      templateId: v1Paper.templateId,
      templateName: v1Paper.templateName,
      status: v1Paper.status,
    },
  };
}

/**
 * Per-section options the v2 tree has no slot for (page-layout markers, page break, the number and
 * width of a formula). Stored by section id in `layoutOverrides.sectionExtras`, restored by adaptV2toV1.
 */
function collectSectionExtras(sections: V1PaperSection[] | undefined): Record<string, Record<string, unknown>> | undefined {
  const out: Record<string, Record<string, unknown>> = {};
  for (const sec of sections || []) {
    const e: Record<string, unknown> = {};
    if (sec.pageLayout) e.pageLayout = sec.pageLayout;
    if (sec.pageBreakAfter) e.pageBreakAfter = true;
    if (sec.equation?.num !== undefined) e.eqNum = sec.equation.num;
    if (sec.equation?.columnSpan) e.eqSpan = sec.equation.columnSpan;
    if (Object.keys(e).length > 0) out[sec.id] = e;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}
