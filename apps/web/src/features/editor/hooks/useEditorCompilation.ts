'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { CompletePaper, DEFAULT_LAYOUT_SETTINGS } from '@/types/paper';
import { exportToLatex } from '@/lib/exporters';
import {
  CompileScheduler,
  CompilerRouter,
  NetworkMonitor,
  RemoteCompiler,
  WasmCompiler,
  TauriDesktopCompiler,
  isTauriEnvironment,
} from '@structpaper/compiler-client';
import { toast } from '@/components/toast';
import { extractPaperImagesAsync } from '@/lib/media/figure-image-utils';
import { getAuthHeaders } from '@/lib/auth-headers';
import { CompileStats, CompileErrorInfo } from '../components/types';

export interface UseEditorCompilationOptions {
  paper: CompletePaper;
  formData: CompletePaper;
  onUpdatePaper: (updated: CompletePaper) => void;
  onSavePaper?: (paper: CompletePaper) => Promise<boolean | void>;
  setIsDirty?: (dirty: boolean) => void;
  router?: CompilerRouter;
  networkMonitor?: NetworkMonitor;
  debounceMs?: number;
}

export function useEditorCompilation({
  paper,
  formData,
  onUpdatePaper,
  onSavePaper,
  setIsDirty,
  router: customRouter,
  networkMonitor: customNetworkMonitor,
  debounceMs = 500,
}: UseEditorCompilationOptions) {
  const isDefaultHs630 =
    formData.id === 'hs630' || formData.metadata?.doi?.includes('630');
  const defaultPdf = isDefaultHs630
    ? '/demo-files/ID630_HS-2026-10-02-07-07.pdf'
    : null;

  const [compiledPdfUrl, setCompiledPdfUrl] = useState<string | null>(defaultPdf);
  const [isCompilingPdf, setIsCompilingPdf] = useState(false);
  const [compileStats, setCompileStats] = useState<CompileStats | null>(
    defaultPdf
      ? {
          durationMs: 1845,
          sizeKb: 1447,
          timestamp: 'Sẵn sàng',
          engineKind: 'server-native',
          engine: 'Server XeLaTeX',
          producedBy: {
            kind: 'server-native',
            environmentId: 'tl2026-server',
          },
        }
      : null
  );
  const [compileErrorInfo, setCompileErrorInfo] = useState<CompileErrorInfo | null>(null);

  const monitorRef = useRef<NetworkMonitor | null>(customNetworkMonitor ?? null);
  const routerRef = useRef<CompilerRouter | null>(customRouter ?? null);
  const schedulerRef = useRef<CompileScheduler | null>(null);

  /**
   * Create (or re-create after an unmount/remount, e.g. React StrictMode in dev) the network
   * monitor, compiler router and scheduler. A disposed instance is never reused.
   */
  const ensureInfra = () => {
    if (!monitorRef.current) {
      monitorRef.current = new NetworkMonitor({ serverEndpoint: '/api/health', timeoutMs: 3000 });
    }
    if (!routerRef.current) {
      const isDesktop = isTauriEnvironment();
      const localCompiler = isDesktop ? new TauriDesktopCompiler() : new WasmCompiler();
      routerRef.current = new CompilerRouter({
        local: localCompiler,
        server: new RemoteCompiler({ endpoint: '/api/compile-latex', getHeaders: getAuthHeaders }),
        getContext: () => {
          const monitor = monitorRef.current;
          return {
            online: monitor ? monitor.isOnline() : true,
            serverReachable: monitor ? monitor.isServerReachable() : true,
            localEnv: isDesktop ? 'ready' : typeof Worker !== 'undefined' ? 'ready' : 'missing',
            localEnvMatches: true,
            deviceScore: typeof Worker !== 'undefined' || isDesktop ? 100 : 'unsupported',
            pageEstimate: 5,
            assetBytes: 1024 * 1024,
            recentLocalFailures: [],
            userPreference: isDesktop ? 'local' : 'server',
            parity: 'same',
            localDisabledByFlag: false,
            saveData: false,
          };
        },
      });
    }
    if (!schedulerRef.current) {
      schedulerRef.current = new CompileScheduler({ compiler: routerRef.current, debounceMs });
    }
    return schedulerRef.current;
  };
  ensureInfra();

  /** Each compile owns the busy flag: a superseded/aborted compile must not hide the spinner of the newer one. */
  const compileSeqRef = useRef(0);
  /** Outcome of the last finished compile, so callers can tell "cancelled" from "failed". */
  const lastOutcomeRef = useRef<'success' | 'cancelled' | 'error' | null>(null);
  const [compileStartedAt, setCompileStartedAt] = useState<number | null>(null);

  // NetworkMonitor subscription and Sticky Toast management
  useEffect(() => {
    ensureInfra();
    const monitor = monitorRef.current;
    if (!monitor) return;

    let wasOfflineOrUnreachable = !monitor.isOnline() || !monitor.isServerReachable();

    if (wasOfflineOrUnreachable) {
      toast.sticky(
        'Đang ngoại tuyến',
        'Hệ thống tự động chuyển sang chế độ biên dịch trực tiếp trên trình duyệt (WASM)',
        { theme: 'warning', id: 'offline-compile-toast' }
      );
    }

    const unsubscribe = monitor.subscribe((state) => {
      const isOfflineOrUnreachable = !state.online || !state.serverReachable;

      if (isOfflineOrUnreachable) {
        wasOfflineOrUnreachable = true;
        toast.sticky(
          'Đang ngoại tuyến',
          'Hệ thống tự động chuyển sang chế độ biên dịch trực tiếp trên trình duyệt (WASM)',
          { theme: 'warning', id: 'offline-compile-toast' }
        );
      } else {
        toast.dismiss('offline-compile-toast');
        if (wasOfflineOrUnreachable) {
          toast.info(
            'Đã kết nối lại máy chủ',
            'Hệ thống đã sẵn sàng biên dịch chuẩn xuất bản trên máy chủ',
            { duration: 3000 }
          );
          wasOfflineOrUnreachable = false;
        }
      }
    });

    return () => {
      unsubscribe();
      if (!customNetworkMonitor) {
        monitor.dispose();
        monitorRef.current = null;
      }
    };
  }, [customNetworkMonitor]);

  // Clean up scheduler & router
  useEffect(() => {
    return () => {
      schedulerRef.current?.dispose();
      schedulerRef.current = null;
      if (!customRouter) {
        routerRef.current?.dispose();
        routerRef.current = null;
      }
    };
  }, [customRouter]);

  const compileLatexToPdf = useCallback(
    async (customPaperData?: CompletePaper): Promise<string | null> => {
      const paperToCompile = customPaperData || formData;
      const settings = paperToCompile.layoutSettings || DEFAULT_LAYOUT_SETTINGS;

      const seq = ++compileSeqRef.current;
      const isLatest = () => seq === compileSeqRef.current;
      try {
        setIsCompilingPdf(true);
        setCompileStartedAt(Date.now());
        setCompileErrorInfo(null);
        const texContent = exportToLatex(paperToCompile, settings);
        const images = await extractPaperImagesAsync(paperToCompile);

        const scheduler = ensureInfra();

        const result = await scheduler.compileNow({
          tex: texContent,
          paperId: paperToCompile.id,
          images,
          mode: 'draft',
        });

        if (result.status === 'success') {
          const url =
            result.pdfUrl ||
            (result.pdfBlob ? URL.createObjectURL(result.pdfBlob) : null);
          if (url && isLatest()) {
            setCompiledPdfUrl(url);
          }
          const engineKind = result.producedBy?.kind;
          const engineName =
            result.engine ||
            (engineKind === 'browser-wasm' ? 'XeLaTeX WASM' : 'Server XeLaTeX');

          setCompileStats({
            durationMs: result.durationMs,
            sizeKb: Math.round(
              (result.pdfBlob?.size ?? result.pdfBuffer?.length ?? 0) / 1024
            ),
            timestamp: new Date().toLocaleTimeString('vi-VN'),
            engineKind,
            engine: engineName,
            producedBy: result.producedBy,
          });
          lastOutcomeRef.current = 'success';
          return url;
        } else if (
          result.cancelled ||
          result.error === 'Compilation was aborted' ||
          result.error?.includes('superseded') ||
          result.error?.includes('aborted')
        ) {
          // Bỏ qua khi yêu cầu bị hủy hoặc thay thế bởi tác vụ mới (debounce)
          lastOutcomeRef.current = 'cancelled';
          return null;
        } else {
          if (!isLatest()) return null;
          lastOutcomeRef.current = 'error';
          setCompileErrorInfo({
            error: result.error || 'Biên dịch thất bại',
            details: result.details,
            engine:
              result.engine ||
              (result.producedBy?.kind === 'browser-wasm' ? 'XeLaTeX WASM' : 'Tectonic'),
            rawLog: result.logs?.join('\n'),
          });
          return null;
        }
      } catch (e: any) {
        if (
          e?.name === 'CompileAbortError' ||
          e?.name === 'AbortError' ||
          e?.message?.includes('aborted') ||
          e?.message?.includes('superseded')
        ) {
          // Yêu cầu bị hủy bình thường do debounce hoặc chuyển bản thảo
          lastOutcomeRef.current = 'cancelled';
          return null;
        }
        if (!isLatest()) return null;
        lastOutcomeRef.current = 'error';
        setCompileErrorInfo({
          error: 'Lỗi kết nối máy chủ biên dịch',
          details: e?.message || 'Không thể gửi yêu cầu biên dịch tới backend.',
        });
        return null;
      } finally {
        if (isLatest()) {
          setIsCompilingPdf(false);
          setCompileStartedAt(null);
        }
      }
    },
    [formData]
  );

  // Sync with paper changes and compile initial
  useEffect(() => {
    const isHs630 = paper.id === 'hs630' || paper.metadata?.doi?.includes('630');
    if (isHs630) {
      setCompiledPdfUrl('/demo-files/ID630_HS-2026-10-02-07-07.pdf');
    } else {
      setCompiledPdfUrl(null);
      compileLatexToPdf(paper);
    }
  }, [paper.id]);

  const handleRecompile = useCallback(
    async (customPaper?: CompletePaper) => {
      const target = customPaper || formData;
      onUpdatePaper(target);
      if (onSavePaper) {
        try {
          await onSavePaper(target);
        } catch (saveErr) {
          console.warn('[useEditorCompilation] Failed to auto-save on recompile:', saveErr);
        }
      }
      setIsDirty?.(false);
      compileLatexToPdf(target);
    },
    [formData, onUpdatePaper, onSavePaper, setIsDirty, compileLatexToPdf]
  );

  return {
    compiledPdfUrl,
    setCompiledPdfUrl,
    isCompilingPdf,
    compileStartedAt,
    lastOutcomeRef,
    compileStats,
    setCompileStats,
    compileErrorInfo,
    setCompileErrorInfo,
    compileLatexToPdf,
    handleRecompile,
    networkMonitor: monitorRef.current,
    compilerRouter: routerRef.current,
  };
}
