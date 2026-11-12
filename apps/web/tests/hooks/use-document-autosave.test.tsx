// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { createEmptyPaper, type CompletePaper } from '@/types/paper';
import { useDocumentAutosave } from '@/hooks/useDocumentAutosave';

const paperOf = (id: string, title: string): CompletePaper => {
  const p = createEmptyPaper();
  p.id = id;
  p.metadata.title = title;
  return p;
};
const clone = (p: CompletePaper): CompletePaper => JSON.parse(JSON.stringify(p));

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('useDocumentAutosave when the loaded document changes', () => {
  it('does not save a document that was only opened (the editor re-clones it on load)', async () => {
    const saveLocal = vi.fn(async (_p: CompletePaper) => true);
    const blank = paperOf('blank', 'Bản thảo');
    const opened = paperOf('ees', 'Bài EES');
    const { rerender } = renderHook(
      ({ paper, id }) => useDocumentAutosave({ paper, documentId: id, saveLocal, remote: false, debounceMs: 100 }),
      { initialProps: { paper: blank, id: 'blank' } }
    );
    // 1) the context switches to the opened paper, the editor still shows the old content for one render
    rerender({ paper: blank, id: 'ees' });
    // 2) the editor then loads (a deep clone of) the opened paper
    rerender({ paper: clone(opened), id: 'ees' });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(saveLocal).not.toHaveBeenCalled();
  });

  it('never saves the previous document content under the new document', async () => {
    const saveLocal = vi.fn(async (_p: CompletePaper) => true);
    const old = paperOf('ees', 'Bài EES');
    const fresh = paperOf('new', 'Bản thảo bài báo');
    const { rerender, result } = renderHook(
      ({ paper, id }) => useDocumentAutosave({ paper, documentId: id, saveLocal, remote: false, debounceMs: 100 }),
      { initialProps: { paper: old, id: 'ees' } }
    );
    // the user edits the old paper, then creates a new one before the debounce fires
    rerender({ paper: { ...old, metadata: { ...old.metadata, title: 'Bài EES (sửa)' } }, id: 'ees' });
    rerender({ paper: old, id: 'new' });
    rerender({ paper: clone(fresh), id: 'new' });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    // the pending edit is still persisted, but only ever as the document it belongs to
    const saved = saveLocal.mock.calls.map((c) => c[0].id);
    expect(saved.every((id) => id === 'ees')).toBe(true);
    expect(result.current.state).not.toBe('error');
  });
});

describe('useDocumentAutosave with the auto-save switch off', () => {
  it('saves nothing on its own, but saves once the switch is turned on again', async () => {
    const saveLocal = vi.fn(async (_p: CompletePaper) => true);
    const base = paperOf('d', 'Bản thảo');
    const { rerender } = renderHook(
      ({ paper, enabled }) => useDocumentAutosave({ paper, documentId: 'd', saveLocal, remote: false, debounceMs: 100, enabled }),
      { initialProps: { paper: base, enabled: false } }
    );
    const edited = { ...base, metadata: { ...base.metadata, title: 'Đã sửa' } };
    rerender({ paper: edited, enabled: false });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(saveLocal).not.toHaveBeenCalled();
    rerender({ paper: edited, enabled: true });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(saveLocal).toHaveBeenCalledTimes(1);
    expect(saveLocal.mock.calls[0][0].metadata.title).toBe('Đã sửa');
  });

  it('marks dirty while auto-save is off and clears baseline after manual saveNow so re-enabling does not duplicate-save', async () => {
    const saveLocal = vi.fn(async (_p: CompletePaper) => true);
    const base = paperOf('d2', 'Bản thảo gốc');
    const { result, rerender } = renderHook(
      ({ paper, enabled }) => useDocumentAutosave({ paper, documentId: 'd2', saveLocal, remote: false, debounceMs: 100, enabled }),
      { initialProps: { paper: base, enabled: false } }
    );

    const edited = { ...base, metadata: { ...base.metadata, title: 'Sửa thủ công' } };
    rerender({ paper: edited, enabled: false });

    expect(result.current.state).toBe('dirty');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(saveLocal).not.toHaveBeenCalled();

    let outcome: string | undefined;
    await act(async () => {
      outcome = await result.current.saveNow(edited);
    });
    expect(outcome).toBe('saved-local');
    expect(saveLocal).toHaveBeenCalledTimes(1);
    expect(result.current.state).toBe('saved-local');

    // Turning AutoSave back ON with no new edits after manual save must NOT trigger another save
    rerender({ paper: edited, enabled: true });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(saveLocal).toHaveBeenCalledTimes(1);
  });
});
