import type { LayoutSettings, ThemeSettings } from '@/types/paper';

export interface ResolvedTheme {
  titleColor: string;
  tableHeaderColor: string;
  tableZebraColor: string;
  bodyFont: string;
  headingFont: string;
  bodyFontSizePt: number;
  lineHeight: number;
  margins: { top: number; bottom: number; left: number; right: number };
  repeatTableHeader: boolean;
  longTableRowThreshold: number;
  continuedTitleText: string;
  continuedFootText: string;
  englishSummaryPage: boolean;
  keepSectionNumbers: boolean;
  /** A table set sideways turns its whole page (landscape pages). Default false: every page stays upright and only the table is turned. */
  rotateTablePage: boolean;
}

/** Defaults replicate the previously hard-coded VNUHCM look. */
export const DEFAULT_THEME: ResolvedTheme = {
  titleColor: '#2B74B7',
  tableHeaderColor: '#E5E5E5',
  tableZebraColor: '#E7ECF7',
  bodyFont: 'Times New Roman',
  headingFont: 'Calibri',
  bodyFontSizePt: 9,
  lineHeight: 1.38,
  margins: { top: 1.8, bottom: 2, left: 1.7, right: 1.3 },
  repeatTableHeader: true,
  longTableRowThreshold: 12,
  // Same wording as the journal's reference PDF (EBL ID1750).
  continuedTitleText: 'Table {n} continued',
  continuedFootText: 'Continued on next page',
  englishSummaryPage: true,
  keepSectionNumbers: false,
  rotateTablePage: false,
};

const HEX_RE = /^#?([0-9a-fA-F]{6})$/;
const FONT_RE = /^[\p{L}\p{N} \-_.]{1,60}$/u;

export function sanitizeHex(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback;
  const m = value.trim().match(HEX_RE);
  return m ? `#${m[1].toUpperCase()}` : fallback;
}

function sanitizeFont(value: unknown, fallback: string): string {
  return typeof value === 'string' && FONT_RE.test(value.trim()) ? value.trim() : fallback;
}

function sanitizeLabel(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() && value.length <= 80 ? value.trim() : fallback;
}

function clamp(n: unknown, min: number, max: number, fallback: number): number {
  const v = typeof n === 'number' ? n : Number.NaN;
  if (!Number.isFinite(v)) return fallback;
  return Math.min(max, Math.max(min, v));
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const m = hex.match(HEX_RE);
  const n = parseInt(m ? m[1] : '000000', 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

/**
 * Merge user theme overrides (and optional journal brand colour) over defaults.
 * All values are sanitised so they are safe to interpolate into CSS and LaTeX.
 */
export function resolveTheme(
  layout?: Pick<LayoutSettings, 'theme'> | null,
  journalColor?: string
): ResolvedTheme {
  const t: ThemeSettings = layout?.theme || {};
  const base = DEFAULT_THEME;
  const m = t.margins || {};
  return {
    titleColor: sanitizeHex(t.titleColor ?? journalColor, base.titleColor),
    tableHeaderColor: sanitizeHex(t.tableHeaderColor, base.tableHeaderColor),
    tableZebraColor: sanitizeHex(t.tableZebraColor, base.tableZebraColor),
    bodyFont: sanitizeFont(t.bodyFont, base.bodyFont),
    headingFont: sanitizeFont(t.headingFont, base.headingFont),
    bodyFontSizePt: clamp(t.bodyFontSizePt, 8, 12, base.bodyFontSizePt),
    lineHeight: clamp(t.lineHeight, 1, 2, base.lineHeight),
    margins: {
      top: clamp(m.top, 0.5, 6, base.margins.top),
      bottom: clamp(m.bottom, 0.5, 6, base.margins.bottom),
      left: clamp(m.left, 0.5, 6, base.margins.left),
      right: clamp(m.right, 0.5, 6, base.margins.right),
    },
    repeatTableHeader: t.repeatTableHeader !== false,
    longTableRowThreshold: Math.round(clamp(t.longTableRowThreshold, 1, 200, base.longTableRowThreshold)),
    continuedTitleText: sanitizeLabel(t.continuedTitleText, base.continuedTitleText),
    continuedFootText: sanitizeLabel(t.continuedFootText, base.continuedFootText),
    englishSummaryPage: t.englishSummaryPage !== false,
    keepSectionNumbers: t.keepSectionNumbers === true,
    rotateTablePage: t.rotateTablePage === true,
  };
}

/** CSS custom properties consumed by the live preview components. */
export function themeToCssVars(theme: ResolvedTheme): Record<string, string> {
  return {
    '--sp-title-color': theme.titleColor,
    '--sp-table-head': theme.tableHeaderColor,
    '--sp-table-zebra': theme.tableZebraColor,
    '--sp-body-font': `'${theme.bodyFont}', 'Source Serif 4', serif`,
    '--sp-heading-font': `'${theme.headingFont}', 'Myriad Pro', Arial, sans-serif`,
    '--sp-body-size': `${theme.bodyFontSizePt}pt`,
    '--sp-line-height': String(theme.lineHeight),
    '--sp-margin-top': `${theme.margins.top}cm`,
    '--sp-margin-bottom': `${theme.margins.bottom}cm`,
    '--sp-margin-left': `${theme.margins.left}cm`,
    '--sp-margin-right': `${theme.margins.right}cm`,
  };
}
