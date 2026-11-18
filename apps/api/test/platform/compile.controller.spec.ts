import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '../../src/app.module';
import { Rfc9457ExceptionFilter } from '../../src/modules/platform/filters/rfc9457-exception.filter';
import { CompileService } from '../../src/modules/platform/application/compile.service';
import { AuthService } from '../../src/modules/identity/application/auth.service';

// Compilation is a protected route (global JwtAuthGuard): requests carry a bearer token.
const AUTH = { authorization: 'Bearer test-token' };

describe('CompileController & NestJS Compile LaTeX Route (/api/v1/compile/latex)', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    app = await NestFactory.create<NestFastifyApplication>(
      AppModule,
      new FastifyAdapter(),
      { logger: false },
    );
    app.setGlobalPrefix('api/v1', {
      exclude: ['health'],
    });
    app.useGlobalFilters(new Rfc9457ExceptionFilter());
    await app.init();
    await app.getHttpAdapter().getInstance().ready();

    // No database in this test: accept our test token as a valid session.
    vi.spyOn(app.get(AuthService), 'verifyTokenWithPermissions').mockResolvedValue({
      id: 'test-user',
      permissionsVersion: 1,
    } as any);
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('compiles LaTeX and returns 200 with application/pdf and proper headers', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/compile/latex',
      headers: {
        'content-type': 'application/json',
        ...AUTH,
      },
      payload: JSON.stringify({
        tex: '\\documentclass{article}\\begin{document}Test Paper\\end{document}',
        jobName: 'article',
        engine: 'xelatex',
        autoFontFallback: true,
      }),
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toBe('application/pdf');
    expect(response.headers['content-disposition']).toBe('inline; filename="article.pdf"');
    expect(response.headers['x-compiler-engine']).toBe('NestJS Compiler Engine');

    const pdfBuffer = response.rawPayload;
    expect(pdfBuffer).toBeDefined();
    expect(pdfBuffer.length).toBeGreaterThan(50);
    expect(pdfBuffer.toString('utf-8', 0, 5)).toBe('%PDF-');
  });

  it('accepts texContent field as an alternative to tex', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/compile/latex',
      headers: {
        'content-type': 'application/json',
        ...AUTH,
      },
      payload: JSON.stringify({
        texContent: '\\documentclass{article}\\begin{document}Alternative Tex\\end{document}',
      }),
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toBe('application/pdf');
    expect(response.rawPayload.toString('utf-8', 0, 5)).toBe('%PDF-');
  });

  it('returns valid fallback PDF buffer when tex is empty or minimal', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/compile/latex',
      headers: {
        'content-type': 'application/json',
        ...AUTH,
      },
      payload: JSON.stringify({
        tex: '',
      }),
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toBe('application/pdf');
    expect(response.headers['x-compiler-engine']).toBe('NestJS Compiler Engine');
    expect(response.rawPayload.toString('utf-8', 0, 5)).toBe('%PDF-');
  });

  it('rejects compilation without a token (401): the route is not public', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/compile/latex',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ tex: '\documentclass{article}\begin{document}x\end{document}' }),
    });

    expect(response.statusCode).toBe(401);
    expect(response.headers['content-type']).toContain('application/problem+json');
  });

  it('keeps the health check public', async () => {
    const response = await app.inject({ method: 'GET', url: '/health' });
    expect(response.statusCode).not.toBe(401);
  });

  it('CompileService.generateFallbackPdf returns valid 1-page PDF conforming to PDF-1.4', () => {
    const fallbackBuffer = CompileService.generateFallbackPdf();
    expect(fallbackBuffer).toBeDefined();
    expect(Buffer.isBuffer(fallbackBuffer)).toBe(true);
    const content = fallbackBuffer.toString('utf-8');
    expect(content.startsWith('%PDF-1.4')).toBe(true);
    expect(content).toContain('%%EOF');
  });
});
