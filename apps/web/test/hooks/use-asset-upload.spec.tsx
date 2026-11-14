// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAssetUpload } from '@/hooks/useAssetUpload';

const mockCreateIntent = vi.fn();
const mockCompleteUpload = vi.fn();

vi.mock('@structpaper/api-client', async () => {
  const actual = await vi.importActual<any>('@structpaper/api-client');
  return {
    ...actual,
    isMockModeEnabled: () => false,
    useCreateUploadIntent: () => ({
      mutateAsync: mockCreateIntent,
      isPending: false,
    }),
    useCompleteUpload: () => ({
      mutateAsync: mockCompleteUpload,
      isPending: false,
    }),
  };
});

vi.mock('@/components/DynamicIslandToast', () => ({
  sileo: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('useAssetUpload Custom Hook (Task 4)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('completes 3-step upload: intent -> S3 PUT -> complete confirmation', async () => {
    mockCreateIntent.mockResolvedValueOnce({
      uploadUrl: 'http://localhost:9000/assets/presigned-key',
      storageKey: 'assets/sample.png',
      expiresIn: 3600,
    });

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ etag: '"sample-etag"' }),
    });
    global.fetch = mockFetch;

    mockCompleteUpload.mockResolvedValueOnce({
      id: '00000000-0000-0000-0000-000000000001',
      filename: 'sample.png',
      mimeType: 'image/png',
      fileSize: 1024,
      storageKey: 'assets/sample.png',
      checksum: 'sample-etag',
    });

    const file = new File(['fake content'], 'sample.png', { type: 'image/png' });

    const { result } = renderHook(() => useAssetUpload({ showToast: false }), {
      wrapper: createWrapper(),
    });

    let res: any = null;
    await act(async () => {
      res = await result.current.uploadFile(file, '00000000-0000-0000-0000-000000000099');
    });

    expect(mockCreateIntent).toHaveBeenCalledWith({
      data: expect.objectContaining({
        filename: 'sample.png',
        mimeType: 'image/png',
        fileSize: 12, // length of 'fake content'
        manuscriptId: '00000000-0000-0000-0000-000000000099',
      }),
    });

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:9000/assets/presigned-key',
      expect.objectContaining({
        method: 'PUT',
        body: file,
      }),
    );

    expect(mockCompleteUpload).toHaveBeenCalledWith({
      data: expect.objectContaining({
        storageKey: 'assets/sample.png',
        filename: 'sample.png',
      }),
    });

    expect(res).toBeDefined();
    expect(res?.id).toBe('00000000-0000-0000-0000-000000000001');
  });
});
