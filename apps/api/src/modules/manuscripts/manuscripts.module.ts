import { Module } from '@nestjs/common';
import { AccessModule } from '../access/access.module';
import { AssetsModule } from '../assets/assets.module';
import { ManuscriptService } from './application/manuscript.service';
import { ManuscriptSharingService } from './application/manuscript-sharing.service';
import { ManuscriptPreviewService } from './application/manuscript-preview.service';
import { ManuscriptController } from './presentation/manuscript.controller';

@Module({
  imports: [AccessModule, AssetsModule],
  controllers: [ManuscriptController],
  providers: [ManuscriptService, ManuscriptSharingService, ManuscriptPreviewService],
  exports: [ManuscriptService],
})
export class ManuscriptsModule {}
