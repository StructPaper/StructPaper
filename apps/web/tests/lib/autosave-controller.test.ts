import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createEmptyPaper, type CompletePaper } from '@/types/paper';
import { AutosaveController, type SaveState } from '@/lib/documents/autosave-controller';
import { ApiError } from '@/lib/documents/document-api';

const mk = (title: string): CompletePaper => {
  const p = createEmptyPaper();
  p.id = 'd1';
  p.metadata.title = title;
  return p;
};

function setup(syncImpl?: { push: (...a: any[]) => Promise<any> } | null, local = async (_p: CompletePaper) => true) {
  const states: SaveState[] = [];
  const saveLocal = vi.fn(local);
  const ctl = new AutosaveController({
    debounceMs: 1000,
    saveLocal,
    sync: syncImpl === null ? null : ((syncImpl ?? { push: vi.fn(async (..._a: any[]) => ({ rev: 1 })) }) as any),
    onState: (s) => states.push(s),
  });
  return { ctl, saveLocal, states };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('AutosaveController', () => {
  it('debounces rapid edits into one save of the latest content', async () => {
    const sync = { push: vi.fn(async (..._a: any[]) => ({ rev: 1 })) };
    const { ctl, saveLocal } = setup(sync);
    ctl.notify(mk('a'));
    ctl.notify(mk('ab'));
    ctl.notify(mk('abc'));
    await vi.advanceTimersByTimeAsync(999);
    expect(saveLocal).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(2);
    expect(saveLocal).toHaveBeenCalledTimes(1);
    expect(saveLocal.mock.calls[0][0].metadata.title).toBe('abc');
    expect(sync.push).toHaveBeenCalledTimes(1);
    expect(ctl.getState()).toBe('saved');
  });

  it('keeps data safe locally when the server is unreachable, then recovers on next edit', async () => {
    const push = vi.fn<(...a: any[]) => Promise<any>>()
      .mockRejectedValueOnce(new ApiError(0, 'offline'))
      .mockResolvedValue({ rev: 2 });
    const { ctl } = setup({ push });
    ctl.notify(mk('x'));
    await vi.advanceTimersByTimeAsync(1100);
    expect(ctl.getState()).toBe('saved-local');
    ctl.notify(mk('xy'));
    await vi.advanceTimersByTimeAsync(1100);
    expect(ctl.getState()).toBe('saved');
  });

  it('works with no server configured (local only)', async () => {
    const { ctl, saveLocal } = setup(null);
    ctl.notify(mk('x'));
    await vi.advanceTimersByTimeAsync(1100);
    expect(saveLocal).toHaveBeenCalled();
    expect(ctl.getState()).toBe('saved-local');
  });

  it('reports error when the local save fails', async () => {
    const { ctl } = setup(null, async () => false);
    ctl.notify(mk('x'));
    await vi.advanceTimersByTimeAsync(1100);
    expect(ctl.getState()).toBe('error');
  });

  it('flags a conflict and lets the user keep their version', async () => {
    const push = vi.fn<(...a: any[]) => Promise<any>>()
      .mockRejectedValueOnce(new ApiError(412, 'conflict'))
      .mockResolvedValue({ rev: 5 });
    const { ctl } = setup({ push });
    ctl.notify(mk('mine'));
    await vi.advanceTimersByTimeAsync(1100);
    expect(ctl.getState()).toBe('conflict');
    await ctl.resolveKeepMine();
    expect(push).toHaveBeenLastCalledWith(expect.anything(), { force: true });
    expect(ctl.getState()).toBe('saved');
  });

  it('flush() saves immediately without waiting for the debounce', async () => {
    const { ctl, saveLocal } = setup();
    ctl.notify(mk('x'));
    await ctl.flush();
    expect(saveLocal).toHaveBeenCalledTimes(1);
  });

  it('explicit save requests a server snapshot; autosave does not', async () => {
    const push = vi.fn(async (..._a: any[]) => ({ rev: 1 }));
    const { ctl } = setup({ push });
    ctl.notify(mk('a'));
    await vi.advanceTimersByTimeAsync(1100);
    expect(push.mock.calls[0][1]).toEqual({ snapshot: false });
    await ctl.saveNow(mk('b'));
    expect(push.mock.calls[1][1]).toEqual({ snapshot: true });
  });

  it('edits made during a save trigger a follow-up save of the newest content', async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const push = vi.fn(async (..._a: any[]) => {
      await gate;
      return { rev: 1 };
    });
    const { ctl, saveLocal } = setup({ push });
    ctl.notify(mk('first'));
    await vi.advanceTimersByTimeAsync(1100); // save #1 now blocked on push
    ctl.notify(mk('second'));
    await vi.advanceTimersByTimeAsync(1100); // debounce fires, queued as rerun
    release();
    await vi.advanceTimersByTimeAsync(10);
    expect(saveLocal.mock.calls.map((c) => c[0].metadata.title)).toEqual(['first', 'second']);
  });

  it('does nothing after dispose', async () => {
    const { ctl, saveLocal } = setup();
    ctl.notify(mk('x'));
    ctl.dispose();
    await vi.advanceTimersByTimeAsync(2000);
    expect(saveLocal).not.toHaveBeenCalled();
  });

  it('can be re-armed after dispose (React StrictMode mount/unmount/mount)', async () => {
    const { ctl, saveLocal } = setup();
    ctl.dispose();
    ctl.activate();
    ctl.notify(mk('x'));
    await vi.advanceTimersByTimeAsync(1100);
    expect(saveLocal).toHaveBeenCalledTimes(1);
  });

  it('saveNow() returns the settled SaveState outcome (saved, saved-local, conflict, error)', async () => {
    const push = vi.fn<(...a: any[]) => Promise<any>>()
      .mockResolvedValueOnce({ rev: 1 })
      .mockRejectedValueOnce(new ApiError(0, 'offline'))
      .mockRejectedValueOnce(new ApiError(412, 'conflict'));

    const localFailOnce = vi.fn<(_p: CompletePaper) => Promise<boolean>>()
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);

    const { ctl } = setup({ push }, localFailOnce);

    expect(await ctl.saveNow(mk('v1'))).toBe('saved');
    expect(await ctl.saveNow(mk('v2'))).toBe('saved-local');
    expect(await ctl.saveNow(mk('v3'))).toBe('conflict');
    expect(await ctl.saveNow(mk('v4'))).toBe('error');
  });

  it('saveNow() waits through an in-flight rerun before returning the latest SaveState', async () => {
    let releaseFirst!: () => void;
    const firstGate = new Promise<void>((r) => (releaseFirst = r));
    const push = vi.fn<(...a: any[]) => Promise<any>>()
      .mockImplementationOnce(async () => {
        await firstGate;
        return { rev: 1 };
      })
      .mockRejectedValueOnce(new ApiError(412, 'conflict'));

    const { ctl } = setup({ push });
    ctl.notify(mk('first'));
    await vi.advanceTimersByTimeAsync(1100);

    const savePromise = ctl.saveNow(mk('second'));
    releaseFirst();
    await expect(savePromise).resolves.toBe('conflict');
    expect(push).toHaveBeenCalledTimes(2);
  });

  it('markDirty() emits dirty without scheduling an automatic save', async () => {
    const { ctl, saveLocal, states } = setup();
    ctl.markDirty(mk('manual-only'));
    expect(ctl.getState()).toBe('dirty');
    expect(states).toContain('dirty');
    await vi.advanceTimersByTimeAsync(2000);
    expect(saveLocal).not.toHaveBeenCalled();
  });
});
