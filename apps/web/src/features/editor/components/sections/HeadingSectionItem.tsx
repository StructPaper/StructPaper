'use client';

import React from 'react';
import { Bold, Italic, Underline, Type, RotateCcw, Copy } from 'lucide-react';
import { PaperSection } from '@/types/paper';
import { lookOfText, markupToHtml, setWholeLook, stripMarkup, type WholeLook } from '@/lib/inline-markup';
import { AutoResizeTextarea } from './AutoResizeTextarea';
import { RichLineInput } from './RichLineInput';
import { ColorSwatchField } from '../TableLookControls';
import { Field } from '../settings-ui';
import { Popover } from '../../overview/overview-ui';

export interface HeadingSectionItemProps {
  sec: PaperSection;
  idx: number;
  onUpdateSection: (index: number, updated: PaperSection) => void;
  /** Gives every heading of this level the look of this one, or takes the look off all of them (their text is left alone). */
  onApplyHeadingLook?: (fromIndex: number, mode: 'copy' | 'reset') => void;
}

const LEVEL_LABEL: Record<string, string> = { h1: 'mục lớn', h2: 'mục con', h3: 'mục nhỏ' };

const Toggle: React.FC<{ on: boolean; label: string; onClick: () => void; children: React.ReactNode }> = ({ on, label, onClick, children }) => (
  <button
    type="button"
    title={label}
    aria-label={label}
    aria-pressed={on}
    onClick={onClick}
    className={`h-9 w-9 rounded-xl flex items-center justify-center cursor-pointer transition-colors ${on ? 'bg-[#ECFCCB] text-[#14532D]' : 'bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-100'}`}
  >
    {children}
  </button>
);

/** A heading: its text shown as it will print, and a popup with its kind and look (like the settings of a table or a figure). */
const HeadingSectionItemBase: React.FC<HeadingSectionItemProps> = ({ sec, idx, onUpdateSection, onApplyHeadingLook }) => {
  const title = sec.title || '';
  const look = lookOfText(title);
  const hasLook = look.b || look.i || look.u || !!look.color;
  const setLook = (patch: Partial<WholeLook>) => onUpdateSection(idx, { ...sec, title: setWholeLook(title, { ...look, ...patch }) });
  const level = sec.type as 'h1' | 'h2' | 'h3';
  const sizeClass = level === 'h1' ? 'uppercase' : level === 'h3' ? 'italic' : '';
  return (
    <div className="space-y-1.5">
      <div className="flex items-start gap-1.5">
        <RichLineInput
          value={title}
          onChange={(val) => onUpdateSection(idx, { ...sec, title: val })}
          placeholder="Nhập tiêu đề đề mục (ví dụ: GIỚI THIỆU, PHƯƠNG PHÁP, KẾT QUẢ...)"
          ariaLabel="Tiêu đề đề mục"
          textClassName={`font-bold ${sizeClass}`}
          className="flex-1 min-w-0 p-2.5 rounded-2xl text-xs sm:text-sm text-zinc-900 bg-white focus-within:ring-4 focus-within:ring-blue-200 focus-within:border-blue-300 shadow-2xs cursor-text"
        />
        <Popover
          label={null}
          title="Cài đặt tiêu đề: cấp, in đậm, nghiêng, màu"
          width={330}
          align="right"
          chevron={false}
          trigger={(open, toggle) => (
            <button
              type="button"
              data-edit-only
              data-testid="heading-settings"
              title="Cài đặt tiêu đề: cấp, in đậm, nghiêng, màu"
              aria-label="Cài đặt tiêu đề"
              onClick={toggle}
              className={`relative mt-0.5 h-9 w-9 flex-shrink-0 rounded-xl flex items-center justify-center cursor-pointer transition-colors ${open ? 'bg-[#ECFCCB] text-[#14532D]' : 'bg-white border border-zinc-200 text-zinc-600 hover:bg-zinc-100'}`}
            >
              <Type className="w-4 h-4" />
              {hasLook && <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-[#78C841]" />}
            </button>
          )}
        >
          {(close) => (
            <div className="space-y-3.5" data-testid="heading-settings-panel">
              <div>
                <h4 className="text-sm font-extrabold text-slate-900">Cài đặt tiêu đề</h4>
                <p className="text-[11px] text-slate-500 mt-0.5">Cấp và dáng chữ của tiêu đề này.</p>
              </div>
              {/* the level (h1, h2, h3) and "turn into a paragraph" are on the card's own header: not repeated here */}
              <Field label="Dáng chữ" hint="Áp dụng cho cả tiêu đề. Muốn chỉ vài chữ thì bôi đen chữ đó ở chế độ Tổng thể.">
                <div className="flex items-center gap-2">
                  <Toggle on={look.b} label="In đậm" onClick={() => setLook({ b: !look.b })}>
                    <Bold className="w-4 h-4" />
                  </Toggle>
                  <Toggle on={look.i} label="In nghiêng" onClick={() => setLook({ i: !look.i })}>
                    <Italic className="w-4 h-4" />
                  </Toggle>
                  <Toggle on={look.u} label="Gạch chân" onClick={() => setLook({ u: !look.u })}>
                    <Underline className="w-4 h-4" />
                  </Toggle>
                </div>
              </Field>
              <ColorSwatchField label="Màu chữ" value={look.color} fallback="#2B74B7" onChange={(c) => setLook({ color: c })} />
              <div className="rounded-2xl bg-white border border-zinc-200 px-3 py-2.5">
                <span className="block text-[10px] font-bold uppercase tracking-wide text-zinc-400 mb-1">Xem trước</span>
                <span className={`block font-bold text-[#2B74B7] ${sizeClass} ${level === 'h1' ? 'text-[15px]' : 'text-[13px]'}`} dangerouslySetInnerHTML={{ __html: markupToHtml(title || '…') }} />
              </div>
              {onApplyHeadingLook && (
                <div className="flex flex-col gap-1.5 pt-2.5 border-t border-zinc-200/70">
                  <button
                    type="button"
                    data-testid="heading-apply-level"
                    onClick={() => {
                      onApplyHeadingLook(idx, 'copy');
                      close();
                    }}
                    className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-bold bg-lime-200/70 text-lime-950 hover:bg-lime-200 cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    Áp dụng cho mọi {LEVEL_LABEL[level] ?? 'tiêu đề'}
                  </button>
                  <button
                    type="button"
                    data-testid="heading-reset-level"
                    onClick={() => {
                      onApplyHeadingLook(idx, 'reset');
                      close();
                    }}
                    className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-bold text-zinc-600 bg-gray-200/70 hover:bg-gray-200 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Đưa mọi {LEVEL_LABEL[level] ?? 'tiêu đề'} về mặc định
                  </button>
                </div>
              )}
              <button
                type="button"
                data-testid="heading-reset"
                disabled={!hasLook}
                onClick={() => onUpdateSection(idx, { ...sec, title: stripMarkup(title) })}
                className="w-full text-[11px] font-bold text-zinc-500 hover:text-zinc-900 underline underline-offset-2 disabled:opacity-40 cursor-pointer disabled:cursor-default"
              >
                Bỏ định dạng của tiêu đề này
              </button>
            </div>
          )}
        </Popover>
      </div>
      {sec.content && (
        <AutoResizeTextarea
          value={sec.content}
          onChange={(val) => onUpdateSection(idx, { ...sec, content: val })}
          placeholder="Nội dung phụ / mô tả dưới tiêu đề..."
          className="w-full p-2.5 rounded-2xl text-xs text-zinc-900 bg-white leading-relaxed focus:outline-none focus:ring-4 focus:ring-blue-200 focus:border-blue-300 shadow-2xs"
        />
      )}
    </div>
  );
};

export const HeadingSectionItem = React.memo(HeadingSectionItemBase);
HeadingSectionItem.displayName = 'HeadingSectionItem';
