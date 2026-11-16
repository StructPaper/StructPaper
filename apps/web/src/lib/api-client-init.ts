'use client';

import { setGlobalApiErrorHandler, type GlobalApiErrorInfo } from '@structpaper/api-client';
import { toast, sileo } from '@/components/toast';

if (typeof window !== 'undefined') {
  setGlobalApiErrorHandler((errorInfo: GlobalApiErrorInfo) => {
    const { title, description, status, rawError } = errorInfo;

    // Deduplication ID: Prevents duplicate toasts stacking up
    const dedupeId = `api-error-${status}-${title}`;

    // For 412 or 409 (version/data conflict), present as warning toast
    if (status === 412 || status === 409) {
      sileo.warning({
        id: dedupeId,
        title,
        description:
          description ||
          'Máy chủ đang có bản mới hơn từ phiên làm việc khác. Bạn có thể chọn "Ghi đè" trên thanh tiêu đề.',
        error: rawError,
        status,
      });
      return;
    }

    // For other errors (4xx, 5xx, network offline), present as error toast
    toast.error(title, description, {
      id: dedupeId,
      error: rawError,
      status,
    });
  });
}
