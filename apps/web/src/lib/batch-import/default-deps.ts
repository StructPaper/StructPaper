import { normalizeCompletePaper } from '@/types/paper';
import { resolvePaperLayout } from '@/lib/layout/paper-profile';
import { publishPdfPreview } from '@/lib/editor/pdf-preview-sync';
import { fetchTitleDuplicates } from '@/lib/storage/title-duplicates';
import { parseDocxFile } from '@/lib/docx-parser';
import { exportToLatex } from '@/lib/exporters';
import { extractPaperImagesAsync } from '@/lib/media/figure-image-utils';
import { validateForImport } from '@/lib/validation/validators';
import { getUnifiedStorage } from '@/lib/storage/storage-factory';
import { collectAllExistingTitles } from '@/lib/storage/paper-naming';
import { DocumentApi } from '@/lib/documents/document-api';
import { defaultDatabase, IndexedDbManuscriptRepo } from '@structpaper/storage';
import { abortError } from './limiter';
import { getAuthHeaders } from '../auth-headers';
import type { BatchDeps } from './types';

/** PDF from the compile endpoint (the same one the editor uses). */
export async function compileToPdf(
  tex: string,
  images: Record<string, string>,
  signal: AbortSignal,
  fetchFn: typeof fetch = fetch
): Promise<Blob> {
  let res: Response;
  try {
    res = await fetchFn('/api/compile-latex', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await getAuthHeaders()) },
      body: JSON.stringify({ tex, images }),
      signal,
    });
  } catch (e) {
    if (signal.aborted) throw abortError();
    throw new Error('Không kết nối được máy chủ biên dịch');
  }
  if (!res.ok) {
    let detail = '';
    try {
      const j = await res.json();
      detail = [j.error, j.details].filter(Boolean).join(': ');
    } catch {
      /* not JSON */
    }
    throw new Error(detail.slice(0, 300) || `Biên dịch thất bại (HTTP ${res.status})`);
  }
  return res.blob();
}

/** Only the pictures the LaTeX source names (the editor's helper sends every figure under several aliases). */
export function referencedImages(tex: string, images: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(images).filter(([name]) => tex.includes(name)));
}

/** Server copies are skipped in tests and when sync is switched off (same rule as the editor autosave). */
const remoteSync = () => process.env.NODE_ENV !== 'test' && process.env.NEXT_PUBLIC_DISABLE_SYNC !== '1';

export function createBatchDeps(): BatchDeps {
  const api = remoteSync() ? new DocumentApi() : null;
  return {
    async parse(file) {
      try {
        return await parseDocxFile(await file.arrayBuffer(), file.name);
      } catch (e) {
        console.warn('[batch-import] cannot read', file.name, e);
        throw new Error('Không đọc được tệp Word: tệp có thể bị hỏng hoặc không phải .docx');
      }
    },
    async existingTitles() {
      if (typeof indexedDB === 'undefined') return [];
      return collectAllExistingTitles(await new IndexedDbManuscriptRepo(defaultDatabase).listRecords());
    },
    findDuplicates: (title) => fetchTitleDuplicates(title),
    // Same storage as the papers page and the editor: this device and the server (or the server alone when
    // local storage is off). The server may give the paper its own id; `paper.id` is updated by the save.
    async save(paper) {
      await getUnifiedStorage().savePaper(paper);
      return true;
    },
    load: (id) => getUnifiedStorage().loadPaper(id),
    check(paper) {
      const r = validateForImport(paper);
      return { errors: r.errorCount, warnings: r.warningCount };
    },
    async compile(paper, signal) {
      const started = performance.now();
      const ready = normalizeCompletePaper(paper);
      const tex = exportToLatex(ready, resolvePaperLayout(ready));
      const blob = await compileToPdf(tex, referencedImages(tex, await extractPaperImagesAsync(ready)), signal);
      return { blob, ms: Math.round(performance.now() - started) };
    },
    // The PDF becomes the copy readers see (only for papers that are on the server; silent when not allowed)
    archive: api ? (paper, pdf) => publishPdfPreview(paper.id, pdf) : undefined,
  };
}
