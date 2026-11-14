import { useState, useCallback } from 'react';
import {
  useCreateUploadIntent,
  useCompleteUpload,
  isMockModeEnabled,
  type AssetResponse,
} from '@structpaper/api-client';
import { sileo } from '@/components/DynamicIslandToast';

export interface UseAssetUploadOptions {
  showToast?: boolean;
  onSuccess?: (asset: AssetResponse) => void;
  onError?: (error: any) => void;
}

export interface UseAssetUploadReturn {
  uploadFile: (file: File, manuscriptId?: string) => Promise<AssetResponse>;
  isUploading: boolean;
  progress: number;
  error: any;
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function useAssetUpload(options: UseAssetUploadOptions = {}): UseAssetUploadReturn {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<any>(null);

  const createIntentMutation = useCreateUploadIntent();
  const completeMutation = useCompleteUpload();

  const uploadFile = useCallback(
    async (file: File, manuscriptId?: string): Promise<AssetResponse> => {
      setIsUploading(true);
      setProgress(10);
      setError(null);

      const isValidUuid = manuscriptId
        ? /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(manuscriptId)
        : false;

      // 1. Mock / Offline Mode
      if (isMockModeEnabled()) {
        try {
          const dataUrl = await fileToDataUrl(file);
          setProgress(100);
          const mockAsset: AssetResponse = {
            id: crypto.randomUUID(),
            filename: file.name,
            mimeType: file.type || 'application/octet-stream',
            fileSize: file.size,
            storageKey: `local-data/${file.name}`,
            checksum: `local-${file.size}`,
            manuscriptId: isValidUuid ? manuscriptId : undefined,
            createdAt: new Date().toISOString(),
          };

          if (options.showToast !== false) {
            sileo.success({
              title: 'Tải tệp thành công (Ngoại tuyến)',
              description: `Đã lưu tạm "${file.name}" trong trình duyệt.`,
            });
          }

          options.onSuccess?.(mockAsset);
          return mockAsset;
        } catch (err: any) {
          setError(err);
          throw err;
        } finally {
          setIsUploading(false);
        }
      }

      // 2. Cloud Mode: 3-step MinIO / S3 Presigned Upload
      try {
        // Step 1: Request presigned intent
        setProgress(25);
        const intent = await createIntentMutation.mutateAsync({
          data: {
            filename: file.name,
            mimeType: file.type || 'application/octet-stream',
            fileSize: file.size,
            manuscriptId: isValidUuid ? manuscriptId : undefined,
          },
        });

        // Step 2: Direct PUT to S3 / MinIO
        setProgress(50);
        const s3Response = await fetch(intent.uploadUrl, {
          method: 'PUT',
          headers: {
            'Content-Type': file.type || 'application/octet-stream',
          },
          body: file,
        });

        if (!s3Response.ok) {
          throw new Error(`S3 upload failed with HTTP status ${s3Response.status}`);
        }

        const etag = s3Response.headers.get('etag')?.replace(/"/g, '') || `chk-${Date.now()}`;
        setProgress(75);

        // Step 3: Confirm upload completion
        const completedAsset = await completeMutation.mutateAsync({
          data: {
            storageKey: intent.storageKey,
            checksum: etag,
            filename: file.name,
            mimeType: file.type || 'application/octet-stream',
            fileSize: file.size,
            manuscriptId: isValidUuid ? manuscriptId : undefined,
          },
        });

        setProgress(100);

        if (options.showToast !== false) {
          sileo.success({
            title: 'Tải tài nguyên thành công',
            description: `Đã lưu "${file.name}" lên máy chủ lưu trữ đám mây.`,
          });
        }

        options.onSuccess?.(completedAsset);
        return completedAsset;
      } catch (err: any) {
        console.error('[useAssetUpload] Upload failed:', err);
        setError(err);

        const msg =
          err?.detail ||
          err?.response?.data?.detail ||
          err?.message ||
          'Không thể tải tệp lên máy chủ.';

        if (options.showToast !== false) {
          sileo.error({
            title: 'Lỗi tải tệp',
            description: msg,
          });
        }

        options.onError?.(err);
        throw err;
      } finally {
        setIsUploading(false);
      }
    },
    [createIntentMutation, completeMutation, options],
  );

  return {
    uploadFile,
    isUploading: isUploading || createIntentMutation.isPending || completeMutation.isPending,
    progress,
    error,
  };
}
