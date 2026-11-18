import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/compile-latex/route';

const PDF_BYTES = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF');

function backendReply(engine: string | null, status = 200, body: Buffer | string = PDF_BYTES) {
  const headers: Record<string, string> = { 'content-type': 'application/pdf' };
  if (engine) headers['x-compiler-engine'] = engine;
  return new Response(new Uint8Array(Buffer.from(body)), { status, headers });
}

describe('LaTeX Compile Route (POST /api/compile-latex)', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    process.env.INTERNAL_API_URL = 'http://api:3001/';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.INTERNAL_API_URL;
  });

  function createRequest(body: Record<string, any>): NextRequest {
    return new NextRequest('http://localhost:3000/api/compile-latex', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  it('forwards the LaTeX to the backend compile endpoint and returns the PDF', async () => {
    fetchMock.mockResolvedValueOnce(backendReply('NestJS Compiler Engine (Tectonic)'));

    const response = await POST(
      createRequest({
        tex: '\\documentclass{article}\\begin{document}Hello World\\end{document}',
        jobName: 'article',
        images: { 'fig1.png': 'base64data' },
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('application/pdf');
    expect(response.headers.get('content-disposition')).toBe('inline; filename="article.pdf"');
    expect(response.headers.get('x-compiler-engine')).toBe('NestJS Compiler Engine (Tectonic)');
    expect(Buffer.from(await response.arrayBuffer())).toEqual(PDF_BYTES);

    // Trailing slash of INTERNAL_API_URL is normalised; payload carries tex + images
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://api:3001/api/v1/compile/latex');
    const sent = JSON.parse(init.body);
    expect(sent.tex).toContain('Hello World');
    expect(sent.engine).toBe('tectonic');
    expect(sent.images).toEqual({ 'fig1.png': 'base64data' });
  });

  it('forwards the bearer token of the caller to the backend (the compile route requires login)', async () => {
    fetchMock.mockResolvedValueOnce(backendReply('NestJS Compiler Engine (Tectonic)'));
    const req = new NextRequest('http://localhost:3000/api/compile-latex', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer abc.def.ghi' },
      body: JSON.stringify({ tex: '\documentclass{article}' }),
    });

    await POST(req);

    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer abc.def.ghi');
  });

  it('does not invent an Authorization header when the caller has none', async () => {
    fetchMock.mockResolvedValueOnce(backendReply('NestJS Compiler Engine (Tectonic)'));

    await POST(createRequest({ tex: '\documentclass{article}' }));

    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBeUndefined();
  });

  it('answers 401 / 403 from the backend with the same status and a clear login message', async () => {
    fetchMock.mockResolvedValueOnce(backendReply(null, 401, '{"detail":"Missing or invalid Authorization header"}'));
    const unauthorized = await POST(createRequest({ tex: '\documentclass{article}' }));
    expect(unauthorized.status).toBe(401);
    expect((await unauthorized.json()).error).toMatch(/đăng nhập/i);

    fetchMock.mockResolvedValueOnce(backendReply(null, 403, '{}'));
    const forbidden = await POST(createRequest({ tex: '\documentclass{article}' }));
    expect(forbidden.status).toBe(403);
  });

  it('accepts a cached compilation as a real PDF', async () => {
    fetchMock.mockResolvedValueOnce(backendReply('NestJS Compiler Engine (Cached)'));

    const response = await POST(createRequest({ tex: '\\documentclass{article}' }));
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('application/pdf');
  });

  it('returns 400 Bad Request if tex payload is missing or empty', async () => {
    const response = await POST(createRequest({ images: {} }));

    expect(response.status).toBe(400);
    expect((await response.json()).error).toBeDefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  /**
   * Regression: a failed compilation used to come back as an empty one-page PDF, so users just
   * saw a blank sheet. The route must surface an error instead.
   */
  it('reports the backend being unreachable as a 502 error, never as a blank PDF', async () => {
    fetchMock.mockRejectedValueOnce(new Error('connect ECONNREFUSED 127.0.0.1:3001'));

    const response = await POST(createRequest({ tex: '\\documentclass{article}' }));

    expect(response.status).toBe(502);
    expect(response.headers.get('content-type')).toContain('application/json');
    const data = await response.json();
    expect(data.error).toMatch(/backend/i);
    expect(data.details).toContain('ECONNREFUSED');
  });

  it('treats the backend placeholder PDF (compiler failed or timed out) as an error', async () => {
    // The backend answers 200 with a blank PDF and an engine label WITHOUT "Tectonic"
    fetchMock.mockResolvedValueOnce(backendReply('NestJS Compiler Engine'));

    const response = await POST(createRequest({ tex: '\\documentclass{article}' }));

    expect(response.status).toBe(502);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect((await response.json()).error).toMatch(/Tectonic/);
  });

  it('passes a backend HTTP error on as a 502 with the backend message', async () => {
    fetchMock.mockResolvedValueOnce(backendReply(null, 500, 'compile exploded'));

    const response = await POST(createRequest({ tex: '\\documentclass{article}' }));

    expect(response.status).toBe(502);
    const data = await response.json();
    expect(data.error).toContain('500');
    expect(data.details).toContain('compile exploded');
  });
});
