import { Injectable, Inject, Logger } from '@nestjs/common';
import * as crypto from 'node:crypto';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import {
  compileJobs,
  assets,
  manuscripts,
  manuscriptDocs,
  manuscriptRevisions,
  eq,
  type DbClient,
} from '@structpaper/db';
import { LatexExporter } from '@structpaper/exporters/latex';
import type { Manuscript } from '@structpaper/doc-model';
import type { LatexRunner } from '../runners/latex-runner.interface';

export interface CompileLatexJobData {
  jobId?: string;
  id?: string;
  compileJobId?: string;
  manuscriptId: string;
  revisionId?: string | null;
  serverRev?: number;
  engine?: string;
}

export interface CompileJobResult {
  success: boolean;
  jobId: string;
  pdfAssetId?: string;
  error?: string;
}

@Injectable()
export class LatexCompileProcessor {
  private readonly logger = new Logger(LatexCompileProcessor.name);

  constructor(
    @Inject('DB_CLIENT') private readonly db: DbClient,
    @Inject('LATEX_RUNNER') private readonly runner: LatexRunner,
    @Inject('S3_CLIENT') private readonly s3Client: S3Client,
    @Inject('S3_BUCKET') private readonly bucket: string,
  ) {}

  public async register(boss: any): Promise<void> {
    this.logger.log("Registering worker listener for queue 'compile.latex'...");
    await boss.work('compile.latex', async (jobs: any) => {
      const jobList = Array.isArray(jobs) ? jobs : [jobs];
      for (const job of jobList) {
        if (job?.data) {
          try {
            await this.processJob(job.data);
          } catch (err: any) {
            this.logger.error(`Error processing job ${job.id}: ${err.message}`, err.stack);
            throw err;
          }
        }
      }
    });
    this.logger.log("Worker listener for 'compile.latex' successfully registered.");
  }

  public async processJob(data: CompileLatexJobData): Promise<CompileJobResult> {
    const startTime = Date.now();
    const jobId = data.jobId || data.id || data.compileJobId;
    const manuscriptId = data.manuscriptId;
    const engine = data.engine || 'XELATEX';

    this.logger.log(
      `Processing compile.latex job: jobId=${jobId}, manuscriptId=${manuscriptId}, engine=${engine}`,
    );

    let targetJobId = jobId;

    // 1. Resolve or create target compile job
    if (targetJobId) {
      await this.db
        .update(compileJobs)
        .set({ status: 'PROCESSING' })
        .where(eq(compileJobs.id, targetJobId));
    } else {
      // Find latest queued compile job for this manuscript or insert one
      const existing = await this.db.query.compileJobs.findFirst({
        where: eq(compileJobs.manuscriptId, manuscriptId),
      });
      if (existing) {
        targetJobId = existing.id;
        await this.db
          .update(compileJobs)
          .set({ status: 'PROCESSING' })
          .where(eq(compileJobs.id, targetJobId));
      } else {
        targetJobId = crypto.randomUUID();
        await this.db.insert(compileJobs).values({
          id: targetJobId,
          manuscriptId,
          status: 'PROCESSING',
          engine,
          serverRev: data.serverRev ?? 0,
        });
      }
    }

    try {
      // 2. Fetch manuscript record
      let manuscriptRecord: any = null;
      if (this.db.query?.manuscripts?.findFirst) {
        manuscriptRecord = await this.db.query.manuscripts.findFirst({
          where: eq(manuscripts.id, manuscriptId),
        });
      } else {
        const rows = await this.db.select().from(manuscripts).where(eq(manuscripts.id, manuscriptId)).limit(1);
        manuscriptRecord = rows[0] || null;
      }

      if (!manuscriptRecord) {
        const durationMs = Date.now() - startTime;
        const errMsg = `Manuscript with ID '${manuscriptId}' not found.`;
        await this.db
          .update(compileJobs)
          .set({
            status: 'FAILED',
            logOutput: errMsg,
            durationMs,
          })
          .where(eq(compileJobs.id, targetJobId));

        return { success: false, jobId: targetJobId, error: errMsg };
      }

      // 3. Fetch doc tree or revision snapshot
      let docTree: any = null;
      if (data.revisionId) {
        let revRecord: any = null;
        if (this.db.query?.manuscriptRevisions?.findFirst) {
          revRecord = await this.db.query.manuscriptRevisions.findFirst({
            where: eq(manuscriptRevisions.id, data.revisionId),
          });
        }
        docTree = revRecord?.snapshot || null;
      }

      if (!docTree) {
        let docRecord: any = null;
        if (this.db.query?.manuscriptDocs?.findFirst) {
          docRecord = await this.db.query.manuscriptDocs.findFirst({
            where: eq(manuscriptDocs.manuscriptId, manuscriptId),
          });
        } else {
          const rows = await this.db.select().from(manuscriptDocs).where(eq(manuscriptDocs.manuscriptId, manuscriptId)).limit(1);
          docRecord = rows[0] || null;
        }
        docTree = docRecord?.docTree || null;
      }

      // 4. Construct valid Manuscript AST
      const manuscriptAst = this.normalizeToManuscriptAst(manuscriptRecord, docTree);

      // 5. Generate LaTeX bundle
      const exporter = new LatexExporter();
      const texSource = exporter.export(manuscriptAst);

      let clsSource = '';
      try {
        clsSource = LatexExporter.getTemplateCls();
      } catch (err: any) {
        this.logger.warn(`Could not load template structpaper-hs.cls: ${err.message}`);
      }

      const files: Record<string, string | Buffer> = {
        'manuscript.tex': texSource,
      };
      if (clsSource) {
        files['structpaper-hs.cls'] = clsSource;
      }

      // 6. Invoke runner sandbox
      this.logger.log(`Invoking LaTeX runner with engine: ${engine}`);
      const result = await this.runner.compile({
        mainFile: 'manuscript.tex',
        files,
        engine,
      });

      const durationMs = result.durationMs ?? (Date.now() - startTime);

      // 7. Handle compilation failure
      if (!result.success || !result.pdfBuffer) {
        this.logger.warn(`Compilation failed for job ${targetJobId} with exitCode ${result.exitCode}`);
        await this.db
          .update(compileJobs)
          .set({
            status: 'FAILED',
            logOutput: result.log || 'Compilation failed without output logs.',
            durationMs,
          })
          .where(eq(compileJobs.id, targetJobId));

        return {
          success: false,
          jobId: targetJobId,
          error: result.log,
        };
      }

      // 8. Upload PDF artifact to MinIO S3
      const assetId = crypto.randomUUID();
      const storageKey = `manuscripts/${manuscriptId}/compiles/${targetJobId}.pdf`;
      const checksum = crypto.createHash('sha256').update(result.pdfBuffer).digest('hex');

      this.logger.log(`Uploading PDF artifact (${result.pdfBuffer.length} bytes) to S3: ${storageKey}`);
      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: storageKey,
          Body: result.pdfBuffer,
          ContentType: 'application/pdf',
        }),
      );

      // 9. Insert asset record
      await this.db.insert(assets).values({
        id: assetId,
        manuscriptId,
        filename: `${manuscriptRecord.title || 'manuscript'}.pdf`,
        fileSize: result.pdfBuffer.length,
        mimeType: 'application/pdf',
        storageKey,
        checksum,
        createdBy: manuscriptRecord.createdBy || null,
      });

      // 10. Update compile job to COMPLETED
      await this.db
        .update(compileJobs)
        .set({
          status: 'COMPLETED',
          pdfAssetId: assetId,
          durationMs,
          logOutput: result.log,
        })
        .where(eq(compileJobs.id, targetJobId));

      this.logger.log(`Compile job ${targetJobId} successfully COMPLETED in ${durationMs}ms`);

      return {
        success: true,
        jobId: targetJobId,
        pdfAssetId: assetId,
      };
    } catch (err: any) {
      const durationMs = Date.now() - startTime;
      this.logger.error(`Exception during compile job ${targetJobId}: ${err.message}`, err.stack);
      try {
        await this.db
          .update(compileJobs)
          .set({
            status: 'FAILED',
            logOutput: `Worker Exception: ${err.message}\n${err.stack || ''}`,
            durationMs,
          })
          .where(eq(compileJobs.id, targetJobId));
      } catch (dbErr: any) {
        this.logger.error(`Failed to update compile_jobs to FAILED: ${dbErr.message}`);
      }

      return {
        success: false,
        jobId: targetJobId,
        error: err.message,
      };
    }
  }

  private normalizeToManuscriptAst(manuscriptRecord: any, docTree: any): Manuscript {
    const title = manuscriptRecord?.title || 'Untitled Manuscript';

    if (docTree && (docTree.meta || docTree.body)) {
      return {
        schemaVersion: 2,
        id: manuscriptRecord?.id || docTree.id || 'doc_unknown',
        lang: docTree.lang || 'vi',
        journalId: manuscriptRecord?.journalId || docTree.journalId || 'vnuhcm-hs',
        articleType: docTree.articleType || 'Bài báo nghiên cứu',
        meta: {
          title: docTree.meta?.title || [{ t: 'text', v: title }],
          authors: docTree.meta?.authors || [],
          affiliations: docTree.meta?.affiliations || [],
          abstract:
            docTree.meta?.abstract ||
            (manuscriptRecord?.abstract ? [[{ t: 'text', v: manuscriptRecord.abstract }]] : []),
          keywords: docTree.meta?.keywords || [],
          dates: docTree.meta?.dates || {},
          ...docTree.meta,
        },
        body: docTree.body || [],
        back: docTree.back || [],
        references: docTree.references || [],
        assets: docTree.assets || {},
        ...docTree,
      };
    }

    return {
      schemaVersion: 2,
      id: manuscriptRecord?.id || 'doc_unknown',
      lang: 'vi',
      journalId: manuscriptRecord?.journalId || 'vnuhcm-hs',
      articleType: 'Bài báo nghiên cứu',
      meta: {
        title: [{ t: 'text', v: title }],
        authors: [],
        affiliations: [],
        abstract: manuscriptRecord?.abstract ? [[{ t: 'text', v: manuscriptRecord.abstract }]] : [],
        keywords: [],
        dates: {},
      },
      body: (docTree && docTree.body) || [],
      back: [],
      references: [],
      assets: {},
    };
  }
}
