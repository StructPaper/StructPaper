'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { Download, RotateCw } from 'lucide-react';
import { SettingsCard, SettingsFooter, SettingsHeader, ToggleRow, sectionListClass } from './settings-ui';

export interface PdfExportOptions {
  /** The sheets of the turned pages (the appendices) are turned on their side; off = every sheet stays upright. */
  rotateSheets: boolean;
}

interface Props {
  /** The answer the popup starts from (the download is asked for upright sheets unless the person says otherwise). */
  initial: PdfExportOptions;
  onContinue: (options: PdfExportOptions) => void;
  onClose: () => void;
}

/**
 * Asked when the PDF is downloaded: how the file is to be made. Only what changes the file itself is asked here (the paper's own
 * settings stay as they are); more questions can be added as cards below.
 */
export const PdfExportOptionsModal: React.FC<Props> = ({ initial, onContinue, onClose }) => {
  const [mounted, setMounted] = useState(false);
  const [rotateSheets, setRotateSheets] = useState(initial.rotateSheets);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] overflow-hidden flex items-center justify-center p-4 pointer-events-auto">
      <div className="fixed inset-0 bg-black/30 backdrop-blur-xs cursor-default" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.16, ease: 'easeOut' }}
        role="dialog"
        aria-label="Tùy chọn tải PDF"
        data-testid="pdf-export-options"
        className="relative z-10 w-[420px] max-w-[calc(100vw-2rem)] rounded-[28px] border border-white/60 bg-[#F8F9FA] shadow-[0_12px_44px_rgba(0,0,0,0.20),0_4px_16px_rgba(0,0,0,0.10)] overflow-hidden flex flex-col text-left select-none"
      >
        <SettingsHeader compact icon={<Download className="w-5 h-5" />} title="Tải PDF" subtitle="Chọn cách tạo file trước khi tải" onClose={onClose} closeTitle="Đóng (Esc)" />

        <div className={`px-5 py-3 ${sectionListClass}`}>
          <SettingsCard title="Trang xoay" hint="Chỉ đổi tờ giấy của file tải về: cài đặt từng bảng, từng hình và bản xem trước không đổi." icon={<RotateCw />}>
            <ToggleRow
              checked={rotateSheets}
              onChange={setRotateSheets}
              label="Xoay tờ giấy"
              hint="Bật: trang có bảng, hình xoay in thành tờ ngang, dễ đọc trên màn hình. Tắt: tờ giấy vẫn thẳng đứng như thường (bảng, hình vẫn xoay theo cài đặt của từng cái)."
              testId="export-rotate-sheets"
            />
          </SettingsCard>
        </div>

        <SettingsFooter
          onCancel={onClose}
          cancelTitle="Không tải"
          primaryLabel="Tiếp tục"
          primaryIcon={<Download className="w-3.5 h-3.5" />}
          primaryTitle="Tạo và tải file PDF"
          onPrimary={() => onContinue({ rotateSheets })}
        />
      </motion.div>
    </div>,
    document.body
  );
};
