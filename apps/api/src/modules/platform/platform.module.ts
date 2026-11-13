import { Module, Global } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { HealthController } from './controllers/health.controller';
import { Rfc9457ExceptionFilter } from './filters/rfc9457-exception.filter';
import { ZodValidationPipe } from './pipes/zod-validation.pipe';
import { createDbClient } from '@structpaper/db';

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

@Global()
@Module({
  controllers: [HealthController],
  providers: [
    {
      provide: APP_FILTER,
      useClass: Rfc9457ExceptionFilter,
    },
    Rfc9457ExceptionFilter,
    ZodValidationPipe,
    dbProvider,
  ],
  exports: [Rfc9457ExceptionFilter, ZodValidationPipe, 'DB_CLIENT'],
})
export class PlatformModule {}
