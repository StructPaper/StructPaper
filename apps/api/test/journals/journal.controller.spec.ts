import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '../../src/app.module';
import { Rfc9457ExceptionFilter } from '../../src/modules/platform/filters/rfc9457-exception.filter';

describe('JournalsController (/api/v1/journals & /api/v1/profiles)', () => {
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
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('GET /api/v1/journals returns all 7 VNUHCM journals', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/journals',
    });

    expect(response.statusCode).toBe(200);
    const journals = JSON.parse(response.body);
    expect(Array.isArray(journals)).toBe(true);
    expect(journals.length).toBeGreaterThanOrEqual(7);

    const slugs = journals.map((j: any) => j.slug.toLowerCase());
    expect(slugs).toContain('vnuhcm-std');
    expect(slugs).toContain('vnuhcm-hs');
    expect(slugs).toContain('vnuhcm-ssh');
    expect(slugs).toContain('vnuhcm-ebl');
    expect(slugs).toContain('vnuhcm-et');
    expect(slugs).toContain('vnuhcm-ees');
    expect(slugs).toContain('vnuhcm-arns');
  });

  it('GET /api/v1/journals/:id returns specific journal details by short code or slug', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/journals/hs',
    });

    expect(response.statusCode).toBe(200);
    const journal = JSON.parse(response.body);
    expect(journal.shortName).toBe('HS');
    expect(journal.color).toBe('#2B74B7');
    expect(journal.name).toContain('Sức khỏe');
  });

  it('GET /api/v1/journals/:id/article-types returns allowed article types', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/journals/hs/article-types',
    });

    expect(response.statusCode).toBe(200);
    const articleTypes = JSON.parse(response.body);
    expect(Array.isArray(articleTypes)).toBe(true);
    expect(articleTypes.length).toBeGreaterThanOrEqual(1);
    expect(articleTypes.some((t: any) => t.id === 'research')).toBe(true);
  });

  it('GET /api/v1/profiles/resolve?journal=hs returns resolved 3-tier styling profile', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/profiles/resolve?journal=hs',
    });

    expect(response.statusCode).toBe(200);
    const profile = JSON.parse(response.body);
    expect(profile).toBeDefined();
    expect(profile.id?.toLowerCase()).toContain('hs');
    expect(profile.color).toBe('#2B74B7');
  });

  it('GET /api/v1/profiles/resolve answers with an ETag and the versions used', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/profiles/resolve?journal=hs&type=research' });
    expect(response.statusCode).toBe(200);
    expect(response.headers.etag).toMatch(/^"[0-9a-f]{16}"$/);
    expect(response.headers['x-profile-versions']).toMatch(/^base:\d+,journal:\d+(,type:\d+)?$/);
  });

  it('GET /api/v1/profiles/resolve rejects a malformed pin with 400', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/profiles/resolve?journal=hs&pin=oops' });
    expect(response.statusCode).toBe(400);
  });

  it('GET /api/v1/profiles/published is public, carries an ETag, and answers 304 when it has not changed', async () => {
    const first = await app.inject({ method: 'GET', url: '/api/v1/profiles/published' });
    expect(first.statusCode).toBe(200);
    expect(JSON.parse(first.body)).toHaveProperty('base');
    const etag = first.headers.etag as string;
    expect(etag).toBeTruthy();

    const again = await app.inject({ method: 'GET', url: '/api/v1/profiles/published', headers: { 'if-none-match': etag } });
    expect(again.statusCode).toBe(304);
  });

  describe('changing journals needs a signed-in manager', () => {
    const writes: Array<[string, string, object?]> = [
      ['POST', '/api/v1/journals', { key: 'zzz', name: 'Tạp chí thử', color: '#112233' }],
      ['PATCH', '/api/v1/journals/hs', { color: '#112233' }],
      ['GET', '/api/v1/profiles/journal/hs/versions'],
      ['POST', '/api/v1/profiles/journal/hs/drafts', { config: {} }],
      ['POST', '/api/v1/profiles/journal/hs/drafts/2/validate'],
      ['POST', '/api/v1/profiles/journal/hs/drafts/2/publish', {}],
      ['POST', '/api/v1/profiles/journal/hs/rollback', { toVersion: 1 }],
    ];
    for (const [method, url, payload] of writes) {
      it(`${method} ${url} without a token is 401`, async () => {
        const response = await app.inject({ method: method as any, url, payload: payload as any });
        expect(response.statusCode).toBe(401);
      });
    }
  });
});
