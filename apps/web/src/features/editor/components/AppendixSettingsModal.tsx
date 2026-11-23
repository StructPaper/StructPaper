'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { Check, ListOrdered, RotateCcw, MapPin, RotateCw } from 'lucide-react';
import { POPUP_EDGE, POPUP_TOP } from '@/lib/popup-bounds';
import { APPENDIX_PLACEMENTS, DEFAULT_APPENDIX, type AppendixPlacement, type AppendixSettings } from '@/lib/appendix';
import { SegmentedOptions } from './sections/SegmentedOptions';
import { SettingsCard, SettingsFooter, SettingsHeader, ToggleRow, sectionListClass } from './settings-ui';

interface Props {
  isOpen?: boolean;
  /** The button that opened it: the popup opens beside it, as the table and figure settings do. */
  triggerRect?: DOMRect;
  settings: AppendixSettings;
  onSave: (settings: AppendixSettings) => void;
  onClose: () => void;
}

/** Where the appendices are printed, how they are numbered, and whether their sheets are turned. */
export const AppendixSettingsModal: React.FC<Props> = ({ isOpen = true, triggerRect, settings, onSave, onClose }) => {
  const [mounted, setMounted] = useState(false);
  const [placement, setPlacement] = useState<AppendixPlacement>(settings.placement);
  const [numbering, setNumbering] = useState<AppendixSettings['numbering']>(settings.numbering);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  useEffect(() => {
    if (isOpen) {
      setPlacement(settings.placement);
      setNumbering(settings.numbering);
    }
  }, [isOpen, settings]);

  if (!mounted || !isOpen) return null;

  const viewportH = typeof window !== 'undefined' ? window.innerHeight : 800;
  const maxH = Math.min(640, viewportH - POPUP_TOP - POPUP_EDGE);
  const style: React.CSSProperties = triggerRect
    ? {
        position: 'fixed',
        top: Math.max(POPUP_TOP, Math.min(triggerRect.top, viewportH - maxH - POPUP_EDGE)),
        maxHeight: maxH,
        right: Math.max(16, (typeof window !== 'undefined' ? window.innerWidth : 1200) - triggerRect.right),
      }
    : { position: 'fixed', top: POPUP_TOP, maxHeight: maxH, right: '25%' };

  return createPortal(
    <div className="fixed inset-0 z-[9999] overflow-hidden pointer-events-auto">
      <div className="fixed inset-0 bg-transparent cursor-default" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.16, ease: 'easeOut' }}
        style={style}
        role="dialog"
        aria-label="Cài đặt phụ lục"
        data-testid="appendix-settings"
        className="z-10 w-[400px] max-w-[calc(100vw-2rem)] rounded-[28px] border border-white/60 bg-[#F8F9FA] shadow-[0_12px_44px_rgba(0,0,0,0.20),0_4px_16px_rgba(0,0,0,0.10)] overflow-hidden flex flex-col text-left select-none pointer-events-auto"
      >
        <SettingsHeader compact title="Cài đặt phụ lục" subtitle="Vị trí và cách đánh số các phụ lục" onClose={onClose} closeTitle="Đóng cài đặt phụ lục (Esc)" />

        <div className={`flex-1 overflow-y-auto px-5 py-3 custom-scrollbar ${sectionListClass}`}>
          <SettingsCard title="Vị trí khi in" hint="Phụ lục luôn thấy ở thẻ Phụ lục, dù in ở đâu." icon={<MapPin />}>
            <SegmentedOptions<AppendixPlacement>
              ariaLabel="Vị trí phụ lục"
              value={placement}
              onChange={setPlacement}
              options={APPENDIX_PLACEMENTS.map((p) => ({ value: p.value, label: p.label, title: p.hint, testId: `appendix-placement-${p.value}` }))}
            />
            <p className="mt-1.5 text-[10.5px] text-slate-500 leading-snug">{APPENDIX_PLACEMENTS.find((p) => p.value === placement)?.hint}</p>
          </SettingsCard>

          <SettingsCard title="Cách đánh số" hint="Phụ lục có số riêng, bắt đầu từ đầu và không tính vào Bảng, Hình của bài." icon={<ListOrdered />}>
            <SegmentedOptions<AppendixSettings['numbering']>
              ariaLabel="Cách đánh số phụ lục"
              value={numbering}
              onChange={setNumbering}
              options={[
                { value: 'number', label: 'Phụ lục 1, 2, 3', testId: 'appendix-numbering-number' },
                { value: 'letter', label: 'Phụ lục A, B, C', testId: 'appendix-numbering-letter' },
              ]}
            />
          </SettingsCard>
        </div>

        <SettingsFooter
          onReset={() => {
            setPlacement(DEFAULT_APPENDIX.placement);
            setNumbering(DEFAULT_APPENDIX.numbering);
          }}
          resetTitle="Khôi phục cài đặt phụ lục về mặc định"
          resetIcon={<RotateCcw className="w-3.5 h-3.5" />}
          onCancel={onClose}
          cancelTitle="Hủy các thay đổi và đóng"
          primaryLabel="Lưu"
          primaryIcon={<Check className="w-3.5 h-3.5" />}
          primaryTitle="Lưu cài đặt phụ lục"
          onPrimary={() => {
            onSave({ placement, numbering });
            onClose();
          }}
        />
      </motion.div>
    </div>,
    document.body
  );
};
