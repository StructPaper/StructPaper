import { findManuscriptDuplicates, isMockModeEnabled, type TitleDuplicate } from '@structpaper/api-client';

export type { TitleDuplicate };

/**
 * Who has already uploaded a paper with this title (names and dates only, the server shows nothing
 * else). Never throws: offline or without an account the answer is simply "nobody we know of".
 */
export async function fetchTitleDuplicates(title: string): Promise<TitleDuplicate[]> {
  if (isMockModeEnabled() || !title.trim()) return [];
  try {
    return (await findManuscriptDuplicates({ title: title.trim() }, { skipGlobalToast: true } as any)) ?? [];
  } catch {
    return [];
  }
}

/** "21/10/2026" for a date string or Date; empty when it is not a date. */
export function formatUploadDate(value: string | Date | undefined): string {
  const d = value ? new Date(value) : null;
  if (!d || Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
