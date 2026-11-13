import { describe, it, expect, beforeEach } from 'vitest';
import { ArgumentsHost, BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { z, ZodError } from 'zod';
import { Rfc9457ExceptionFilter } from '../../src/modules/platform/filters/rfc9457-exception.filter';
import { ZodValidationPipe } from '../../src/modules/platform/pipes/zod-validation.pipe';
import { HealthController } from '../../src/modules/platform/controllers/health.controller';
import { AppModule } from '../../src/app.module';

function createMockArgumentsHost(url = '/api/v1/test') {
  let statusCode = 200;
  const headers: Record<string, string> = {};
  let sentBody: any = null;

  const mockReply = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    header(name: string, value: string) {
      headers[name.toLowerCase()] = value;
      return this;
    },
    type(contentType: string) {
      headers['content-type'] = contentType;
      return this;
    },
    send(body: any) {
      sentBody = body;
      return this;
    },
  };

  const mockRequest = {
    raw: { url },
    url,
    method: 'GET',
  };

  const host = {
    switchToHttp: () => ({
      getResponse: () => mockReply,
      getRequest: () => mockRequest,
    }),
  } as unknown as ArgumentsHost;

  return {
    host,
    getStatusCode: () => statusCode,
    getHeaders: () => headers,
    getBody: () => sentBody,
  };
}

describe('RFC 9457 Exception Filter & Platform Suite', () => {
  let filter: Rfc9457ExceptionFilter;

  beforeEach(() => {
    filter = new Rfc9457ExceptionFilter();
  });

  describe('Rfc9457ExceptionFilter', () => {
    it('formats standard HttpException (NotFoundException) to application/problem+json', () => {
      const mock = createMockArgumentsHost('/api/v1/manuscripts/123');
      const exception = new NotFoundException('Manuscript not found');

      filter.catch(exception, mock.host);

      expect(mock.getStatusCode()).toBe(404);
      expect(mock.getHeaders()['content-type']).toBe('application/problem+json');

      const body = mock.getBody();
      expect(body).toMatchObject({
        type: 'about:blank',
        title: 'Not Found',
        status: 404,
        detail: 'Manuscript not found',
        instance: '/api/v1/manuscripts/123',
      });
    });

    it('formats custom BadRequestException with code and invalidParams', () => {
      const mock = createMockArgumentsHost('/api/v1/auth/login');
      const exception = new BadRequestException({
        title: 'Invalid Request Payload',
        detail: 'The email address is invalid',
        code: 'INVALID_CREDENTIALS',
        invalidParams: [{ name: 'email', reason: 'Must be a valid email address' }],
      });

      filter.catch(exception, mock.host);

      expect(mock.getStatusCode()).toBe(400);
      expect(mock.getHeaders()['content-type']).toBe('application/problem+json');

      const body = mock.getBody();
      expect(body).toMatchObject({
        type: 'about:blank',
        title: 'Invalid Request Payload',
        status: 400,
        detail: 'The email address is invalid',
        code: 'INVALID_CREDENTIALS',
        instance: '/api/v1/auth/login',
        invalidParams: [{ name: 'email', reason: 'Must be a valid email address' }],
      });
    });

    it('formats ZodError into status 400 with structured invalidParams', () => {
      const mock = createMockArgumentsHost('/api/v1/manuscripts');
      const schema = z.object({
        title: z.string().min(5, 'Title must be at least 5 characters'),
        pages: z.number().positive('Pages must be positive'),
      });

      const parseResult = schema.safeParse({ title: 'Hi', pages: -2 });
      expect(parseResult.success).toBe(false);
      if (parseResult.success) return;

      filter.catch(parseResult.error, mock.host);

      expect(mock.getStatusCode()).toBe(400);
      expect(mock.getHeaders()['content-type']).toBe('application/problem+json');

      const body = mock.getBody();
      expect(body.status).toBe(400);
      expect(body.title).toBe('Bad Request');
      expect(body.code).toBe('VALIDATION_ERROR');
      expect(body.detail).toBe('Request validation failed');
      expect(body.instance).toBe('/api/v1/manuscripts');
      expect(body.invalidParams).toBeDefined();
      expect(body.invalidParams).toHaveLength(2);
      expect(body.invalidParams).toContainEqual({
        name: 'title',
        reason: 'Title must be at least 5 characters',
      });
      expect(body.invalidParams).toContainEqual({
        name: 'pages',
        reason: 'Pages must be positive',
      });
    });

    it('formats 409 Conflict with op-log sync extensions (OUT_OF_SYNC)', () => {
      const mock = createMockArgumentsHost('/api/v1/manuscripts/m1/sync/patches');
      const exception = new ConflictException({
        title: 'Conflict',
        detail: 'Document base server revision is outdated',
        code: 'OUT_OF_SYNC',
        serverRev: 14,
        missingOps: [{ id: 'op-12', serverRev: 13 }, { id: 'op-13', serverRev: 14 }],
      });

      filter.catch(exception, mock.host);

      expect(mock.getStatusCode()).toBe(409);
      expect(mock.getHeaders()['content-type']).toBe('application/problem+json');

      const body = mock.getBody();
      expect(body).toMatchObject({
        type: 'about:blank',
        title: 'Conflict',
        status: 409,
        detail: 'Document base server revision is outdated',
        code: 'OUT_OF_SYNC',
        serverRev: 14,
        missingOps: [{ id: 'op-12', serverRev: 13 }, { id: 'op-13', serverRev: 14 }],
      });
    });

    it('formats unhandled generic Error to status 500 without leaking stack traces', () => {
      const mock = createMockArgumentsHost('/api/v1/crash');
      const unhandledError = new Error('Database disk write timeout');

      filter.catch(unhandledError, mock.host);

      expect(mock.getStatusCode()).toBe(500);
      expect(mock.getHeaders()['content-type']).toBe('application/problem+json');

      const body = mock.getBody();
      expect(body.status).toBe(500);
      expect(body.title).toBe('Internal Server Error');
      expect(body.type).toBe('about:blank');
      expect(body.instance).toBe('/api/v1/crash');
      expect(typeof body.detail).toBe('string');
    });
  });

  describe('ZodValidationPipe', () => {
    const TestSchema = z.object({
      name: z.string().min(2),
      email: z.string().email(),
    });

    it('passes valid payloads through unchanged', () => {
      const pipe = new ZodValidationPipe(TestSchema);
      const input = { name: 'Dr. Jane Doe', email: 'jane@structpaper.org' };

      const output = pipe.transform(input, { type: 'body' });
      expect(output).toEqual(input);
    });

    it('throws ZodError on invalid payload so filter can catch it', () => {
      const pipe = new ZodValidationPipe(TestSchema);
      const invalidInput = { name: 'A', email: 'not-an-email' };

      expect(() => {
        pipe.transform(invalidInput, { type: 'body' });
      }).toThrowError(ZodError);
    });

    it('returns value unchanged when no schema is configured on pipe', () => {
      const pipe = new ZodValidationPipe();
      const input = { arbitrary: 123 };
      expect(pipe.transform(input, { type: 'body' })).toEqual(input);
    });
  });

  describe('HealthController', () => {
    it('returns server health status with uptime, timestamp, and database info', async () => {
      const controller = new HealthController();
      const result = await controller.check();

      expect(result).toBeDefined();
      expect(result.status).toBe('ok');
      expect(typeof result.uptime).toBe('number');
      expect(typeof result.timestamp).toBe('string');
      expect(result.database).toBeDefined();
      expect(typeof result.database.status).toBe('string');
    });
  });

  describe('NestJS Fastify AppModule Bootstrap & HTTP Routing', () => {
    it('initializes AppModule on FastifyAdapter and serves /health', async () => {
      const app = await NestFactory.create<NestFastifyApplication>(
        AppModule,
        new FastifyAdapter(),
        { logger: false },
      );
      app.useGlobalFilters(new Rfc9457ExceptionFilter());
      await app.init();
      await app.getHttpAdapter().getInstance().ready();

      const response = await app.inject({
        method: 'GET',
        url: '/health',
      });

      expect(response.statusCode).toBe(200);
      const json = JSON.parse(response.payload);
      expect(json.status).toBe('ok');
      expect(typeof json.uptime).toBe('number');

      await app.close();
    });

    it('returns RFC 9457 problem details when accessing a nonexistent route (404)', async () => {
      const app = await NestFactory.create<NestFastifyApplication>(
        AppModule,
        new FastifyAdapter(),
        { logger: false },
      );
      app.useGlobalFilters(new Rfc9457ExceptionFilter());
      await app.init();
      await app.getHttpAdapter().getInstance().ready();

      const response = await app.inject({
        method: 'GET',
        url: '/non-existent-route',
      });

      expect(response.statusCode).toBe(404);
      expect(response.headers['content-type']).toContain('application/problem+json');
      const json = JSON.parse(response.payload);
      expect(json.status).toBe(404);
      expect(json.type).toBe('about:blank');
      expect(json.title).toBe('Not Found');
      expect(json.instance).toBe('/non-existent-route');

      await app.close();
    });
  });
});
