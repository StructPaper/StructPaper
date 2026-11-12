/**
 * Compatibility interfaces representing StructPaper v1 CompletePaper document model.
 */

export interface V1Author {
  id: string;
  name: string;
  affiliationIds: number[];
  isCorresponding?: boolean;
  email?: string;
  orcid?: string;
}

export interface V1Affiliation {
  id: number;
  name: string;
  nameEn?: string;
}

export interface V1PaperDates {
  received?: string;
  revised?: string;
  accepted?: string;
  published?: string;
}

export interface V1PaperMetadata {
  title: string;
  titleEn?: string;
  articleType: string;
  journalId: string;
  journalName?: string;
  journalAbbv?: string;
  authors: V1Author[];
  affiliations: V1Affiliation[];
  corresponding?: {
    name: string;
    email: string;
    affiliation: string;
  };
  abstract: string;
  abstractEn?: string;
  keywords: string[];
  keywordsEn?: string[];
  dates: V1PaperDates;
  doi?: string;
  volume?: string;
  issue?: string;
  year?: string;
  firstPage?: number;
  lastPage?: number;
}

export interface V1PaperFigure {
  id: string;
  num: number;
  caption: string;
  src: string;
  source?: string;
  isFullWidth?: boolean;
  columnSpan?: '1-column' | '2-column';
  scalePercent?: number;
  alignment?: 'center' | 'left' | 'right';
  placement?: 'auto' | 'top' | 'here' | 'bottom';
  hasBorder?: boolean;
}

export interface V1TableCell {
  text: string;
  colSpan?: number;
  rowSpan?: number;
  align?: 'left' | 'center' | 'right';
  isHeader?: boolean;
}

export interface V1PaperTable {
  id: string;
  num: number;
  caption: string;
  source?: string;
  headers: string[];
  rows: string[][];
  headerRows?: V1TableCell[][];
  bodyRows?: V1TableCell[][];
  isFullWidth?: boolean;
  columnSpan?: '1-column' | '2-column';
  isRotated?: boolean;
  fontSize?: '7pt' | '8pt' | '9pt' | '10pt';
  rowStretch?: number;
  hasZebraStripes?: boolean;
  placement?: 'auto' | 'top' | 'here' | 'bottom';
  breakAcrossPages?: 'auto' | 'always' | 'never';
  bodyFill?: 'plain' | 'zebra' | 'shaded';
}

export interface V1PaperEquation {
  latex: string;
  num?: number;
  numbered: boolean;
  omml?: string;
  /** '2-column': the formula is set on one unbroken line across both columns. */
  columnSpan?: '1-column' | '2-column';
}

/** Page layout that starts at a section: a new page with these columns / orientation until the next marker. */
export interface V1SectionPageLayout {
  columns?: '1-column' | '2-column';
  orientation?: 'portrait' | 'landscape';
  turned?: boolean;
}

export interface V1PaperSection {
  id: string;
  type: 'h1' | 'h2' | 'h3' | 'paragraph' | 'figure' | 'table' | 'quote' | 'box' | 'citation' | 'equation';
  equation?: V1PaperEquation;
  title?: string;
  content: string;
  figure?: V1PaperFigure;
  table?: V1PaperTable;
  pageBreakAfter?: boolean;
  pageLayout?: V1SectionPageLayout;
}

export interface V1PaperReference {
  id: number;
  raw: string;
  authors?: string;
  title?: string;
  journal?: string;
  year?: string;
  doi?: string;
  isCited?: boolean;
  citationCount?: number;
}

export interface V1CompletePaper {
  id: string;
  metadata: V1PaperMetadata;
  sections: V1PaperSection[];
  references: V1PaperReference[];
  layoutSettings?: Record<string, unknown>;
  templateId?: string;
  templateName?: string;
  updatedAt?: string;
  createdAt?: string;
  status?: 'draft' | 'review' | 'ready';
}
