// Types added for dynamic theming and equations (kept out of paper.ts, a size-capped legacy file).

/**
 * Dynamic (non hard-coded) appearance options. Every field is optional;
 * resolveTheme() in lib/theme-config.ts merges them over the journal defaults.
 */
export interface ThemeSettings {
  titleColor?: string; // hex, e.g. '#2B74B7' (headings, captions, running footer)
  tableHeaderColor?: string; // hex, header row background
  tableZebraColor?: string; // hex, alternating body row background
  bodyFont?: string; // CSS/LaTeX family name, e.g. 'Times New Roman'
  headingFont?: string; // e.g. 'Calibri'
  bodyFontSizePt?: number; // 8-12
  lineHeight?: number; // 1.0 - 2.0
  /** Page margins in centimetres. */
  margins?: { top?: number; bottom?: number; left?: number; right?: number };
  /** Repeat the header row on every page a long table spans. Default true. */
  repeatTableHeader?: boolean;
  /** Tables with more body rows than this are typeset as breakable tables. Default 12. */
  longTableRowThreshold?: number;
  /** Keep the section numbers typed in Word ("4. Kết quả"). Default false: the journal prints unnumbered headings. */
  keepSectionNumbers?: boolean;
  /** Append the closing English summary page (English title/abstract/affiliation). Default true. */
  englishSummaryPage?: boolean;
  /** Marker printed on top of each continuation page; "{n}" is the table number. */
  continuedTitleText?: string;
  /** Marker printed at the bottom of a table that continues on the next page. */
  continuedFootText?: string;
}

export interface PaperEquation {
  /** LaTeX source of the formula (without $ delimiters). */
  latex: string;
  /** Displayed number "(n)"; assigned in document order when numbered. */
  num?: number;
  numbered: boolean;
  /** Optional original OMML kept for lossless DOCX round-trips. */
  omml?: string;
  /**
   * '2-column': in a two-column layout the formula is set on one unbroken line across both columns
   * (like a full-width table or figure). Default '1-column': set inside the column, broken if too wide.
   */
  columnSpan?: '1-column' | '2-column';
}

/**
 * Page layout that starts at a section: the section begins a new page with these columns and
 * orientation, which stay in force until the next section that carries a marker. A field that is
 * left out falls back to the document default (the column layout of the layout settings, portrait).
 * An empty marker therefore means "new page, back to the default layout".
 */
export interface SectionPageLayout {
  columns?: '1-column' | '2-column';
  orientation?: 'portrait' | 'landscape';
  /** Written by turning a page in the preview, not by the editor: dropped again when it becomes redundant. */
  turned?: boolean;
}

/**
 * Publication data assigned by the editorial office (volume, issue, pages, DOI, publication date).
 * Semantics per field: key absent = not entered yet (printed as "?"), "" = deliberately blank, otherwise the value.
 */
export interface PublicationInfo {
  volume?: string;
  issue?: string;
  firstPage?: string;
  lastPage?: string;
  doi?: string;
  published?: string;
  /** Article id on the journal platform (the "a-#" in image URLs, last part of the DOI). */
  articleId?: string;
}
