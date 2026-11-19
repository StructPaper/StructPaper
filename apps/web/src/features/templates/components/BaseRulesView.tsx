'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Layers, Send, AlertTriangle } from 'lucide-react';
import { useProfileVersions, usePublishRules, useJournalAccess, ProfileValidationError } from '@/features/journals';
import { Shimmer } from '@/components/ui/Shimmer';
import { toast } from '@/components/toast';
import { JournalVersionsTab } from './tabs/JournalVersionsTab';

/**
 * The rules every journal starts from (tier 1 of the profile). Each journal's own rules are laid over these, so
 * a change here reaches every journal that does not set the same thing itself. Meant for the people who run the system.
 */
export const BaseRulesView: React.FC = () => {
  const access = useJournalAccess('base', true);
  const versions = useProfileVersions('base', 'base');
  const publish = usePublishRules('base', 'base');

  const published = useMemo(() => versions.data?.find((v) => v.state === 'published'), [versions.data]);
  const [text, setText] = useState('');
  const [note, setNote] = useState('');
  const [issues, setIssues] = useState<{ path: string; message: string }[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);

  // show the published rules once they arrive (and again after a new version is published)
  useEffect(() => {
    if (published) setText(JSON.stringify(published.config, null, 2));
  }, [published?.id]);

  const submit = () => {
    setIssues([]);
    let config: Record<string, unknown>;
    try {
      config = JSON.parse(text);
      if (!config || typeof config !== 'object' || Array.isArray(config)) throw new Error('Quy tắc phải là một đối tượng JSON');
      setParseError(null);
    } catch (err) {
      setParseError((err as Error).message);
      return;
    }
    publish.mutate(
      { config, changeNote: note.trim() || undefined },
      {
        onSuccess: (v) => {
          setNote('');
          toast.success('Đã xuất bản', `Quy tắc dùng chung đã lên phiên bản ${v.version}. Mọi tạp chí kế thừa quy tắc mới.`);
        },
        onError: (err) => {
          if (err instanceof ProfileValidationError) setIssues(err.issues);
          toast.error('Chưa xuất bản được', err.message);
        },
      },
    );
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-5 pb-16 px-4 sm:px-6" data-testid="base-rules-view">
      <div className="flex items-center gap-3 pt-2">
        <Link href="/templates" className="p-2 rounded-xl bg-white border border-zinc-200 hover:bg-zinc-50" aria-label="Quay lại danh mục tạp chí">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
          <Layers className="w-5 h-5 text-[#78C841]" strokeWidth={3} />
          Quy tắc dùng chung (base)
        </h1>
      </div>

      <p className="text-xs text-zinc-600 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 flex gap-2">
        <AlertTriangle className="w-4 h-4 shrink-0 text-amber-700" />
        <span>
          Đây là quy tắc mà mọi tạp chí kế thừa. Tạp chí nào tự đặt cùng một thông số thì giữ giá trị của nó. Bài báo đã được ghim phiên bản
          vẫn giữ quy tắc cũ cho tới khi tác giả nâng cấp.
        </span>
      </p>

      {versions.isLoading ? (
        <div className="space-y-2" aria-busy="true">
          <Shimmer className="h-6 w-1/3 rounded-md" />
          <Shimmer className="h-72 w-full rounded-2xl" />
        </div>
      ) : versions.isError ? (
        <p className="text-xs font-bold text-rose-600">Không tải được quy tắc. Bạn có thể cần đăng nhập lại.</p>
      ) : (
        <div className="space-y-3 bg-white rounded-3xl border border-zinc-200/80 p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-extrabold text-zinc-900">Phiên bản đang xuất bản{published ? `: v${published.version}` : ''}</h2>
          </div>
          <textarea
            aria-label="Quy tắc dùng chung (JSON)"
            value={text}
            onChange={(e) => setText(e.target.value)}
            readOnly={!access.canCreate}
            spellCheck={false}
            className="w-full h-96 font-mono text-[11.5px] leading-relaxed bg-zinc-50 border border-zinc-200 rounded-2xl p-3 focus:border-[#78C841] focus:ring-2 focus:ring-[#78C841]/20 outline-none"
          />
          {parseError && <p className="text-xs font-bold text-rose-600">JSON chưa hợp lệ: {parseError}</p>}
          {issues.length > 0 && (
            <ul className="text-xs text-rose-700 space-y-1 bg-rose-50 border border-rose-200 rounded-2xl p-3" data-testid="base-rules-issues">
              {issues.map((i) => (
                <li key={`${i.path}-${i.message}`}>
                  <b>{i.path}</b>: {i.message}
                </li>
              ))}
            </ul>
          )}
          {access.canCreate ? (
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Ghi chú thay đổi (không bắt buộc)"
                className="flex-1 min-w-[220px] bg-white border border-zinc-200 rounded-xl px-3 py-2 text-xs focus:border-[#78C841] focus:ring-2 focus:ring-[#78C841]/20 outline-none"
              />
              <button
                type="button"
                onClick={submit}
                disabled={publish.isPending || !text.trim()}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#78C841] hover:bg-[#6cb43a] text-xs font-extrabold text-zinc-950 cursor-pointer disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                {publish.isPending ? 'Đang xuất bản...' : 'Kiểm tra và xuất bản'}
              </button>
            </div>
          ) : (
            <p className="text-xs font-bold text-zinc-500">Bạn chỉ có quyền xem quy tắc này.</p>
          )}
        </div>
      )}

      <div className="bg-white rounded-3xl border border-zinc-200/80">
        <JournalVersionsTab journalKey="base" scope="base" />
      </div>
    </div>
  );
};

export default BaseRulesView;
