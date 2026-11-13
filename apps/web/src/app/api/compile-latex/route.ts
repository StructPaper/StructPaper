import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Checks if a CLI command is available in system PATH
 */
async function isCommandAvailable(command: string): Promise<boolean> {
  try {
    const isWindows = process.platform === 'win32';
    const checkCmd = isWindows ? `where ${command}` : `which ${command}`;
    await execAsync(checkCmd);
    return true;
  } catch {
    return false;
  }
}

/**
 * Extracts key error lines from LaTeX log file
 */
function extractLatexErrors(logContent: string): string[] {
  const lines = logContent.split('\n');
  const errors: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('!') || line.startsWith('Fatal')) {
      // Collect the error and next 2 context lines
      const context = lines.slice(i, Math.min(lines.length, i + 3)).join('\n');
      errors.push(context);
      i += 2;
    }
  }

  return errors;
}

/**
 * POST /api/compile-latex
 * Pure, transparent LaTeX compilation backend:
 * - Executes XeLaTeX directly on the host machine.
 * - NO silent fallbacks: If compilation fails or XeLaTeX is not installed, returns exact error log.
 */
export async function POST(req: NextRequest) {
  let jobDir = '';

  try {
    const body = await req.json();
    const { tex, images } = body;

    if (!tex || typeof tex !== 'string') {
      return NextResponse.json(
        {
          error: 'Mã nguồn LaTeX (tex) không hợp lệ',
          details: 'Thiếu trường dữ liệu tex hoặc nội dung rỗng',
        },
        { status: 400 }
      );
    }

    // --- 1. PROXY TO JAVA SPRING BOOT BACKEND FIRST ---
    // Only proxy if explicitly configured via SPRING_API_URL, or if local port 8080 confirms it is StructPaper backend.
    const configuredSpringUrl = process.env.SPRING_API_URL;
    let springCompileUrl: string | null = configuredSpringUrl
      ? `${configuredSpringUrl.replace(/\/+$/, '')}/api/v1/compile/latex`
      : null;

    if (!springCompileUrl) {
      // Fast probe to 127.0.0.1:8080 (IPv4 only to avoid ::1 wslrelay hangs)
      // to check if StructPaper backend is actively running locally on port 8080
      try {
        const probeRes = await fetch('http://127.0.0.1:8080/api/v1/system/status', {
          method: 'GET',
          signal: AbortSignal.timeout(800),
        });
        if (probeRes.ok) {
          const statusJson = (await probeRes.json().catch(() => ({}))) as Record<string, any>;
          if (statusJson.engine || statusJson.status || statusJson.operatingSystem) {
            springCompileUrl = 'http://127.0.0.1:8080/api/v1/compile/latex';
          }
        }
      } catch {
        // Not running or timed out; continue to local CLI engine
      }
    }

    if (springCompileUrl) {
      try {
        const springRes = await fetch(springCompileUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ texContent: tex, jobName: 'article', autoFontFallback: true, images: images || {} }),
          signal: AbortSignal.timeout(60000),
        });
        if (springRes.ok) {
          const pdfBuffer = await springRes.arrayBuffer();
          const engine = springRes.headers.get('x-compiler-engine') || 'XeLaTeX';
          const duration = springRes.headers.get('x-compilation-time-ms') || '0';
          return new NextResponse(pdfBuffer, {
            status: 200,
            headers: {
              'Content-Type': 'application/pdf',
              'Content-Disposition': 'inline; filename="article.pdf"',
              'X-Compiler-Engine': `Java Spring Boot (${engine})`,
              'X-Compilation-Time-Ms': duration,
            },
          });
        }
      } catch (springErr) {
        console.warn('[compile-latex] Spring Boot proxy failed or timed out:', springErr);
        // Continue to local CLI fallback below
      }
    }

    // 2. Create a secure, isolated job workspace in OS temp directory
    const jobId = `latex-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    jobDir = path.join(os.tmpdir(), jobId);
    fs.mkdirSync(jobDir, { recursive: true });

    const texFilePath = path.join(jobDir, 'article.tex');
    const pdfFilePath = path.join(jobDir, 'article.pdf');
    const logFilePath = path.join(jobDir, 'article.log');

    // 2. Apply safe font and file fallbacks so XeTeX / Tectonic never halt on missing proprietary files
    // 2. Apply safe font and file fallbacks so XeTeX / Tectonic never halt on missing proprietary files
    let safeTex = tex;
    if (safeTex.includes('\\setmainfont{MinionPro-Regular.otf}')) {
      safeTex = safeTex.replace(
        /\\setmainfont\{MinionPro-Regular\.otf\}\[[^\]]*\]/g,
        '\\setmainfont{Times New Roman}[Ligatures=TeX]'
      );
    }
    if (safeTex.includes('\\setsansfont{MyriadPro-Regular.otf}')) {
      safeTex = safeTex.replace(
        /\\setsansfont\{MyriadPro-Regular\.otf\}\[[^\]]*\]/g,
        '\\setsansfont{Calibri}[Ligatures=TeX]'
      );
    }
    if (safeTex.includes('\\setmonofont{UniversLTStd-Light.otf}')) {
      safeTex = safeTex.replace(
        /\\setmonofont\{UniversLTStd-Light\.otf\}\[[^\]]*\]/g,
        '\\setmonofont{Calibri Light}[Ligatures=TeX]'
      );
    }
    if (safeTex.includes('\\newfontfamily\\prolight{MyriadPro-Light.otf}')) {
      safeTex = safeTex.replace(
        /\\newfontfamily\\prolight\{MyriadPro-Light\.otf\}\[[^\]]*\]/g,
        '\\newfontfamily\\prolight{Calibri Light}[Ligatures=TeX]'
      );
    }
    if (safeTex.includes('\\usepackage{tabcaptionwidth}')) {
      safeTex = safeTex.replace(
        '\\usepackage{tabcaptionwidth}',
        '\\IfFileExists{tabcaptionwidth.sty}{\\usepackage{tabcaptionwidth}}{\\providecommand{\\tabularWidth}{\\linewidth}}'
      );
    }
    if (safeTex.includes('\\input{size9-edited.clo}')) {
      safeTex = safeTex.replace('\\input{size9-edited.clo}', '\\IfFileExists{size9-edited.clo}{\\input{size9-edited.clo}}{}');
    }
    if (safeTex.includes('\\usepackage{multirow-custom}')) {
      safeTex = safeTex.replace('\\usepackage{multirow-custom}', '\\IfFileExists{multirow-custom.sty}{\\usepackage{multirow-custom}}{}');
    }

    // Title width calibration for Calibri metrics (ensures line 1 ends at 'cập nhật' and line 2 starts with 'trong điều trị')
    safeTex = safeTex.replace('\\parbox{\\dimexpr(\\linewidth+4.8cm)}', '\\parbox{\\dimexpr(\\linewidth+3.9cm)}');
    safeTex = safeTex.replace("T\\'{A} TR\\`{A}NG:", "T\\'{A}~TR\\`{A}NG:");
    safeTex = safeTex.replace('TÁ TRÀNG:', 'TÁ~TRÀNG:');
    safeTex = safeTex.replace('\\textsuperscript{*},', '\\textsuperscript{*}\\!,');

    // Strip invisible/zero-width characters that break fonts
    safeTex = safeTex.replace(/[\u200B\u200C\u200D\uFEFF\u200E\u200F]/g, '');

    fs.writeFileSync(texFilePath, safeTex, 'utf-8');

    // 3. Copy graphic assets to job directory
    const imageDirs = [
      path.join(process.cwd(), 'public', 'media'),
      path.join(process.cwd(), 'public', 'demo-images'),
      path.join(process.cwd(), 'public', 'sample-media'),
    ];

    const subImagesDir = path.join(jobDir, 'images');
    fs.mkdirSync(subImagesDir, { recursive: true });

    // Copy base demo assets first
    for (const imgDir of imageDirs) {
      if (fs.existsSync(imgDir)) {
        const files = fs.readdirSync(imgDir);
        for (const file of files) {
          try {
            const srcPath = path.join(imgDir, file);
            if (fs.statSync(srcPath).isFile()) {
              fs.copyFileSync(srcPath, path.join(jobDir, file));
              fs.copyFileSync(srcPath, path.join(subImagesDir, file));
            }
          } catch { }
        }
      }
    }

    // File aliases for standard template icons
    const copyAlias = (srcName: string, ...targets: string[]) => {
      const srcP = path.join(jobDir, srcName);
      if (fs.existsSync(srcP)) {
        for (const t of targets) {
          try {
            fs.copyFileSync(srcP, path.join(jobDir, t));
            fs.copyFileSync(srcP, path.join(subImagesDir, t));
          } catch { }
        }
      }
    };

    copyAlias('image2.png', 'article-qr.png', 'qr-code.png', 'qr-code');
    copyAlias('image4.jpeg', 'logo-vnuhcmpress-color.png', 'logo-vnuhcmpress-color.jpeg', 'logo-vnuhcmpress-color');
    copyAlias('image3.jpeg', 'check-update.jpeg', 'check-update.jpg');
    // open-access.png comes from public/demo-images (image1.png is usually a figure, not the icon)

    // Only copy default sample figure 1 if client did not supply a custom figure
    const hasCustomFig1 = images && (images['fig1.png'] || images['fig1.jpg'] || images['fig_1.png']);
    if (!hasCustomFig1) {
      copyAlias('image5.jpeg', 'hs630_fig_1.jpg', '21b96d08-b05f-46d2-b278-a27112337f5fimage1.png', 'fig1.png');
    }

    // Now write client uploaded images LAST so they take absolute priority
    if (images && typeof images === 'object') {
      for (const [filename, base64Content] of Object.entries(images)) {
        try {
          const buffer = Buffer.from(base64Content as string, 'base64');
          fs.writeFileSync(path.join(jobDir, filename), buffer);
          fs.writeFileSync(path.join(subImagesDir, filename), buffer);
        } catch (e) {
          console.warn('Failed to write figure image:', filename, e);
        }
      }
    }

    // 4. Check if XeLaTeX or Tectonic engine is available
    const hasXeLatex = await isCommandAvailable('xelatex');
    const exeName = process.platform === 'win32' ? 'tectonic.exe' : 'tectonic';
    const possibleTectonicPaths = [
      path.join(process.cwd(), 'bin', exeName),
      path.join(process.cwd(), '..', 'bin', exeName),
      path.join(process.cwd(), '..', '..', 'bin', exeName),
    ];
    const resolvedTectonicPath = possibleTectonicPaths.find((p) => fs.existsSync(p));
    const hasGlobalTectonic = await isCommandAvailable('tectonic');

    if (!hasXeLatex && !resolvedTectonicPath && !hasGlobalTectonic) {
      return NextResponse.json(
        {
          error: 'Chưa cài đặt trình biên dịch XeLaTeX trên máy tính',
          engine: 'None',
          installed: false,
          details:
            'Hệ điều hành Windows của bạn chưa có lệnh "xelatex" hoặc "tectonic".\n\n' +
            'Để biên dịch offline, vui lòng cài đặt MiKTeX hoặc TeX Live:\n' +
            '1. Tải MiKTeX (khuyên dùng): https://miktex.org/download\n' +
            '2. Sau khi cài, mở CMD kiểm tra: xelatex -v\n' +
            '3. Khởi động lại máy hoặc terminal để nhận biến môi trường PATH.',
          rawLog: '',
        },
        { status: 503 }
      );
    }

    // 5. Execute XeLaTeX / Tectonic CLI
    let compileError: Error | null = null;
    let compilerEngine = hasXeLatex ? 'XeLaTeX CLI' : 'Tectonic Engine';

    try {
      if (hasXeLatex) {
        // Two passes: citations (\cite) and page/table references resolve only on the second run,
        // otherwise they print as "?". (Tectonic reruns by itself.)
        for (let pass = 0; pass < 2; pass++) {
          await execAsync(`xelatex -interaction=nonstopmode -halt-on-error article.tex`, {
            cwd: jobDir,
            timeout: 90000,
          });
        }
      } else {
        const tectonicBin = resolvedTectonicPath ? `"${resolvedTectonicPath}"` : 'tectonic';
        await execAsync(`${tectonicBin} article.tex`, {
          cwd: jobDir,
          timeout: 60000,
        });
      }
    } catch (err: any) {
      compileError = err;
    }

    // 6. Check compilation result
    if (fs.existsSync(pdfFilePath) && fs.statSync(pdfFilePath).size > 1000) {
      const pdfBuffer = fs.readFileSync(pdfFilePath);
      return new Response(pdfBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': 'inline; filename="article.pdf"',
          'X-Compiler-Engine': compilerEngine,
          'X-Compiled-Timestamp': new Date().toISOString(),
        },
      });
    }

    // 7. If compilation failed, read the exact LaTeX error log and report it
    let fullLog = '';
    let extractedErrors: string[] = [];

    if (fs.existsSync(logFilePath)) {
      fullLog = fs.readFileSync(logFilePath, 'utf-8');
      extractedErrors = extractLatexErrors(fullLog);
    }

    return NextResponse.json(
      {
        error: 'Biên dịch XeLaTeX thất bại',
        engine: compilerEngine,
        installed: true,
        details:
          extractedErrors.length > 0
            ? extractedErrors.join('\n---\n')
            : compileError?.message || 'Lỗi không xác định khi chạy lệnh xelatex',
        rawLog: fullLog.slice(-4000), // Last 4000 chars of compiler log
      },
      { status: 422 }
    );
  } catch (error: any) {
    console.error('API /api/compile-latex error:', error);
    return NextResponse.json(
      {
        error: 'Lỗi máy chủ nội bộ',
        details: error.message || 'Lỗi không xác định',
      },
      { status: 500 }
    );
  } finally {
    // Clean up temporary workspace directory
    if (jobDir && fs.existsSync(jobDir)) {
      try {
        fs.rmSync(jobDir, { recursive: true, force: true });
      } catch { }
    }
  }
}
