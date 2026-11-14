'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { LayoutTemplate } from 'lucide-react';
import type { PaperSection, SectionPageLayout } from '@/types/paper';
import { SegmentedOptions } from './SegmentedOptions';

type Columns = NonNullable<SectionPageLayout['columns']>;
type Orientation = NonNullable<SectionPageLayout['orientation']>;

export function describePageLayout(layout: SectionPageLayout): string {
  const parts = ['Trang mới'];
  if (layout.columns) parts.push(layout.columns === '2-column' ? '2 cột' : '1 cột');
  if (layout.orientation) parts.push(layout.orientation === 'landscape' ? 'Ngang' : 'Dọc');
  return parts.join(' · ');
}

export const PageLayoutBadge: React.FC<{ layout?: SectionPageLayout }> = ({ layout }) => {
  if (!layout) return null;
  return (
    <span
      data-testid="page-layout-badge"
      className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 flex items-center gap-1"
    >
      <LayoutTemplate className="w-3 h-3" />
      {describePageLayout(layout)}
    </span>
  );
};

interface PageLayoutControlProps {
  sec: PaperSection;
  idx: number;
  onUpdateSection: (index: number, updated: PaperSection) => void;
}

const DEFAULT_VALUE = 'default';
const POPOVER_W = 288;

export const PageLayoutControl: React.FC<PageLayoutControlProps> = ({ sec, idx, onUpdateSection }) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const layout = sec.pageLayout;
  const enabled = !!layout;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (rootRef.current?.contains(t) || popRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const write = (next: SectionPageLayout | undefined) => {
    const { pageLayout: _drop, ...rest } = sec;
    onUpdateSection(idx, next ? { ...rest, pageLayout: next } : rest);
  };

  const setField = (patch: SectionPageLayout) => {
    const next: SectionPageLayout = { ...(layout ?? {}), ...patch };
    if (!next.columns) delete next.columns;
    if (!next.orientation) delete next.orientation;
    write(next);
  };

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const left = Math.max(8, Math.min(r.right - POPOVER_W, window.innerWidth - POPOVER_W - 8));
          setPos({ top: r.bottom + 4, left });
          setOpen((v) => !v);
        }}
        title="Bố cục trang: bắt đầu trang mới với số cột / hướng giấy riêng"
        aria-haspopup="dialog"
        aria-expanded={open}
        data-testid="page-layout-button"
        className={`px-2 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer ${
          enabled
            ? 'bg-sky-100 text-sky-800 ring-1 ring-sky-300 shadow-2xs'
            : 'text-zinc-500 hover:text-zinc-900 hover:bg-white/80'
        }`}
      >
        <LayoutTemplate className="w-3.5 h-3.5 text-sky-600" />
        <span className="text-[10px] hidden sm:inline whitespace-nowrap">Bố cục trang</span>
      </button>

      {open && typeof document !== 'undefined' && createPortal(
        <div
          ref={popRef}
          style={{ position: 'fixed', top: pos.top, left: pos.left, width: POPOVER_W }}
          role="dialog"
          aria-label="Bố cục trang"
          data-testid="page-layout-popover"
          className="z-[100] p-3 space-y-2.5 rounded-2xl bg-white border border-zinc-200 shadow-lg"
        >
          <label className="flex items-center gap-2 text-[11px] font-bold text-zinc-800 cursor-pointer select-none">
            <input
              type="checkbox"
              data-testid="page-layout-toggle"
              checked={enabled}
              onChange={(e) => write(e.target.checked ? {} : undefined)}
              className="accent-lime-500"
            />
            Bắt đầu trang mới với bố cục riêng
          </label>

          {enabled && (
            <>
              <div className="space-y-1">
                <span className="text-[11px] font-bold text-zinc-600">Cột</span>
                <SegmentedOptions<string>
                  ariaLabel="Số cột của trang"
                  value={layout?.columns ?? DEFAULT_VALUE}
                  onChange={(v) => setField({ columns: v === DEFAULT_VALUE ? undefined : (v as Columns) })}
                  options={[
                    { value: DEFAULT_VALUE, label: 'Mặc định tài liệu', testId: 'page-layout-cols-default' },
                    { value: '1-column', label: '1 cột', testId: 'page-layout-cols-1' },
                    { value: '2-column', label: '2 cột', testId: 'page-layout-cols-2' },
                  ]}
                />
              </div>
              <div className="space-y-1">
                <span className="text-[11px] font-bold text-zinc-600">Hướng</span>
                <SegmentedOptions<string>
                  ariaLabel="Hướng của trang"
                  value={layout?.orientation ?? DEFAULT_VALUE}
                  onChange={(v) =>
                    setField({ orientation: v === DEFAULT_VALUE ? undefined : (v as Orientation) })
                  }
                  options={[
                    { value: DEFAULT_VALUE, label: 'Mặc định tài liệu', testId: 'page-layout-orient-default' },
                    { value: 'portrait', label: 'Dọc', testId: 'page-layout-orient-portrait' },
                    { value: 'landscape', label: 'Ngang', testId: 'page-layout-orient-landscape' },
                  ]}
                />
              </div>
              <p className="text-[10px] text-zinc-500 leading-snug">
                Giữ đến mục có bố cục trang kế tiếp; chọn &apos;Mặc định&apos; ở cả hai để quay lại bố cục chung.
              </p>
            </>
          )}
        </div>,
        document.body
      )}
    </div>
  );
};
