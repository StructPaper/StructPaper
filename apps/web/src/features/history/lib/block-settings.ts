import { tableSettingChips, figureSettingChips, type SettingChip } from '@/features/editor/components/sections/BlockSettingChips';
import { describePageLayout } from '@/features/editor/components/sections/PageLayoutControl';

type Json = Record<string, any>;

/** One setting of a block that differs between two versions. */
export interface SettingChange {
  /** What the setting is ("Hướng", "Cỡ chữ bảng"...). */
  label: string;
  from: string;
  to: string;
}

const NONE = 'Mặc định';

const TYPE_LABELS: Record<string, string> = {
  h1: 'Mục cấp 1 (H1)',
  h2: 'Mục cấp 2 (H2)',
  h3: 'Mục cấp 3 (H3)',
  paragraph: 'Đoạn văn',
  quote: 'Trích dẫn',
  box: 'Khung nổi bật',
  table: 'Bảng số liệu',
  figure: 'Hình minh họa',
  equation: 'Công thức',
  citation: 'Trích dẫn bài báo',
};

/** The kind of a block as the editor names it ("Mục cấp 2 (H2)", "Đoạn văn"). */
export const blockTypeLabel = (type: unknown): string => TYPE_LABELS[String(type)] ?? String(type ?? '—');

const EQUATION_NAMES: Record<string, string> = { numbered: 'Đánh số công thức' };

function equationChips(eq: Json | undefined): SettingChip[] {
  // a formula has no column setting: it follows the paper's layout
  return [{ key: 'numbered', label: eq?.numbered ? 'Có đánh số' : 'Không đánh số', accent: eq?.numbered === false }];
}

const TABLE_NAMES: Record<string, string> = {
  columns: 'Số cột của bảng',
  orientation: 'Hướng bảng',
  font: 'Cỡ chữ bảng',
  fill: 'Nền bảng',
  placement: 'Vị trí bảng',
  break: 'Ngắt trang trong bảng',
};
const FIGURE_NAMES: Record<string, string> = {
  columns: 'Số cột của hình',
  scale: 'Kích thước hình',
  align: 'Căn hình',
  border: 'Viền hình',
  placement: 'Vị trí hình',
};

const byKey = (chips: SettingChip[]) => new Map(chips.map((c) => [c.key, c.label]));

function chipChanges(before: SettingChip[], after: SettingChip[], names: Record<string, string>): SettingChange[] {
  const a = byKey(before);
  const b = byKey(after);
  const out: SettingChange[] = [];
  for (const key of new Set([...a.keys(), ...b.keys()])) {
    const from = a.get(key) ?? NONE;
    const to = b.get(key) ?? NONE;
    if (from !== to) out.push({ label: names[key] ?? key, from, to });
  }
  return out;
}

/** The page layout set on a block ("Trang mới · 2 cột · Ngang"), or nothing. */
export const pageLayoutText = (section: Json | undefined): string => (section?.pageLayout ? describePageLayout(section.pageLayout) : NONE);

/**
 * What changed in how a block is set between two versions: a table's columns, orientation, type size, fill, placement and page
 * breaks; a figure's columns, size, alignment, border and placement; the page layout started at the block; a page break after it.
 * Text and cells are not settings and are not listed here.
 */
export function blockSettingChanges(before: Json | undefined, after: Json | undefined): SettingChange[] {
  if (!before || !after) return [];
  const out: SettingChange[] = [];
  // turning a heading into a paragraph, a paragraph into a quote, H2 into H3...
  if (before.type !== after.type) out.push({ label: 'Loại khối', from: blockTypeLabel(before.type), to: blockTypeLabel(after.type) });
  if (after.type === 'equation' && before.type === 'equation') out.push(...chipChanges(equationChips(before.equation), equationChips(after.equation), EQUATION_NAMES));
  if (after.type === 'table' && before.type === 'table') out.push(...chipChanges(tableSettingChips(before.table ?? {}), tableSettingChips(after.table ?? {}), TABLE_NAMES));
  if (after.type === 'figure' && before.type === 'figure') out.push(...chipChanges(figureSettingChips(before.figure ?? {}), figureSettingChips(after.figure ?? {}), FIGURE_NAMES));
  if (pageLayoutText(before) !== pageLayoutText(after)) out.push({ label: 'Bố cục trang', from: pageLayoutText(before), to: pageLayoutText(after) });
  if (!!before.pageBreakAfter !== !!after.pageBreakAfter) out.push({ label: 'Ngắt trang sau khối', from: before.pageBreakAfter ? 'Có' : 'Không', to: after.pageBreakAfter ? 'Có' : 'Không' });
  return out;
}

/** The settings a block has now, as chips: the table's or figure's own, the page layout started here, a page break after it. */
export function blockSettingChips(section: Json): SettingChip[] {
  const chips: SettingChip[] = [];
  if (section.type === 'table') chips.push(...tableSettingChips(section.table ?? {}));
  if (section.type === 'figure') chips.push(...figureSettingChips(section.figure ?? {}));
  if (section.type === 'equation') chips.push(...equationChips(section.equation));
  if (section.pageLayout) chips.push({ key: 'pageLayout', label: describePageLayout(section.pageLayout), accent: true });
  if (section.pageBreakAfter) chips.push({ key: 'pageBreak', label: 'Ngắt trang sau khối', accent: true });
  return chips;
}

/** A short name for a block in a list: its heading, "Bảng 2: …", "Hình 1", or the start of its text. */
export function blockName(section: Json): string {
  switch (section.type) {
    case 'table':
      return `Bảng ${section.table?.num ?? ''}${section.table?.caption ? `: ${section.table.caption}` : ''}`.trim();
    case 'figure':
      return `Hình ${section.figure?.num ?? ''}${section.figure?.caption ? `: ${section.figure.caption}` : ''}`.trim();
    case 'equation':
      return `Công thức ${section.equation?.num ?? ''}`.trim();
    default: {
      const t = String(section.title || section.content || '').replace(/\s+/g, ' ').trim();
      return t.length > 70 ? `${t.slice(0, 70)}…` : t || 'Khối trống';
    }
  }
}

/** Whether a block carries any setting worth showing under it (a table, figure or equation, a page layout, a page break). */
export const hasBlockSettings = (section: Json): boolean => section.type === 'table' || section.type === 'figure' || section.type === 'equation' || !!section.pageLayout || !!section.pageBreakAfter;
