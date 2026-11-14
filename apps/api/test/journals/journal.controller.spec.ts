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
});
