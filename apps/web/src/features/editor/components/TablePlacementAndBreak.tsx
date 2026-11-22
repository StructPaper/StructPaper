'use client';

import React from 'react';
import { SegmentedOptions } from './sections/SegmentedOptions';
import { Field } from './settings-ui';

type Placement = 'auto' | 'top' | 'here' | 'bottom';
type BreakMode = 'auto' | 'always' | 'never';
type BodyFill = 'plain' | 'zebra' | 'shaded';
type SideColumn = 'auto' | 'text' | 'full';

interface Props {
  placement: Placement;
  onPlacement: (p: Placement) => void;
  breakAcrossPages: BreakMode;
  onBreakAcrossPages: (b: BreakMode) => void;
  bodyFill: BodyFill;
  onBodyFill: (f: BodyFill) => void;
  sideColumn?: SideColumn;
  onSideColumn?: (s: SideColumn) => void;
}

const PLACEMENTS = [
  { value: 'auto' as const, label: 'Tự động', title: 'Tự động [!htbp]: LaTeX tự tính toán vị trí đẹp nhất' },
  { value: 'top' as const, label: 'Đầu trang', title: 'Đầu trang [t]: Ưu tiên đặt bảng ở trên cùng trang giấy' },
  { value: 'here' as const, label: 'Tại vị trí', title: 'Tại vị trí [!h]: Cố gắng đặt bảng ngay cạnh văn bản' },
];

const BREAKS = [
  { value: 'auto' as const, label: 'Tự động', title: 'Bảng nhiều hàng tự được cắt qua trang' },
  { value: 'always' as const, label: 'Luôn cắt', title: 'Luôn cho phép cắt bảng qua trang, lặp hàng tiêu đề' },
  { value: 'never' as const, label: 'Giữ nguyên', title: 'Giữ cả bảng trong một khối' },
];

const SIDES = [
  { value: 'auto' as const, label: 'Tự động', title: 'Bảng lớn chiếm cả trang như bản in chuẩn; bảng nhỏ nằm trong cột chữ' },
  { value: 'text' as const, label: 'Trong cột chữ', title: 'Luôn giữ bảng trong phần chữ, chừa cột mã QR và thông tin liên hệ bên trái' },
  { value: 'full' as const, label: 'Cả trang', title: 'Bảng chiếm toàn bộ bề ngang trang, kể cả cột mã QR và thông tin liên hệ' },
];

const FILLS = [
  { value: 'plain' as const, label: 'Trắng', title: 'Nền trắng' },
  { value: 'zebra' as const, label: 'Sọc xen kẽ', title: 'Tô nhạt các hàng xen kẽ' },
  { value: 'shaded' as const, label: 'Tô đều', title: 'Tô nền nhạt toàn bộ thân bảng (như Bảng 2 bản in)' },
];

/** Body colour, float placement and page-break behaviour of a table: three one-line choices, one under the other. */
export const TablePlacementAndBreak: React.FC<Props> = ({ placement, onPlacement, breakAcrossPages, onBreakAcrossPages, bodyFill, onBodyFill, sideColumn, onSideColumn }) => (
  <>
    <Field label="Nền thân bảng" title="Màu nền các hàng dữ liệu" testId="table-fill-option">
      <SegmentedOptions ariaLabel="Nền thân bảng" value={bodyFill} onChange={onBodyFill} options={FILLS} />
    </Field>
    <Field label="Vị trí neo" title="Vị trí neo trang LaTeX: nơi ưu tiên đặt bảng khi biên dịch PDF [placement]">
      <SegmentedOptions ariaLabel="Vị trí neo" value={placement} onChange={onPlacement} options={PLACEMENTS} />
    </Field>
    <Field
      label="Ngắt qua trang"
      hint="Bảng dài được cắt sang trang kế, lặp lại hàng tiêu đề và ghi chú tiếp theo."
      testId="table-break-option"
    >
      <SegmentedOptions ariaLabel="Ngắt qua trang" value={breakAcrossPages} onChange={onBreakAcrossPages} options={BREAKS} />
    </Field>
    {onSideColumn && (
      <Field
        label="Bảng lớn chiếm cột bên"
        hint="Bảng lớn nằm riêng một trang có thể chiếm cả bề ngang trang, kể cả chỗ cột mã QR và liên hệ (như phụ lục trong mẫu chuẩn)."
        testId="table-side-option"
      >
        <SegmentedOptions ariaLabel="Bảng lớn chiếm cột bên" value={sideColumn ?? 'auto'} onChange={onSideColumn} options={SIDES} />
      </Field>
    )}
  </>
);
