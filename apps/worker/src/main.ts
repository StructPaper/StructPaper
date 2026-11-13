import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { WorkerModule } from './worker.module';

async function bootstrap() {
  const logger = new Logger('WorkerMain');
  logger.log('Bootstrapping StructPaper standalone background worker context...');

  const app = await NestFactory.createApplicationContext(WorkerModule, {
    logger: ['log', 'error', 'warn', 'debug', 'verbose'],
  });

  app.enableShutdownHooks();

  logger.log('StructPaper background worker initialized and ready for jobs.');
}

bootstrap().catch((error) => {
  console.error('Fatal error starting StructPaper worker:', error);
  process.exit(1);
});
