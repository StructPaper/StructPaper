import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import * as os from 'node:os';

export interface CompileQueueOptions {
  /** Compilers running at the same time. Default: half the cores, between 1 and 4 (COMPILE_CONCURRENCY). */
  concurrency?: number;
  /** Jobs waiting in total before new ones are refused (COMPILE_MAX_QUEUE, default 60). */
  maxQueued?: number;
  /** Jobs one user may have waiting + running (COMPILE_MAX_PER_USER, default 12). */
  maxPerUser?: number;
}

export interface CompileQueueStatus {
  /** Compilers running now / allowed at once. */
  running: number;
  concurrency: number;
  /** Jobs waiting for a free compiler (everybody's). */
  queued: number;
  /** The asking user's own jobs. */
  mine: { running: number; queued: number };
}

interface Job {
  userId: string;
  start: () => void;
}

const envNumber = (name: string): number | undefined => {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : undefined;
};

/**
 * Keeps the compilers from being swamped: at most N run at once, the rest wait in a queue that is
 * served round-robin between users (one person importing twenty papers does not make everybody
 * else wait for all twenty). When the queue is too long a new job is refused with 429 instead of
 * piling up until the machine runs out of memory.
 */
@Injectable()
export class CompileQueue {
  readonly concurrency: number;
  private readonly maxQueued: number;
  private readonly maxPerUser: number;

  private running = 0;
  private readonly runningByUser = new Map<string, number>();
  /** Waiting jobs per user, and the order in which users take their turn. */
  private readonly waiting = new Map<string, Job[]>();
  private readonly turn: string[] = [];

  constructor(options: CompileQueueOptions = {}) {
    const cores = Math.max(1, os.cpus()?.length ?? 1);
    this.concurrency = options.concurrency ?? envNumber('COMPILE_CONCURRENCY') ?? Math.min(4, Math.max(1, Math.floor(cores / 2)));
    this.maxQueued = options.maxQueued ?? envNumber('COMPILE_MAX_QUEUE') ?? 60;
    this.maxPerUser = options.maxPerUser ?? envNumber('COMPILE_MAX_PER_USER') ?? 12;
  }

  /** Runs `task` when a compiler is free. Resolves with its result; rejects 429 if the queue is full. */
  run<T>(userId: string, task: () => Promise<T>): Promise<T> {
    const mine = (this.runningByUser.get(userId) ?? 0) + (this.waiting.get(userId)?.length ?? 0);
    if (mine >= this.maxPerUser) {
      throw new HttpException('Bạn đang có quá nhiều bài chờ biên dịch. Hãy đợi một số bài xong rồi gửi tiếp.', HttpStatus.TOO_MANY_REQUESTS);
    }
    if (this.queuedCount() >= this.maxQueued) {
      throw new HttpException('Hệ thống biên dịch đang quá tải. Vui lòng thử lại sau ít phút.', HttpStatus.TOO_MANY_REQUESTS);
    }

    return new Promise<T>((resolve, reject) => {
      const job: Job = {
        userId,
        start: () => {
          this.running++;
          this.runningByUser.set(userId, (this.runningByUser.get(userId) ?? 0) + 1);
          task()
            .then(resolve, reject)
            .finally(() => {
              this.running--;
              const left = (this.runningByUser.get(userId) ?? 1) - 1;
              if (left <= 0) this.runningByUser.delete(userId);
              else this.runningByUser.set(userId, left);
              this.drain();
            });
        },
      };
      const list = this.waiting.get(userId) ?? [];
      list.push(job);
      this.waiting.set(userId, list);
      if (!this.turn.includes(userId)) this.turn.push(userId);
      this.drain();
    });
  }

  status(userId: string): CompileQueueStatus {
    return {
      running: this.running,
      concurrency: this.concurrency,
      queued: this.queuedCount(),
      mine: {
        running: this.runningByUser.get(userId) ?? 0,
        queued: this.waiting.get(userId)?.length ?? 0,
      },
    };
  }

  private queuedCount(): number {
    let n = 0;
    for (const jobs of this.waiting.values()) n += jobs.length;
    return n;
  }

  /** Start waiting jobs while a compiler is free, taking users in turn. */
  private drain(): void {
    while (this.running < this.concurrency && this.turn.length > 0) {
      const userId = this.turn.shift()!;
      const jobs = this.waiting.get(userId);
      const job = jobs?.shift();
      if (!job) {
        this.waiting.delete(userId);
        continue;
      }
      if (jobs && jobs.length > 0) this.turn.push(userId); // still has jobs: back of the line
      else this.waiting.delete(userId);
      job.start();
    }
  }
}
