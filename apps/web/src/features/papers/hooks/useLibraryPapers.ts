import { useMemo } from 'react';
import { useListManuscripts } from '@structpaper/api-client';
import type { ManuscriptRecord } from '@structpaper/doc-model';
import { remoteManuscriptToRecord } from './usePapersHub';

/** Which list the papers page shows. */
export type LibraryMode = 'mine' | 'public' | 'shared';

export const LIBRARY_LABELS: Record<Exclude<LibraryMode, 'mine'>, { label: string; empty: string }> = {
  public: { label: 'Kho bài public', empty: 'Chưa có bài báo nào được chia sẻ công khai.' },
  shared: { label: 'Được chia sẻ với tôi', empty: 'Bạn chưa mở bài nào được chia sẻ qua liên kết. Mở một liên kết bài báo, bài đó sẽ nằm lại ở đây.' },
};

/**
 * The server-side lists that sit next to "my papers": every paper shared with anyone, and the ones
 * I opened through a link. `records` is null in 'mine' mode (the normal hub list is used then).
 */
export function useLibraryPapers(mode: LibraryMode): { records: ManuscriptRecord[] | null; isLoading: boolean; isError: boolean } {
  const query = useListManuscripts({ scope: mode === 'mine' ? undefined : mode, limit: 100 }, { query: { enabled: mode !== 'mine' } });
  const records = useMemo(
    () => (mode === 'mine' ? null : ((query.data as any)?.items ?? []).map(remoteManuscriptToRecord)),
    [mode, query.data],
  );
  return { records, isLoading: mode !== 'mine' && query.isLoading, isError: mode !== 'mine' && query.isError };
}
