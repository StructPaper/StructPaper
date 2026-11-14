'use client';

import React from 'react';

type Placement = 'auto' | 'top' | 'here' | 'bottom';
type BreakMode = 'auto' | 'always' | 'never';
type BodyFill = 'plain' | 'zebra' | 'shaded';

interface Props {
  placement: Placement;
  onPlacement: (p: Placement) => void;
  breakAcrossPages: BreakMode;
  onBreakAcrossPages: (b: BreakMode) => void;
  bodyFill: BodyFill;
  onBodyFill: (f: BodyFill) => void;
}

const PLACEMENTS = [
  { key: 'auto' as const, label: 'Tự động', desc: 'Tự động [!htbp]: LaTeX tự tính toán vị trí đẹp nhất' },
  { key: 'top' as const, label: 'Đầu', desc: 'Đầu trang [t]: Ưu tiên đặt bảng ở trên cùng trang giấy' },
  { key: 'here' as const, label: 'Tại vị trí', desc: 'Tại vị trí [!h]: Cố gắng đặt bảng ngay cạnh văn bản' },
];

const BREAKS = [
  { key: 'auto' as const, label: 'Tự động', desc: 'Bảng nhiều hàng tự được cắt qua trang' },
  { key: 'always' as const, label: 'Luôn cắt', desc: 'Luôn cho phép cắt bảng qua trang, lặp hàng tiêu đề' },
  { key: 'never' as const, label: 'Giữ nguyên', desc: 'Giữ cả bảng trong một khối' },
];

const FILLS = [
  { key: 'plain' as const, label: 'Trắng', desc: 'Nền trắng (mặc định)' },
  { key: 'zebra' as const, label: 'Sọc xen kẽ', desc: 'Tô nhạt các hàng xen kẽ' },
  { key: 'shaded' as const, label: 'Tô đều', desc: 'Tô nền nhạt toàn bộ thân bảng (như Bảng 2 bản in)' },
];

function Segmented<T extends string>({
  label,
  title,
  items,
  value,
  onChange,
  testId,
}: {
  label: string;
  title: string;
  items: Array<{ key: T; label: string; desc: string }>;
  value: T;
  onChange: (v: T) => void;
  testId?: string;
}) {
  return (
    <div className="space-y-1.5" data-testid={testId}>
      <label className="text-[12px] font-bold text-zinc-600 block" title={title}>
        {label}
      </label>
      <div className="grid grid-cols-3 gap-1">
        {items.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => onChange(item.key)}
            className={`py-1.5 px-1 rounded-lg text-center transition-all cursor-pointer text-[11px] font-bold ${
              value === item.key ? 'bg-gray-400 text-white shadow-2xs' : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700'
            }`}
            title={item.desc}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Float placement + page-break behaviour of long tables (extracted from TableSettingsModal). */
export const TablePlacementAndBreak: React.FC<Props> = ({ placement, onPlacement, breakAcrossPages, onBreakAcrossPages, bodyFill, onBodyFill }) => (
  <>
    <Segmented label="Nền thân bảng" title="Màu nền các hàng dữ liệu" items={FILLS} value={bodyFill} onChange={onBodyFill} testId="table-fill-option" />
    <Segmented
      label="Vị trí neo"
      title="Vị trí neo trang LaTeX: Vị trí ưu tiên đặt bảng khi biên dịch file PDF [placement]"
      items={PLACEMENTS}
      value={placement}
      onChange={onPlacement}
    />
    <Segmented
      label="Ngắt qua trang"
      title="Bảng dài sẽ được cắt sang trang kế, lặp lại hàng tiêu đề và ghi chú tiếp theo"
      items={BREAKS}
      value={breakAcrossPages}
      onChange={onBreakAcrossPages}
      testId="table-break-option"
    />
  </>
);
