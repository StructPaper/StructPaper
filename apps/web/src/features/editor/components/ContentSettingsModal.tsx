'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { Check, MousePointerClick, RotateCcw } from 'lucide-react';
import { POPUP_EDGE, POPUP_TOP } from '@/lib/popup-bounds';
import { SettingsCard, SettingsFooter, SettingsHeader, ToggleRow, sectionListClass } from './settings-ui';

export interface ContentSettings {
  /** The strip with the buttons to add a block unfolds under the block the pointer rests on. */
  hoverInsert: boolean;
}

export const DEFAULT_CONTENT_SETTINGS: ContentSettings = { hoverInsert: true };

interface Props {
  /** The button that opened it: the popup opens beside it, as the other settings popups do. */
  triggerRect?: DOMRect;
  settings: ContentSettings;
  onSave: (settings: ContentSettings) => void;
  onClose: () => void;
}

/** How the content tab behaves for the person using it (a preference of this browser, not a setting of the paper). */
export const ContentSettingsModal: React.FC<Props> = ({ triggerRect, settings, onSave, onClose }) => {
  const [mounted, setMounted] = useState(false);
  const [hoverInsert, setHoverInsert] = useState(settings.hoverInsert);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!mounted) return null;

  const viewportH = typeof window !== 'undefined' ? window.innerHeight : 800;
  const maxH = Math.min(520, viewportH - POPUP_TOP - POPUP_EDGE);
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
        transition={{ duration: 0.16, ease: 'easeOut' }}
        style={style}
        role="dialog"
        aria-label="Cài đặt nội dung"
        data-testid="content-settings"
        className="z-10 w-[400px] max-w-[calc(100vw-2rem)] rounded-[28px] border border-white/60 bg-[#F8F9FA] shadow-[0_12px_44px_rgba(0,0,0,0.20),0_4px_16px_rgba(0,0,0,0.10)] overflow-hidden flex flex-col text-left select-none"
      >
        <SettingsHeader compact title="Cài đặt nội dung" subtitle="Cách thẻ này hiển thị khi bạn soạn" onClose={onClose} closeTitle="Đóng cài đặt nội dung (Esc)" />

        <div className={`flex-1 overflow-y-auto px-5 py-3 custom-scrollbar ${sectionListClass}`}>
          <SettingsCard title="Thêm khối" hint="Lựa chọn này lưu trên trình duyệt của bạn, không thuộc bài báo." icon={<MousePointerClick />}>
            <ToggleRow
              checked={hoverInsert}
              onChange={setHoverInsert}
              label="Bung nút thêm khối khi rê chuột"
              hint="Rê chuột đến khối nào thì hàng nút Tiêu đề, Đoạn văn, Bảng, Hình… bung ra bên dưới khối đó. Tắt đi nếu thấy bung ra bung vào gây chóng mặt; cần thêm khối thì bật lại."
              testId="content-hover-insert"
            />
          </SettingsCard>
        </div>

        <SettingsFooter
          onReset={() => setHoverInsert(DEFAULT_CONTENT_SETTINGS.hoverInsert)}
          resetTitle="Khôi phục cài đặt nội dung về mặc định"
          resetIcon={<RotateCcw className="w-3.5 h-3.5" />}
          onCancel={onClose}
          cancelTitle="Hủy các thay đổi và đóng"
          primaryLabel="Lưu"
          primaryIcon={<Check className="w-3.5 h-3.5" />}
          primaryTitle="Lưu cài đặt nội dung"
          onPrimary={() => {
            onSave({ hoverInsert });
            onClose();
          }}
        />
      </motion.div>
    </div>,
    document.body
  );
};
