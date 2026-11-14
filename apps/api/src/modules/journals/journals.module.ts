import { Module } from '@nestjs/common';
import { JournalService } from './application/journal.service';
import { JournalController } from './presentation/journal.controller';

@Module({
  controllers: [JournalController],
  providers: [JournalService],
  exports: [JournalService],
})
export class JournalsModule {}
