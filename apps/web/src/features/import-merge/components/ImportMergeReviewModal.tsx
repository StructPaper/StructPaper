'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { GitMerge, Loader2, ChevronDown, ChevronUp, ShieldCheck } from 'lucide-react';
import type { BlockChange } from '@structpaper/doc-diff';
import { ModalCard } from '@/components/modals';
import { Badge, BlockBody, KIND_BOX, Marked } from '@/features/history/components/DocumentDiffView';
import { blockTypeLabel } from '@/features/history/lib/block-settings';
import type { Analysis } from '@/lib/documents/word-source';
import { summarizePlan, suggestedSelection, type MergeProposal } from '@/lib/import-merge/three-way';

interface Props {
  analysis: Analysis;
  isOpen: boolean;
  busy: boolean;
  /** The comparison is being redone (the button "Hiện cả chỗ bài đang khác file"). */
  replanning?: boolean;
  onApply: (accepted: ReadonlySet<string>) => void;
  onCancel: () => void;
  onShowEdits: (on: boolean) => void;
}

const SCOPE_TITLE: Record<string, string> = { field: 'Thông tin bài', authors: 'Thông tin bài', references: 'Thông tin bài', block: 'Nội dung bài' };

function ProposalBody({ p }: { p: MergeProposal }) {
  if (p.scope !== 'block') {
    return (
      <div className="space-y-1.5 text-[13px] leading-relaxed text-zinc-800 whitespace-pre-wrap">
        {p.kind === 'modified' ? <Marked segments={p.inline} /> : p.kind === 'added' ? p.after : <del className="bg-rose-200/80 text-rose-900">{p.before}</del>}
      </div>
    );
  }
  const change: BlockChange = {
    id: p.id,
    kind: p.kind,
    type: String(p.blockType),
    index: 0,
    before: p.oursBlock,
    after: p.theirsBlock,
    inline: p.inline,
    fields: p.fields ?? [],
  };
  if (p.kind === 'removed') return <BlockBody section={p.oursBlock!} compare={false} />;
  if (p.kind === 'added') return <BlockBody section={p.theirsBlock!} compare={false} />;
  return <BlockBody section={p.theirsBlock!} before={p.oursBlock} change={change} compare />;
}

/**
 * The comparison screen of "read the Word file again": one card per difference, each ticked (apply) or not (keep as it is).
 * What the author never touched is suggested ticked; what was edited by hand is kept unless ticked. Layout is never in the list.
 */
export const ImportMergeReviewModal: React.FC<Props> = ({ analysis, isOpen, busy, replanning = false, onApply, onCancel, onShowEdits }) => {
  const { plan } = analysis;
  const [selected, setSelected] = useState<Set<string>>(() => suggestedSelection(plan));
  const [open, setOpen] = useState<Set<string>>(new Set());
  useEffect(() => {
    setSelected(suggestedSelection(plan));
  }, [plan]);
  useEffect(() => setOpen(new Set()), [analysis.fileName, analysis.theirs]);

  const summary = useMemo(() => summarizePlan(plan), [plan]);
  const groups = useMemo(() => {
    const out: Array<{ title: string; items: MergeProposal[] }> = [];
    for (const p of plan.proposals) {
      const title = SCOPE_TITLE[p.scope];
      let g = out.find((x) => x.title === title);
      if (!g) out.push((g = { title, items: [] }));
      g.items.push(p);
    }
    return out.sort((a, b) => (a.title === 'Thông tin bài' ? -1 : b.title === 'Thông tin bài' ? 1 : 0));
  }, [plan]);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const toggleOpen = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const BTN = 'inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[11px] font-bold bg-white hover:bg-zinc-50 text-zinc-800 border border-zinc-200/80 shadow-sm transition-all cursor-pointer active:scale-95 disabled:opacity-60 disabled:cursor-default';

  return (
    <ModalCard
      isOpen={isOpen}
      springExit
      animateLayout
      onClose={busy ? () => {} : onCancel}
      icon={<GitMerge className="w-5 h-5" />}
      title="So sánh với file Word"
      subtitle={`File “${analysis.fileName}”. Chọn những thay đổi muốn đưa vào bài; phần không chọn giữ nguyên như hiện tại.`}
      maxWidthClass="max-w-[820px]"
      zIndex={130}
      testId="import-merge-review"
      footer={
        <div className="flex items-center justify-between gap-3">
          <span className="text-[11px] font-semibold text-slate-500">
            Đã chọn {selected.size}/{summary.total}
          </span>
          <div className="flex gap-2.5">
            <button type="button" onClick={onCancel} disabled={busy} data-testid="import-merge-cancel" className="px-5 py-2.5 rounded-full text-xs sm:text-sm font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all cursor-pointer active:scale-95 disabled:opacity-60">
              Hủy
            </button>
            <button
              type="button"
              onClick={() => onApply(selected)}
              disabled={busy}
              data-testid="import-merge-apply"
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full text-xs sm:text-sm font-bold bg-zinc-900 hover:bg-zinc-700 text-white transition-all cursor-pointer active:scale-95 disabled:opacity-60"
            >
              {busy && <Loader2 className="w-4 h-4 animate-spin" />}
              {selected.size > 0 ? `Áp dụng ${selected.size} thay đổi` : 'Hoàn tất, không đổi gì'}
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-4 pb-1">
        <div className="rounded-3xl bg-gray-200/50 p-3.5 space-y-2 text-xs text-zinc-700 leading-relaxed">
          <p className="flex items-start gap-2 font-semibold">
            <ShieldCheck className="w-4 h-4 shrink-0 mt-px text-emerald-700" />
            <span>Cài đặt dàn trang của bài, cột, hướng giấy, cỡ chữ và thiết lập từng bảng/hình được giữ nguyên; chỉ nội dung được cập nhật.</span>
          </p>
          {plan.conservative ? (
            <p className="font-semibold text-amber-900" data-testid="import-merge-conservative">
              Bài này chưa có bản phân tích gốc để đối chiếu nên chưa biết phần nào bạn đã sửa tay: mọi khác biệt đều để không chọn, hãy chọn phần cần lấy từ file.
            </p>
          ) : (
            <p>
              {summary.clean} thay đổi ở phần bạn chưa sửa (đã chọn sẵn)
              {summary.conflicts > 0 ? `, ${summary.conflicts} thay đổi ở phần bạn đã sửa tay (không chọn sẵn để giữ bản của bạn).` : '.'}
            </p>
          )}
          <div className="flex gap-2 pt-0.5">
            <button type="button" className={BTN} onClick={() => setSelected(suggestedSelection(plan))} data-testid="import-merge-suggested">Chọn theo đề xuất</button>
            <button type="button" className={BTN} onClick={() => setSelected(new Set(plan.proposals.map((p) => p.id)))} data-testid="import-merge-all">Chọn tất cả</button>
            <button type="button" className={BTN} onClick={() => setSelected(new Set())} data-testid="import-merge-none">Bỏ chọn tất cả</button>
            {!plan.conservative && (
              <button type="button" className={BTN} onClick={() => onShowEdits(!plan.includeEdits)} disabled={busy || replanning} data-testid="import-merge-toggle-edits">
                {replanning && <Loader2 className="w-3 h-3 animate-spin" />}
                {replanning ? 'Đang so sánh...' : plan.includeEdits ? 'Chỉ hiện thay đổi mới từ file' : 'Hiện cả chỗ bài đang khác file'}
              </button>
            )}
          </div>
        </div>

        {plan.isEmpty && (
          <p className="text-sm text-slate-500 text-center py-6 leading-relaxed" data-testid="import-merge-empty">
            {plan.includeEdits
              ? 'Bài báo giống hệt file Word.'
              : 'File Word đọc ra giống hệt lần đọc đầu, không có gì mới để cập nhật. Phần bạn đã sửa tay được giữ nguyên. Bấm “Hiện cả chỗ bài đang khác file” nếu muốn xem những chỗ bạn đã sửa.'}
          </p>
        )}

        <div className={`relative space-y-4 transition-opacity duration-200 ${replanning ? 'opacity-40 pointer-events-none' : ''}`} aria-busy={replanning} data-testid="import-merge-list">
        {replanning && (
          <div className="absolute inset-x-0 top-6 z-10 flex justify-center pointer-events-none" data-testid="import-merge-replanning">
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-zinc-900 text-white text-xs font-bold shadow-lg">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Đang so sánh với file Word...
            </span>
          </div>
        )}
        {groups.map((g) => (
          <section key={g.title} className="space-y-2">
            <h4 className="text-xs font-extrabold text-zinc-900">{g.title}</h4>
            {g.items.map((p) => {
              const isOpen = open.has(p.id);
              const checked = selected.has(p.id);
              const label = p.scope === 'block' ? blockTypeLabel(p.blockType) : p.label;
              const preview = (p.kind === 'removed' ? p.before : p.after).replace(/\s+/g, ' ').slice(0, 110);
              return (
                <div key={p.id} data-testid={`import-merge-item-${p.id}`} data-conflict={p.conflict || undefined} className={`rounded-2xl px-3 py-2.5 ${KIND_BOX[p.kind]}`}>
                  <div className="flex items-start gap-2.5">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(p.id)}
                      aria-label={`Áp dụng: ${label}`}
                      data-testid={`import-merge-check-${p.id}`}
                      className="mt-1 w-4 h-4 accent-zinc-900 cursor-pointer shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge kind={p.kind} />
                        <span className="text-xs font-bold text-zinc-900 mb-1.5">{label}</span>
                        {p.conflict && !plan.conservative && (
                          <span className="mb-1.5 px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[10px] font-bold">{p.note ?? 'Bạn đã sửa tay'}</span>
                        )}
                      </div>
                      {!isOpen && <p className="text-[12px] text-zinc-600 truncate">{preview || '—'}</p>}
                      {isOpen && (
                        <div className="mt-1">
                          <ProposalBody p={p} />
                        </div>
                      )}
                    </div>
                    <button type="button" onClick={() => toggleOpen(p.id)} aria-label={isOpen ? 'Thu gọn' : 'Xem chi tiết'} className="shrink-0 w-7 h-7 rounded-full bg-white/70 hover:bg-white flex items-center justify-center text-zinc-600 cursor-pointer">
                      {isOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              );
            })}
          </section>
        ))}
        </div>
      </div>
    </ModalCard>
  );
};
