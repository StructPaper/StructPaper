import type { ThemeSettings, PaperEquation, PublicationInfo, SectionPageLayout } from './paper-extensions'; export type { ThemeSettings, PaperEquation, PublicationInfo, SectionPageLayout }; import type { Cell } from '@structpaper/doc-model';

export interface Author {
  id: string;
  name: string;
  affiliationIds: number[];
  isCorresponding?: boolean;
  email?: string;
  orcid?: string;
}

export type PaperAuthor = Author;

export interface Affiliation {
  id: number;
  name: string;
  nameEn?: string;
}

export type PaperAffiliation = Affiliation;

export interface PaperDates {
  received: string;
  revised: string;
  accepted: string;
  published: string;
}

export interface PaperMetadata {
  title: string;
  titleEn?: string;
  /** Language the first page is written in ('vi' | 'en'): found when the Word file is imported, changed with the title-bar language picker. */
  primaryLanguage?: 'vi' | 'en';
  /** How the appendices are set (see lib/appendix): where they go, turned or not, numbered 1,2,3 or A,B,C. */
  appendix?: { placement?: 'afterReferences' | 'beforeReferences' | 'inContent' | 'original';  numbering?: 'number' | 'letter' };
  /** Code of the article type in the paper's journal ("research"): the author's choice; the server applies that type's rules. */
  articleTypeCode?: string;
  articleType: string; // 'Bài tổng quan' | 'Bài báo nghiên cứu' | 'Báo cáo ca lâm sàng' | 'Research Article' | 'Review Article'
  journalId: string;
  journalName: string;
  journalAbbv: string;
  authors: Author[];
  affiliations: Affiliation[];
  corresponding: {
    name: string;
    email: string;
    affiliation: string;
  };
  abstract: string;
  abstractEn?: string;
  keywords: string[];
  keywordsEn?: string[];
  dates: PaperDates;
  doi: string;
  volume: string;
  issue: string;
  year: string;
  firstPage: number;
  lastPage: number;
  titleOriginal?: string; titleEnOriginal?: string; importNotes?: string[]; articleTypeEn?: string; publication?: PublicationInfo; // Word title before normalization (undo); "?" publication fields until entered
}

export interface PaperFigure {
  id: string;
  num: number;
  caption: string;
  src: string;
  source?: string;
  /** An appendix figure ("Phụ lục 4"): numbered on its own, apart from the figures of the text. */
  appendix?: boolean;
  /** 'full': the figure takes a page of its own across the whole width, over the side column (QR code, contact). */
  sideColumn?: 'auto' | 'text' | 'full';
  /** Turned on its side (only when the figure has a page of its own, see sideColumn). */
  isRotated?: boolean;
  isFullWidth?: boolean;
  columnSpan?: '1-column' | '2-column';
  scalePercent?: number; // 50 to 100
  alignment?: 'center' | 'left' | 'right';
  placement?: 'auto' | 'top' | 'here' | 'bottom';
  hasBorder?: boolean;
  assetId?: string; // SHA-256 asset reference from storage
}

export interface TableCell {
  /** The text; may carry <b>, <i>, <u> and <color=#rrggbb> tags (see lib/inline-markup). */
  text: string;
  colSpan?: number;
  rowSpan?: number;
  align?: 'left' | 'center' | 'right';
  isHeader?: boolean;
  /** Background of this cell as "#RRGGBB" (over the table's own fill). */
  fill?: string;
  /** Where the text stands in the height of the cell (default: top). */
  valign?: 'top' | 'middle' | 'bottom';
  /** The lines of this cell's four sides: 'line' draws one, 'none' leaves it out, whatever the table's own style says (absent: the table's style decides). */
  borders?: CellBorders;
}

export type CellBorderMode = 'line' | 'none';
export interface CellBorders {
  top?: CellBorderMode;
  bottom?: CellBorderMode;
  left?: CellBorderMode;
  right?: CellBorderMode;
}

/** How the lines of a table are drawn: the journal's (rules above and below), none, between rows, between columns, all, or the outline only. */
export type TableBorderStyle = 'journal' | 'none' | 'horizontal' | 'vertical' | 'grid' | 'outer';

export interface PaperTable {
  id: string;
  num: number;
  caption: string;
  /** What is printed under the table, one line per line typed ("Nguồn: Kết quả của nhóm tác giả", "Chú thích: …"). */
  source?: string;
  /** How those lines are set (absent: as the journal prints them: a note in italic, a source upright, to the left). */
  sourceStyle?: { bold?: boolean; italic?: boolean; align?: 'left' | 'center' | 'right' };
  headers: string[];
  rows: string[][];
  headerRows?: TableCell[][];
  bodyRows?: TableCell[][];
  grid?: Cell[][]; // Support new doc-model grid matrix
  isFullWidth?: boolean;
  columnSpan?: '1-column' | '2-column';
  isRotated?: boolean; // Xoay bảng 90 độ ngang (sidewaystable)
  /** Any size in points, as "8pt" or "8.5pt" (the table settings take a number). */
  fontSize?: `${number}pt`;
  rowStretch?: number; // Giãn dòng 1.1x, 1.4x, 1.6x
  hasZebraStripes?: boolean; // Sọc màu hàng xen kẽ
  placement?: 'auto' | 'top' | 'here' | 'bottom';
  breakAcrossPages?: 'auto' | 'always' | 'never'; // cho phép bảng ngắt qua trang
  /** A table that takes pages of its own: set within the text ('text'), or across the whole page, over the side column ('full'). 'auto' (default): as the printed journal does, a large table takes the whole page. */
  sideColumn?: 'auto' | 'text' | 'full';
  /** An appendix table ("Phụ lục 2"): numbered on its own, apart from the tables of the text, and set at the end of the paper. */
  appendix?: boolean;
  bodyFill?: 'plain' | 'zebra' | 'shaded'; // nền thân bảng: trắng (mặc định) / sọc / tô đều
  /** Lines of the table (default: the journal's). */
  borderStyle?: TableBorderStyle;
  /** Colour of the lines, "#RRGGBB" (default black). */
  borderColor?: string;
  /** Thickness of the lines in points (default 0.4). */
  borderWidth?: number;
  /** Least height in points of each body row (null/absent: as the text needs). */
  rowHeights?: Array<number | null>;
  /** Least height in points of the header rows. */
  headerHeight?: number;
  /** How much of the room (the column, the text, the page) the table takes, in percent (absent: all of it). The columns share this width. */
  widthPercent?: number;
  /** Where a table narrower than its room stands (absent: in the middle). */
  tableAlign?: 'left' | 'center' | 'right';
  /** Relative width of each column (absent: worked out from the text). */
  colWeights?: number[];
  /** Colour of the header band, "#RRGGBB" (default: the theme's). */
  headerFill?: string;
  /** Colour of the tinted body rows, "#RRGGBB" (default: the theme's). */
  bodyTint?: string;
}

/**
 * Synthesizes a structured 2-tier header matrix from flat composite headers
 * (e.g., "Chức năng hô hấp / FEV1", "Chức năng hô hấp / FEF25") when structural headerRows is absent.
 */
export function synthesizeHeaderRows(headers: string[]): TableCell[][] {
  if (!headers || headers.length === 0) return [];

  // Check 1: Does headers contain " / " composite notation?
  const hasSlash = headers.some((h) => h.includes(' / '));
  if (hasSlash) {
    const parsed = headers.map((h) => {
      const parts = h.split(' / ').map((p) => p.trim());
      if (parts.length >= 2) {
        return { super: parts[0], sub: parts.slice(1).join(' / ') };
      }
      return { super: h, sub: '' };
    });

    const row0: TableCell[] = [];
    const row1: TableCell[] = [];

    let col = 0;
    while (col < parsed.length) {
      const curr = parsed[col];
      if (!curr.sub) {
        row0.push({ text: curr.super, rowSpan: 2, isHeader: true });
        col++;
      } else {
        let span = 1;
        while (
          col + span < parsed.length &&
          parsed[col + span].super.toLowerCase() === curr.super.toLowerCase() &&
          parsed[col + span].sub
        ) {
          span++;
        }
        row0.push({ text: curr.super, colSpan: span > 1 ? span : undefined, isHeader: true });
        for (let s = 0; s < span; s++) {
          row1.push({ text: parsed[col + s].sub, isHeader: true });
        }
        col += span;
      }
    }
    return row1.length > 0 ? [row0, row1] : [row0];
  }

  // Check 2: Does headers contain adjacent identical strings? (e.g. ['Chức năng hô hấp', 'Chức năng hô hấp'])
  const hasAdjacentDuplicates = headers.some(
    (h, idx) => idx > 0 && h.trim().length > 0 && h.trim().toLowerCase() === headers[idx - 1].trim().toLowerCase()
  );

  if (hasAdjacentDuplicates) {
    const row0: TableCell[] = [];
    let col = 0;
    while (col < headers.length) {
      const curr = headers[col].trim();
      let span = 1;
      while (
        col + span < headers.length &&
        headers[col + span].trim().toLowerCase() === curr.toLowerCase() &&
        curr.length > 0
      ) {
        span++;
      }
      row0.push({
        text: curr || `Cột ${col + 1}`,
        colSpan: span > 1 ? span : undefined,
        rowSpan: span === 1 ? 2 : undefined,
        isHeader: true,
      });
      col += span;
    }
    return [row0];
  }

  return [headers.map((h) => ({ text: h, isHeader: true }))];
}

/**
 * Normalizes any table structure to guarantee correct multi-tier headers and clean data rows.
 * Automatically handles cases where:
 * 1. Subheader row is stored as `rows[0]` (with leading empty strings followed by sub-metrics).
 * 2. Flat headers contain " / " composite notation or adjacent duplicate group names.
 * 3. Cleans up Word XML artifacts where standalone columns got pushed to row 1.
 * 4. Populates and synchronizes `headerRows`, `headers`, and `bodyRows` cleanly.
 */
export function normalizePaperTable(table: PaperTable): PaperTable {
  if (!table) return table;

  let headers = [...(table.headers || [])];
  let rows = (table.rows || []).map((r) => [...r]);
  let headerRows = table.headerRows ? table.headerRows.map((r) => [...r]) : undefined;
  let bodyRows = table.bodyRows ? table.bodyRows.map((r) => [...r]) : undefined;

  // Case 0: Clean and validate existing headerRows if already populated (e.g. from docx-parser)
  if (headerRows && headerRows.length === 2) {
    const row0 = headerRows[0];
    const row1 = headerRows[1];

    // Check if row0 has an empty cell at the end while row1 has a standalone title (e.g. "Tài trợ/Xung đột lợi ích")
    if (row0.length > 0 && row1.length > 0) {
      const lastCell0 = row0[row0.length - 1];
      const lastCell1 = row1[row1.length - 1];
      if ((!lastCell0.text || !lastCell0.text.trim()) && lastCell1.text && lastCell1.text.trim()) {
        lastCell0.text = lastCell1.text.trim();
        lastCell0.rowSpan = 2;
        delete lastCell0.colSpan;
        row1.pop();
      }
    }

    // Ensure all cells in row0 that do not span columns span 2 rows vertically
    for (const c of row0) {
      if (!c.colSpan || c.colSpan <= 1) {
        c.rowSpan = 2;
      }
    }
  }

  // Case 1: Detect if rows[0] is actually a sub-header row masquerading as data
  if (
    rows.length > 0 &&
    (!headerRows || headerRows.length <= 1)
  ) {
    const r0 = rows[0];
    const leadingEmptyCount = r0.findIndex((cell) => cell.trim().length > 0);
    const hasTrailingValues = r0.some((cell) => cell.trim().length > 0);
    const looksLikeSubheader =
      leadingEmptyCount >= 2 &&
      hasTrailingValues &&
      r0.some((cell) =>
        /FEV1|FVC|FEF|GOLD|COPD|CAT|6MWD|triệu chứng|đợt cấp|tài trợ|xung đột|%\s*pred|min|max|mean|sd|p[-=]|kết quả/i.test(
          cell
        )
      );

    if (looksLikeSubheader) {
      const newHeaders: string[] = [];
      for (let c = 0; c < r0.length; c++) {
        const subText = r0[c].trim();
        const superText = (headers[c] || '').trim();

        if (c < leadingEmptyCount) {
          const title = superText || `Cột ${c + 1}`;
          newHeaders.push(title);
        } else if (/tài\s*trợ|xung\s*đột\s*lợi\s*ích/i.test(subText)) {
          newHeaders.push(subText);
        } else if (/FEV|FVC|FEF|FET/i.test(subText)) {
          newHeaders.push(`Chức năng hô hấp / ${subText}`);
        } else if (/đợt\s*cấp|COPD|GOLD|CAT|6MWD/i.test(subText)) {
          newHeaders.push(`Vấn đề liên quan / ${subText}`);
        } else {
          let groupName = superText;
          if (!groupName) {
            for (let back = c - 1; back >= leadingEmptyCount; back--) {
              if (headers[back]?.trim()) {
                groupName = headers[back].trim();
                break;
              }
            }
          }
          if (!groupName) groupName = 'Chỉ số';

          const composite = subText ? `${groupName} / ${subText}` : groupName;
          newHeaders.push(composite);
        }
      }

      headerRows = synthesizeHeaderRows(newHeaders);
      headers = newHeaders;
      rows = rows.slice(1);
      bodyRows = rows.map((r) => r.map((c) => ({ text: c })));

      return {
        ...table,
        headers,
        rows,
        headerRows,
        bodyRows,
      };
    }
  }

  // Case 2: Headers have " / " but headerRows is not yet populated
  if ((!headerRows || headerRows.length <= 1) && headers.some((h) => h.includes(' / '))) {
    headerRows = synthesizeHeaderRows(headers);
  }

  // Case 3: Headers have adjacent duplicates without slashes and no 2-tier headerRows
  if (!headerRows || headerRows.length <= 1) {
    const hasAdjacentDuplicates = headers.some(
      (h, idx) => idx > 0 && h.trim().length > 0 && h.trim().toLowerCase() === headers[idx - 1].trim().toLowerCase()
    );
    if (hasAdjacentDuplicates) {
      headerRows = synthesizeHeaderRows(headers);
    }
  }

  // Case 4: Ensure bodyRows matches rows if missing
  if ((!bodyRows || bodyRows.length === 0) && rows.length > 0) {
    bodyRows = rows.map((r) => r.map((c) => ({ text: c })));
  }

  return {
    ...table,
    headers,
    rows,
    headerRows,
    bodyRows,
  };
}

/**
 * Normalizes affiliations so that items sharing the same ID (e.g. Vietnamese and English)
 * are cleanly merged into a single bilingual Affiliation item.
 */
export function normalizeAffiliations(affs: Affiliation[]): Affiliation[] {
  if (!affs || affs.length === 0) return [];
  const map = new Map<number, Affiliation>();

  for (const aff of affs) {
    const id = aff.id || 1;
    if (!map.has(id)) {
      map.set(id, {
        id,
        name: aff.name || '',
        nameEn: aff.nameEn || '',
      });
    } else {
      const existing = map.get(id)!;
      const isVi = (text: string) =>
        /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(text) ||
        /\b(viện|trường|đại học|khoa|bệnh viện|trung tâm)\b/i.test(text);

      const existingIsVi = isVi(existing.name);
      const incomingIsVi = isVi(aff.name);

      if (incomingIsVi && !existingIsVi) {
        // incoming is VI, existing was EN
        existing.nameEn = existing.nameEn || existing.name;
        existing.name = aff.name;
      } else if (!incomingIsVi && existingIsVi) {
        // incoming is EN, existing is VI
        existing.nameEn = aff.name;
      } else {
        if (!existing.name) existing.name = aff.name;
        else if (!existing.nameEn && aff.name !== existing.name) existing.nameEn = aff.name;
      }

      if (aff.nameEn) {
        existing.nameEn = aff.nameEn;
      }
    }
  }

  return Array.from(map.values()).sort((a, b) => a.id - b.id);
}

/**
 * Normalizes all tables and affiliations across an entire paper document.
 */
export function normalizeCompletePaper(paper: CompletePaper): CompletePaper {
  if (!paper) return paper;
  const normalizedAffiliations = paper.metadata?.affiliations
    ? normalizeAffiliations(paper.metadata.affiliations)
    : [];

  return {
    ...paper,
    metadata: {
      ...paper.metadata,
      affiliations: normalizedAffiliations,
    },
    layoutSettings: paper.layoutSettings,
    sections: (paper.sections || []).map((sec) => {
      if (sec.type === 'table' && sec.table) {
        return {
          ...sec,
          table: normalizePaperTable(sec.table),
        };
      }
      return sec;
    }),
  };
}

export interface PaperSection {
  id: string;
  type: 'h1' | 'h2' | 'h3' | 'paragraph' | 'figure' | 'table' | 'quote' | 'box' | 'citation' | 'equation';
  equation?: PaperEquation;
  title?: string;
  content: string;
  figure?: PaperFigure;
  table?: PaperTable;
  pageBreakAfter?: boolean;
  /** A block of text (heading, paragraph, formula …) that belongs to the appendices; a table or figure carries the flag in itself. */
  appendix?: boolean;
  /** Where an appendix stood in the Word file: after this block, or after the references. */
  appendixOrigin?: { after?: string; afterReferences: boolean };
  pageLayout?: SectionPageLayout; // new page here with these columns/orientation, until the next marker
}

export function createEmptyPaper(journalId: string = 'VNUHCM-HS'): CompletePaper {
  return {
    id: `paper_${Date.now()}`,
    metadata: {
      title: '',
      titleEn: '',
      articleType: 'Bài báo nghiên cứu',
      journalId,
      journalName: 'Tạp chí Phát triển Khoa học & Công nghệ – Health Sciences',
      journalAbbv: 'Sci. Tech. Dev. J. - Health Sci.',
      authors: [],
      affiliations: [],
      corresponding: {
        name: '',
        email: '',
        affiliation: '',
      },
      abstract: '',
      abstractEn: '',
      keywords: [],
      dates: {
        received: '',
        revised: '',
        accepted: '',
        published: '',
      },
      doi: '',
      volume: '1',
      issue: '1',
      year: new Date().getFullYear().toString(),
      firstPage: 1,
      lastPage: 1,
    },
    sections: [],
    references: [],
  };
}

export function isPaperEmpty(paper?: CompletePaper | null): boolean {
  if (!paper) return true;
  const hasTitle = Boolean(paper.metadata?.title?.trim());
  const hasSections = Boolean(paper.sections && paper.sections.length > 0);
  const hasAuthors = Boolean(paper.metadata?.authors && paper.metadata.authors.length > 0);
  return !hasTitle && !hasSections && !hasAuthors;
}

export interface PaperReference {
  id: number;
  raw: string;
  authors?: string;
  title?: string;
  journal?: string;
  year?: string;
  doi?: string;
  isCited: boolean;
  citationCount: number;
}

export interface StructuralIssue {
  id: string;
  category: 'metadata' | 'author' | 'abstract' | 'content' | 'table_fig' | 'reference';
  severity: 'error' | 'warning' | 'info';
  title: string;
  message: string;
  suggestion: string;
  fixTab?: 'metadata' | 'authors' | 'abstract' | 'sections' | 'refs' | 'citation' | 'appendix';
  /** Stable machine code when the issue comes from the shared validation rules (e.g. "numbering.table"). */
  code?: string;
}

export interface PreflightCheck {
  titleOk: boolean;
  titleEnOk: boolean;
  abstractOk: boolean;
  abstractEnOk: boolean;
  citationOk?: boolean;
  keywordsCount: number;
  keywordsEnCount: number;
  authorsCount: number;
  affiliationsCount: number;
  correspondingOk: boolean;
  imradOk: boolean;
  foundImradSections: {
    intro: boolean;
    methods: boolean;
    results: boolean;
    discussion: boolean;
    conclusion: boolean;
  };
  totalFigures: number;
  totalTables: number;
  totalReferences: number;
  uncitedReferences: number[];
  missingCitations: number[];
  vancouverConformant: boolean;
  score: number; // 0 - 100
  issues: StructuralIssue[];
}

export interface JournalTemplate {
  /** What the journal prints before a reference's DOI link ("Available from: "); empty prints the link alone. */
  referenceDoiLabel?: string;
  doiPrefix?: string; officialNameEn?: string; officialAbbvEn?: string; // DOI prefix (DOI = prefix.v{vol}i{issue}.{articleId}); English name/abbreviation for headers and citation
  id: string;
  name: string;
  shortName: string;
  publisher: string;
  color: string;
  accentColor: string;
  issn?: string;
  eIssn?: string;
  headerText: string;
}

export interface PageNumberingSettings {
  enabled: boolean;
  position: 'bottom-center' | 'bottom-right' | 'bottom-left' | 'bottom-alternating' | 'top-center' | 'top-right' | 'top-left' | 'top-alternating';
  format: 'arabic' | 'roman-lower' | 'roman-upper' | 'alpha-lower' | 'alpha-upper' | 'page-x-of-y' | 'hyphen';
  startNumber: number; // Mặc định 1 (hoặc số trang trong kỷ yếu/tập san)
  suppressOnFirstPage: boolean; // Khác biệt trang đầu / Ẩn trang 1 (Different first page)
  prefixText?: string; // Tiền tố (ví dụ: "Trang ", "Page " hoặc để trống)
  suffixText?: string;
}

export const DEFAULT_PAGE_NUMBERING: PageNumberingSettings = {
  enabled: true,
  position: 'bottom-alternating',
  format: 'arabic',
  startNumber: 1,
  suppressOnFirstPage: false,
  prefixText: '',
  suffixText: '',
};

export interface LayoutSettings {
  paperSize: 'custom' | 'a4' | 'letter' | 'b5';
  theme?: ThemeSettings;
  columnLayout: '1-column' | '2-column';
  orientation?: 'portrait' | 'landscape'; // whole body; the first page (title block) stays portrait
  fontSize?: '9pt' | '10pt' | '11pt';
  columnSep?: '1pc' | '1.5pc' | '2pc';
  lineSpacing?: '1.13' | '1.2' | '1.3';
  pageNumbering?: PageNumberingSettings;
  /** The DOI at the end of a reference: as the journal prints it (default), with "Available from:", as a bare link, or not at all. */
  referenceDoi?: 'journal' | 'available' | 'link' | 'none';
  /** The two columns of the last page end at the same height (default on). */
  balanceColumns?: boolean;
  /** Hyphens between numbers (268-9, 2016-2023) are printed as en dashes (default on). */
  rangeDash?: boolean;
}

export const DEFAULT_LAYOUT_SETTINGS: LayoutSettings = {
  paperSize: 'custom',
  columnLayout: '2-column',
  fontSize: '9pt',
  columnSep: '1pc',
  lineSpacing: '1.13',
  pageNumbering: DEFAULT_PAGE_NUMBERING,
};

export interface CompletePaper {
  id: string;
  displayName?: string;
  metadata: PaperMetadata;
  sections: PaperSection[];
  references: PaperReference[];
  /**
   * What the author changed about the page layout on this paper. Everything else follows the rules of the
   * paper's journal (see resolvePaperLayout), so this holds only the differences.
   */
  layoutSettings?: Partial<LayoutSettings>;
  /** The journal-profile versions the paper is laid out under. Set by the server; only an explicit upgrade moves them. */
  profilePin?: { base?: number; journal?: number; articleType?: number };
  /** Code of the paper's article type in its journal ("research"). */
  articleTypeCode?: string;
  templateId?: string;
  templateName?: string;
  updatedAt?: string;
  createdAt?: string;
  status?: 'draft' | 'review' | 'ready' | string;
  workflowStatus?: string;
  version?: number;
  currentServerRev?: number;
}

