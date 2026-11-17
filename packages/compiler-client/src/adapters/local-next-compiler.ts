import type {
  CompilerPort,
  CompileRequest,
  CompileResult,
} from '../interfaces/compiler-port';

export interface LocalNextCompilerOptions {
  /** API endpoint path, defaults to '/api/compile-latex' */
  endpoint?: string;

  /** Base URL for API calls (e.g. 'http://localhost:3000' in tests/server, or empty string in browser) */
  baseUrl?: string;

  /** Custom fetch implementation (useful for tests or specific polyfills) */
  fetchFn?: typeof fetch;

  /** Optional secondary compiler to fall back to when the HTTP endpoint is unreachable */
  fallbackCompiler?: CompilerPort;

  /** Extra request headers resolved per request (e.g. the Authorization bearer token) */
  getHeaders?: () => Record<string, string> | Promise<Record<string, string>>;
}

/**
 * LocalNextCompilerAdapter implements CompilerPort by communicating with
 * the Next.js `/api/compile-latex` backend endpoint.
 */
export class LocalNextCompilerAdapter implements CompilerPort {
  private readonly endpoint: string;
  private readonly baseUrl: string;
  private readonly fetchFn?: typeof fetch;
  private readonly fallbackCompiler?: CompilerPort;
  private readonly getHeaders?: () => Record<string, string> | Promise<Record<string, string>>;

  constructor(options: LocalNextCompilerOptions = {}) {
    this.endpoint = options.endpoint ?? '/api/compile-latex';
    this.baseUrl = options.baseUrl ?? '';
    this.fetchFn = options.fetchFn;
    this.fallbackCompiler = options.fallbackCompiler;
    this.getHeaders = options.getHeaders;
  }

  public async compile(
    request: CompileRequest,
    signal?: AbortSignal
  ): Promise<CompileResult> {
    const startTime = Date.now();
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

      const response = await doFetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.getHeaders ? await this.getHeaders() : {}),
        },
        body: JSON.stringify({
          tex: request.tex,
          paperId: request.paperId,
          images: request.images || {},
          options: request.options,
        }),
        signal,
      });

      const clientDuration = Date.now() - startTime;

      if (!response.ok) {
        let errData: any = {};
        try {
          errData = await response.json();
        } catch {
          errData = { error: `Server returned status ${response.status}: ${response.statusText}` };
        }

        // If server 503 / offline and fallbackCompiler is available, attempt fallback
        if (response.status === 503 && this.fallbackCompiler) {
          return this.fallbackCompiler.compile(request, signal);
        }

        return {
          status: 'error',
          error: errData.error || `Biên dịch thất bại (${response.status})`,
          details: errData.details,
          engine: errData.engine || 'None',
          logs: errData.rawLog ? [errData.rawLog] : [errData.details || errData.error || 'Compilation failed'],
          durationMs: clientDuration,
        };
      }

      const engine = response.headers.get('x-compiler-engine') || 'XeLaTeX';
      const serverDuration = response.headers.get('x-compilation-time-ms');
      const durationMs = serverDuration ? parseInt(serverDuration, 10) : clientDuration;

      // Extract PDF data as arrayBuffer and Blob
      const arrayBuffer = await response.arrayBuffer();
      const pdfBuffer = new Uint8Array(arrayBuffer);

      let pdfBlob: Blob | undefined;
      let pdfUrl: string | undefined;

      if (typeof Blob !== 'undefined') {
        pdfBlob = new Blob([pdfBuffer as unknown as BlobPart], { type: 'application/pdf' });
        if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
          try {
            pdfUrl = URL.createObjectURL(pdfBlob);
          } catch {
            // Ignore URL creation error if unsupported in environment
          }
        }
      }

      return {
        status: 'success',
        pdfBlob,
        pdfUrl,
        pdfBuffer,
        logs: [`Compiled successfully using ${engine}`],
        durationMs,
        engine,
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
        };
      }

      // If connection failed and fallback compiler is present
      if (this.fallbackCompiler) {
        try {
          return await this.fallbackCompiler.compile(request, signal);
        } catch {
          // If fallback also failed, return original error below
        }
      }

      return {
        status: 'error',
        error: err?.message || 'Network error occurred while calling compiler',
        details: err?.stack,
        logs: [err?.message || 'Network error'],
        durationMs: Date.now() - startTime,
      };
    }
  }
}
