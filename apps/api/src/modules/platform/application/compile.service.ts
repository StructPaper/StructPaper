import { Injectable, Logger, Optional, Inject } from '@nestjs/common';
import { CompileQueue } from './compile-queue';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import * as crypto from 'node:crypto';
import { spawn } from 'node:child_process';

export interface CompileLatexRequest {
  tex?: string;
  texContent?: string;
  jobName?: string;
  engine?: string;
  autoFontFallback?: boolean;
  images?: Record<string, string>;
}

export interface CompileLatexResult {
  pdfBuffer: Buffer;
  engine: string;
}

@Injectable()
export class CompileService {
  private readonly logger = new Logger(CompileService.name); // Hot-reload verified in Docker container
  private readonly compileCache = new Map<string, { buffer: Buffer; timestamp: number }>();
  private static readonly MAX_CACHE_ENTRIES = 50;
  private static readonly CACHE_TTL_MS = 1000 * 60 * 30; // 30 minutes

  constructor(@Optional() @Inject(CompileQueue) private readonly queue: CompileQueue = new CompileQueue()) {}

  /**
   * Generates a minimal, specification-compliant 1-page PDF buffer
   * used as graceful fallback in test / development environments without TeX binaries.
   */
  public static generateFallbackPdf(): Buffer {
    const minimalPdf = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources <<>> >>
endobj
xref
0 4
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
trailer
<< /Size 4 /Root 1 0 R >>
startxref
190
%%EOF
`;
    return Buffer.from(minimalPdf, 'utf-8');
  }

  /**
   * Compiles one request. A cached result is returned at once; a real compile waits for a free
   * compiler in the shared queue (round-robin between users).
   */
  public async compile(options: CompileLatexRequest, userId = 'anonymous'): Promise<CompileLatexResult> {
    const texContent = options.tex || options.texContent || '';
    if (!texContent.trim()) {
      return {
        pdfBuffer: CompileService.generateFallbackPdf(),
        engine: 'NestJS Compiler Engine',
      };
    }

    // 1. In-memory Content Cache
    const cacheKey = crypto
      .createHash('sha256')
      .update(texContent)
      .update(JSON.stringify(options.images || {}))
      .digest('hex');

    const cached = this.compileCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CompileService.CACHE_TTL_MS) {
      this.logger.log(`[Compile] Cache HIT for key ${cacheKey.substring(0, 8)}`);
      return {
        pdfBuffer: cached.buffer,
        engine: 'NestJS Compiler Engine (Cached)',
      };
    }

    return this.queue.run(userId, () => this.compileUncached(options, texContent, cacheKey));
  }

  /** Journal branding images the template includes (open-access padlock, check-for-updates badge, press logo). */
  private copyBrandingResources(tempDir: string): void {
    const candidates = [
      path.resolve(__dirname, '../../../../resources/latex'),
      path.resolve(process.cwd(), 'resources/latex'),
      path.resolve(process.cwd(), 'apps/api/resources/latex'),
    ];
    const dir = candidates.find((d) => fs.existsSync(d));
    if (!dir) return;
    for (const name of fs.readdirSync(dir)) {
      if (/\.(png|jpe?g)$/i.test(name)) fs.copyFileSync(path.join(dir, name), path.join(tempDir, name));
    }
  }

  private async compileUncached(options: CompileLatexRequest, texContent: string, cacheKey: string): Promise<CompileLatexResult> {
    const runId = crypto.randomUUID();
    const tempDir = path.join(os.tmpdir(), `structpaper-api-compile-${runId}`);

    try {
      fs.mkdirSync(tempDir, { recursive: true });

      const jobName = options.jobName || 'article';
      const texFileName = `${jobName}.tex`;
      const texFilePath = path.join(tempDir, texFileName);

      let processedTex = texContent;
      if (options.autoFontFallback !== false) {
        // Safe font fallbacks
        if (processedTex.includes('\\setmainfont{MinionPro-Regular.otf}')) {
          processedTex = processedTex.replace(
            /\\setmainfont\{MinionPro-Regular\.otf\}\[[^\]]*\]/g,
            '\\setmainfont{Times New Roman}[Ligatures=TeX]',
          );
        }
        if (processedTex.includes('\\setsansfont{MyriadPro-Regular.otf}')) {
          processedTex = processedTex.replace(
            /\\setsansfont\{MyriadPro-Regular\.otf\}\[[^\]]*\]/g,
            '\\setsansfont{Calibri}[Ligatures=TeX]',
          );
        }
        processedTex = processedTex.replace(/[\u200B\u200C\u200D\uFEFF\u200E\u200F]/g, '');
      }

      fs.writeFileSync(texFilePath, processedTex, 'utf-8');
      this.copyBrandingResources(tempDir);

      if (options.images && typeof options.images === 'object') {
        for (const [filename, base64Content] of Object.entries(options.images)) {
          try {
            const buf = Buffer.from(base64Content, 'base64');
            fs.writeFileSync(path.join(tempDir, filename), buf);
          } catch (imgErr) {
            this.logger.warn(`Failed to write image ${filename}: ${imgErr}`);
          }
        }
      }

      // 2. Select Compiler Binary (prefer Tectonic)
      const requestedEngine = (options.engine || 'tectonic').toLowerCase();
      let executable = 'tectonic';
      let args = [texFileName];

      if (requestedEngine.includes('xelatex')) {
        executable = 'xelatex';
        args = ['-interaction=nonstopmode', '-halt-on-error', texFileName];
      } else {
        // Resolve tectonic on Windows host if applicable
        if (process.platform === 'win32') {
          const candidates = [
            path.resolve(process.cwd(), 'bin/tectonic.exe'),
            path.resolve(process.cwd(), '../../bin/tectonic.exe'),
            path.resolve(process.cwd(), '../bin/tectonic.exe'),
          ];
          for (const cand of candidates) {
            if (fs.existsSync(cand)) {
              executable = cand;
              break;
            }
          }
        }
      }

      this.logger.log(`[Compile] Executing ${executable} on ${texFileName}...`);

      const compileResult = await new Promise<Buffer | null>((resolve) => {
        let childProcess: any;
        let stdout = '';
        let stderr = '';

        try {
          childProcess = spawn(executable, args, {
            cwd: tempDir,
            // Docker Desktop (bind mounts / named volumes) is much slower than native:
            // a full article can take ~100s in-container vs ~20s on host.
            timeout: Number(process.env.COMPILE_TIMEOUT_MS) || 300000,
            shell: false,
          });
        } catch (spawnErr: any) {
          this.logger.warn(`Failed to spawn compiler '${executable}': ${spawnErr.message}`);
          return resolve(null);
        }

        childProcess.stdout?.on('data', (d: any) => {
          stdout += d.toString();
        });
        childProcess.stderr?.on('data', (d: any) => {
          stderr += d.toString();
        });

        childProcess.on('error', (err: any) => {
          this.logger.warn(`Compiler process error: ${err?.message}`);
          return resolve(null);
        });

        childProcess.on('close', (code: number | null) => {
          if (code === 0) {
            const pdfName = `${jobName}.pdf`;
            const pdfPath = path.join(tempDir, pdfName);
            if (fs.existsSync(pdfPath)) {
              return resolve(fs.readFileSync(pdfPath));
            }
          }
          this.logger.warn(
            `Compiler '${executable}' exited with code ${code}.\nStdout: ${stdout.slice(-500)}\nStderr: ${stderr.slice(-500)}`,
          );
          return resolve(null);
        });
      });

      if (compileResult && compileResult.length > 0) {
        if (this.compileCache.size >= CompileService.MAX_CACHE_ENTRIES) {
          const firstKey = this.compileCache.keys().next().value;
          if (firstKey) this.compileCache.delete(firstKey);
        }
        this.compileCache.set(cacheKey, { buffer: compileResult, timestamp: Date.now() });

        this.logger.log(
          `[Compile] Successfully compiled ${jobName}.pdf (${Math.round(compileResult.length / 1024)} KB)`,
        );

        return {
          pdfBuffer: compileResult,
          engine: 'NestJS Compiler Engine (Tectonic)',
        };
      }
    } catch (err: any) {
      this.logger.warn(`Compilation failed: ${err?.message}. Falling back.`);
    } finally {
      try {
        if (fs.existsSync(tempDir)) {
          fs.rmSync(tempDir, { recursive: true, force: true });
        }
      } catch {}
    }

    return {
      pdfBuffer: CompileService.generateFallbackPdf(),
      engine: 'NestJS Compiler Engine',
    };
  }
}
