import { NextRequest, NextResponse } from 'next/server';

// A full article can take ~100s when Tectonic runs inside Docker.
export const maxDuration = 300;

/**
 * POST /api/compile-latex
 * Forwards the LaTeX source to the NestJS backend (Tectonic) and pipes the PDF back.
 * The caller's bearer token is forwarded (the backend compile route requires login).
 * On failure it returns a JSON error (never a blank placeholder PDF) so the UI can show it.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const tex = body.tex || body.texContent;
    const { images, engine, jobName, autoFontFallback } = body;

    if (!tex || typeof tex !== 'string') {
      return NextResponse.json(
        {
          error: 'Mã nguồn LaTeX (tex) không hợp lệ',
          details: 'Thiếu trường dữ liệu tex hoặc nội dung rỗng',
        },
        { status: 400 }
      );
    }

    const backendBaseUrl = (
      process.env.INTERNAL_API_URL ||
      process.env.API_SERVER_URL ||
      process.env.NEXT_PUBLIC_API_URL ||
      'http://localhost:3001'
    ).replace(/\/+$/, '');

    const authorization = req.headers.get('authorization');

    let backendRes: Response;
    try {
      backendRes = await fetch(`${backendBaseUrl}/api/v1/compile/latex`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authorization ? { Authorization: authorization } : {}),
        },
        body: JSON.stringify({
          tex,
          texContent: tex,
          jobName: jobName || 'article',
          engine: engine || 'tectonic',
          autoFontFallback: autoFontFallback !== false,
          images: images || {},
        }),
      });
    } catch (backendErr: any) {
      console.warn('[compile-latex] Backend unreachable:', backendErr?.message || backendErr);
      return NextResponse.json(
        {
          error: 'Không kết nối được tới backend biên dịch',
          details: `Kiểm tra container structpaper-api-dev (cổng 3001) và INTERNAL_API_URL. ${backendErr?.message || ''}`,
          engine: 'Tectonic',
        },
        { status: 502 }
      );
    }

    if (backendRes.status === 401 || backendRes.status === 403) {
      return NextResponse.json(
        {
          error:
            backendRes.status === 401
              ? 'Phiên đăng nhập đã hết hạn hoặc chưa đăng nhập'
              : 'Bạn không có quyền biên dịch',
          details: 'Hãy đăng nhập lại rồi biên dịch lại.',
          engine: 'Tectonic',
        },
        { status: backendRes.status },
      );
    }

    if (!backendRes.ok) {
      const errorText = await backendRes.text().catch(() => '');
      console.warn(`[compile-latex] Backend returned ${backendRes.status}:`, errorText);
      return NextResponse.json(
        {
          error: `Backend biên dịch trả lỗi (${backendRes.status})`,
          details: errorText.slice(0, 2000),
          engine: 'Tectonic',
        },
        { status: 502 }
      );
    }

    const arrayBuf = await backendRes.arrayBuffer();
    const engineHeader = backendRes.headers.get('x-compiler-engine') || '';

    // The backend answers 200 with a blank placeholder PDF (engine label without
    // "Tectonic"/"Cached") when the compiler failed or timed out.
    if (!/tectonic|cached/i.test(engineHeader) || arrayBuf.byteLength === 0) {
      return NextResponse.json(
        {
          error: 'Tectonic trên backend biên dịch thất bại hoặc quá thời gian',
          details: 'Xem log chi tiết: docker logs structpaper-api-dev',
          engine: engineHeader || 'Tectonic',
        },
        { status: 502 }
      );
    }

    return new Response(new Uint8Array(arrayBuf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline; filename="article.pdf"',
        'X-Compiler-Engine': engineHeader,
        'X-Compiled-Timestamp': new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error('API /api/compile-latex error:', error);
    return NextResponse.json(
      { error: 'Lỗi biên dịch nội bộ', details: error?.message || String(error) },
      { status: 500 }
    );
  }
}
