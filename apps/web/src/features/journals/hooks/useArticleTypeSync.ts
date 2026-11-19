import { useEffect, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import { changeManuscriptArticleType } from '@structpaper/api-client';
import type { CompletePaper } from '@/types/paper';
import { idleQueryClient, useOptionalQueryClient } from '@/lib/optional-query-client';
import { isUuid } from '@/features/papers/components/types';
import { toast } from '@/components/toast';

/**
 * Keeps the server's article type of a paper (and with it the pinned rules of that type) in step with the type
 * the author chose in the editor. The choice is stored on the paper as `metadata.articleTypeCode`; the server
 * moves the paper to that type's rules and answers with the new pin.
 *
 * Nothing is sent for a paper that only exists on this machine (the server reads the choice when it first
 * saves it), or when the server already has that type.
 */
export function useArticleTypeSync(paper: CompletePaper, setPaper: (update: (prev: CompletePaper) => CompletePaper) => void): void {
  const client = useOptionalQueryClient() ?? idleQueryClient;
  const change = useMutation(
    { mutationFn: (v: { id: string; code: string }) => changeManuscriptArticleType(v.id, { articleType: v.code }) },
    client,
  );
  // a choice the server refused is not asked again until the author chooses something else
  const attempted = useRef<string | null>(null);

  const chosen = paper.metadata?.articleTypeCode;
  useEffect(() => {
    if (!chosen || !isUuid(paper.id)) return;
    if (chosen === paper.articleTypeCode) {
      attempted.current = null;
      return;
    }
    const key = `${paper.id}:${chosen}`;
    if (attempted.current === key) return;
    attempted.current = key;
    change.mutate(
      { id: paper.id, code: chosen },
      {
        onSuccess: (result) =>
          setPaper((prev) => ({
            ...prev,
            articleTypeCode: result.articleType ?? undefined,
            profilePin: result.profilePin as CompletePaper['profilePin'],
            version: result.version ?? prev.version,
          })),
        onError: (err) => toast.error('Không đổi được loại bài trên máy chủ', err.message),
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chosen, paper.id, paper.articleTypeCode]);
}
