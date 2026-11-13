export interface LatexFile {
  name: string;
  content: string | Buffer;
}

export interface LatexCompileOptions {
  mainFile?: string;
  files: Record<string, string | Buffer> | LatexFile[];
  engine?: 'XELATEX' | 'TECTONIC' | string;
  timeoutMs?: number;
}

export interface LatexCompileResult {
  success: boolean;
  pdfBuffer?: Buffer;
  log: string;
  exitCode: number;
  durationMs: number;
}

export interface LatexRunner {
  compile(options: LatexCompileOptions): Promise<LatexCompileResult>;
}
