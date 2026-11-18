import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { CompletePaper } from '@/types/paper';
import { toast, toastStore } from '@/components/toast';
import { useEditorSession } from '@/context/EditorSessionContext';
import { isUuid } from '@/features/papers/components/types';
import { journalKeyOf } from '@/lib/templates';
import { useJournals } from './useJournals';
import { useUpgradeProfile } from './usePaperProfile';

type Pin = NonNullable<CompletePaper['profilePin']>;

export interface PaperProfileSessionOptions {
  isOutdated: boolean;
  latestPin?: Pin;
  /** The paper after the server moved it to the newest rules. */
  onUpgraded: (pin: Pin, version: number) => void;
}

export const upgradeToastId = (paperId: string) => `profile-upgrade-${paperId}`;

/**
 * Keeps the title bar's "which rules apply" dialog informed about the open paper, and tells the author (with a toast that
 * stays until they act or dismiss it) when the journal published newer rules. Dismissing is only for now: the toast
 * comes back the next time the paper is opened, and the dialog always offers the upgrade.
 */
export function usePaperProfileSession(paper: CompletePaper, { isOutdated, latestPin, onUpgraded }: PaperProfileSessionOptions) {
  const { setPaperProfile } = useEditorSession();
  const { find } = useJournals();
  const upgrade = useUpgradeProfile();
  const onUpgradedRef = useRef(onUpgraded);
  onUpgradedRef.current = onUpgraded;

  const journalId = paper.metadata?.journalId;
  const journal = find(journalId);
  const paperId = paper.id;
  const serverPaper = isUuid(paperId);

  const runUpgrade = useCallback(() => {
    if (!serverPaper) return;
    upgrade.mutate(paperId, {
      onSuccess: (result) => {
        onUpgradedRef.current(result.profilePin as Pin, result.version);
        toastStore.dismissToast(upgradeToastId(paperId));
        toast.success('Đã nâng cấp quy tắc', 'Bài báo giờ dàn trang theo quy tắc mới nhất của tạp chí.');
      },
      onError: (err) => toast.error('Không thể nâng cấp', err.message),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paperId, serverPaper]);

  const info = useMemo(() => {
    if (!journalId || !serverPaper) return null;
    const meta = paper.metadata;
    return {
      paperId,
      journalKey: journal?.key ?? journalKeyOf(journalId),
      journalName: { vi: journal?.name ?? meta.journalName ?? journalId, en: journal?.nameEn ?? meta.journalName ?? journalId },
      journalShort: journal?.code ?? meta.journalAbbv ?? journalId,
      journalColor: journal?.color ?? '#71717a',
      articleType: meta.articleType ? { vi: meta.articleType, en: meta.articleTypeEn || meta.articleType } : null,
      pin: paper.profilePin,
      latestPin,
      isOutdated,
      isUpgrading: upgrade.isPending,
      onUpgrade: runUpgrade,
    };
  }, [journalId, serverPaper, paperId, journal, paper.metadata, paper.profilePin, latestPin, isOutdated, upgrade.isPending, runUpgrade]);

  useEffect(() => {
    setPaperProfile(info);
    return () => setPaperProfile(null);
  }, [info, setPaperProfile]);

  // one toast per paper, on arrival and whenever the paper becomes outdated; it leaves when the paper is up to date
  useEffect(() => {
    const id = upgradeToastId(paperId);
    if (!isOutdated || !serverPaper) {
      toastStore.dismissToast(id);
      return;
    }
    toast.warning('Tạp chí vừa ban hành quy tắc mới', 'Bài báo này vẫn giữ quy tắc cũ cho tới khi bạn nâng cấp.', {
      id,
      duration: Infinity,
      action: { label: 'Nâng cấp quy tắc', onClick: runUpgrade },
    });
    return () => toastStore.dismissToast(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOutdated, paperId, serverPaper]);

  return { isUpgrading: upgrade.isPending, upgrade: runUpgrade };
}
