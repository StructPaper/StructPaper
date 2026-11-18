import { useCallback, useState } from 'react';
import { sileo } from '@/components/toast';
import { copyToClipboard } from '@/features/permissions/utils';

/** The address that opens a paper (read-only for people who may only read it). */
export const manuscriptLink = (manuscriptId: string): string =>
  `${typeof window !== 'undefined' ? window.location.origin : ''}/papers/${encodeURIComponent(manuscriptId)}`;

export function useCopyManuscriptLink(manuscriptId: string) {
  const [copied, setCopied] = useState(false);
  const copy = useCallback(async () => {
    const ok = await copyToClipboard(manuscriptLink(manuscriptId));
    if (ok) {
      setCopied(true);
      sileo.success({ title: 'Đã sao chép liên kết bài báo' });
      setTimeout(() => setCopied(false), 2000);
    } else {
      sileo.info({ title: 'Chưa sao chép được tự động', description: 'Hãy sao chép địa chỉ trên thanh trình duyệt.' });
    }
  }, [manuscriptId]);
  return { copy, copied };
}
