import 'reflect-metadata';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

// Automatically load root .env file in dev mode
const envPaths = [resolve(process.cwd(), '.env'), resolve(process.cwd(), '../../.env'), resolve(__dirname, '../../../.env')];
for (const p of envPaths) {
  if (existsSync(p)) {
    try {
      process.loadEnvFile(p);
      break;
    } catch {}
  }
}
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';
import fastifyCookie from '@fastify/cookie';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { Rfc9457ExceptionFilter } from './modules/platform/filters/rfc9457-exception.filter';

export async function bootstrap(): Promise<NestFastifyApplication> {
  const logger = new Logger('Bootstrap');
  const adapter = new FastifyAdapter({
    logger: process.env.NODE_ENV !== 'production',
    // Compile requests carry the whole LaTeX source plus base64 images (Fastify's default is 1 MB).
    bodyLimit: Number(process.env.BODY_LIMIT_BYTES) || 64 * 1024 * 1024,
  });

  const app = await NestFactory.create<NestFastifyApplication>(AppModule, adapter);

  // The compiled PDF of a manuscript arrives as a raw application/pdf body.
  app
    .getHttpAdapter()
    .getInstance()
    .addContentTypeParser('application/pdf', { parseAs: 'buffer' }, (_req: any, body: Buffer, done: any) => done(null, body));

  await app.register(helmet as any, {
    contentSecurityPolicy: process.env.NODE_ENV === 'production',
  });

  await app.register(cors as any, {
    origin: process.env.CORS_ORIGIN || true,
    credentials: true,
  });

  await app.register(fastifyCookie as any, {
    secret: process.env.COOKIE_SECRET || process.env.JWT_SECRET || 'dev-jwt-cookie-secret-structpaper',
  });

  app.setGlobalPrefix('api/v1', {
    exclude: ['health'],
  });

  const port = Number(process.env.PORT) || 4000;
  const host = process.env.HOST || '0.0.0.0';

  await app.listen(port, host);
  logger.log(`StructPaper API server running on http://${host}:${port}`);
  logger.log(`Health check available at http://${host}:${port}/health`);
  return app;
}

if (process.env.NODE_ENV !== 'test' && !process.env.VITEST) {
  bootstrap().catch((err) => {
    console.error('Fatal bootstrap failure:', err);
    process.exit(1);
  });
}
