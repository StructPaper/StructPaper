// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useEditorAutoSave } from '@/features/editor';
import { createEmptyPaper, CompletePaper } from '@/types/paper';

function createMockPaper(title = 'Bản thảo ban đầu'): CompletePaper {
  const base = createEmptyPaper('VNUHCM-HS');
  return {
    ...base,
    id: 'paper-test-01',
    metadata: {
      ...base.metadata,
      title,
    },
  };
}

describe('useEditorAutoSave hook', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('does not trigger onSave when isDirty is false', () => {
    const mockSave = vi.fn().mockResolvedValue(true);
    const mockSetIsDirty = vi.fn();
    const paper = createMockPaper();

    const { result } = renderHook(() =>
      useEditorAutoSave({
        paperId: paper.id,
        formData: paper,
        isDirty: false,
        setIsDirty: mockSetIsDirty,
        onSave: mockSave,
        debounceMs: 1500,
      })
    );

    expect(result.current.autosaveStatus).toBe('idle');
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(mockSave).not.toHaveBeenCalled();
    expect(result.current.autosaveStatus).toBe('idle');
  });

  it('triggers onSave after debounce interval when isDirty is true', async () => {
    const mockSave = vi.fn().mockResolvedValue(true);
    const mockSetIsDirty = vi.fn();
    const paper = createMockPaper('Bản thảo đã sửa');

    const { result, rerender } = renderHook(
      ({ paperData, dirty }) =>
        useEditorAutoSave({
          paperId: paperData.id,
          formData: paperData,
          isDirty: dirty,
          setIsDirty: mockSetIsDirty,
          onSave: mockSave,
          debounceMs: 1000,
        }),
      {
        initialProps: { paperData: paper, dirty: true },
      }
    );

    // After 500ms, should not have fired yet
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(mockSave).not.toHaveBeenCalled();

    // After another 600ms (total 1100ms > 1000ms), should fire
    await act(async () => {
      vi.advanceTimersByTime(600);
    });

    expect(mockSave).toHaveBeenCalledTimes(1);
    expect(mockSave).toHaveBeenCalledWith(paper);
    expect(mockSetIsDirty).toHaveBeenCalledWith(false);
  });

  it('debounces multiple rapid edits and only saves the latest version once', async () => {
    const mockSave = vi.fn().mockResolvedValue(true);
    const mockSetIsDirty = vi.fn();

    let paper = createMockPaper('Thay đổi 1');

    const { rerender } = renderHook(
      ({ paperData, dirty }) =>
        useEditorAutoSave({
          paperId: paperData.id,
          formData: paperData,
          isDirty: dirty,
          setIsDirty: mockSetIsDirty,
          onSave: mockSave,
          debounceMs: 1000,
        }),
      {
        initialProps: { paperData: paper, dirty: true },
      }
    );

    // Edit 2 at 400ms
    act(() => {
      vi.advanceTimersByTime(400);
    });
    paper = createMockPaper('Thay đổi 2');
    rerender({ paperData: paper, dirty: true });

    // Edit 3 at 800ms
    act(() => {
      vi.advanceTimersByTime(400);
    });
    paper = createMockPaper('Thay đổi 3 - Chốt');
    rerender({ paperData: paper, dirty: true });

    // Advance 600ms (not yet 1000ms since Edit 3)
    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(mockSave).not.toHaveBeenCalled();

    // Advance 500ms (now > 1000ms since Edit 3)
    await act(async () => {
      vi.advanceTimersByTime(500);
    });

    expect(mockSave).toHaveBeenCalledTimes(1);
    expect(mockSave).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({ title: 'Thay đổi 3 - Chốt' }),
      })
    );
  });

  it('flush immediately saves without waiting for debounce', async () => {
    const mockSave = vi.fn().mockResolvedValue(true);
    const mockSetIsDirty = vi.fn();
    const paper = createMockPaper('Cần lưu khẩn cấp');

    const { result } = renderHook(() =>
      useEditorAutoSave({
        paperId: paper.id,
        formData: paper,
        isDirty: true,
        setIsDirty: mockSetIsDirty,
        onSave: mockSave,
        debounceMs: 5000,
      })
    );

    expect(mockSave).not.toHaveBeenCalled();

    let flushSuccess: boolean = false;
    await act(async () => {
      flushSuccess = await result.current.flush();
    });

    expect(flushSuccess).toBe(true);
    expect(mockSave).toHaveBeenCalledTimes(1);
    expect(mockSetIsDirty).toHaveBeenCalledWith(false);
  });

  it('registers window beforeunload when isDirty is true and unregisters when false', () => {
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

    const mockSave = vi.fn().mockResolvedValue(true);
    const mockSetIsDirty = vi.fn();
    const paper = createMockPaper();

    const { rerender } = renderHook(
      ({ dirty }) =>
        useEditorAutoSave({
          paperId: paper.id,
          formData: paper,
          isDirty: dirty,
          setIsDirty: mockSetIsDirty,
          onSave: mockSave,
        }),
      {
        initialProps: { dirty: false },
      }
    );

    expect(addEventListenerSpy).not.toHaveBeenCalledWith(
      'beforeunload',
      expect.any(Function)
    );

    // Switch to dirty
    rerender({ dirty: true });
    expect(addEventListenerSpy).toHaveBeenCalledWith(
      'beforeunload',
      expect.any(Function)
    );

    // Switch back to clean
    rerender({ dirty: false });
    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      'beforeunload',
      expect.any(Function)
    );

    addEventListenerSpy.mockRestore();
    removeEventListenerSpy.mockRestore();
  });

  it('does not auto-save when enabled is false, but manual flush still works', async () => {
    const mockSave = vi.fn().mockResolvedValue(true);
    const mockSetIsDirty = vi.fn();
    const paper = createMockPaper('Tắt tự động lưu');

    const { result } = renderHook(() =>
      useEditorAutoSave({
        paperId: paper.id,
        formData: paper,
        isDirty: true,
        setIsDirty: mockSetIsDirty,
        onSave: mockSave,
        debounceMs: 1000,
        enabled: false,
      })
    );

    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(mockSave).not.toHaveBeenCalled();

    await act(async () => {
      const ok = await result.current.flush();
      expect(ok).toBe(true);
    });
    expect(mockSave).toHaveBeenCalledTimes(1);
    expect(mockSetIsDirty).toHaveBeenCalledWith(false);
  });

  it('cancels pending autosave when toggled off mid-debounce and saves when toggled back on while dirty', async () => {
    const mockSave = vi.fn().mockResolvedValue(true);
    const mockSetIsDirty = vi.fn();
    const paper = createMockPaper('Chuyển đổi AutoSave');

    const { rerender } = renderHook(
      ({ autoSaveEnabled, dirty }) =>
        useEditorAutoSave({
          paperId: paper.id,
          formData: paper,
          isDirty: dirty,
          setIsDirty: mockSetIsDirty,
          onSave: mockSave,
          debounceMs: 1000,
          enabled: autoSaveEnabled,
        }),
      {
        initialProps: { autoSaveEnabled: true, dirty: true },
      }
    );

    // Mid-debounce turn OFF
    act(() => {
      vi.advanceTimersByTime(600);
    });
    rerender({ autoSaveEnabled: false, dirty: true });

    // Advance well past original 1000ms timer: must remain cancelled
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(mockSave).not.toHaveBeenCalled();

    // Flip back ON while still dirty: must schedule and execute save
    rerender({ autoSaveEnabled: true, dirty: true });
    await act(async () => {
      vi.advanceTimersByTime(1100);
    });
    expect(mockSave).toHaveBeenCalledTimes(1);
    expect(mockSetIsDirty).toHaveBeenCalledWith(false);
  });
});
