'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { CircleHelp, ExternalLink, Loader2, Sparkles, CheckCircle2 } from 'lucide-react';
import { ModalCard } from '@/components/modals';
import { useEditorSession, type PaperProfileInfo } from '@/context/EditorSessionContext';

const TIERS: { key: 'base' | 'journal' | 'articleType'; label: string; hint: string }[] = [
  { key: 'base', label: 'Quy tắc chung', hint: 'Dùng cho mọi tạp chí' },
  { key: 'journal', label: 'Quy tắc của tạp chí', hint: 'Dàn trang, tóm tắt, trích dẫn' },
  { key: 'articleType', label: 'Quy tắc của loại bài', hint: 'Các mục bắt buộc của loại bài' },
];

const PILL =
  'relative inline-flex items-center justify-center w-7 h-7 rounded-full text-zinc-600 bg-zinc-100 hover:bg-[#78C841] hover:text-zinc-950 transition-all duration-200 cursor-pointer select-none active:scale-95';

/** The dialog: which journal, article type and rule versions this paper is laid out under, and whether newer ones exist. */
export const PaperProfileInfoModal: React.FC<{ info: PaperProfileInfo; isOpen: boolean; onClose: () => void }> = ({ info, isOpen, onClose }) => (
  <ModalCard
    isOpen={isOpen}
    onClose={onClose}
    icon={<CircleHelp className="w-5 h-5" />}
    title="Quy tắc đang áp dụng"
    subtitle="Bài báo này được dàn trang theo các phiên bản quy tắc dưới đây. Phiên bản không tự đổi khi tạp chí ban hành quy tắc mới."
    maxWidthClass="max-w-[560px]"
    testId="paper-profile-info-modal"
    footer={
      <div className="grid grid-cols-2 gap-2.5">
        <button
          type="button"
          onClick={onClose}
          className="w-full py-2.5 rounded-full text-xs sm:text-sm font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all cursor-pointer active:scale-95"
        >
          Đóng
        </button>
        <Link
          href={`/templates/journal/${info.journalKey}`}
          onClick={onClose}
          data-testid="paper-profile-open-journal"
          className="w-full py-2.5 rounded-full text-xs sm:text-sm font-bold bg-zinc-900 hover:bg-zinc-700 text-white transition-all cursor-pointer inline-flex items-center justify-center gap-1.5 hover:scale-102 active:scale-98"
        >
          <ExternalLink className="w-4 h-4" />
          <span>Xem quy định tạp chí</span>
        </Link>
      </div>
    }
  >
    <div className="space-y-3 pb-1">
      <div className="flex items-center gap-3 p-3.5 rounded-3xl bg-gray-200/50">
        <span className="shrink-0 px-2.5 py-1 rounded-xl text-[10.5px] font-extrabold text-white" style={{ backgroundColor: info.journalColor }}>
          {info.journalShort}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-extrabold text-zinc-900 truncate">{info.journalName.vi}</p>
          <p className="text-[11px] text-zinc-500 truncate">{info.articleType ? `Loại bài: ${info.articleType.vi}` : 'Chưa chọn loại bài'}</p>
        </div>
      </div>

      <div className="rounded-3xl bg-gray-200/50 p-1.5 space-y-1" data-testid="paper-profile-tiers">
        {TIERS.map((tier) => {
          const pinned = info.pin?.[tier.key];
          if (tier.key === 'articleType' && !pinned && !info.articleType) return null;
          const latest = info.latestPin?.[tier.key];
          const behind = !!pinned && !!latest && latest > pinned;
          return (
            <div key={tier.key} className="flex items-center gap-3 px-3 py-2.5 rounded-2xl bg-white/70" data-testid={`profile-tier-${tier.key}`}>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-zinc-900">{tier.label}</p>
                <p className="text-[11px] text-zinc-500">{tier.hint}</p>
              </div>
              <span className="shrink-0 px-2.5 py-1 rounded-xl bg-zinc-900 text-white text-[11px] font-extrabold">{pinned ? `v${pinned}` : 'mặc định'}</span>
              {behind ? (
                <span className="shrink-0 px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[10.5px] font-bold">mới nhất v{latest}</span>
              ) : (
                pinned && (
                  <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#D9F99D] text-[#14532D] text-[10.5px] font-bold">
                    <CheckCircle2 className="w-3 h-3" />
                    mới nhất
                  </span>
                )
              )}
            </div>
          );
        })}
      </div>

      {info.isOutdated && (
        <div className="rounded-3xl bg-amber-50 p-3.5 space-y-2.5" data-testid="paper-profile-upgrade">
          <p className="flex items-start gap-2 text-xs font-semibold text-amber-900 leading-relaxed">
            <Sparkles className="w-4 h-4 shrink-0 mt-px" />
            <span>Tạp chí vừa ban hành quy tắc mới. Bài báo này vẫn giữ quy tắc cũ cho tới khi bạn nâng cấp.</span>
          </p>
          <button
            type="button"
            onClick={info.onUpgrade}
            disabled={info.isUpgrading}
            data-testid="paper-profile-upgrade-btn"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-amber-900 hover:bg-amber-800 text-white text-xs font-bold transition-all cursor-pointer disabled:opacity-60 active:scale-95"
          >
            {info.isUpgrading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            <span>{info.isUpgrading ? 'Đang nâng cấp...' : 'Nâng cấp quy tắc'}</span>
          </button>
        </div>
      )}
    </div>
  </ModalCard>
);

/** Title-bar "?" beside the share button: opens the dialog above. Dotted amber when newer rules are waiting. */
export const PaperProfileInfoButton: React.FC = () => {
  const { paperProfile } = useEditorSession();
  const [open, setOpen] = useState(false);
  if (!paperProfile) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-testid="titlebar-paper-profile"
        data-no-drag="true"
        title="Quy tắc đang áp dụng cho bài báo"
        aria-label="Quy tắc đang áp dụng cho bài báo"
        className={PILL}
      >
        <CircleHelp className="w-3.5 h-3.5" />
        {paperProfile.isOutdated && <span className="absolute top-0 right-0 w-2 h-2 rounded-full bg-amber-500 ring-2 ring-gray-200" data-testid="paper-profile-dot" />}
      </button>
      <PaperProfileInfoModal info={paperProfile} isOpen={open} onClose={() => setOpen(false)} />
    </>
  );
};
