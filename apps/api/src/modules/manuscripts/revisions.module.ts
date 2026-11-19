import { Module } from '@nestjs/common';
import { RevisionService } from './application/revision.service';

/** The history of a paper's content. Its own module so both papers and journals can take revisions without a cycle. */
@Module({ providers: [RevisionService], exports: [RevisionService] })
export class RevisionsModule {}
