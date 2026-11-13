import type {
  CompilerPort,
  CompileRequest,
  CompileResult,
  CapabilityVerdict,
  CompileProgress,
  Unsubscribe,
} from '../interfaces/compiler-port';
import type {
  CompilerKind,
  CompileContext,
} from '../interfaces/compiler-router.types';
import { parseLatexLog } from '../wasm/log-parser';

export interface RemoteCompilerOptions {
  /** API endpoint path, defaults to '/api/compile-latex' */
  endpoint?: string;

  /** Base URL for API calls (e.g. 'http://localhost:3000' or '' in browser) */
  baseUrl?: string;

  /** Custom fetch implementation for testing and non-browser environments */
  fetchFn?: typeof fetch;

  /** Server TeX environment identifier (defaults to 'tl2026-server') */
  environmentId?: string;

  /** Request timeout in milliseconds */
  timeoutMs?: number;

  /** Optional secondary compiler to fall back to when the HTTP endpoint is unreachable */
  fallbackCompiler?: CompilerPort;
}

/**
 * RemoteCompiler adapter implementing CompilerPort ('server-native').
 * Dispatches compilation requests to the remote StructPaper LaTeX compiler service.
 */
export class RemoteCompiler implements CompilerPort {
  public readonly kind: CompilerKind = 'server-native';

  private readonly endpoint: string;
  private readonly baseUrl: string;
  private readonly fetchFn?: typeof fetch;
  private readonly environmentId: string;
  private readonly timeoutMs?: number;
  private readonly fallbackCompiler?: CompilerPort;
  private readonly progressListeners = new Set<(event: CompileProgress) => void>();

  constructor(options: RemoteCompilerOptions = {}) {
    this.endpoint = options.endpoint ?? '/api/compile-latex';
    this.baseUrl = options.baseUrl ?? '';
    this.fetchFn = options.fetchFn;
    this.environmentId = options.environmentId ?? 'tl2026-server';
    this.timeoutMs = options.timeoutMs;
    this.fallbackCompiler = options.fallbackCompiler;
  }

  /**
   * Evaluates if this remote compiler can handle the compilation request.
   * Returns supported: true and canHandle: true if online and the compile server is reachable.
   */
  public canHandle(
    _request: CompileRequest,
    context?: CompileContext
  ): CapabilityVerdict & { supported: boolean } {
    if (context) {
      if (context.online === false) {
        return {
          canHandle: false,
          supported: false,
          reasonCode: 'R04_OFFLINE_LOCAL_READY',
          reason: 'Remote compilation unavailable: device is offline',
        };
      }

      if (context.serverReachable === false) {
        return {
          canHandle: false,
          supported: false,
          reasonCode: 'R07_LOCAL_ENV_NOT_READY',
          reason: 'Remote compilation unavailable: server is unreachable',
        };
      }
    }

    return {
      canHandle: true,
      supported: true,
    };
  }

  /**
   * Compiles LaTeX source code remotely by sending an HTTP POST request to the compiler endpoint.
   */
  public async compile(
    request: CompileRequest,
    signal?: AbortSignal
  ): Promise<CompileResult> {
    const startTime = Date.now();
    const activeEnvironmentId = request.environmentId || this.environmentId;

    if (signal?.aborted) {
      return {
        status: 'error',
        error: 'Compilation was aborted',
        logs: ['Request was aborted by signal'],
        durationMs: 0,
        cancelled: true,
        producedBy: {
          kind: 'server-native',
          environmentId: activeEnvironmentId,
        },
      };
    }

    this.notifyProgress({ phase: 'preparing', percent: 10, message: 'Preparing remote compile request' });

    const url = `${this.baseUrl}${this.endpoint}`;

    try {
      const doFetch = (input: RequestInfo | URL, init?: RequestInit) => {
        if (this.fetchFn) {
          return this.fetchFn(input, init);
        }
        if (typeof window !== 'undefined' && typeof window.fetch === 'function') {
          return window.fetch(input, init);
        }
        if (typeof globalThis !== 'undefined' && typeof globalThis.fetch === 'function') {
          return globalThis.fetch(input, init);
        }
        throw new Error('fetch is not defined in this environment and no custom fetchFn was provided');
      };

      const payload = {
        tex: request.tex,
        paperId: request.paperId ?? request.manuscriptId,
        manuscriptId: request.manuscriptId ?? request.paperId,
        rev: request.rev,
        mode: request.mode ?? 'draft',
        environmentId: activeEnvironmentId,
        passes: request.passes,
        images: request.images || {},
        files: request.files,
        options: request.options,
      };

      this.notifyProgress({ phase: 'compiling', percent: 30, message: 'Transmitting payload to compiler server' });

      const timeoutMs = this.timeoutMs ?? 90000;
      const abortCtrl = new AbortController();
      let timedOut = false;
      const timer = setTimeout(() => {
        timedOut = true;
        abortCtrl.abort();
      }, timeoutMs);

      if (signal) {
        signal.addEventListener('abort', () => {
          clearTimeout(timer);
          abortCtrl.abort();
        });
      }

      let response: Response;
      try {
        response = await doFetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/pdf, application/json',
          },
          body: JSON.stringify(payload),
          signal: abortCtrl.signal,
        });
      } catch (fetchErr: any) {
        clearTimeout(timer);
        if (timedOut) {
          return {
            status: 'error',
            error: `Máy chủ biên dịch không phản hồi sau ${Math.round(timeoutMs / 1000)}s (Timeout)`,
            details: `Thời gian yêu cầu biên dịch vượt quá giới hạn ${Math.round(timeoutMs / 1000)} giây.`,
            logs: [`Remote compilation request timed out after ${timeoutMs}ms`],
            durationMs: Date.now() - startTime,
            producedBy: {
              kind: 'server-native',
              environmentId: activeEnvironmentId,
            },
          };
        }
        throw fetchErr;
      } finally {
        clearTimeout(timer);
      }

      const clientDuration = Date.now() - startTime;

      if (!response.ok) {
        let errData: any = {};
        let rawLogText = '';

        try {
          const contentType = response.headers.get('content-type') || '';
          if (contentType.includes('application/json')) {
            errData = await response.json();
            rawLogText = errData.rawLog || (Array.isArray(errData.logs) ? errData.logs.join('\n') : errData.logs) || errData.details || '';
          } else {
            rawLogText = await response.text();
            errData = { error: rawLogText };
          }
        } catch {
          rawLogText = `Server returned status ${response.status}: ${response.statusText}`;
          errData = { error: rawLogText };
        }

        if (response.status === 503 && this.fallbackCompiler) {
          return this.fallbackCompiler.compile(request, signal);
        }

        const report = parseLatexLog(rawLogText || errData.error || '', request.tex);
        const logs = rawLogText ? rawLogText.split(/\r?\n/) : [errData.error || 'Compilation failed'];

        return {
          status: 'error',
          error: errData.error || errData.message || `Biên dịch thất bại (${response.status})`,
          details: errData.details,
          engine: errData.engine || 'None',
          logs,
          report,
          durationMs: clientDuration,
          producedBy: {
            kind: 'server-native',
            environmentId: activeEnvironmentId,
          },
        };
      }

      this.notifyProgress({ phase: 'saving', percent: 80, message: 'Processing compiled binary PDF' });

      const engine = response.headers.get('x-compiler-engine') || 'XeLaTeX';
      const serverDuration = response.headers.get('x-compilation-time-ms');
      const durationMs = serverDuration ? parseInt(serverDuration, 10) : clientDuration;

      const arrayBuffer = await response.arrayBuffer();
      const pdfBuffer = new Uint8Array(arrayBuffer);

      let pdfBlob: Blob | undefined;
      let pdfUrl: string | undefined;

      if (typeof Blob !== 'undefined') {
        try {
          pdfBlob = new Blob([pdfBuffer as unknown as BlobPart], { type: 'application/pdf' });
          if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
            pdfUrl = URL.createObjectURL(pdfBlob);
          }
        } catch {
          // Ignore Blob / URL errors in non-browser environments
        }
      }

      const logs = [`Compiled successfully using ${engine}`];
      const report = parseLatexLog(logs, request.tex);

      this.notifyProgress({ phase: 'idle', percent: 100, message: 'Compilation complete' });

      return {
        status: 'success',
        pdfBuffer,
        pdfBlob,
        pdf: pdfBlob,
        pdfUrl,
        logs,
        report,
        durationMs,
        engine,
        producedBy: {
          kind: 'server-native',
          environmentId: activeEnvironmentId,
        },
      };
    } catch (err: any) {
      const isAbort =
        signal?.aborted ||
        err?.name === 'AbortError' ||
        err?.message?.includes('aborted');

      if (isAbort) {
        return {
          status: 'error',
          error: 'Compilation was aborted',
          logs: ['Request was aborted by signal'],
          durationMs: Date.now() - startTime,
          cancelled: true,
          producedBy: {
            kind: 'server-native',
            environmentId: activeEnvironmentId,
          },
        };
      }

      if (this.fallbackCompiler) {
        try {
          return await this.fallbackCompiler.compile(request, signal);
        } catch {
          // Ignore fallback error and return original
        }
      }

      const errMsg = err?.message || 'Network error occurred while calling compiler';
      return {
        status: 'error',
        error: errMsg,
        details: err?.stack,
        logs: [errMsg],
        report: parseLatexLog(errMsg, request.tex),
        durationMs: Date.now() - startTime,
        producedBy: {
          kind: 'server-native',
          environmentId: activeEnvironmentId,
        },
      };
    }
  }

  /**
   * Subscribes to compilation progress notifications.
   */
  public onProgress(callback: (event: CompileProgress) => void): Unsubscribe {
    this.progressListeners.add(callback);
    return () => {
      this.progressListeners.delete(callback);
    };
  }

  private notifyProgress(event: CompileProgress): void {
    for (const listener of this.progressListeners) {
      try {
        listener(event);
      } catch {
        // Ignore subscriber errors
      }
    }
  }
}
