import { describe, it, expect } from 'vitest';
import { HttpException } from '@nestjs/common';
import { CompileQueue } from '../../src/modules/platform/application/compile-queue';

/** A job that stays "running" until the test releases it. */
function gate() {
  let release!: () => void;
  const done = new Promise<void>((r) => (release = r));
  return { release, task: () => done };
}
const tick = () => new Promise((r) => setTimeout(r, 0));

describe('CompileQueue', () => {
  it('runs at most `concurrency` jobs at once and queues the rest', async () => {
    const q = new CompileQueue({ concurrency: 2 });
    const gates = [gate(), gate(), gate(), gate()];
    const order: number[] = [];
    const jobs = gates.map((g, i) => q.run('u1', async () => { order.push(i); await g.task(); return i; }));
    await tick();

    expect(order).toEqual([0, 1]);
    expect(q.status('u1')).toMatchObject({ running: 2, queued: 2, concurrency: 2, mine: { running: 2, queued: 2 } });

    gates[0].release();
    await tick();
    expect(order).toEqual([0, 1, 2]);

    gates.forEach((g) => g.release());
    expect(await Promise.all(jobs)).toEqual([0, 1, 2, 3]);
    expect(q.status('u1')).toMatchObject({ running: 0, queued: 0 });
  });

  it('serves users in turn: one person with many papers does not starve the others', async () => {
    const q = new CompileQueue({ concurrency: 1 });
    const started: string[] = [];
    const blocker = gate();
    const first = q.run('a', async () => { started.push('a0'); await blocker.task(); });
    const queued = [
      ...[1, 2, 3].map((i) => q.run('a', async () => { started.push(`a${i}`); })),
      q.run('b', async () => { started.push('b0'); }),
    ];
    await tick();
    blocker.release();
    await Promise.all([first, ...queued]);

    // b is served right after a's running job, before a's 2nd and 3rd waiting paper
    expect(started.slice(0, 3)).toEqual(['a0', 'a1', 'b0']);
    expect(started).toHaveLength(5);
  });

  it('refuses with 429 when one user has too many papers, or the whole queue is full', async () => {
    const q = new CompileQueue({ concurrency: 1, maxPerUser: 2, maxQueued: 4 });
    const gates = [gate(), gate(), gate(), gate()];
    q.run('a', gates[0].task);
    q.run('a', gates[1].task);
    expect(() => q.run('a', gates[2].task)).toThrow(HttpException);
    try {
      q.run('a', gates[2].task);
    } catch (e: any) {
      expect(e.getStatus()).toBe(429);
    }

    q.run('b', gates[2].task);
    q.run('c', gates[3].task);
    q.run('d', async () => undefined);
    expect(() => q.run('e', async () => undefined)).toThrow(/quá tải/);
    gates.forEach((g) => g.release());
  });

  it('keeps going when a job fails', async () => {
    const q = new CompileQueue({ concurrency: 1 });
    const failing = q.run('a', async () => { throw new Error('boom'); });
    const ok = q.run('a', async () => 'fine');

    await expect(failing).rejects.toThrow('boom');
    await expect(ok).resolves.toBe('fine');
    expect(q.status('a')).toMatchObject({ running: 0, queued: 0 });
  });

  it('reports only the asking user as "mine"', async () => {
    const q = new CompileQueue({ concurrency: 1 });
    const g = gate();
    q.run('a', g.task);
    q.run('b', async () => undefined);
    await tick();

    expect(q.status('a').mine).toEqual({ running: 1, queued: 0 });
    expect(q.status('b').mine).toEqual({ running: 0, queued: 1 });
    expect(q.status('nobody').mine).toEqual({ running: 0, queued: 0 });
    g.release();
  });
});
