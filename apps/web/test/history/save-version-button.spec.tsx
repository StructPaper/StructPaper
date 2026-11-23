// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const session = vi.hoisted(() => ({ documentSession: null as any }));
vi.mock('@/context/EditorSessionContext', () => ({ useEditorSession: () => session }));
vi.mock('@/features/papers/access', () => ({
  isServerPaperId: (id?: string | null) => !!id && id.length > 8,
  usePaperAccess: () => ({ access: { explain: () => ({ allowed: access.canEdit }) } }),
}));
const access = vi.hoisted(() => ({ canEdit: true }));
const api = vi.hoisted(() => ({ createManuscriptRevision: vi.fn() }));
vi.mock('@structpaper/api-client', async (importOriginal) => ({ ...(await importOriginal<typeof import('@structpaper/api-client')>()), ...api }));
vi.mock('@/components/toast', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() } }));

import { SaveVersionButton } from '@/components/titlebar/SaveVersionButton';
import { toast } from '@/components/toast';

const renderButton = () => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}><SaveVersionButton /></QueryClientProvider>);

beforeEach(() => {
  vi.clearAllMocks();
  access.canEdit = true;
  session.documentSession = { paperId: '11111111-2222-3333-4444-555555555555', onManualSave: vi.fn().mockResolvedValue(undefined) };
});
afterEach(cleanup);

describe('the "save a version" icon in the title bar of a paper', () => {
  it('is an icon without text', () => {
    renderButton();
    const btn = screen.getByTestId('titlebar-save-version');
    expect(btn.textContent).toBe('');
    expect(btn.getAttribute('aria-label')).toBe('Lưu phiên bản');
  });

  it('saves what is on screen first, then keeps it as a named version', async () => {
    api.createManuscriptRevision.mockResolvedValue({ id: 'r1' });
    renderButton();
    fireEvent.click(screen.getByTestId('titlebar-save-version'));
    fireEvent.change(await screen.findByTestId('version-name-input'), { target: { value: 'Bản gửi' } });
    await act(async () => {
      fireEvent.click(screen.getByTestId('version-name-submit'));
    });
    await waitFor(() => expect(api.createManuscriptRevision).toHaveBeenCalledWith('11111111-2222-3333-4444-555555555555', { name: 'Bản gửi', kind: 'named' }));
    expect(session.documentSession.onManualSave).toHaveBeenCalled();
    expect(session.documentSession.onManualSave.mock.invocationCallOrder[0]).toBeLessThan(api.createManuscriptRevision.mock.invocationCallOrder[0]);
    expect(toast.success).toHaveBeenCalledWith('Đã lưu phiên bản', expect.stringContaining('Bản gửi'));
  });

  it('says so when the version could not be kept', async () => {
    api.createManuscriptRevision.mockRejectedValue(new Error('Mất kết nối'));
    renderButton();
    fireEvent.click(screen.getByTestId('titlebar-save-version'));
    fireEvent.change(await screen.findByTestId('version-name-input'), { target: { value: 'Bản gửi' } });
    await act(async () => {
      fireEvent.click(screen.getByTestId('version-name-submit'));
    });
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Không lưu được phiên bản', 'Mất kết nối'));
  });

  it('is not there for somebody who may not edit, or for a paper only on this machine', () => {
    access.canEdit = false;
    renderButton();
    expect(screen.queryByTestId('titlebar-save-version')).toBeNull();
    cleanup();
    access.canEdit = true;
    session.documentSession = { paperId: 'paper_1' };
    renderButton();
    expect(screen.queryByTestId('titlebar-save-version')).toBeNull();
  });
});
