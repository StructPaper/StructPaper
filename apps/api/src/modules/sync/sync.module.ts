import { Module } from '@nestjs/common';
import { AccessModule } from '../access/access.module';
import { SseManagerService } from './domain/sse-manager.service';
import { FastifySseManagerService } from './infrastructure/sse-manager.service';
import { SyncService } from './application/sync.service';
import { SyncController } from './presentation/sync.controller';

@Module({
  imports: [AccessModule],
  controllers: [SyncController],
  providers: [
    FastifySseManagerService,
    {
      provide: SseManagerService,
      useExisting: FastifySseManagerService,
    },
    SyncService,
  ],
  exports: [SyncService, SseManagerService, FastifySseManagerService],
})
export class SyncModule {}
