import { Module, OnModuleInit, OnModuleDestroy, Logger, Inject } from '@nestjs/common';
import PgBoss from 'pg-boss';
import { S3Client } from '@aws-sdk/client-s3';
import { createDbClient } from '@structpaper/db';
import { LatexCompileProcessor } from './jobs/latex-compile.processor';
import { OutboxDispatcherProcessor } from './jobs/outbox-dispatcher.processor';
import { LocalProcessRunner } from './runners/local-process.runner';
import { DockerSandboxRunner } from './runners/docker-sandbox.runner';

@Module({
  providers: [
    {
      provide: 'DB_CLIENT',
      useFactory: () => {
        const connectionString =
          process.env.DATABASE_URL ||
          'postgres://postgres:postgres@localhost:5432/structpaper';
        const { db } = createDbClient(connectionString);
        return db;
      },
    },
    {
      provide: 'PG_BOSS',
      useFactory: () => {
        const connectionString =
          process.env.DATABASE_URL ||
          'postgres://postgres:postgres@localhost:5432/structpaper';
        return new PgBoss({ connectionString });
      },
    },
    {
      provide: 'S3_CLIENT',
      useFactory: () => {
        const endpoint = process.env.S3_ENDPOINT || 'http://localhost:9000';
        const region = process.env.S3_REGION || 'us-east-1';
        const accessKeyId = process.env.S3_ACCESS_KEY || 'minioadmin';
        const secretAccessKey = process.env.S3_SECRET_KEY || 'minioadmin';

        return new S3Client({
          endpoint,
          region,
          credentials: {
            accessKeyId,
            secretAccessKey,
          },
          forcePathStyle: true,
        });
      },
    },
    {
      provide: 'S3_BUCKET',
      useValue: process.env.S3_BUCKET || 'structpaper-assets',
    },
    {
      provide: 'LATEX_RUNNER',
      useFactory: () => {
        const runnerType = process.env.LATEX_RUNNER_TYPE?.toLowerCase();
        if (runnerType === 'docker') {
          return new DockerSandboxRunner();
        }
        return new LocalProcessRunner();
      },
    },
    LatexCompileProcessor,
    OutboxDispatcherProcessor,
  ],
  exports: [
    'DB_CLIENT',
    'PG_BOSS',
    'S3_CLIENT',
    'LATEX_RUNNER',
    LatexCompileProcessor,
    OutboxDispatcherProcessor,
  ],
})
export class WorkerModule implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WorkerModule.name);
  private outboxInterval?: NodeJS.Timeout;

  constructor(
    @Inject('PG_BOSS') private readonly boss: PgBoss,
    @Inject(LatexCompileProcessor) private readonly compileProcessor: LatexCompileProcessor,
    @Inject(OutboxDispatcherProcessor) private readonly outboxProcessor: OutboxDispatcherProcessor,
  ) {}

  public async onModuleInit(): Promise<void> {
    this.logger.log('Initializing WorkerModule and pg-boss background supervisor...');
    try {
      await this.boss.start();
      this.logger.log('pg-boss started successfully.');

      await this.compileProcessor.register(this.boss);
      await this.outboxProcessor.register(this.boss);

      // Periodically trigger outbox dispatch every 5 seconds
      this.outboxInterval = setInterval(() => {
        this.outboxProcessor.processPendingEvents().catch((err: any) => {
          this.logger.error(`Error during periodic outbox poll: ${err.message}`);
        });
      }, 5000);

      this.logger.log('StructPaper background workers and polling intervals successfully registered.');
    } catch (err: any) {
      this.logger.warn(`Could not start pg-boss or register workers: ${err.message}`);
    }
  }

  public async onModuleDestroy(): Promise<void> {
    this.logger.log('Shutting down WorkerModule and stopping pg-boss...');
    if (this.outboxInterval) {
      clearInterval(this.outboxInterval);
    }
    try {
      await this.boss.stop({ graceful: true });
      this.logger.log('pg-boss stopped cleanly.');
    } catch (err: any) {
      this.logger.warn(`Error while stopping pg-boss: ${err.message}`);
    }
  }
}
