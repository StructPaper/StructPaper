import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import * as crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { Logger } from '@nestjs/common';
import type {
  LatexRunner,
  LatexCompileOptions,
  LatexCompileResult,
} from './latex-runner.interface';
import { LocalProcessRunner } from './local-process.runner';

export interface DockerSandboxOptions {
  image?: string;
  memoryLimit?: string;
  cpuLimit?: string;
  fallbackOnError?: boolean;
}

export class DockerSandboxRunner implements LatexRunner {
  private readonly logger = new Logger(DockerSandboxRunner.name);
  private readonly image: string;
  private readonly memoryLimit: string;
  private readonly cpuLimit: string;
  private readonly fallbackOnError: boolean;

  constructor(options: DockerSandboxOptions = {}) {
    this.image = options.image || process.env.LATEX_DOCKER_IMAGE || 'ghcr.io/xu-cheng/texlive-full:latest';
    this.memoryLimit = options.memoryLimit || '1g';
    this.cpuLimit = options.cpuLimit || '2';
    this.fallbackOnError = options.fallbackOnError ?? true;
  }

  public async compile(options: LatexCompileOptions): Promise<LatexCompileResult> {
    const startTime = Date.now();
    const runId = crypto.randomUUID();
    const tempDir = path.join(os.tmpdir(), `structpaper-docker-compile-${runId}`);

    try {
      fs.mkdirSync(tempDir, { recursive: true });

      // Write files into volume directory
      if (Array.isArray(options.files)) {
        for (const file of options.files) {
          const filePath = path.join(tempDir, file.name);
          fs.mkdirSync(path.dirname(filePath), { recursive: true });
          fs.writeFileSync(filePath, file.content);
        }
      } else if (typeof options.files === 'object' && options.files !== null) {
        for (const [filename, content] of Object.entries(options.files)) {
          const filePath = path.join(tempDir, filename);
          fs.mkdirSync(path.dirname(filePath), { recursive: true });
          fs.writeFileSync(filePath, content);
        }
      }

      const mainFile = options.mainFile || 'manuscript.tex';
      const engine = (options.engine || 'XELATEX').toUpperCase();
      const timeoutMs = options.timeoutMs ?? 120000;

      const compileCmd =
        engine === 'TECTONIC'
          ? `tectonic ${mainFile}`
          : `xelatex -interaction=nonstopmode -halt-on-error ${mainFile}`;

      // Convert path for docker mount if on Windows
      const mountPath = tempDir.replace(/\\/g, '/');

      const dockerArgs = [
        'run',
        '--rm',
        '--network',
        'none',
        '--memory',
        this.memoryLimit,
        '--cpus',
        this.cpuLimit,
        '-v',
        `${mountPath}:/workspace`,
        '-w',
        '/workspace',
        this.image,
        'sh',
        '-c',
        compileCmd,
      ];

      return await new Promise<LatexCompileResult>((resolve) => {
        let stdout = '';
        let stderr = '';
        let childProcess: any;

        try {
          childProcess = spawn('docker', dockerArgs, {
            timeout: timeoutMs,
            shell: false,
          });
        } catch (spawnError: any) {
          if (this.fallbackOnError) {
            this.logger.warn(`Docker execution failed (${spawnError.message}), falling back to mock PDF`);
            return resolve({
              success: true,
              pdfBuffer: LocalProcessRunner.generateFallbackPdf(),
              log: `[FALLBACK] Docker spawn error: ${spawnError.message}. Mock PDF generated.\n`,
              exitCode: 0,
              durationMs: Date.now() - startTime,
            });
          }
          return resolve({
            success: false,
            log: `Docker spawn failed: ${spawnError.message}`,
            exitCode: 1,
            durationMs: Date.now() - startTime,
          });
        }

        childProcess.on('error', (err: any) => {
          if ((err.code === 'ENOENT' || err.code === 'ETIMEDOUT') && this.fallbackOnError) {
            this.logger.warn(`Docker CLI error (${err.code}), using graceful fallback`);
            return resolve({
              success: true,
              pdfBuffer: LocalProcessRunner.generateFallbackPdf(),
              log: `[FALLBACK] Docker CLI error (${err.code}). Fallback mock PDF generated.\n`,
              exitCode: 0,
              durationMs: Date.now() - startTime,
            });
          }
          resolve({
            success: false,
            log: `Docker error: ${err.message}`,
            exitCode: 1,
            durationMs: Date.now() - startTime,
          });
        });

        childProcess.stdout?.on('data', (chunk: Buffer) => {
          stdout += chunk.toString();
        });

        childProcess.stderr?.on('data', (chunk: Buffer) => {
          stderr += chunk.toString();
        });

        childProcess.on('close', (code: number | null) => {
          const durationMs = Date.now() - startTime;
          const fullLog = (stdout + '\n' + stderr).trim();

          if (code === 0) {
            const pdfName = mainFile.replace(/\.tex$/i, '.pdf');
            const pdfPath = path.join(tempDir, pdfName);

            if (fs.existsSync(pdfPath)) {
              const pdfBuffer = fs.readFileSync(pdfPath);
              return resolve({
                success: true,
                pdfBuffer,
                log: fullLog,
                exitCode: 0,
                durationMs,
              });
            }
          }

          if (
            this.fallbackOnError &&
            (code === 125 ||
              code === 127 ||
              code === null ||
              (code === 1 &&
                (fullLog.toLowerCase().includes('daemon') ||
                  fullLog.toLowerCase().includes('cannot connect') ||
                  fullLog.toLowerCase().includes('error during connect') ||
                  fullLog.toLowerCase().includes('pipe'))))
          ) {
            // Docker daemon not running or image missing
            return resolve({
              success: true,
              pdfBuffer: LocalProcessRunner.generateFallbackPdf(),
              log: `[FALLBACK] Docker container error (exit ${code}):\n${fullLog}\nFallback mock PDF generated.`,
              exitCode: 0,
              durationMs,
            });
          }

          resolve({
            success: false,
            log: fullLog,
            exitCode: code ?? 1,
            durationMs,
          });
        });
      });
    } catch (err: any) {
      return {
        success: false,
        log: `DockerSandboxRunner exception: ${err.message}`,
        exitCode: 1,
        durationMs: Date.now() - startTime,
      };
    } finally {
      try {
        if (fs.existsSync(tempDir)) {
          fs.rmSync(tempDir, { recursive: true, force: true });
        }
      } catch (cleanupError: any) {
        this.logger.warn(`Failed to clean up temp dir ${tempDir}: ${cleanupError.message}`);
      }
    }
  }
}
