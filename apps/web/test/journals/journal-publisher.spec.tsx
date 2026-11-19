// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, cleanup, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BASE_PROFILE, resolveProfile } from '@structpaper/journal-profiles';

const api = vi.hoisted(() => ({
  createJournal: vi.fn(),
  updateJournal: vi.fn(),
  createProfileDraft: vi.fn(),
  validateProfileDraft: vi.fn(),
  publishProfileDraft: vi.fn(),
}));
vi.mock('@structpaper/api-client', async (importOriginal) => ({ ...(await importOriginal<typeof import('@structpaper/api-client')>()), ...api }));

import { useJournalPublisher, ProfileValidationError } from '@/features/journals/hooks/useJournalPublisher';
import type { ManagedJournalProfile } from '@/lib/templates/journal-storage';

const base = BASE_PROFILE as unknown as Record<string, unknown>;
const managedOf = (key: string, patch: (p: any) => void = () => undefined): ManagedJournalProfile => {
  const profile = structuredClone(resolveProfile(key)) as any;
  patch(profile);
  return { id: key, status: 'published', profile };
};

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}>{children}</QueryClientProvider>
);

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
  api.createProfileDraft.mockResolvedValue({ version: 2 });
  api.validateProfileDraft.mockResolvedValue({ ok: true, issues: [] });
  api.publishProfileDraft.mockResolvedValue({ version: 2, state: 'published' });
  api.updateJournal.mockResolvedValue({ version: 5 });
  api.createJournal.mockResolvedValue({ version: 1 });
});
afterEach(cleanup);

const save = async (input: Parameters<ReturnType<typeof useJournalPublisher>['mutateAsync']>[0]) => {
  const { result } = renderHook(() => useJournalPublisher(), { wrapper });
  let outcome: any;
  let error: unknown;
  await act(async () => {
    try {
      outcome = await result.current.mutateAsync(input);
    } catch (e) {
      error = e;
    }
  });
  return { outcome, error };
};

describe('saving the journal editor', () => {
  it('does nothing when neither identity nor rules changed', async () => {
    const original = managedOf('hs');
    await save({ isNew: false, key: 'hs', original, edited: managedOf('hs'), base });
    Object.values(api).forEach((fn) => expect(fn).not.toHaveBeenCalled());
  });

  it('a new colour or name goes to the journal only, with If-Match, and makes no profile version', async () => {
    const original = managedOf('hs');
    const edited = managedOf('hs', (p) => { p.color = '#112233'; p.names.vi = 'Tên mới'; });
    await save({ isNew: false, key: 'hs', original, edited, base, serverVersion: 4 });
    expect(api.updateJournal).toHaveBeenCalledWith('hs', { name: 'Tên mới', color: '#112233' }, { headers: { 'If-Match': '"4"' } });
    expect(api.createProfileDraft).not.toHaveBeenCalled();
  });

  it('changed rules become a draft, are validated, then published, in that order, with a note', async () => {
    const original = managedOf('hs');
    const edited = managedOf('hs', (p) => { p.layout.columns = 3; });
    const { outcome } = await save({ isNew: false, key: 'hs', original, edited, base });
    expect(api.updateJournal).not.toHaveBeenCalled();
    const order = [api.createProfileDraft, api.validateProfileDraft, api.publishProfileDraft].map((fn) => fn.mock.invocationCallOrder[0]);
    expect(order).toEqual([...order].sort((a, b) => a - b));
    const [scope, key, data] = api.createProfileDraft.mock.calls[0];
    expect([scope, key]).toEqual(['journal', 'hs']);
    expect(data.changeNote).toBe('Sửa dàn trang');
    expect(data.config.layout.columns).toBe(3);
    expect(data.config).not.toHaveProperty('names'); // identity is not part of the rules
    expect(api.validateProfileDraft).toHaveBeenCalledWith('journal', 'hs', 2);
    expect(api.publishProfileDraft).toHaveBeenCalledWith('journal', 'hs', 2, {});
    expect(outcome.published.version).toBe(2);
  });

  it('a draft the server rejects is not published and says what is wrong', async () => {
    api.validateProfileDraft.mockResolvedValue({ ok: false, issues: [{ path: 'typography.fontSizes', message: 'Expected object' }] });
    const edited = managedOf('hs', (p) => { p.layout.columns = 3; });
    const { error } = await save({ isNew: false, key: 'hs', original: managedOf('hs'), edited, base });
    expect(error).toBeInstanceOf(ProfileValidationError);
    expect((error as ProfileValidationError).message).toContain('typography.fontSizes');
    expect(api.publishProfileDraft).not.toHaveBeenCalled();
  });

  it('a new journal is created first, then its rules published when they differ from the base', async () => {
    const edited = managedOf('std', (p) => { p.id = 'agr'; p.names = { vi: 'Nông nghiệp', en: 'Agriculture', short: 'VNUHCM-AGR' }; p.color = '#228B22'; p.layout.columns = 1; });
    const { outcome } = await save({ isNew: true, key: 'agr', edited, base });
    expect(api.createJournal).toHaveBeenCalledWith({
      key: 'agr', name: 'Nông nghiệp', nameEn: 'Agriculture', code: 'VNUHCM-AGR', color: '#228B22', status: 'published',
    });
    expect(api.createJournal.mock.invocationCallOrder[0]).toBeLessThan(api.createProfileDraft.mock.invocationCallOrder[0]);
    expect(outcome.published).toBeTruthy();
  });

  it('a new journal that keeps the base rules needs no profile version', async () => {
    const edited = managedOf('std', (p) => { p.id = 'agr'; p.names = { vi: 'Nông nghiệp', en: 'Agriculture', short: 'VNUHCM-AGR' }; });
    // the standard journal's own rules are the only difference from the base: compare against them
    const tierBase = structuredClone(resolveProfile('std')) as unknown as Record<string, unknown>;
    await save({ isNew: true, key: 'agr', edited, base: tierBase });
    expect(api.createJournal).toHaveBeenCalledTimes(1);
    expect(api.createProfileDraft).not.toHaveBeenCalled();
  });

  it('a draft status is sent as draft, and the editor\'s "validated" is just a draft', async () => {
    const original = managedOf('hs');
    const edited = { ...managedOf('hs'), status: 'validated' as const };
    await save({ isNew: false, key: 'hs', original, edited, base });
    expect(api.updateJournal).toHaveBeenCalledWith('hs', { status: 'draft' }, undefined);
  });

  it('a stale editor (412 from the server) surfaces the error and publishes nothing', async () => {
    api.updateJournal.mockRejectedValue(Object.assign(new Error('Tạp chí đã được người khác sửa'), { status: 412 }));
    const edited = managedOf('hs', (p) => { p.color = '#112233'; p.layout.columns = 3; });
    const { error } = await save({ isNew: false, key: 'hs', original: managedOf('hs'), edited, base, serverVersion: 1 });
    expect((error as Error).message).toContain('người khác sửa');
    expect(api.createProfileDraft).not.toHaveBeenCalled();
  });
});

describe('waits for the writes', () => {
  it('reports pending while saving and settles afterwards', async () => {
    let release: (v: unknown) => void = () => undefined;
    api.updateJournal.mockReturnValue(new Promise((r) => (release = r)));
    const { result } = renderHook(() => useJournalPublisher(), { wrapper });
    act(() => {
      result.current.mutate({ isNew: false, key: 'hs', original: managedOf('hs'), edited: managedOf('hs', (p) => { p.color = '#112233'; }), base });
    });
    await waitFor(() => expect(result.current.isPending).toBe(true));
    await act(async () => release({ version: 2 }));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});
