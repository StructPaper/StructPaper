import { http } from '../http';
import type {
  UploadIntent,
  UploadIntentResponse,
  UploadComplete,
  AssetResponse,
} from '@structpaper/contracts';

export const assetApi = {
  putAsset: <T = any>(
    sha256: string,
    data: Blob | Buffer | Uint8Array | ArrayBuffer | any,
    contentType?: string,
  ) => {
    return http.put<T>(`/api/v1/assets/${sha256}`, data, {
      headers: {
        'Content-Type': contentType || 'application/octet-stream',
      },
    }) as unknown as Promise<T>;
  },

  getAssetBlob: (sha256: string) => {
    return http.get<Blob>(`/api/v1/assets/${sha256}`, {
      responseType: 'blob',
    }) as unknown as Promise<Blob>;
  },

  hasAsset: async (sha256: string): Promise<boolean> => {
    return http
      .head(`/api/v1/assets/${sha256}`)
      .then(() => true)
      .catch((err: any) => {
        if (err?.status === 404 || err?.response?.status === 404) {
          return false;
        }
        throw err;
      });
  },

  createUploadIntent: <T = UploadIntentResponse>(data: UploadIntent) => {
    return http.post<T>('/api/v1/assets/upload-intent', data) as unknown as Promise<T>;
  },

  completeUpload: <T = AssetResponse>(data: UploadComplete) => {
    return http.post<T>('/api/v1/assets/upload-complete', data) as unknown as Promise<T>;
  },

  getAsset: <T = AssetResponse>(id: string) => {
    return http.get<T>(`/api/v1/assets/${id}`) as unknown as Promise<T>;
  },
};
