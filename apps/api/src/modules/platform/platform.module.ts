import { Module, Global } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { HealthController } from './controllers/health.controller';
import { CompileController } from './controllers/compile.controller';
import { CompileService } from './application/compile.service';
import { CompileQueue } from './application/compile-queue';
import { Rfc9457ExceptionFilter } from './filters/rfc9457-exception.filter';
import { ZodValidationPipe } from './pipes/zod-validation.pipe';
import { createDbClient } from '@structpaper/db';

export const DRIZZLE = 'DRIZZLE';

const dbProvider = {
  provide: 'DB_CLIENT',
  useFactory: () => {
    const url = process.env.DATABASE_URL;
    if (!url) {
      return null;
    }
    try {
      const { client } = createDbClient(url);
      return client;
    } catch {
      return null;
    }
  },
};

const drizzleProvider = {
  provide: DRIZZLE,
  useFactory: () => {
    const url = process.env.DATABASE_URL;
    if (!url) {
      return null;
    }
    try {
      const { db } = createDbClient(url);
      return db;
    } catch {
      return null;
    }
  },
};

@Global()
@Module({
  controllers: [HealthController, CompileController],
  providers: [
    {
      provide: APP_FILTER,
      useClass: Rfc9457ExceptionFilter,
    },
    Rfc9457ExceptionFilter,
    ZodValidationPipe,
    CompileQueue,
    CompileService,
    dbProvider,
    drizzleProvider,
  ],
  exports: [Rfc9457ExceptionFilter, ZodValidationPipe, CompileQueue, CompileService, 'DB_CLIENT', DRIZZLE],
})
export class PlatformModule {}
