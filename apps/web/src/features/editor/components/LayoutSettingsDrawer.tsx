'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Columns, FileText, Hash, BookOpen, Sliders, Type, Sparkles, RotateCcw, RotateCw } from 'lucide-react';
import {
  LayoutSettings,
  DEFAULT_LAYOUT_SETTINGS,
  PageNumberingSettings,
  DEFAULT_PAGE_NUMBERING,
} from '@/types/paper';
import { useJournals } from '@/features/journals';
import { Shimmer } from '@/components/ui/Shimmer';
import { Select, SelectOption } from '@/components/ui/Select';
import { NumberInput } from '@/components/ui/NumberInput';
import {
  ThemeColorsCard,
  ThemeFontsFields,
  ThemeMarginsCard,
  ThemeResetButton,
  ThemeTablesCard,
} from './ThemeSettingsSection';
import { formatSamplePage } from './page-number-format';
import { SegmentedOptions } from './sections/SegmentedOptions';
import {
  ChoiceCard,
  Field,
  MiniLines,
  MiniPage,
  SettingsCard,
  SettingsFooter,
  SettingsHeader,
  sectionListClass,
  Tag,
  ToggleRow,
  textInputClass,
} from './settings-ui';

interface LayoutSettingsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  settings: LayoutSettings;
  journalId?: string;
  onApplySettings: (newSettings: LayoutSettings, newJournalId?: string) => void;
  isCompiling?: boolean;
}

type PositionZone = 'bottom' | 'top';
type PositionAlign = 'alternating' | 'center' | 'right' | 'left';

const ZONES = [
  { value: 'bottom' as const, label: 'Chân trang' },
  { value: 'top' as const, label: 'Đầu trang' },
];

const ALIGNS = [
  { value: 'alternating' as const, label: 'Đối xứng', title: 'Trang chẵn bên trái, trang lẻ bên phải (như sách)' },
  { value: 'center' as const, label: 'Giữa', title: 'Chính giữa trang' },
  { value: 'right' as const, label: 'Phải', title: 'Góc bên phải' },
  { value: 'left' as const, label: 'Trái', title: 'Góc bên trái' },
];

const NUMBER_FORMATS: SelectOption<PageNumberingSettings['format']>[] = [
  { value: 'arabic', label: '1, 2, 3…' },
  { value: 'roman-lower', label: 'i, ii, iii…' },
  { value: 'roman-upper', label: 'I, II, III…' },
  { value: 'alpha-lower', label: 'a, b, c…' },
  { value: 'alpha-upper', label: 'A, B, C…' },
  { value: 'hyphen', label: '- 1 -, - 2 -' },
  { value: 'page-x-of-y', label: 'Trang X / Y' },
];

const PAPER_SIZES = [
  { id: 'custom' as const, title: 'Chuẩn ĐHQG', sub: '216 × 279 mm (8.51″ × 11″)', tag: <Tag tone="green">Mặc định</Tag> },
  { id: 'a4' as const, title: 'A4', sub: '210 × 297 mm', tag: <Tag tone="blue">ISO 216</Tag> },
  { id: 'letter' as const, title: 'US Letter', sub: '215.9 × 279.4 mm', tag: undefined },
  { id: 'b5' as const, title: 'B5', sub: '182 × 257 mm', tag: undefined },
];

export const LayoutSettingsDrawer: React.FC<LayoutSettingsDrawerProps> = ({
  isOpen,
  onClose,
  settings,
  journalId = 'VNUHCM-HS',
  onApplySettings,
  isCompiling = false,
}) => {
  const [mounted, setMounted] = useState(false);
  const { journals, isLoading: journalsLoading, find: findJournalInfo } = useJournals();
  const journalOptions: SelectOption[] = journals.map((j) => ({
    value: j.code,
    label: j.name,
    description: j.code,
    color: j.color,
    badge: j.key.toUpperCase(),
  }));
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

  // The parent hands over a new `settings` object on every render, so the drawer compares by value: a re-render of the editor must not
  // throw away what is being chosen here (every click would be undone at once).
  const settingsKey = JSON.stringify(settings);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, settingsKey, journalId]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!mounted) return null;

  const pageNum = localSettings.pageNumbering || DEFAULT_PAGE_NUMBERING;
  const [zone, align] = pageNum.position.split('-') as [PositionZone, PositionAlign];
  const patch = (p: Partial<LayoutSettings>) => setLocalSettings((prev) => ({ ...prev, ...p }));

  const updatePageNum = (p: Partial<PageNumberingSettings>) => {
    setLocalSettings((prev) => ({
      ...prev,
      pageNumbering: {
        ...(prev.pageNumbering || DEFAULT_PAGE_NUMBERING),
        ...p,
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

  const samplePage1 = formatSamplePage(pageNum.startNumber || 1, pageNum.format, pageNum.prefixText);
  const samplePage2 = formatSamplePage((pageNum.startNumber || 1) + 1, pageNum.format, pageNum.prefixText);
  const columnLayout = localSettings.columnLayout;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="layout-drawer-root"
          className="fixed inset-0 z-[1000] flex justify-start px-3 pb-3 pt-[calc(var(--titlebar-height,38px)+0.75rem)] overflow-hidden pointer-events-auto"
        >
          {/* Backdrop with smooth fade and blur */}
          <motion.div
            key="drawer-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="fixed inset-0 bg-black/30 backdrop-blur-xs cursor-pointer"
            onClick={onClose}
          />

          {/* Drawer panel with spring physics sliding in from the left */}
          <motion.div
            key="drawer-panel"
            role="dialog"
            aria-label="Cài đặt dàn trang PDF"
            initial={{ x: 'calc(-100% - 2rem)', opacity: 0.9 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 'calc(-100% - 2rem)', opacity: 0.9 }}
            transition={{ type: 'spring', stiffness: 280, damping: 28 }}
            className="relative z-10 w-full max-w-[500px] h-full rounded-[32px] bg-[#F8F9FA] shadow-2xl flex flex-col border border-white/60 overflow-hidden"
          >
            <SettingsHeader
              icon={<Sliders className="w-5 h-5" />}
              title="Cài đặt dàn trang PDF"
              subtitle="Mẫu tạp chí, khổ giấy, số trang, chữ và bảng"
              onClose={onClose}
              closeTitle="Đóng bảng cài đặt"
            />

            <div className={`flex-1 overflow-y-auto px-5 sm:px-6 py-3 custom-scrollbar ${sectionListClass}`}>
              {/* 1. Journal template */}
              <SettingsCard title="Mẫu tạp chí" hint="Quy tắc dàn trang của bài lấy theo tạp chí được chọn." icon={<BookOpen />}>
                {journalsLoading ? (
                  <Shimmer className="h-9 w-full rounded-2xl" />
                ) : (
                  <Select
                    value={findJournalInfo(localJournal)?.code ?? localJournal}
                    onChange={(val) => setLocalJournal(val)}
                    options={journalOptions}
                    size="sm"
                    variant="clean"
                    searchable={true}
                    searchPlaceholder={`Tìm kiếm trong ${journals.length} tạp chí VNUHCM...`}
                  />
                )}
              </SettingsCard>

              {/* 2. Paper, orientation, columns */}
              <SettingsCard title="Khổ giấy và bố cục" icon={<FileText />}>
                <Field label="Khổ giấy" aside={<span className="text-[10px] text-zinc-400 font-medium">XeLaTeX</span>}>
                  <div role="radiogroup" aria-label="Khổ giấy" className="grid grid-cols-2 gap-2.5">
                    {PAPER_SIZES.map((s) => (
                      <ChoiceCard
                        key={s.id}
                        selected={localSettings.paperSize === s.id}
                        onClick={() => patch({ paperSize: s.id })}
                        title={s.title}
                        sub={s.sub}
                        tag={s.tag}
                      />
                    ))}
                  </div>
                </Field>

                <div data-testid="orientation-setting">
                  <Field label="Hướng trang" hint="Trang đầu (khối tiêu đề) luôn để dọc." aside={<RotateCw className="w-3.5 h-3.5 text-zinc-400" />}>
                    <SegmentedOptions
                      ariaLabel="Hướng trang toàn bộ nội dung"
                      value={localSettings.orientation ?? 'portrait'}
                      onChange={(orientation) => patch({ orientation })}
                      options={[
                        { value: 'portrait', label: 'Dọc', testId: 'orientation-portrait' },
                        { value: 'landscape', label: 'Ngang', testId: 'orientation-landscape' },
                      ]}
                    />
                  </Field>
                </div>

                <Field label="Số cột của nội dung" aside={<Columns className="w-3.5 h-3.5 text-zinc-400" />}>
                  <div role="radiogroup" aria-label="Số cột" className="grid grid-cols-2 gap-2.5">
                    <ChoiceCard
                      selected={columnLayout === '2-column'}
                      onClick={() => patch({ columnLayout: '2-column' })}
                      title="2 cột"
                      sub="Chuẩn tạp chí ĐHQG-HCM"
                      tag={<Tag tone="green">Mặc định</Tag>}
                    >
                      <MiniPage>
                        <MiniLines />
                        <MiniLines widths={['w-full', 'w-5/6', 'w-2/3']} />
                      </MiniPage>
                    </ChoiceCard>
                    <ChoiceCard
                      selected={columnLayout === '1-column'}
                      onClick={() => patch({ columnLayout: '1-column' })}
                      title="1 cột"
                      sub="Nội dung trải rộng toàn trang"
                      tag={<Tag tone="blue">Toàn trang</Tag>}
                    >
                      <MiniPage>
                        <MiniLines widths={['w-full', 'w-4/5', 'w-full']} />
                      </MiniPage>
                    </ChoiceCard>
                  </div>
                </Field>
              </SettingsCard>

              {/* 3. Page numbers */}
              <SettingsCard
                title="Đánh số trang"
                hint="Vị trí, kiểu số và trang bắt đầu."
                icon={<Hash />}
                aside={
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={pageNum.enabled}
                      onChange={(e) => updatePageNum({ enabled: e.target.checked })}
                      aria-label="Bật đánh số trang"
                      className="sr-only peer"
                    />
                    <span className="w-9 h-5 rounded-full bg-zinc-200 peer-checked:bg-[#78C841] transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:h-4 after:w-4 after:rounded-full after:bg-white after:shadow-xs after:transition-all peer-checked:after:translate-x-4" />
                  </label>
                }
              >
                {pageNum.enabled && (
                  <div className="space-y-3.5 animate-in fade-in">
                    <div className="flex items-center justify-between gap-2 rounded-2xl bg-zinc-50 border border-zinc-200/70 px-3 py-2">
                      <span className="flex items-center gap-1.5 text-[11px] font-medium text-zinc-600">
                        <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                        Hiển thị thực tế
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-xl bg-white border border-zinc-200 text-xs font-mono font-bold text-zinc-800">{samplePage1}</span>
                        <span className="text-zinc-300 text-xs">→</span>
                        <span className="px-2.5 py-0.5 rounded-xl bg-white border border-zinc-200 text-xs font-mono font-bold text-zinc-800">{samplePage2}</span>
                      </span>
                    </div>

                    <Field label="Vị trí">
                      <div className="space-y-2">
                        <SegmentedOptions
                          ariaLabel="Số trang ở đầu hay chân trang"
                          value={zone}
                          onChange={(z) => updatePageNum({ position: `${z}-${align}` as PageNumberingSettings['position'] })}
                          options={ZONES}
                        />
                        <SegmentedOptions
                          ariaLabel="Căn số trang"
                          value={align}
                          onChange={(a) => updatePageNum({ position: `${zone}-${a}` as PageNumberingSettings['position'] })}
                          options={ALIGNS}
                        />
                      </div>
                    </Field>

                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Kiểu số">
                        <Select
                          value={pageNum.format}
                          onChange={(f) => updatePageNum({ format: f })}
                          options={NUMBER_FORMATS}
                          size="sm"
                          variant="clean"
                        />
                      </Field>
                      <Field label="Bắt đầu từ trang số" hint="Hữu ích khi đóng tập san, kỷ yếu.">
                        <NumberInput
                          value={pageNum.startNumber || 1}
                          onChange={(v) => updatePageNum({ startNumber: Math.max(1, Math.round(v) || 1) })}
                          min={1}
                          max={9999}
                          step={1}
                          variant="flat-white"
                          ariaLabel="Bắt đầu từ trang số"
                        />
                      </Field>
                    </div>

                    <Field label="Tiền tố" hint="Để trống nếu chỉ cần hiện số.">
                      <input
                        type="text"
                        value={pageNum.prefixText || ''}
                        onChange={(e) => updatePageNum({ prefixText: e.target.value })}
                        placeholder='Ví dụ: "Trang" hoặc "Page"'
                        className={textInputClass}
                      />
                    </Field>

                    <ToggleRow
                      checked={pageNum.suppressOnFirstPage}
                      onChange={(v) => updatePageNum({ suppressOnFirstPage: v })}
                      label="Ẩn số ở trang đầu"
                      hint="Trang đầu của bài báo (khối tiêu đề) không in số, như bài báo ĐHQG-HCM."
                    />
                  </div>
                )}
              </SettingsCard>

              {/* 4. Type and spacing */}
              <SettingsCard title="Chữ và khoảng cách" hint="Cỡ chữ, giãn dòng, khoảng cách giữa hai cột và phông chữ." icon={<Type />}>
                <Field label="Cỡ chữ bài báo">
                  <SegmentedOptions
                    ariaLabel="Cỡ chữ bài báo"
                    value={localSettings.fontSize || '9pt'}
                    onChange={(fontSize) => patch({ fontSize })}
                    options={[
                      { value: '9pt', label: '9pt (chuẩn)' },
                      { value: '10pt', label: '10pt' },
                      { value: '11pt', label: '11pt' },
                    ]}
                  />
                </Field>
                <Field label="Hệ số giãn dòng">
                  <SegmentedOptions
                    ariaLabel="Hệ số giãn dòng"
                    value={localSettings.lineSpacing || '1.13'}
                    onChange={(lineSpacing) => patch({ lineSpacing })}
                    options={[
                      { value: '1.13', label: '1.13× (chuẩn)' },
                      { value: '1.2', label: '1.2×' },
                      { value: '1.3', label: '1.3×' },
                    ]}
                  />
                </Field>
                {columnLayout === '2-column' && (
                  <Field label="Khoảng cách giữa hai cột">
                    <SegmentedOptions
                      ariaLabel="Khoảng cách giữa hai cột"
                      value={localSettings.columnSep || '1pc'}
                      onChange={(columnSep) => patch({ columnSep })}
                      options={[
                        { value: '1pc', label: '1pc (chuẩn)' },
                        { value: '1.5pc', label: '1.5pc' },
                        { value: '2pc', label: '2pc' },
                      ]}
                    />
                  </Field>
                )}
                <ThemeFontsFields
                  theme={localSettings.theme}
                  onChange={(theme) => patch({ theme })}
                />
              </SettingsCard>

              <ThemeMarginsCard theme={localSettings.theme} onChange={(theme) => patch({ theme })} />
              <ThemeColorsCard theme={localSettings.theme} onChange={(theme) => patch({ theme })} />
              <ThemeTablesCard theme={localSettings.theme} onChange={(theme) => patch({ theme })} />

              {/* 5. References and last page */}
              <div data-testid="layout-references-section">
                <SettingsCard title="Tài liệu tham khảo và trang cuối" hint="Cách in DOI và cân đối trang cuối." icon={<BookOpen />}>
                  <Field
                    label="DOI ở cuối mỗi tài liệu tham khảo"
                    hint={'Chỉ tài liệu đã có DOI mới được in. Tạp chí KH&CN (STD) in liên kết không kèm chữ "Available from:".'}
                  >
                    <SegmentedOptions
                      ariaLabel="DOI ở cuối mỗi tài liệu tham khảo"
                      value={localSettings.referenceDoi || 'journal'}
                      onChange={(referenceDoi) => patch({ referenceDoi })}
                      options={[
                        { value: 'journal', label: 'Theo tạp chí', testId: 'layout-reference-doi-journal' },
                        { value: 'available', label: '"Available from:"', testId: 'layout-reference-doi-available' },
                        { value: 'link', label: 'Chỉ liên kết', testId: 'layout-reference-doi-link' },
                        { value: 'none', label: 'Không in', testId: 'layout-reference-doi-none' },
                      ]}
                    />
                  </Field>
                  <ToggleRow
                    testId="layout-balanceColumns"
                    checked={localSettings.balanceColumns !== false}
                    onChange={(v) => patch({ balanceColumns: v })}
                    label="Cân bằng hai cột ở trang cuối"
                    hint="Hai cột kết thúc ngang nhau thay vì cột trái đầy còn cột phải ngắn."
                  />
                  <ToggleRow
                    testId="layout-rangeDash"
                    checked={localSettings.rangeDash !== false}
                    onChange={(v) => patch({ rangeDash: v })}
                    label="Gạch ngang dài cho khoảng số"
                    hint="Đổi 268-9 và 2016-2023 thành 268–9 và 2016–2023 như bản in của tạp chí."
                  />
                </SettingsCard>
              </div>

              <div className="flex justify-center pt-1 pb-1">
                <ThemeResetButton onChange={(theme) => patch({ theme })} />
              </div>
            </div>

            <SettingsFooter
              onReset={handleReset}
              resetTitle="Khôi phục về quy chuẩn ban đầu của tạp chí"
              resetIcon={<RotateCcw className="w-3.5 h-3.5" />}
              primaryLabel="Áp dụng & Biên dịch PDF"
              onPrimary={handleApply}
              primaryDisabled={isCompiling}
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};
