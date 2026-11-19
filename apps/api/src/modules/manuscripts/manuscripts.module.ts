import { Module } from '@nestjs/common';
import { AccessModule } from '../access/access.module';
import { AssetsModule } from '../assets/assets.module';
import { JournalsModule } from '../journals/journals.module';
import { ManuscriptService } from './application/manuscript.service';
import { ManuscriptSharingService } from './application/manuscript-sharing.service';
import { ManuscriptPreviewService } from './application/manuscript-preview.service';
import { ManuscriptDuplicatesService } from './application/manuscript-duplicates.service';
import { RevisionsModule } from './revisions.module';
import { TrashService } from './application/trash.service';
import { ManuscriptController } from './presentation/manuscript.controller';

@Module({
  imports: [AccessModule, AssetsModule, JournalsModule, RevisionsModule],
  controllers: [ManuscriptController],
  providers: [ManuscriptService, ManuscriptSharingService, ManuscriptPreviewService, ManuscriptDuplicatesService, TrashService],
  exports: [ManuscriptService, TrashService],
})
export class ManuscriptsModule {}
