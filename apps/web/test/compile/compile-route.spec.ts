import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { http, type InternalAxiosRequestConfig, type AxiosResponse } from '@structpaper/api-client';
import { POST } from '@/app/api/compile-latex/route';

describe('LaTeX Compile Route (POST /api/compile-latex)', () => {
  const originalAdapter = http.defaults.adapter;
  let lastRequest: InternalAxiosRequestConfig | null = null;
  let mockPdfBuffer: Buffer;

  beforeEach(() => {
    lastRequest = null;
    mockPdfBuffer = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF');

    http.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
      lastRequest = config;
      return {
        data: mockPdfBuffer,
        status: 200,
        statusText: 'OK',
        headers: {
          'content-type': 'application/pdf',
          'x-compiler-engine': 'NestJS Compiler Engine',
        },
        config,
      } as AxiosResponse;
    };
  });

  afterEach(() => {
    http.defaults.adapter = originalAdapter;
    vi.restoreAllMocks();
  });

  function createRequest(body: Record<string, any>): NextRequest {
    return new NextRequest('http://localhost:3000/api/compile-latex', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  }

  it('forwards compilation request to /api/proxy/api/v1/compile/latex via http client and returns 200 application/pdf', async () => {
    const req = createRequest({
      tex: '\\documentclass{article}\\begin{document}Hello World\\end{document}',
      jobName: 'article',
      images: { 'fig1.png': 'base64data' },
    });

    const response = await POST(req);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('application/pdf');
    expect(response.headers.get('content-disposition')).toBe('inline; filename="article.pdf"');
    expect(response.headers.get('x-compiler-engine')).toBe('NestJS Compiler Engine');

    // Verify request routed to /api/proxy/api/v1/compile/latex
    expect(lastRequest).not.toBeNull();
    expect(lastRequest?.baseURL).toBe('/api/proxy');
    expect(lastRequest?.url).toBe('/api/v1/compile/latex');
    const fullRequestedUrl = `${lastRequest?.baseURL}${lastRequest?.url}`;
    expect(fullRequestedUrl).toBe('/api/proxy/api/v1/compile/latex');
    expect(lastRequest?.method?.toLowerCase()).toBe('post');

    const arrayBuf = await response.arrayBuffer();
    expect(Buffer.from(arrayBuf)).toEqual(mockPdfBuffer);
  });

  it('returns 400 Bad Request if tex payload is missing or empty', async () => {
    const req = createRequest({
      images: {},
    });

    const response = await POST(req);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBeDefined();
  });

  it('gracefully falls back to minimal PDF when backend is unreachable without 503 error', async () => {
    http.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
      lastRequest = config;
      const error: any = new Error('connect ECONNREFUSED 127.0.0.1:3001');
      error.isAxiosError = true;
      error.config = config;
      throw error;
    };

    const req = createRequest({
      tex: '\\documentclass{article}\\begin{document}Fallback Test\\end{document}',
    });

    const response = await POST(req);

    // Must never return 503 asking user to install MiKTeX
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('application/pdf');
    expect(response.headers.get('content-disposition')).toBe('inline; filename="article.pdf"');

    const arrayBuf = await response.arrayBuffer();
    const pdfStr = Buffer.from(arrayBuf).toString('utf-8');
    expect(pdfStr.startsWith('%PDF-1.4')).toBe(true);
    expect(pdfStr).toContain('%%EOF');
  });
});
