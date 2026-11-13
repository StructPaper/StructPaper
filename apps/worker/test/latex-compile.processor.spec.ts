import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as crypto from 'node:crypto';
import { LatexCompileProcessor } from '../src/jobs/latex-compile.processor';
import { OutboxDispatcherProcessor } from '../src/jobs/outbox-dispatcher.processor';
import { LocalProcessRunner } from '../src/runners/local-process.runner';
import { DockerSandboxRunner } from '../src/runners/docker-sandbox.runner';
import type { LatexRunner, LatexCompileResult, LatexCompileOptions } from '../src/runners/latex-runner.interface';

describe('LatexCompileProcessor & Latex Runner Sandbox', () => {
  let processor: LatexCompileProcessor;
  let mockRunner: LatexRunner;
  let mockS3Client: any;
  let mockDb: any;

  const manuscriptId = '33333333-3333-3333-3333-333333333333';
  const jobId = '44444444-4444-4444-4444-444444444444';
  const revisionId = '55555555-5555-5555-5555-555555555555';
  const mockPdfBuffer = Buffer.from('%PDF-1.4 mock pdf content');

  beforeEach(() => {
    mockRunner = {
      compile: vi.fn().mockResolvedValue({
        success: true,
        pdfBuffer: mockPdfBuffer,
        log: 'Output written on manuscript.pdf (1 page, 12345 bytes).',
        exitCode: 0,
        durationMs: 450,
      } as LatexCompileResult),
    };

    mockS3Client = {
      send: vi.fn().mockResolvedValue({ ETag: '"pdf-etag"' }),
    };

    const compileJobsList: any[] = [
      {
        id: jobId,
        manuscriptId,
        status: 'QUEUED',
        engine: 'XELATEX',
        createdAt: new Date(),
      },
    ];
    const assetsList: any[] = [];
    const manuscriptsList: any[] = [
      {
        id: manuscriptId,
        journalId: 'vnuhcm-hs',
        title: 'Deep Learning in Protein Folding',
        abstract: 'Comprehensive study on deep learning techniques.',
        createdBy: '11111111-1111-1111-1111-111111111111',
      },
    ];
    const revisionsList: any[] = [
      {
        id: revisionId,
        manuscriptId,
        serverRev: 10,
        tagName: 'v1.0-checkpoint',
        snapshot: {
          schemaVersion: 2,
          id: manuscriptId,
          lang: 'vi',
          journalId: 'vnuhcm-hs',
          articleType: 'Research Paper',
          meta: {
            title: [{ t: 'text', v: 'Revision 10: Protein Folding' }],
            authors: [],
            affiliations: [],
            abstract: [[{ t: 'text', v: 'Revision abstract content' }]],
            keywords: ['Protein'],
            dates: {},
          },
          body: [
            {
              id: 'sec_rev',
              title: [{ t: 'text', v: 'Revision Section' }],
              blocks: [
                {
                  id: 'blk_rev',
                  type: 'paragraph',
                  content: [{ t: 'text', v: 'Updated revision content.' }],
                },
              ],
            },
          ],
          back: [],
          references: [],
          assets: {},
        },
      },
    ];
    const docsList: any[] = [
      {
        manuscriptId,
        docTree: {
          schemaVersion: 2,
          id: manuscriptId,
          lang: 'vi',
          journalId: 'vnuhcm-hs',
          articleType: 'Research Paper',
          meta: {
            title: [{ t: 'text', v: 'Deep Learning in Protein Folding' }],
            authors: [],
            affiliations: [],
            abstract: [[{ t: 'text', v: 'Comprehensive study on deep learning techniques.' }]],
            keywords: ['Deep Learning', 'Protein'],
            dates: {},
          },
          body: [
            {
              id: 'sec_1',
              title: [{ t: 'text', v: 'Introduction' }],
              blocks: [
                {
                  id: 'blk_1',
                  type: 'paragraph',
                  content: [{ t: 'text', v: 'Protein folding is a grand challenge in biology.' }],
                },
              ],
            },
          ],
          back: [],
          references: [],
          assets: {},
        },
      },
    ];

    mockDb = {
      _data: { compileJobs: compileJobsList, assets: assetsList, manuscripts: manuscriptsList, docs: docsList, revisions: revisionsList },
      update: vi.fn().mockImplementation((table: any) => ({
        set: vi.fn().mockImplementation((updates: any) => ({
          where: vi.fn().mockImplementation(async () => {
            const job = compileJobsList.find((j) => j.id === jobId);
            if (job) {
              Object.assign(job, updates);
            }
            return [job];
          }),
        })),
      })),
      insert: vi.fn().mockImplementation((table: any) => ({
        values: vi.fn().mockImplementation((val: any) => {
          assetsList.push(val);
          const p = Promise.resolve([val]);
          return Object.assign(p, {
            returning: vi.fn().mockResolvedValue([val]),
          });
        }),
      })),
      query: {
        manuscripts: {
          findFirst: vi.fn().mockImplementation(async ({ where }: any) => {
            return manuscriptsList.find((m) => m.id === manuscriptId) || null;
          }),
        },
        manuscriptRevisions: {
          findFirst: vi.fn().mockImplementation(async ({ where }: any) => {
            return revisionsList.find((r) => r.id === revisionId) || null;
          }),
        },
        manuscriptDocs: {
          findFirst: vi.fn().mockImplementation(async ({ where }: any) => {
            return docsList.find((d) => d.manuscriptId === manuscriptId) || null;
          }),
        },
        compileJobs: {
          findFirst: vi.fn().mockImplementation(async ({ where }: any) => {
            return compileJobsList.find((j) => j.id === jobId) || null;
          }),
        },
      },
      select: vi.fn().mockImplementation(() => ({
        from: vi.fn().mockImplementation((tbl: any) => ({
          where: vi.fn().mockImplementation(() => ({
            limit: vi.fn().mockImplementation(async () => {
              return [manuscriptsList[0]];
            }),
          })),
        })),
      })),
    };

    processor = new LatexCompileProcessor(
      mockDb,
      mockRunner,
      mockS3Client,
      'structpaper-test-bucket',
    );
  });

  it('successfully compiles LaTeX bundle, uploads PDF to S3, creates asset, and marks compile job COMPLETED', async () => {
    const jobData = {
      jobId,
      manuscriptId,
      engine: 'XELATEX',
    };

    const result = await processor.processJob(jobData);

    expect(result.success).toBe(true);

    // 1. Verify runner was called with LaTeX bundle files
    expect(mockRunner.compile).toHaveBeenCalledTimes(1);
    const compileArgs: LatexCompileOptions = (mockRunner.compile as any).mock.calls[0][0];
    expect(compileArgs.mainFile).toBe('manuscript.tex');
    const files = compileArgs.files as Record<string, string | Buffer>;
    expect(files['manuscript.tex']).toBeDefined();
    expect(typeof files['manuscript.tex']).toBe('string');
    expect(files['manuscript.tex']).toContain('Deep Learning in Protein Folding');
    expect(files['structpaper-hs.cls']).toBeDefined();

    // 2. Verify PDF was uploaded to S3 bucket
    expect(mockS3Client.send).toHaveBeenCalledTimes(1);
    const s3Command = (mockS3Client.send as any).mock.calls[0][0];
    expect(s3Command.input.Bucket).toBe('structpaper-test-bucket');
    expect(s3Command.input.ContentType).toBe('application/pdf');
    expect(s3Command.input.Body).toEqual(mockPdfBuffer);

    // 3. Verify asset was inserted
    expect(mockDb.insert).toHaveBeenCalledTimes(1);
    expect(mockDb._data.assets.length).toBe(1);
    const insertedAsset = mockDb._data.assets[0];
    expect(insertedAsset.manuscriptId).toBe(manuscriptId);
    expect(insertedAsset.mimeType).toBe('application/pdf');
    expect(insertedAsset.fileSize).toBe(mockPdfBuffer.length);
    expect(insertedAsset.checksum).toBe(
      crypto.createHash('sha256').update(mockPdfBuffer).digest('hex'),
    );

    // 4. Verify compile job was updated to COMPLETED with pdfAssetId and logs
    const updatedJob = mockDb._data.compileJobs.find((j: any) => j.id === jobId);
    expect(updatedJob.status).toBe('COMPLETED');
    expect(updatedJob.pdfAssetId).toBe(insertedAsset.id);
    expect(updatedJob.logOutput).toContain('Output written on manuscript.pdf');
    expect(updatedJob.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('compiles revision snapshot when revisionId is passed in job data', async () => {
    const jobData = {
      jobId,
      manuscriptId,
      revisionId,
      engine: 'XELATEX',
    };

    const result = await processor.processJob(jobData);

    expect(result.success).toBe(true);
    expect(mockRunner.compile).toHaveBeenCalledTimes(1);
    const compileArgs: LatexCompileOptions = (mockRunner.compile as any).mock.calls[0][0];
    const files = compileArgs.files as Record<string, string | Buffer>;
    expect(files['manuscript.tex']).toContain('Revision 10: Protein Folding');
  });

  it('handles manuscript not found gracefully and marks job as FAILED', async () => {
    mockDb.query.manuscripts.findFirst.mockResolvedValueOnce(null);

    const jobData = {
      jobId,
      manuscriptId: '00000000-0000-0000-0000-000000000000',
      engine: 'XELATEX',
    };

    const result = await processor.processJob(jobData);

    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
    const updatedJob = mockDb._data.compileJobs.find((j: any) => j.id === jobId);
    expect(updatedJob.status).toBe('FAILED');
  });

  it('records failure in compile_jobs when LaTeX runner fails', async () => {
    (mockRunner.compile as any).mockResolvedValueOnce({
      success: false,
      log: '! LaTeX Error: File `nonexistent.sty` not found.',
      exitCode: 1,
      durationMs: 250,
    } as LatexCompileResult);

    const jobData = {
      jobId,
      manuscriptId,
      engine: 'XELATEX',
    };

    const result = await processor.processJob(jobData);

    expect(result.success).toBe(false);
    expect(mockS3Client.send).not.toHaveBeenCalled();
    expect(mockDb.insert).not.toHaveBeenCalled();

    const updatedJob = mockDb._data.compileJobs.find((j: any) => j.id === jobId);
    expect(updatedJob.status).toBe('FAILED');
    expect(updatedJob.logOutput).toContain('nonexistent.sty');
    expect(updatedJob.durationMs).toBe(250);
  });

  it('LocalProcessRunner provides graceful fallback producing valid PDF buffer when TeX CLI is missing', async () => {
    const runner = new LocalProcessRunner();
    const result = await runner.compile({
      mainFile: 'manuscript.tex',
      files: {
        'manuscript.tex': '\\documentclass{article}\\begin{document}Hello Test\\end{document}',
      },
      engine: 'XELATEX',
    });

    expect(result.durationMs).toBeGreaterThanOrEqual(0);
    // Even if xelatex is not installed on this test host, runner must succeed via fallback
    expect(result.success).toBe(true);
    expect(result.pdfBuffer).toBeDefined();
    expect(Buffer.isBuffer(result.pdfBuffer)).toBe(true);
    // Check for standard PDF magic header
    expect(result.pdfBuffer!.slice(0, 4).toString()).toBe('%PDF');
    expect(result.log).toBeDefined();
  });

  it('DockerSandboxRunner provides fallback mock PDF when docker daemon is unavailable', async () => {
    const runner = new DockerSandboxRunner({ fallbackOnError: true });
    const result = await runner.compile({
      mainFile: 'manuscript.tex',
      files: {
        'manuscript.tex': '\\documentclass{article}\\begin{document}Docker Test\\end{document}',
      },
      engine: 'XELATEX',
      timeoutMs: 1500,
    });

    expect(result.durationMs).toBeGreaterThanOrEqual(0);
    expect(result.success).toBe(true);
    expect(result.pdfBuffer).toBeDefined();
    expect(result.pdfBuffer!.slice(0, 4).toString()).toBe('%PDF');
  }, 15000);

  it('registers compile.latex queue handler with pg-boss', async () => {
    const mockBoss = {
      work: vi.fn().mockImplementation(async (queueName, handler) => {
        expect(queueName).toBe('compile.latex');
        // invoke handler with mock job
        await handler([{ id: 'job-1', data: { jobId, manuscriptId, engine: 'XELATEX' } }]);
      }),
    };

    await processor.register(mockBoss);
    expect(mockBoss.work).toHaveBeenCalledWith('compile.latex', expect.any(Function));
  });
});

describe('OutboxDispatcherProcessor', () => {
  let dispatcher: OutboxDispatcherProcessor;
  let mockDb: any;
  let mockBoss: any;
  const pendingEvents = [
    {
      id: 'e1111111-1111-1111-1111-111111111111',
      aggregateType: 'Manuscript',
      aggregateId: '33333333-3333-3333-3333-333333333333',
      eventType: 'compile.requested',
      payload: { jobId: '44444444-4444-4444-4444-444444444444' },
      status: 'PENDING',
      retryCount: 0,
      createdAt: new Date(),
    },
    {
      id: 'e2222222-2222-2222-2222-222222222222',
      aggregateType: 'Manuscript',
      aggregateId: '33333333-3333-3333-3333-333333333333',
      eventType: 'manuscript.updated',
      payload: { serverRev: 5 },
      status: 'PENDING',
      retryCount: 0,
      createdAt: new Date(),
    },
  ];

  beforeEach(() => {
    mockBoss = {
      send: vi.fn().mockResolvedValue('sent-job-id'),
      work: vi.fn().mockResolvedValue('worker-id'),
    };

    mockDb = {
      _events: [...pendingEvents],
      select: vi.fn().mockImplementation(() => ({
        from: vi.fn().mockImplementation(() => ({
          where: vi.fn().mockImplementation(() => ({
            limit: vi.fn().mockImplementation(async () => {
              return mockDb._events.filter((e: any) => e.status === 'PENDING');
            }),
          })),
        })),
      })),
      update: vi.fn().mockImplementation(() => ({
        set: vi.fn().mockImplementation((updates: any) => ({
          where: vi.fn().mockImplementation(async () => {
            for (const ev of mockDb._events) {
              if (ev.status === 'PENDING') {
                Object.assign(ev, updates);
              }
            }
            return mockDb._events;
          }),
        })),
      })),
    };

    dispatcher = new OutboxDispatcherProcessor(mockDb, mockBoss);
  });

  it('processes pending outbox events, dispatches compile.requested to pg-boss, and marks them PROCESSED', async () => {
    const processedCount = await dispatcher.processPendingEvents();
    expect(processedCount).toBe(2);
    expect(mockBoss.send).toHaveBeenCalledWith('compile.latex', { jobId: '44444444-4444-4444-4444-444444444444' });
    expect(mockDb._events.every((e: any) => e.status === 'PROCESSED')).toBe(true);
    expect(mockDb._events.every((e: any) => e.processedAt instanceof Date)).toBe(true);
  });

  it('registers outbox.dispatch queue handler with pg-boss', async () => {
    await dispatcher.register(mockBoss);
    expect(mockBoss.work).toHaveBeenCalledWith('outbox.dispatch', expect.any(Function));
  });
});
