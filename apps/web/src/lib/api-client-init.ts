'use client';

import { setGlobalApiErrorHandler, type GlobalApiErrorInfo } from '@structpaper/api-client';
import { toast, sileo } from '@/components/toast';

/**
 * Bridge between UI-agnostic @structpaper/api-client and Next.js Web UI.
 * Registers global toast presentation for any unhandled network or API failures.
 */
if (typeof window !== 'undefined') {
  setGlobalApiErrorHandler((errorInfo: GlobalApiErrorInfo) => {
    const { title, description, status, rawError } = errorInfo;

    // Deduplication ID: Prevents duplicate toasts stacking up across concurrent calls
    const dedupeId = `api-error-${status}-${title}`;

    // Concurrency conflicts (409/412) are non-fatal warnings with resolution options (Keep Mine),
    // whereas all other failures (4xx/5xx/network offline) are errors.
    const isConflictWarning = status === 409 || status === 412;
    const notify = isConflictWarning ? sileo.warning : toast.error;

    notify({
      id: dedupeId,
      title,
      description,
      error: rawError,
      status,
    });
  });
}
