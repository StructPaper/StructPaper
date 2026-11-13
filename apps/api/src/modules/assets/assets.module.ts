import { Module } from '@nestjs/common';
import { AccessModule } from '../access/access.module';
import { StorageService } from './domain/storage.service';
import { S3StorageService } from './infrastructure/s3-storage.service';
import { AssetService } from './application/asset.service';
import { AssetController } from './presentation/asset.controller';

@Module({
  imports: [AccessModule],
  controllers: [AssetController],
  providers: [
    S3StorageService,
    {
      provide: StorageService,
      useExisting: S3StorageService,
    },
    AssetService,
  ],
  exports: [AssetService, StorageService, S3StorageService],
})
export class AssetsModule {}
