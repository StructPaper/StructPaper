import { Module } from '@nestjs/common';
import { AccessModule } from '../access/access.module';
import { ManuscriptService } from './application/manuscript.service';
import { ManuscriptController } from './presentation/manuscript.controller';

@Module({
  imports: [AccessModule],
  controllers: [ManuscriptController],
  providers: [ManuscriptService],
  exports: [ManuscriptService],
})
export class ManuscriptsModule {}
