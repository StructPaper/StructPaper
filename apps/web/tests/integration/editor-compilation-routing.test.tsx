// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, cleanup, renderHook } from '@testing-library/react';
import { toast, toastStore } from '@/components/toast/toast-store';
import { useEditorCompilation } from '@/features/editor';
import { PublicationPreview } from '@/components/preview/PublicationPreview';
import { PreviewActionsToolbar } from '@/features/editor';
import {
  CompilerRouter,
  NetworkMonitor,
  typesetLatexToPdf,
  type CompilerPort,
  type CompileRequest,
  type CompileResult,
} from '@structpaper/compiler-client';
import type { CompletePaper } from '@/types/paper';

// Mock framer-motion for happy-dom
vi.mock('framer-motion', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('framer-motion');
  return {
    ...actual,
    AnimatePresence: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
    motion: new Proxy(actual.motion as Record<string, unknown>, {
      get: (_target, prop: string) => {
        const MotionComp = React.forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement>>(
          ({ children, ...props }, ref) => {
            const Component = prop as unknown as React.ElementType;
            const strippedProps = { ...props } as Record<string, unknown>;
            delete strippedProps.initial;
            delete strippedProps.animate;
            delete strippedProps.exit;
            delete strippedProps.transition;
            return <Component ref={ref} {...strippedProps}>{children}</Component>;
          }
        );
        MotionComp.displayName = `Motion_${prop}`;
        return MotionComp;
      },
    }),
  };
});

// Mock exporters
vi.mock('@/lib/exporters', () => ({
  exportToLatex: vi.fn(() => '\\documentclass{article}\\begin{document}Hello\\end{document}'),
  generateLatexPackageZip: vi.fn(async () => new Blob(['fake zip'])),
}));

const mockPaper: CompletePaper = {
  id: 'paper-unit-test-1',
  metadata: {
    title: 'Nghiên cứu Định tuyến Biên dịch Hai Tầng',
    journalId: 'VNUHCM-HS',
    journalName: 'Tạp chí Khoa học Sức khỏe ĐHQG-HCM',
  } as any,
  sections: [
    {
      id: 'sec-1',
      type: 'paragraph',
      title: 'Giới thiệu',
      content: 'Nội dung thử nghiệm.',
    },
  ],
  references: [],
};

function createMockPort(kind: 'browser-wasm' | 'server-native', pdfBytes = 2048): CompilerPort {
  return {
    kind,
    compile: vi.fn(async (req: CompileRequest): Promise<CompileResult> => {
      const blob = new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' });
      return {
        status: 'success',
        pdfBlob: blob,
        pdfUrl: `blob:mock-${kind}-pdf`,
        logs: [`Compiled successfully using ${kind}`],
        durationMs: kind === 'browser-wasm' ? 220 : 850,
        producedBy: {
          kind,
          environmentId: kind === 'browser-wasm' ? 'tl2026.1-wasm' : 'tl2026-server',
        },
        engine: kind === 'browser-wasm' ? 'XeLaTeX WASM' : 'Server XeLaTeX',
      };
    }),
  };
}

describe('Editor UI Compilation Routing & Full Flow Integration (Task 7)', () => {
  beforeEach(() => {
    toastStore.clear();
    vi.clearAllMocks();
    if (typeof URL.createObjectURL === 'undefined') {
      URL.createObjectURL = vi.fn((blob: Blob) => `blob:mock-url-${blob.size}`);
      URL.revokeObjectURL = vi.fn();
    }
  });

  afterEach(() => {
    cleanup();
    toastStore.clear();
  });

  describe('useEditorCompilation Hook Integration', () => {
    it('initializes with CompilerRouter and routes to server when online with userPreference="server"', async () => {
      const serverPort = createMockPort('server-native');
      const wasmPort = createMockPort('browser-wasm');
      const networkMonitor = new NetworkMonitor({
        initialOnline: true,
        initialServerReachable: true,
      });

      const router = new CompilerRouter({
        server: serverPort,
        local: wasmPort,
        getContext: () => ({
          online: networkMonitor.isOnline(),
          serverReachable: networkMonitor.isServerReachable(),
          localEnv: 'ready',
          localEnvMatches: true,
          deviceScore: 90,
          pageEstimate: 4,
          assetBytes: 1024,
          recentLocalFailures: [],
          userPreference: 'server',
          parity: 'same',
          localDisabledByFlag: false,
          saveData: false,
        }),
      });

      const onUpdatePaper = vi.fn();

      const { result } = renderHook(() =>
        useEditorCompilation({
          paper: mockPaper,
          formData: mockPaper,
          onUpdatePaper,
          router,
          networkMonitor,
          debounceMs: 10,
        })
      );

      // Perform compile
      let pdfUrl: string | null = null;
      await act(async () => {
        pdfUrl = await result.current.compileLatexToPdf();
      });

      expect(pdfUrl).toBeTruthy();
      expect(serverPort.compile).toHaveBeenCalled();
      expect(wasmPort.compile).not.toHaveBeenCalled();

      // compileStats should record engine kind
      expect(result.current.compileStats).not.toBeNull();
      expect(result.current.compileStats?.producedBy?.kind).toBe('server-native');
      expect(result.current.compileStats?.engineKind).toBe('server-native');
    });

    it('triggers sticky full-width toast and routes to WasmCompiler when offline', async () => {
      const serverPort = createMockPort('server-native');
      const wasmPort = createMockPort('browser-wasm');
      const networkMonitor = new NetworkMonitor({
        initialOnline: true,
        initialServerReachable: true,
      });

      const router = new CompilerRouter({
        server: serverPort,
        local: wasmPort,
        getContext: () => ({
          online: networkMonitor.isOnline(),
          serverReachable: networkMonitor.isServerReachable(),
          localEnv: 'ready',
          localEnvMatches: true,
          deviceScore: 90,
          pageEstimate: 4,
          assetBytes: 1024,
          recentLocalFailures: [],
          userPreference: 'auto',
          parity: 'same',
          localDisabledByFlag: false,
          saveData: false,
        }),
      });

      const onUpdatePaper = vi.fn();

      const { result } = renderHook(() =>
        useEditorCompilation({
          paper: mockPaper,
          formData: mockPaper,
          onUpdatePaper,
          router,
          networkMonitor,
          debounceMs: 10,
        })
      );

      // Network transitions to offline
      act(() => {
        networkMonitor.simulateOffline();
      });

      // Verify sticky toast is triggered
      const toasts = toastStore.getToasts();
      const stickyToast = toasts.find((t) => t.id === 'offline-compile-toast');
      expect(stickyToast).toBeDefined();
      expect(stickyToast?.sticky).toBe(true);
      expect(stickyToast?.title).toBe('Đang ngoại tuyến');
      expect(stickyToast?.description).toContain('biên dịch trực tiếp trên trình duyệt (WASM)');

      // Compile while offline
      let pdfUrl: string | null = null;
      await act(async () => {
        pdfUrl = await result.current.compileLatexToPdf();
      });

      expect(pdfUrl).toBeTruthy();
      expect(wasmPort.compile).toHaveBeenCalled();
      expect(result.current.compileStats?.producedBy?.kind).toBe('browser-wasm');
      expect(result.current.compileStats?.engineKind).toBe('browser-wasm');
    });

    it('dismisses sticky toast when connectivity restores', async () => {
      const serverPort = createMockPort('server-native');
      const wasmPort = createMockPort('browser-wasm');
      const networkMonitor = new NetworkMonitor({
        initialOnline: false,
        initialServerReachable: false,
      });

      const router = new CompilerRouter({
        server: serverPort,
        local: wasmPort,
        getContext: () => ({
          online: networkMonitor.isOnline(),
          serverReachable: networkMonitor.isServerReachable(),
          localEnv: 'ready',
          localEnvMatches: true,
          deviceScore: 90,
          pageEstimate: 4,
          assetBytes: 1024,
          recentLocalFailures: [],
          userPreference: 'auto',
          parity: 'same',
          localDisabledByFlag: false,
          saveData: false,
        }),
      });

      const onUpdatePaper = vi.fn();

      renderHook(() =>
        useEditorCompilation({
          paper: mockPaper,
          formData: mockPaper,
          onUpdatePaper,
          router,
          networkMonitor,
          debounceMs: 10,
        })
      );

      // Verify sticky toast exists on mount because initial status was offline
      expect(toastStore.getToasts().some((t) => t.id === 'offline-compile-toast')).toBe(true);

      // Restore network
      act(() => {
        networkMonitor.simulateOnline();
        networkMonitor.simulateServerReachable(true);
      });

      // Sticky toast should be dismissed
      expect(toastStore.getToasts().some((t) => t.id === 'offline-compile-toast')).toBe(false);
    });

    it('triggers sticky toast when server becomes unreachable (even if online=true)', async () => {
      const serverPort = createMockPort('server-native');
      const wasmPort = createMockPort('browser-wasm');
      const networkMonitor = new NetworkMonitor({
        initialOnline: true,
        initialServerReachable: true,
      });

      const router = new CompilerRouter({
        server: serverPort,
        local: wasmPort,
        getContext: () => ({
          online: networkMonitor.isOnline(),
          serverReachable: networkMonitor.isServerReachable(),
          localEnv: 'ready',
          localEnvMatches: true,
          deviceScore: 90,
          pageEstimate: 4,
          assetBytes: 1024,
          recentLocalFailures: [],
          userPreference: 'auto',
          parity: 'same',
          localDisabledByFlag: false,
          saveData: false,
        }),
      });

      const onUpdatePaper = vi.fn();

      renderHook(() =>
        useEditorCompilation({
          paper: mockPaper,
          formData: mockPaper,
          onUpdatePaper,
          router,
          networkMonitor,
          debounceMs: 10,
        })
      );

      // Server health probe fails
      act(() => {
        networkMonitor.simulateServerReachable(false);
      });

      // Verify sticky toast is triggered
      const stickyToast = toastStore.getToasts().find((t) => t.id === 'offline-compile-toast');
      expect(stickyToast).toBeDefined();
      expect(stickyToast?.sticky).toBe(true);
      expect(stickyToast?.title).toBe('Đang ngoại tuyến');
    });

    it('handles offline with missing local environment (Rule 05 error notice E1)', async () => {
      const serverPort = createMockPort('server-native');
      const wasmPort = createMockPort('browser-wasm');
      const networkMonitor = new NetworkMonitor({
        initialOnline: false,
        initialServerReachable: false,
      });

      const router = new CompilerRouter({
        server: serverPort,
        local: wasmPort,
        getContext: () => ({
          online: false,
          serverReachable: false,
          localEnv: 'missing',
          localEnvMatches: false,
          deviceScore: 90,
          pageEstimate: 4,
          assetBytes: 1024,
          recentLocalFailures: [],
          userPreference: 'auto',
          parity: 'same',
          localDisabledByFlag: false,
          saveData: false,
        }),
      });

      const onUpdatePaper = vi.fn();

      const { result } = renderHook(() =>
        useEditorCompilation({
          paper: mockPaper,
          formData: mockPaper,
          onUpdatePaper,
          router,
          networkMonitor,
          debounceMs: 10,
        })
      );

      await act(async () => {
        await result.current.compileLatexToPdf();
      });

      expect(result.current.compileErrorInfo).not.toBeNull();
      expect(result.current.compileErrorInfo?.error).toContain('Cần tải gói biên dịch trước khi dùng ngoại tuyến');
    });

    it('handleRecompile updates paper and executes compilation', async () => {
      const serverPort = createMockPort('server-native');
      const wasmPort = createMockPort('browser-wasm');
      const networkMonitor = new NetworkMonitor({
        initialOnline: false,
        initialServerReachable: false,
      });

      const router = new CompilerRouter({
        server: serverPort,
        local: wasmPort,
        getContext: () => ({
          online: false,
          serverReachable: false,
          localEnv: 'ready',
          localEnvMatches: true,
          deviceScore: 90,
          pageEstimate: 4,
          assetBytes: 1024,
          recentLocalFailures: [],
          userPreference: 'auto',
          parity: 'same',
          localDisabledByFlag: false,
          saveData: false,
        }),
      });

      const onUpdatePaper = vi.fn();
      const setIsDirty = vi.fn();

      const { result } = renderHook(() =>
        useEditorCompilation({
          paper: mockPaper,
          formData: mockPaper,
          onUpdatePaper,
          setIsDirty,
          router,
          networkMonitor,
          debounceMs: 10,
        })
      );

      const modifiedPaper: CompletePaper = {
        ...mockPaper,
        metadata: {
          ...mockPaper.metadata,
          title: 'Tiêu đề bài báo đã cập nhật',
        },
      };

      await act(async () => {
        result.current.handleRecompile(modifiedPaper);
      });

      expect(onUpdatePaper).toHaveBeenCalledWith(modifiedPaper);
      expect(setIsDirty).toHaveBeenCalledWith(false);
      expect(wasmPort.compile).toHaveBeenCalled();
    });
  });

  describe('Engine Provenance Badge UI (Section 9.4 Spec)', () => {
    it('renders "Bản nháp · Trình duyệt" badge in PublicationPreview when engineKind is browser-wasm', () => {
      render(
        <PublicationPreview
          paper={mockPaper}
          engineKind="browser-wasm"
          compileStats={{
            durationMs: 310,
            sizeKb: 890,
            timestamp: '12:00:00',
            engineKind: 'browser-wasm',
            producedBy: { kind: 'browser-wasm', environmentId: 'tl2026.1-wasm' },
          }}
        />
      );

      const badge = screen.getByTestId('engine-provenance-badge');
      expect(badge).toBeTruthy();
      expect(badge.textContent).toContain('Bản nháp · Trình duyệt');
    });

    it('renders "Chính thức · Máy chủ" badge in PublicationPreview when engineKind is server-native', () => {
      render(
        <PublicationPreview
          paper={mockPaper}
          engineKind="server-native"
          compileStats={{
            durationMs: 1200,
            sizeKb: 1440,
            timestamp: '12:00:00',
            engineKind: 'server-native',
            producedBy: { kind: 'server-native', environmentId: 'tl2026-server' },
          }}
        />
      );

      const badge = screen.getByTestId('engine-provenance-badge');
      expect(badge).toBeTruthy();
      expect(badge.textContent).toContain('Chính thức · Máy chủ');
    });

    it('renders provenance badge in PreviewActionsToolbar matching compileStats producedBy.kind', () => {
      const { rerender } = render(
        <PreviewActionsToolbar
          isCompiling={false}
          onRecompile={vi.fn()}
          onDownloadDocx={vi.fn()}
          onDownloadZip={vi.fn()}
          compiledPdfUrl="blob:mock"
          compileStats={{
            durationMs: 250,
            sizeKb: 1024,
            timestamp: '10:00:00',
            engineKind: 'browser-wasm',
            producedBy: { kind: 'browser-wasm', environmentId: 'tl2026.1-wasm' },
          }}
          isExportingDocx={false}
          isExportingZip={false}
        />
      );

      expect(screen.getByTestId('engine-provenance-badge').textContent).toContain('Bản nháp · Trình duyệt');

      // Re-render with server stats
      rerender(
        <PreviewActionsToolbar
          isCompiling={false}
          onRecompile={vi.fn()}
          onDownloadDocx={vi.fn()}
          onDownloadZip={vi.fn()}
          compiledPdfUrl="blob:mock"
          compileStats={{
            durationMs: 1400,
            sizeKb: 2048,
            timestamp: '10:01:00',
            engineKind: 'server-native',
            producedBy: { kind: 'server-native', environmentId: 'tl2026-server' },
          }}
          isExportingDocx={false}
          isExportingZip={false}
        />
      );

      expect(screen.getByTestId('engine-provenance-badge').textContent).toContain('Chính thức · Máy chủ');
    });

    it('typesets multi-section paper into multi-page PDF using typesetLatexToPdf', () => {
      const sampleTex = `
\\documentclass{article}
\\title{Nghiên cứu Căn tính Văn hóa}
\\author{Tác giả A}
\\begin{document}
\\section{1. Đặt vấn đề}
Nội dung đoạn văn nghiên cứu căn tính xã hội.
\\section{2. Kết luận}
Kết thúc nghiên cứu.
\\end{document}
`;
      const pdfBytes = typesetLatexToPdf(sampleTex);
      expect(pdfBytes).toBeDefined();
      expect(pdfBytes.length).toBeGreaterThan(10000);
      const pdfHeader = Buffer.from(pdfBytes).slice(0, 5).toString('ascii');
      expect(pdfHeader).toBe('%PDF-');
    });
  });
});
