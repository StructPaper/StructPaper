'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Columns,
  FileSpreadsheet,
  Check,
  RotateCcw,
  Sliders,
  Type,
  BookOpen,
  Hash,
  Sparkles,
  FileText,
  BookmarkCheck,
} from 'lucide-react';
import {
  LayoutSettings,
  DEFAULT_LAYOUT_SETTINGS,
  PageNumberingSettings,
  DEFAULT_PAGE_NUMBERING,
} from '@/types/paper';
import { JOURNAL_TEMPLATES } from '@/lib/templates';
import { Select, SelectOption } from '@/components/ui/Select';
import { ThemeSettingsSection } from './ThemeSettingsSection';
import { formatSamplePage } from './page-number-format';
import { PageOrientationSetting } from './PageOrientationSetting';

interface LayoutSettingsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  settings: LayoutSettings;
  journalId?: string;
  onApplySettings: (newSettings: LayoutSettings, newJournalId?: string) => void;
  isCompiling?: boolean;
}

// Filter duplicate STDJ alias for cleaner UI
const JOURNAL_OPTIONS: SelectOption[] = Object.values(JOURNAL_TEMPLATES)
  .filter((tmpl) => tmpl.id !== 'VNUHCM-STDJ')
  .map((tmpl) => ({
    value: tmpl.id,
    label: tmpl.name,
    description: `${tmpl.shortName} • ${tmpl.id}`,
    color: tmpl.color,
    badge: tmpl.id.replace('VNUHCM-', ''),
  }));

export const LayoutSettingsDrawer: React.FC<LayoutSettingsDrawerProps> = ({
  isOpen,
  onClose,
  settings,
  journalId = 'VNUHCM-HS',
  onApplySettings,
  isCompiling = false,
}) => {
  const [mounted, setMounted] = useState(false);
  const [localSettings, setLocalSettings] = useState<LayoutSettings>(() => ({
    ...DEFAULT_LAYOUT_SETTINGS,
    ...settings,
    pageNumbering: {
      ...DEFAULT_PAGE_NUMBERING,
      ...(settings.pageNumbering || {}),
    },
  }));
  const [localJournal, setLocalJournal] = useState<string>(journalId);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setLocalSettings({
        ...DEFAULT_LAYOUT_SETTINGS,
        ...settings,
        pageNumbering: {
          ...DEFAULT_PAGE_NUMBERING,
          ...(settings.pageNumbering || {}),
        },
      });
      setLocalJournal(journalId || 'VNUHCM-HS');
    }
  }, [isOpen, settings, journalId]);

  if (!mounted) return null;

  const pageNum = localSettings.pageNumbering || DEFAULT_PAGE_NUMBERING;

  const updatePageNum = (patch: Partial<PageNumberingSettings>) => {
    setLocalSettings((prev) => ({
      ...prev,
      pageNumbering: {
        ...(prev.pageNumbering || DEFAULT_PAGE_NUMBERING),
        ...patch,
      },
    }));
  };

  const handleReset = () => {
    setLocalSettings(DEFAULT_LAYOUT_SETTINGS);
  };

  const handleApply = () => {
    onApplySettings(localSettings, localJournal);
    onClose();
  };

  const isChanged =
    JSON.stringify(localSettings) !== JSON.stringify(settings) ||
    localJournal !== journalId;

  const samplePage1 = formatSamplePage(
    pageNum.startNumber || 1,
    pageNum.format,
    pageNum.prefixText
  );
  const samplePage2 = formatSamplePage(
    (pageNum.startNumber || 1) + 1,
    pageNum.format,
    pageNum.prefixText
  );

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="layout-drawer-root"
          className="fixed inset-0 z-[1000] flex justify-start px-3 pb-3 pt-[calc(var(--titlebar-height,38px)+0.75rem)] overflow-hidden pointer-events-auto"
        >
          {/* Backdrop with smooth Eatzy-like fade and blur */}
          <motion.div
            key="drawer-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="fixed inset-0 bg-black/30 backdrop-blur-xs cursor-pointer"
            onClick={onClose}
          />

          {/* Drawer Panel with spring physics sliding in from left */}
          <motion.div
            key="drawer-panel"
            initial={{ x: 'calc(-100% - 2rem)', opacity: 0.9 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 'calc(-100% - 2rem)', opacity: 0.9 }}
            transition={{ type: 'spring', stiffness: 280, damping: 28 }}
            className="relative z-10 w-full max-w-[490px] h-full rounded-[32px] bg-[#FBFBFC] shadow-2xl flex flex-col border border-[#E2E4E9] overflow-hidden"
          >
            {/* Header */}
            <div className="px-6 py-5 bg-gray-200/50 rounded-b-[32px] flex items-center justify-between shadow-xs">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#D9F99D]/60 border border-[#B4E50D]/40 flex items-center justify-center text-[#14532D] shadow-2xs">
                  <Sliders className="w-5 h-5 text-[#14532D]" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-zinc-900 tracking-tight flex items-center gap-2">
                    Cài đặt dàn trang PDF
                  </h3>
                  <p className="text-[11px] text-zinc-500 font-medium">
                    Tùy chỉnh bố cục, đánh số trang kiểu Word & khổ giấy
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-xl bg-zinc-200 hover:bg-zinc-200 text-zinc-600 hover:text-zinc-900 flex items-center justify-center transition-colors cursor-pointer"
                title="Đóng bảng cài đặt"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-5 divide-y divide-zinc-200/70 [&>*]:py-5 [&>*:first-child]:pt-0 [&>*:last-child]:pb-0 custom-scrollbar">
              {/* 1. MẪU TẠP CHÍ ĐÍCH (VNUHCM) */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-extrabold uppercase tracking-wider text-zinc-700 flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5 text-zinc-500" />
                    Mẫu tạp chí đích (VNUHCM)
                  </label>
                </div>

                <Select
                  value={localJournal}
                  onChange={(val) => setLocalJournal(val)}
                  options={JOURNAL_OPTIONS}
                  size="sm"
                  searchable={true}
                  searchPlaceholder="Tìm kiếm trong 7 tạp chí VNUHCM..."
                />
              </div>

              {/* 2. CÀI ĐẶT ĐÁNH SỐ TRANG (WORD-STYLE PAGE NUMBERING) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-extrabold uppercase tracking-wider text-zinc-700 flex items-center gap-1.5">
                    <Hash className="w-3.5 h-3.5 text-zinc-500" />
                    Đánh số trang (Page Numbering)
                  </label>

                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={pageNum.enabled}
                      onChange={(e) => updatePageNum({ enabled: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-zinc-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#78C841]"></div>
                  </label>
                </div>

                {pageNum.enabled && (
                  <div className="space-y-4 animate-in fade-in pt-1">
                    {/* Live Preview Pill */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                        <span className="text-[11px] text-zinc-600 font-medium">Mẫu hiển thị thực tế:</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-1 rounded-xl bg-white border border-zinc-200 text-xs font-mono font-bold text-zinc-800 shadow-2xs">
                          {samplePage1}
                        </span>
                        <span className="text-zinc-300 text-xs">→</span>
                        <span className="px-2.5 py-1 rounded-xl bg-white border border-zinc-200 text-xs font-mono font-bold text-zinc-800 shadow-2xs">
                          {samplePage2}
                        </span>
                      </div>
                    </div>

                    {/* Vị trí số trang (Position) */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-zinc-700 block">
                        Vị trí đánh số trang (Position):
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {([
                          { id: 'bottom-alternating' as const, label: 'Chân trang: Đối xứng', sub: 'Chẵn Trái – Lẻ Phải (Chuẩn sách)' },
                          { id: 'bottom-center' as const, label: 'Chân trang: Giữa', sub: 'Chính giữa cuối trang' },
                          { id: 'bottom-right' as const, label: 'Chân trang: Phải', sub: 'Góc dưới bên phải' },
                          { id: 'bottom-left' as const, label: 'Chân trang: Trái', sub: 'Góc dưới bên trái' },
                          { id: 'top-alternating' as const, label: 'Đầu trang: Đối xứng', sub: 'Chẵn Trái – Lẻ Phải (Header)' },
                          { id: 'top-center' as const, label: 'Đầu trang: Giữa', sub: 'Chính giữa đầu trang' },
                          { id: 'top-right' as const, label: 'Đầu trang: Phải', sub: 'Góc trên bên phải' },
                          { id: 'top-left' as const, label: 'Đầu trang: Trái', sub: 'Góc trên bên trái' },
                        ] as const).map((pos) => {
                          const isSel = pageNum.position === pos.id;
                          return (
                            <button
                              key={pos.id}
                              type="button"
                              onClick={() => updatePageNum({ position: pos.id })}
                              className={`p-2.5 rounded-2xl border text-left transition-all cursor-pointer relative ${
                                isSel
                                  ? 'bg-blue-50/50 border-blue-500 ring-2 ring-blue-500/20'
                                  : 'bg-zinc-50/60 hover:bg-zinc-100/80 border-zinc-200 text-zinc-700'
                              }`}
                            >
                              <div className="text-xs font-bold text-zinc-900">{pos.label}</div>
                              <div className="text-[9.5px] text-zinc-500 truncate">{pos.sub}</div>
                              {isSel && (
                                <div className="absolute top-2 right-2 w-3.5 h-3.5 rounded-full bg-blue-600 text-white flex items-center justify-center">
                                  <Check className="w-2 h-2 stroke-[3]" />
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Định dạng số trang (Format) */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-zinc-700 block">
                        Định dạng số trang (Number Format):
                      </label>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {([
                          { id: 'arabic' as const, label: '1, 2, 3...', sample: '1' },
                          { id: 'roman-lower' as const, label: 'i, ii, iii...', sample: 'i' },
                          { id: 'roman-upper' as const, label: 'I, II, III...', sample: 'I' },
                          { id: 'alpha-lower' as const, label: 'a, b, c...', sample: 'a' },
                          { id: 'alpha-upper' as const, label: 'A, B, C...', sample: 'A' },
                          { id: 'hyphen' as const, label: '- 1 -, - 2 -', sample: '- 1 -' },
                          { id: 'page-x-of-y' as const, label: 'Trang X / Y', sample: '1 / 10' },
                        ] as const).map((fmt) => {
                          const isSel = pageNum.format === fmt.id;
                          return (
                            <button
                              key={fmt.id}
                              type="button"
                              onClick={() => updatePageNum({ format: fmt.id })}
                              className={`p-2 rounded-xl border text-center transition-all cursor-pointer ${
                                isSel
                                  ? 'bg-zinc-900 text-white border-zinc-900 shadow-2xs font-bold'
                                  : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700 border-transparent font-medium text-xs'
                              }`}
                            >
                              <div className="text-xs font-mono">{fmt.sample}</div>
                              <div className="text-[9px] opacity-80 truncate">{fmt.label}</div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Starting Page Number & Prefix Text */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      <div>
                        <label className="text-[11px] font-bold text-zinc-700 block mb-1">
                          Bắt đầu từ trang số:
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={9999}
                          value={pageNum.startNumber || 1}
                          onChange={(e) => updatePageNum({ startNumber: Math.max(1, parseInt(e.target.value) || 1) })}
                          className="w-full p-2.5 rounded-xl border border-zinc-200 text-xs font-semibold text-zinc-900 bg-zinc-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
                        />
                        <span className="text-[9.5px] text-zinc-400 mt-0.5 block">
                          Hữu ích khi đóng tập san hoặc kỷ yếu
                        </span>
                      </div>

                      <div>
                        <label className="text-[11px] font-bold text-zinc-700 block mb-1">
                          Tiền tố số trang (Prefix):
                        </label>
                        <input
                          type="text"
                          value={pageNum.prefixText || ''}
                          onChange={(e) => updatePageNum({ prefixText: e.target.value })}
                          placeholder='Ví dụ: "Trang" hoặc "Page"'
                          className="w-full p-2.5 rounded-xl border border-zinc-200 text-xs font-semibold text-zinc-900 bg-zinc-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
                        />
                        <span className="text-[9.5px] text-zinc-400 mt-0.5 block">
                          Để trống nếu chỉ cần hiện số
                        </span>
                      </div>
                    </div>

                    {/* Different First Page Checkbox */}
                    <div className="pt-1">
                      <label className="flex items-start gap-2.5 py-1 cursor-pointer transition-colors">
                        <input
                          type="checkbox"
                          checked={pageNum.suppressOnFirstPage}
                          onChange={(e) => updatePageNum({ suppressOnFirstPage: e.target.checked })}
                          className="mt-0.5 w-4 h-4 text-blue-600 rounded border-zinc-300 focus:ring-blue-500 cursor-pointer"
                        />
                        <div>
                          <div className="text-xs font-bold text-zinc-900 flex items-center gap-1.5">
                            <BookmarkCheck className="w-3.5 h-3.5 text-blue-600" />
                            Khác biệt trang đầu tiên (Different First Page)
                          </div>
                          <div className="text-[10px] text-zinc-500 leading-tight mt-0.5">
                            Ẩn số trang ở trang bìa/trang đầu bài báo (Chuẩn quốc tế & bài báo ĐHQG-HCM)
                          </div>
                        </div>
                      </label>
                    </div>
                  </div>
                )}
              </div>

              {/* 3. BỐ CỤC NỘI DUNG (1 CỘT / 2 CỘT) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-extrabold uppercase tracking-wider text-zinc-700 flex items-center gap-1.5">
                    <Columns className="w-3.5 h-3.5 text-zinc-500" />
                    Bố cục cột nội dung
                  </label>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600">
                    {localSettings.columnLayout === '2-column' ? '2 Cột chuẩn' : '1 Cột rộng'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {/* Option: 2 Cột */}
                  <button
                    type="button"
                    onClick={() =>
                      setLocalSettings((prev) => ({ ...prev, columnLayout: '2-column' }))
                    }
                    className={`p-3.5 rounded-2xl border text-left transition-all relative flex flex-col justify-between cursor-pointer ${
                      localSettings.columnLayout === '2-column'
                        ? 'bg-white border-[#78C841] shadow-sm ring-2 ring-[#78C841]/20'
                        : 'bg-white/60 hover:bg-white border-zinc-200 text-zinc-700 hover:border-zinc-300'
                    }`}
                  >
                    {localSettings.columnLayout === '2-column' && (
                      <div className="absolute top-2.5 right-2.5 w-4 h-4 rounded-full bg-[#78C841] text-white flex items-center justify-center shadow-xs">
                        <Check className="w-2.5 h-2.5 stroke-[3]" />
                      </div>
                    )}
                    <div className="space-y-1.5">
                      <div className="w-full h-12 bg-zinc-50 rounded-lg border border-zinc-150 p-1.5 flex gap-1.5 mb-2">
                        <div className="w-1/2 h-full bg-zinc-200/80 rounded flex flex-col gap-1 p-1">
                          <div className="w-full h-1 bg-zinc-400 rounded-full" />
                          <div className="w-3/4 h-1 bg-zinc-300 rounded-full" />
                          <div className="w-5/6 h-1 bg-zinc-300 rounded-full" />
                        </div>
                        <div className="w-1/2 h-full bg-zinc-200/80 rounded flex flex-col gap-1 p-1">
                          <div className="w-full h-1 bg-zinc-400 rounded-full" />
                          <div className="w-5/6 h-1 bg-zinc-300 rounded-full" />
                          <div className="w-2/3 h-1 bg-zinc-300 rounded-full" />
                        </div>
                      </div>
                      <div className="font-extrabold text-xs text-zinc-900">2 Cột</div>
                      <p className="text-[10px] text-zinc-500 leading-tight">
                        Chuẩn định dạng tạp chí ĐHQG-HCM
                      </p>
                    </div>
                    <span className="inline-block mt-2 text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 w-fit">
                      Mặc định
                    </span>
                  </button>

                  {/* Option: 1 Cột */}
                  <button
                    type="button"
                    onClick={() =>
                      setLocalSettings((prev) => ({ ...prev, columnLayout: '1-column' }))
                    }
                    className={`p-3.5 rounded-2xl border text-left transition-all relative flex flex-col justify-between cursor-pointer ${
                      localSettings.columnLayout === '1-column'
                        ? 'bg-white border-[#78C841] shadow-sm ring-2 ring-[#78C841]/20'
                        : 'bg-white/60 hover:bg-white border-zinc-200 text-zinc-700 hover:border-zinc-300'
                    }`}
                  >
                    {localSettings.columnLayout === '1-column' && (
                      <div className="absolute top-2.5 right-2.5 w-4 h-4 rounded-full bg-[#78C841] text-white flex items-center justify-center shadow-xs">
                        <Check className="w-2.5 h-2.5 stroke-[3]" />
                      </div>
                    )}
                    <div className="space-y-1.5">
                      <div className="w-full h-12 bg-zinc-50 rounded-lg border border-zinc-150 p-1.5 flex mb-2">
                        <div className="w-full h-full bg-zinc-200/80 rounded flex flex-col gap-1 p-1">
                          <div className="w-full h-1 bg-zinc-400 rounded-full" />
                          <div className="w-4/5 h-1 bg-zinc-300 rounded-full" />
                          <div className="w-full h-1 bg-zinc-300 rounded-full" />
                          <div className="w-2/3 h-1 bg-zinc-300 rounded-full" />
                        </div>
                      </div>
                      <div className="font-extrabold text-xs text-zinc-900">1 Cột</div>
                      <p className="text-[10px] text-zinc-500 leading-tight">
                        Nội dung bài báo trải rộng 1 cột xuyên suốt
                      </p>
                    </div>
                    <span className="inline-block mt-2 text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 w-fit">
                      Toàn trang
                    </span>
                  </button>
                </div>
              </div>

              <PageOrientationSetting
                value={localSettings.orientation}
                onChange={(orientation) => setLocalSettings((prev) => ({ ...prev, orientation }))}
              />

              {/* 4. KÍCH THƯỚC KHỔ GIẤY */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-extrabold uppercase tracking-wider text-zinc-700 flex items-center gap-1.5">
                    <FileSpreadsheet className="w-3.5 h-3.5 text-zinc-500" />
                    Kích thước khổ giấy
                  </label>
                  <span className="text-[10px] text-zinc-400 font-medium">XeLaTeX Geometry</span>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() =>
                      setLocalSettings((prev) => ({ ...prev, paperSize: 'custom' }))
                    }
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer relative ${
                      localSettings.paperSize === 'custom'
                        ? 'bg-white border-[#78C841] ring-2 ring-[#78C841]/20 shadow-xs'
                        : 'bg-white/70 hover:bg-white border-zinc-200 text-zinc-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-extrabold text-xs text-zinc-900">Chuẩn ĐHQG</span>
                      {localSettings.paperSize === 'custom' && (
                        <div className="w-3.5 h-3.5 rounded-full bg-[#78C841] text-white flex items-center justify-center">
                          <Check className="w-2 h-2 stroke-[3]" />
                        </div>
                      )}
                    </div>
                    <p className="text-[10px] text-zinc-500">8.51&quot; × 11.0&quot; (216 × 279mm)</p>
                    <span className="inline-block mt-1.5 text-[8px] font-bold px-1 py-0.2 rounded bg-zinc-100 text-zinc-600">
                      Mặc định
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setLocalSettings((prev) => ({ ...prev, paperSize: 'a4' }))
                    }
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer relative ${
                      localSettings.paperSize === 'a4'
                        ? 'bg-white border-[#78C841] ring-2 ring-[#78C841]/20 shadow-xs'
                        : 'bg-white/70 hover:bg-white border-zinc-200 text-zinc-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-extrabold text-xs text-zinc-900">Khổ A4</span>
                      {localSettings.paperSize === 'a4' && (
                        <div className="w-3.5 h-3.5 rounded-full bg-[#78C841] text-white flex items-center justify-center">
                          <Check className="w-2 h-2 stroke-[3]" />
                        </div>
                      )}
                    </div>
                    <p className="text-[10px] text-zinc-500">210 × 297 mm</p>
                    <span className="inline-block mt-1.5 text-[8px] font-bold px-1 py-0.2 rounded bg-blue-50 text-blue-700">
                      ISO 216
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setLocalSettings((prev) => ({ ...prev, paperSize: 'letter' }))
                    }
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer relative ${
                      localSettings.paperSize === 'letter'
                        ? 'bg-white border-[#78C841] ring-2 ring-[#78C841]/20 shadow-xs'
                        : 'bg-white/70 hover:bg-white border-zinc-200 text-zinc-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-extrabold text-xs text-zinc-900">US Letter</span>
                      {localSettings.paperSize === 'letter' && (
                        <div className="w-3.5 h-3.5 rounded-full bg-[#78C841] text-white flex items-center justify-center">
                          <Check className="w-2 h-2 stroke-[3]" />
                        </div>
                      )}
                    </div>
                    <p className="text-[10px] text-zinc-500">8.5&quot; × 11.0&quot; (215.9 × 279.4mm)</p>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setLocalSettings((prev) => ({ ...prev, paperSize: 'b5' }))
                    }
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer relative ${
                      localSettings.paperSize === 'b5'
                        ? 'bg-white border-[#78C841] ring-2 ring-[#78C841]/20 shadow-xs'
                        : 'bg-white/70 hover:bg-white border-zinc-200 text-zinc-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-extrabold text-xs text-zinc-900">Khổ B5</span>
                      {localSettings.paperSize === 'b5' && (
                        <div className="w-3.5 h-3.5 rounded-full bg-[#78C841] text-white flex items-center justify-center">
                          <Check className="w-2 h-2 stroke-[3]" />
                        </div>
                      )}
                    </div>
                    <p className="text-[10px] text-zinc-500">182 × 257 mm</p>
                  </button>
                </div>
              </div>

              {/* 5. THÔNG SỐ NÂNG CAO */}
              <div className="space-y-3">
                <label className="text-xs font-extrabold uppercase tracking-wider text-zinc-700 flex items-center gap-1.5">
                  <Type className="w-3.5 h-3.5 text-zinc-500" />
                  Quy chuẩn phông chữ & khoảng cách
                </label>

                {/* Cỡ chữ */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-zinc-600 block">
                    Cỡ chữ bài báo (Base font size):
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['9pt', '10pt', '11pt'] as const).map((size) => (
                      <button
                        key={size}
                        type="button"
                        onClick={() =>
                          setLocalSettings((prev) => ({ ...prev, fontSize: size }))
                        }
                        className={`py-1.5 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          (localSettings.fontSize || '9pt') === size
                            ? 'bg-zinc-900 text-white shadow-2xs'
                            : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700'
                        }`}
                      >
                        {size} {size === '9pt' ? '(Chuẩn)' : ''}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Khoảng cách 2 cột (Column Gap) - Chỉ hiện khi 2 cột */}
                {localSettings.columnLayout === '2-column' && (
                  <div className="space-y-1.5 animate-in fade-in">
                    <label className="text-[11px] font-bold text-zinc-600 block">
                      Khoảng cách giữa 2 cột (Column sep):
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['1pc', '1.5pc', '2pc'] as const).map((gap) => (
                        <button
                          key={gap}
                          type="button"
                          onClick={() =>
                            setLocalSettings((prev) => ({ ...prev, columnSep: gap }))
                          }
                          className={`py-1.5 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                            (localSettings.columnSep || '1pc') === gap
                              ? 'bg-zinc-900 text-white shadow-2xs'
                              : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700'
                          }`}
                        >
                          {gap} {gap === '1pc' ? '(Chuẩn)' : ''}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Giãn dòng */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-zinc-600 block">
                    Hệ số giãn dòng (Line spread):
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['1.13', '1.2', '1.3'] as const).map((ls) => (
                      <button
                        key={ls}
                        type="button"
                        onClick={() =>
                          setLocalSettings((prev) => ({ ...prev, lineSpacing: ls }))
                        }
                        className={`py-1.5 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          (localSettings.lineSpacing || '1.13') === ls
                            ? 'bg-zinc-900 text-white shadow-2xs'
                            : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700'
                        }`}
                      >
                        {ls}x {ls === '1.13' ? '(Chuẩn)' : ''}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <ThemeSettingsSection
                theme={localSettings.theme}
                onChange={(theme) => setLocalSettings((prev) => ({ ...prev, theme }))}
              />
            </div>

            {/* Footer Actions */}
            <div className="p-5 bg-white border-t border-[#EAECEF] flex items-center justify-between gap-3 shadow-sm">
              <button
                type="button"
                onClick={handleReset}
                className="btn-pill-subtle text-xs py-2 px-3 text-zinc-600 hover:text-zinc-900 font-bold flex items-center gap-1.5 cursor-pointer"
                title="Khôi phục về quy chuẩn ban đầu của Tạp chí"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Mặc định</span>
              </button>

              <button
                type="button"
                onClick={handleApply}
                disabled={isCompiling}
                className="btn-pill-lime text-xs py-2.5 px-5 font-bold flex items-center gap-2 shadow-sm cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
              >
                <span>Áp dụng & Biên dịch PDF</span>
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};
