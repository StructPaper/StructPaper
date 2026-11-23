import type { PaperTable, TableBorderStyle } from '@/types/paper';

/** Which lines a border style draws. `vOuter` = the left and right edges, `vInner` = between columns, `hInner` = between rows. */
export interface TableRules {
  top: boolean;
  bottom: boolean;
  hInner: boolean;
  vInner: boolean;
  vOuter: boolean;
}

const RULES: Record<TableBorderStyle, TableRules> = {
  journal: { top: true, bottom: true, hInner: false, vInner: false, vOuter: false },
  none: { top: false, bottom: false, hInner: false, vInner: false, vOuter: false },
  horizontal: { top: true, bottom: true, hInner: true, vInner: false, vOuter: false },
  vertical: { top: true, bottom: true, hInner: false, vInner: true, vOuter: false },
  grid: { top: true, bottom: true, hInner: true, vInner: true, vOuter: true },
  outer: { top: true, bottom: true, hInner: false, vInner: false, vOuter: true },
};

export const BORDER_STYLES: Array<{ value: TableBorderStyle; label: string; hint: string }> = [
  { value: 'journal', label: 'Như tạp chí', hint: 'Đường kẻ trên và dưới bảng, dải tiêu đề màu' },
  { value: 'horizontal', label: 'Kẻ ngang', hint: 'Đường kẻ giữa các hàng' },
  { value: 'vertical', label: 'Kẻ dọc', hint: 'Đường kẻ giữa các cột' },
  { value: 'grid', label: 'Kẻ đủ', hint: 'Lưới đầy đủ' },
  { value: 'outer', label: 'Khung ngoài', hint: 'Chỉ viền quanh bảng' },
  { value: 'none', label: 'Không kẻ', hint: 'Không có đường kẻ nào' },
];

export const DEFAULT_BORDER_WIDTH = 0.4;

export const tableRulesOf = (table: Pick<PaperTable, 'borderStyle'>): TableRules => RULES[table.borderStyle ?? 'journal'] ?? RULES.journal;

/** "#RRGGBB" -> "r, g, b" for xcolor's [RGB] model; null if it is not a colour. */
export function rgbCsv(hex: string | undefined): string | null {
  if (!hex || !/^#[0-9a-fA-F]{6}$/.test(hex)) return null;
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
}

/** Does this table draw lines or colours differently from the journal's default? */
export function hasCustomTableLook(table: PaperTable): boolean {
  return (
    (table.borderStyle !== undefined && table.borderStyle !== 'journal') ||
    !!table.borderColor ||
    table.borderWidth !== undefined ||
    !!table.headerFill ||
    !!table.bodyTint
  );
}

/** Least height of body row `index` in points, if one was set. */
export function rowHeightOf(table: Pick<PaperTable, 'rowHeights'>, index: number): number | undefined {
  const h = table.rowHeights?.[index];
  return typeof h === 'number' && h > 0 ? h : undefined;
}
