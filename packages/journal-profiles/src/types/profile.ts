/**
 * Journal Profile Types
 *
 * Defines the canonical configuration contract for target academic journals,
 * including Word style mappings, typography, layout, LaTeX engine templates,
 * and preflight QC requirements.
 */

export interface JournalProfileNames {
  vi: string;
  en: string;
  short: string;
}

export interface JournalArticleType {
  id: string;
  label: Record<string, string>;
  requiredSections: string[];
}

export interface JournalAbstractConfig {
  minWords: number;
  maxWords: number;
  structured: boolean;
}

export interface JournalKeywordsConfig {
  min: number;
  max: number;
  separator: ';' | ',';
}

export interface JournalFrontMatterConfig {
  abstract: JournalAbstractConfig | null;
  keywords: JournalKeywordsConfig;
  dateFormat: string;
  doiPattern: string;
}

export interface JournalCitationConfig {
  style: string;
  inText: 'bracket' | 'superscript';
  rangeDash: string;
}

export interface JournalLayoutMargins {
  top: number;
  bottom: number;
  left: number;
  right: number;
  unit?: 'mm' | 'pt' | 'in';
}

export interface JournalLayoutConfig {
  paperSize: string;
  columns: number;
  margins: JournalLayoutMargins;
  columnGap?: number;
  headerHeight?: number;
  footerHeight?: number;
  [key: string]: unknown;
}

export interface JournalTypographyFontFamilies {
  main: string;
  heading?: string;
  mono?: string;
  [key: string]: string | undefined;
}

export interface JournalTypographyFontSizes {
  title: number;
  heading1: number;
  heading2: number;
  heading3: number;
  body: number;
  caption: number;
  table: number;
  reference: number;
  [key: string]: number | undefined;
}

export interface JournalTypographyConfig {
  fontFamilies: JournalTypographyFontFamilies;
  fontSizes: JournalTypographyFontSizes;
  leading?: Record<string, number>;
  widowOrphan?: {
    widows: number;
    orphans: number;
  };
  [key: string]: unknown;
}

export interface JournalLatexFonts {
  main?: string;
  sans?: string;
  mono?: string;
  math?: string;
  [key: string]: unknown;
}

export interface JournalLatexConfig {
  cls: string;
  engine: 'xelatex' | 'lualatex';
  fonts: JournalLatexFonts;
  [key: string]: unknown;
}

export interface JournalQcConfig {
  ruleset: string[];
  weights: Record<string, number>;
}

/**
 * What a journal prints about itself (page headers, "Cite this article", DOI). Its ISSN is the journal's
 * own field (the journals table) and is laid over this when the profile is served.
 */
export interface JournalPublicationConfig {
  /** Full Vietnamese name used in headers and lists */
  name?: string;
  /** English abbreviation, e.g. "Sci. Tech. Dev. J." */
  shortName?: string;
  publisher?: string;
  accentColor?: string;
  issn?: string;
  eIssn?: string;
  /** Header line printed on every page */
  headerText?: string;
  /** Official English name as printed on the journal's own PDF */
  officialNameEn?: string;
  officialAbbvEn?: string;
  /** DOI = prefix.v{volume}i{issue}.{articleId} */
  doiPrefix?: string;
}

export interface JournalProfile {
  id: string;
  version: string;
  names: JournalProfileNames;
  color: string;
  languages: ('vi' | 'en')[];
  articleTypes: JournalArticleType[];
  frontMatter: JournalFrontMatterConfig;
  citation: JournalCitationConfig;
  styleMap: Record<string, string>;
  layout: JournalLayoutConfig;
  typography: JournalTypographyConfig;
  latex: JournalLatexConfig;
  qc: JournalQcConfig;
  publication?: JournalPublicationConfig;
  [key: string]: unknown;
}

export interface ArticleTypeProfile {
  id: string;
  label?: Record<string, string>;
  requiredSections?: string[];
  frontMatter?: Partial<Omit<JournalFrontMatterConfig, 'abstract'>> & {
    abstract?: JournalAbstractConfig | null;
  };
  layout?: Partial<JournalLayoutConfig>;
  typography?: Partial<JournalTypographyConfig>;
  latex?: Partial<JournalLatexConfig>;
  qc?: Partial<JournalQcConfig>;
  [key: string]: unknown;
}

export interface JournalTierProfile {
  id: string;
  names?: JournalProfileNames;
  color?: string;
  languages?: ('vi' | 'en')[];
  articleTypes?: JournalArticleType[];
  frontMatter?: Partial<JournalFrontMatterConfig>;
  citation?: Partial<JournalCitationConfig>;
  styleMap?: Record<string, string>;
  layout?: Partial<JournalLayoutConfig>;
  typography?: Partial<JournalTypographyConfig>;
  latex?: Partial<JournalLatexConfig>;
  qc?: Partial<JournalQcConfig>;
  publication?: JournalPublicationConfig;
  [key: string]: unknown;
}

export interface ResolvedProfile extends JournalProfile {
  articleType?: string;
  [key: string]: unknown;
}
