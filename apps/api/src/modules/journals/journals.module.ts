import { Module } from '@nestjs/common';
import { AccessModule } from '../access/access.module';
import { JournalService } from './application/journal.service';
import { JournalAdminService } from './application/journal-admin.service';
import { ProfileService } from './application/profile.service';
import { ArticleTypeService } from './application/article-type.service';
import { ProfileBulkService } from './application/profile-bulk.service';
import { ProfileResolveService } from './application/profile-resolve.service';
import { JournalController } from './presentation/journal.controller';
import { JournalAdminController } from './presentation/journal-admin.controller';

@Module({
  imports: [AccessModule],
  controllers: [JournalController, JournalAdminController],
  providers: [JournalService, JournalAdminService, ArticleTypeService, ProfileService, ProfileResolveService, ProfileBulkService],
  exports: [JournalService, ProfileService, ProfileResolveService, ArticleTypeService],
})
export class JournalsModule {}
