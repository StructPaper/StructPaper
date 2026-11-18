'use client';

import React from 'react';
import { Sparkles } from 'lucide-react';
import type { CompletePaper } from '@/types/paper';
import { toast } from '@/components/toast';
import { isUuid } from '@/features/papers/components/types';
import { useUpgradeProfile } from '../hooks/usePaperProfile';

interface ProfileUpgradeBannerProps {
  paper: CompletePaper;
  /** The newer versions exist (see usePaperProfile). */
  isOutdated: boolean;
  /** Called with the paper's new pin and version after the server moved it. */
  onUpgraded: (pin: NonNullable<CompletePaper['profilePin']>, version: number) => void;
}

/**
 * Tells the author the journal published newer rules since the paper was written, and lets them move the paper
 * over. Nothing changes until they do: the paper keeps the layout it has.
 */
export const ProfileUpgradeBanner: React.FC<ProfileUpgradeBannerProps> = ({ paper, isOutdated, onUpgraded }) => {
  const upgrade = useUpgradeProfile();
  // a paper that only exists on this machine has not been pinned by the server yet
  if (!isOutdated || !isUuid(paper.id)) return null;

  const run = () =>
    upgrade.mutate(paper.id, {
      onSuccess: (result) => {
        onUpgraded(result.profilePin as NonNullable<CompletePaper['profilePin']>, result.version);
        toast.success('Đã nâng cấp quy tắc', 'Bài báo giờ dàn trang theo quy tắc mới nhất của tạp chí.');
      },
      onError: (err) => toast.error('Không thể nâng cấp', err.message),
    });

  return (
    <div
      role="status"
      data-testid="profile-upgrade-banner"
      className="flex items-center gap-3 px-4 py-2 bg-amber-50 border-b border-amber-200 text-xs text-amber-900"
    >
      <Sparkles className="w-4 h-4 shrink-0" />
      <span className="flex-1 font-semibold">
        Tạp chí vừa ban hành quy tắc dàn trang mới. Bài báo này vẫn giữ quy tắc cũ cho tới khi bạn nâng cấp.
      </span>
      <button
        type="button"
        onClick={run}
        disabled={upgrade.isPending}
        className="shrink-0 px-3 py-1.5 rounded-xl bg-amber-900 text-white font-bold hover:bg-amber-800 disabled:opacity-60 cursor-pointer"
      >
        {upgrade.isPending ? 'Đang nâng cấp...' : 'Nâng cấp quy tắc'}
      </button>
    </div>
  );
};
