'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { listTrash, getTrashedManuscript, restoreFromTrash, purgeFromTrash, bulkTrash, type TrashList, type TrashPreview } from '@structpaper/api-client';
import { idleQueryClient, useOptionalQueryClient } from '@/lib/optional-query-client';

export const trashKey = (search: string) => ['trash', 'list', search] as const;

/** The deleted papers the user may restore (a manager sees those of their journals, SuperAdmin all). */
export function useTrash(search: string, enabled = true) {
  const client = useOptionalQueryClient();
  return useQuery<TrashList>(
    {
      queryKey: trashKey(search),
      queryFn: ({ signal }) => listTrash({ ...(search ? { search } : {}), limit: 200 }, undefined, signal),
      enabled: !!client && enabled,
      staleTime: 10_000,
    },
    client ?? idleQueryClient,
  );
}

/** One deleted paper with its content, to read it before restoring or deleting it for good. */
export function useTrashedManuscript(id: string) {
  const client = useOptionalQueryClient();
  return useQuery<TrashPreview>(
    {
      queryKey: ['trash', 'item', id],
      queryFn: ({ signal }) => getTrashedManuscript(id, undefined, signal),
      enabled: !!client && !!id,
      staleTime: 30_000,
      retry: false,
    },
    client ?? idleQueryClient,
  );
}

/** Restore and delete-for-good, one or many; each one refreshes the trash and the paper lists. */
export function useTrashActions() {
  const client = useOptionalQueryClient() ?? idleQueryClient;
  const refresh = async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: ['trash'] }),
      client.invalidateQueries({ queryKey: ['/api/v1/manuscripts'] }),
      client.invalidateQueries({ queryKey: ['manuscripts'] }),
    ]);
  };
  const restore = useMutation({ mutationFn: (id: string) => restoreFromTrash(id), onSuccess: refresh }, client);
  const purge = useMutation({ mutationFn: (id: string) => purgeFromTrash(id), onSuccess: refresh }, client);
  // many at once (the selection, or everything); `ids` left out means every paper the caller can see
  const bulk = useMutation({ mutationFn: (v: { action: 'restore' | 'purge'; ids?: string[] }) => bulkTrash(v), onSuccess: refresh }, client);
  return { restore, purge, bulk };
}
