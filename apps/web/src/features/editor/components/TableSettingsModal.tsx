'use client';

import React, { useState, useEffect, useRef } from 'react';
import { TablePlacementAndBreak } from './TablePlacementAndBreak';
import { resolveBodyFill } from '@/lib/table-fill';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { PaperTable } from '@/types/paper';
import { NumberInput } from '@/components/ui/NumberInput';
import { Check, Columns, RotateCw, RotateCcw, Type, Grid3x3 } from 'lucide-react';
import { SegmentedOptions } from './sections/SegmentedOptions';
import { DEFAULT_THEME } from '@/lib/theme-config';
import { POPUP_EDGE, POPUP_TOP } from '@/lib/popup-bounds';
import { TableLookControls, applyLook, lookOf, type TableLookValue } from './TableLookControls';
import { ChoiceCard, Field, MiniLines, MiniPage, SettingsCard, SettingsFooter, SettingsHeader, ToggleRow, ValueBadge, sectionListClass } from './settings-ui';

interface TableSettingsModalProps {
  layoutId?: string;
  isOpen?: boolean;
  triggerRect?: DOMRect;
  table: PaperTable;
  onSave: (updated: PaperTable) => void;
  onClose: () => void;
  /** Shown beside the paper view of the table instead of as a popup: no backdrop, no Save, every change is handed over as it is made (onLive). */
  docked?: boolean;
  onLive?: (updated: PaperTable) => void;
}

const ROW_STRETCH = [
  { value: '1.1', label: '1.1×', title: '1.1x - Dày đặc, tiết kiệm diện tích' },
  { value: '1.2', label: '1.2×', title: '1.2x - Mặc định, như bản in của tạp chí' },
  { value: '1.4', label: '1.4×', title: '1.4x - Tiêu chuẩn, cân đối và thoáng đãng' },
  { value: '1.6', label: '1.6×', title: '1.6x - Rộng rãi, thoải mái cho các ô nhiều dòng' },
];

export const TableSettingsModal: React.FC<TableSettingsModalProps> = ({
  layoutId,
  isOpen = true,
  triggerRect,
  table,
  onSave,
  onClose,
  docked = false,
  onLive,
}) => {
  const [mounted, setMounted] = useState(false);

  // Initial column span
  const initialSpan = table.columnSpan || (table.isFullWidth === false ? '1-column' : '2-column');

  const [columnSpan, setColumnSpan] = useState<'1-column' | '2-column'>(initialSpan);
  const [isRotated, setIsRotated] = useState<boolean>(!!table.isRotated);
  const [fontSize, setFontSize] = useState<`${number}pt`>(table.fontSize || '8pt');
  const [rowStretch, setRowStretch] = useState<number>(table.rowStretch || 1.2);
  const [bodyFill, setBodyFill] = useState<'plain' | 'zebra' | 'shaded'>(resolveBodyFill(table));
  const [placement, setPlacement] = useState<'auto' | 'top' | 'here' | 'bottom'>(table.placement || 'auto');
  const [breakAcrossPages, setBreakAcrossPages] = useState<'auto' | 'always' | 'never'>(table.breakAcrossPages || 'auto');
  const [appendix, setAppendix] = useState<boolean>(!!table.appendix);
  const [sideColumn, setSideColumn] = useState<'auto' | 'text' | 'full'>(table.sideColumn || 'auto');
  const [look, setLook] = useState<TableLookValue>(() => lookOf(table));
  const [rowHeightTouched, setRowHeightTouched] = useState(false);
  const changeLook = (patch: Partial<TableLookValue>) => {
    if ('rowHeight' in patch) setRowHeightTouched(true);
    setLook((prev) => ({ ...prev, ...patch }));
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    // (docked beside the paper view, Esc belongs to that view)
    if (docked) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const syncedFor = useRef<string | null>(null);
  useEffect(() => {
    // docked, the choices follow the table only when another table is shown (the table itself changes under them as it is edited)
    if (docked && syncedFor.current === table.id) return;
    syncedFor.current = table.id;
    if (isOpen) {
      const span = table.columnSpan || (table.isFullWidth === false ? '1-column' : '2-column');
      setColumnSpan(span);
      setIsRotated(!!table.isRotated);
      setFontSize(table.fontSize || '8pt');
      setRowStretch(table.rowStretch || 1.2);
      setBodyFill(resolveBodyFill(table));
      setPlacement(table.placement || 'auto');
      setBreakAcrossPages(table.breakAcrossPages || 'auto');
      setSideColumn(table.sideColumn || 'auto');
      setAppendix(!!table.appendix);
      setLook(lookOf(table));
      setRowHeightTouched(false);
    }
  }, [isOpen, table]);

  // docked: what is chosen is handed over at once (the hooks stand before the early return below)
  const buildRef = useRef<() => PaperTable>(() => table);
  const stateKey = JSON.stringify([columnSpan, isRotated, fontSize, rowStretch, bodyFill, placement, breakAcrossPages, appendix, sideColumn, look]);
  const lastKey = useRef(stateKey);
  useEffect(() => {
    if (!docked || stateKey === lastKey.current) return;
    lastKey.current = stateKey;
    onLive?.(buildRef.current());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stateKey]);

  if (!mounted) return null;

  const handleReset = () => {
    setColumnSpan('2-column');
    setIsRotated(false);
    setFontSize('8pt');
    setRowStretch(1.2);
    setBodyFill('plain');
    setPlacement('auto');
    setSideColumn('auto');
    setLook({ borderStyle: 'journal', rowHeight: 0, headerHeight: 0 });
    setRowHeightTouched(true);
  };

  const rowCount = table.bodyRows?.length || table.rows?.length || 0;

  const buildUpdated = (): PaperTable => ({
      ...applyLook(table, look, rowCount, rowHeightTouched),
      columnSpan,
      isFullWidth: columnSpan === '2-column',
      isRotated,
      fontSize,
      rowStretch,
      bodyFill,
      hasZebraStripes: bodyFill === 'zebra',
      placement,
      breakAcrossPages,
      sideColumn,
      appendix: appendix || undefined,
  });
  const handleSave = () => {
    onSave(buildUpdated());
    onClose();
  };

  buildRef.current = buildUpdated;

  // never taller than the window, and placed so the whole dialog stays on screen
  const viewportH = typeof window !== 'undefined' ? window.innerHeight : 800;
  const maxH = Math.min(680, viewportH - POPUP_TOP - POPUP_EDGE);
  const modalStyle: React.CSSProperties = triggerRect
    ? {
      position: 'fixed',
      top: Math.max(POPUP_TOP, Math.min(triggerRect.top, viewportH - maxH - POPUP_EDGE)),
      maxHeight: maxH,
      right: Math.max(16, (typeof window !== 'undefined' ? window.innerWidth : 1200) - triggerRect.right),
    }
    : {
      position: 'fixed',
      top: POPUP_TOP,
      maxHeight: maxH,
      right: '25%',
    };

  const panel = (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.16, ease: 'easeOut' }}
        style={docked ? undefined : modalStyle}
        role={docked ? 'region' : 'dialog'}
        data-docked={docked ? 'true' : undefined}
        aria-label={`Cài đặt ${table.num ? `Bảng ${table.num}` : 'bảng'}`}
        className={`${docked ? 'h-full w-full' : 'z-10 w-[400px] max-w-[calc(100vw-2rem)]'} rounded-[28px] border border-white/60 bg-[#F8F9FA] shadow-[0_12px_44px_rgba(0,0,0,0.20),0_4px_16px_rgba(0,0,0,0.10)] overflow-hidden flex flex-col text-left select-none pointer-events-auto`}
      >
        <SettingsHeader
          compact
          title={`Cài đặt ${table.num ? `Bảng ${table.num}` : 'bảng'}`}
          subtitle="Cỡ, vị trí và cách bảng được dàn trên PDF"
          onClose={onClose}
          closeTitle="Đóng bảng cài đặt (Esc)"
        />

        <div className={`flex-1 overflow-y-auto px-5 py-3 custom-scrollbar ${sectionListClass}`}>
          {/* 0. Appendix */}
          <SettingsCard title="Phụ lục" hint="Bảng phụ lục có số riêng (Phụ lục 1, 2, 3) và được in thành nhóm riêng, không tính vào các bảng của bài.">
            <ToggleRow
              checked={appendix}
              onChange={(on) => {
                setAppendix(on);
                // an appendix table is turned and set across the whole page, as the journal prints them (each setting below can be changed)
                if (on) {
                  setIsRotated(true);
                  setColumnSpan('2-column');
                  setSideColumn('full');
                }
              }}
              label="Đây là phụ lục"
              hint="Chuyển bảng này sang thẻ Phụ lục; mặc định xoay ngang và chiếm cả trang."
              testId="table-appendix-toggle"
            />
          </SettingsCard>

          {/* 1. Where the table sits */}
          <SettingsCard title="Vị trí trên trang" hint="Bảng nằm trong một cột hay trải qua cả hai cột, thẳng hay xoay ngang." icon={<Columns />}>
            <div role="radiogroup" aria-label="Bố cục số cột bảng" className="grid grid-cols-2 gap-2.5">
              <ChoiceCard
                selected={columnSpan === '1-column'}
                onClick={() => setColumnSpan('1-column')}
                title="1 cột"
                sub="Vừa trong một cột văn bản"
                tooltip="1 Cột: Bảng thu gọn trong 1 cột văn bản (thích hợp bảng 2-3 cột dữ liệu)"
              >
                <MiniPage>
                  <MiniLines tone="object" widths={['w-full', 'w-full', 'w-2/3']} />
                  <MiniLines />
                </MiniPage>
              </ChoiceCard>
              <ChoiceCard
                selected={columnSpan === '2-column'}
                onClick={() => setColumnSpan('2-column')}
                title="2 cột"
                sub="Trải ngang cả trang"
                tooltip="2 Cột: Bảng trải ngang cả 2 cột của trang (thích hợp bảng rộng, nhiều cột dữ liệu)"
              >
                <MiniPage>
                  <MiniLines tone="object" widths={['w-full', 'w-full', 'w-full']} />
                </MiniPage>
              </ChoiceCard>
            </div>

            <Field label="Hướng bảng" title="Xoay bảng 90° nếu bảng có nhiều cột" aside={<RotateCw className="w-3.5 h-3.5 text-zinc-400" />}>
              <SegmentedOptions
                ariaLabel="Hướng hiển thị bảng"
                value={isRotated ? 'rotated' : 'upright'}
                onChange={(v) => setIsRotated(v === 'rotated')}
                options={[
                  { value: 'upright', label: 'Chiều dọc', title: 'Bảng thẳng đứng theo chiều dọc của trang' },
                  { value: 'rotated', label: 'Xoay ngang 90°', title: 'Xoay bảng sang chế độ ngang giúp chứa được bảng rất nhiều cột' },
                ]}
              />
            </Field>
          </SettingsCard>

          {/* 2. Type and rows */}
          <SettingsCard title="Chữ và hàng" icon={<Type />}>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Cỡ chữ" title="Giảm cỡ chữ để bảng nhiều cột không bị tràn lề" aside={<ValueBadge title={`Cỡ chữ hiện tại: ${fontSize}`}>{fontSize}</ValueBadge>}>
                <NumberInput
                  value={parseFloat(fontSize) || 8}
                  onChange={(v) => setFontSize(`${Math.round(v * 2) / 2}pt` as `${number}pt`)}
                  min={5}
                  max={14}
                  step={0.5}
                  unit="pt"
                  variant="flat-white"
                  ariaLabel="Cỡ chữ bảng (pt)"
                />
              </Field>
              <Field label="Giãn dòng" title="Khoảng đệm giữa các hàng của bảng" aside={<ValueBadge title={`Độ giãn dòng hiện tại: ${rowStretch}x`}>{rowStretch}×</ValueBadge>}>
                <SegmentedOptions
                  ariaLabel="Giãn dòng"
                  value={String(rowStretch)}
                  onChange={(v) => setRowStretch(Number(v))}
                  options={ROW_STRETCH}
                />
              </Field>
            </div>
          </SettingsCard>

          {/* 3. Lines, colours and row heights */}
          <SettingsCard title="Đường kẻ và màu" hint="Kẻ ngang, kẻ dọc, lưới, màu dải tiêu đề và chiều cao hàng." icon={<Grid3x3 />} testId="table-look">
            <TableLookControls value={look} onChange={changeLook} themeHeader={DEFAULT_THEME.tableHeaderColor} themeTint={DEFAULT_THEME.tableZebraColor} />
          </SettingsCard>

          {/* 4. Fill, anchor, page breaks */}
          <SettingsCard title="Nền và ngắt trang" hint="Màu thân bảng, nơi bảng được ưu tiên đặt và cách bảng dài sang trang kế.">
            <TablePlacementAndBreak
              placement={placement}
              onPlacement={setPlacement}
              breakAcrossPages={breakAcrossPages}
              onBreakAcrossPages={setBreakAcrossPages}
              bodyFill={bodyFill}
              onBodyFill={setBodyFill}
              sideColumn={sideColumn}
              onSideColumn={setSideColumn}
            />
          </SettingsCard>
        </div>

        {!docked && (
        <SettingsFooter
          onReset={handleReset}
          resetTitle="Khôi phục tất cả cài đặt bảng về giá trị mặc định"
          resetIcon={<RotateCcw className="w-3.5 h-3.5" />}
          onCancel={onClose}
          cancelTitle="Hủy các thay đổi và đóng"
          primaryLabel="Lưu"
          primaryIcon={<Check className="w-3.5 h-3.5" />}
          primaryTitle="Lưu các thông số cài đặt này cho bảng dữ liệu"
          onPrimary={handleSave}
        />
        )}
      </motion.div>
  );

  if (docked) return panel;
  return createPortal(
    <div className="fixed inset-0 z-[9999] overflow-hidden pointer-events-auto">
      {/* Transparent backdrop: a click outside closes */}
      <div key="table-backdrop" className="fixed inset-0 bg-transparent cursor-default" onClick={onClose} />
      {panel}
    </div>,
    document.body
  );
};
