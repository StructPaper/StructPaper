// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { notifyManualSaveOutcome } from '@/lib/editor/save-feedback';
import { sileo } from '@/components/DynamicIslandToast';

describe('notifyManualSaveOutcome', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns true and emits success toast only for saved and saved-local', () => {
    const okSpy = vi.spyOn(sileo, 'success');
    expect(notifyManualSaveOutcome('saved')).toBe(true);
    expect(notifyManualSaveOutcome('saved-local')).toBe(true);
    expect(okSpy).toHaveBeenCalledTimes(2);
  });

  it('returns false and refuses success toast for error, conflict, or unsettled dirty/saving/idle', () => {
    const okSpy = vi.spyOn(sileo, 'success');
    const warnSpy = vi.spyOn(sileo, 'warning');
    const errSpy = vi.spyOn(sileo, 'error');

    expect(notifyManualSaveOutcome('error')).toBe(false);
    expect(errSpy).toHaveBeenCalledTimes(1);

    expect(notifyManualSaveOutcome('conflict')).toBe(false);
    expect(notifyManualSaveOutcome('dirty')).toBe(false);
    expect(notifyManualSaveOutcome('saving')).toBe(false);
    expect(notifyManualSaveOutcome('idle')).toBe(false);
    expect(warnSpy).toHaveBeenCalledTimes(4);
    expect(okSpy).not.toHaveBeenCalled();
  });
});
