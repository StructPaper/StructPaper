import { http, isMockModeEnabled } from '@structpaper/api-client';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const previewPath = (id: string) => `/api/v1/manuscripts/${id}/preview`;
// The caller shows its own state; a failed background call must never raise a toast.
const quiet = { skipGlobalToast: true } as any;

/** Papers that live on the server can have a shared preview; local drafts can not. */
export const hasServerPreview = (id: string): boolean => UUID.test(id) && !isMockModeEnabled();

/**
 * Keeps the server copy of the latest compiled PDF up to date so people who may only read the
 * paper can see it. Best effort: it fails silently for anyone who may not edit (the API says no).
 */
export async function publishPdfPreview(id: string, pdf: Blob): Promise<void> {
  if (!hasServerPreview(id)) return;
  try {
    await http.put(previewPath(id), pdf, { ...quiet, headers: { 'Content-Type': 'application/pdf' } });
  } catch {
    // not allowed to publish, or offline: nothing to do
  }
}

/** The latest compiled PDF kept by the server, or null when there is none (or no access). */
export async function fetchPdfPreview(id: string): Promise<Blob | null> {
  if (!hasServerPreview(id)) return null;
  try {
    const blob: any = await http.get(previewPath(id), { ...quiet, responseType: 'blob' });
    return blob instanceof Blob && blob.size > 0 ? blob : null;
  } catch {
    return null;
  }
}
