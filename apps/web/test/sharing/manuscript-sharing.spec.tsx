// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor, within } from '@testing-library/react';

vi.mock('next/navigation', () => ({
  usePathname: () => '/papers/m-1',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}));

vi.mock('@/context/StorageContext', () => ({
  useStorage: () => ({ isLocalAvailable: false }),
}));

const addMutate = vi.fn().mockResolvedValue({});
const removeMutate = vi.fn().mockResolvedValue({});
const generalMutate = vi.fn().mockResolvedValue({});
const reload = vi.fn();

const OWNER = { manuscriptId: 'm-1', userId: 'u-owner', role: 'OWNER', email: 'owner@x.org', displayName: 'Chủ bài' };
const COAUTHOR = { manuscriptId: 'm-1', userId: 'u-2', role: 'COAUTHOR', email: 'co@x.org', displayName: 'Đồng tác giả' };

let sharingData: any = { generalAccess: 'RESTRICTED', members: [OWNER, COAUTHOR] };
let people: any[] = [];

vi.mock('@structpaper/api-client', async () => {
  const actual = await vi.importActual<any>('@structpaper/api-client');
  return {
    ...actual,
    useGetManuscriptMembers: () => ({ data: sharingData, isLoading: false, isError: false, refetch: reload }),
    useAddManuscriptMember: () => ({ mutateAsync: addMutate, isPending: false }),
    useRemoveManuscriptMember: () => ({ mutateAsync: removeMutate, isPending: false }),
    useSetManuscriptGeneralAccess: () => ({ mutateAsync: generalMutate, isPending: false }),
    useSearchManuscriptPeople: () => ({ data: people, isFetching: false }),
  };
});

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ShareManuscriptModal } from '@/features/sharing';

const renderModal = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ShareManuscriptModal isOpen onClose={vi.fn()} manuscriptId="m-1" manuscriptTitle="Bài thử nghiệm" />
    </QueryClientProvider>,
  );

describe('Share manuscript modal', () => {
  beforeEach(() => {
    sharingData = { generalAccess: 'RESTRICTED', members: [OWNER, COAUTHOR] };
    people = [];
    vi.clearAllMocks();
  });
  afterEach(cleanup);

  it('shows the owner (no controls) and the other people with their roles', () => {
    renderModal();

    const owner = screen.getByTestId('share-owner');
    expect(owner.textContent).toContain('Chủ bài');
    expect(owner.textContent).toContain('Chủ sở hữu');
    expect(within(owner).queryByRole('button')).toBeNull();

    const member = screen.getByTestId('share-member-u-2');
    expect(member.textContent).toContain('co@x.org');
  });

  it('adds a person found by email with the chosen role', async () => {
    people = [{ id: 'u-9', email: 'new@x.org', displayName: 'Người mới' }];
    renderModal();

    fireEvent.change(screen.getByLabelText(/Thêm người bằng email/), { target: { value: 'new@' } });
    fireEvent.click(await screen.findByTestId('share-candidate-u-9'));

    await waitFor(() => expect(addMutate).toHaveBeenCalledWith({ id: 'm-1', data: { userId: 'u-9', role: 'COAUTHOR' } }));
  });

  it('does not offer people who already have access', async () => {
    people = [{ id: 'u-2', email: 'co@x.org', displayName: 'Đồng tác giả' }];
    renderModal();

    fireEvent.change(screen.getByLabelText(/Thêm người bằng email/), { target: { value: 'co@' } });

    await screen.findByTestId('share-results');
    expect(screen.queryByTestId('share-candidate-u-2')).toBeNull();
  });

  it('removes a member', async () => {
    renderModal();

    fireEvent.click(screen.getByTestId('share-remove-u-2'));

    await waitFor(() => expect(removeMutate).toHaveBeenCalledWith({ id: 'm-1', userId: 'u-2' }));
  });

  it('shows the API message when something is refused', async () => {
    removeMutate.mockRejectedValueOnce({ response: { data: { detail: 'Chỉ chủ sở hữu mới được chia sẻ bản thảo này' } } });
    renderModal();

    fireEvent.click(screen.getByTestId('share-remove-u-2'));

    const alert = await screen.findByTestId('share-error');
    expect(alert.textContent).toContain('Chỉ chủ sở hữu');
  });

  it('does not render (or query anything) while closed', () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <ShareManuscriptModal isOpen={false} onClose={vi.fn()} manuscriptId="m-1" />
      </QueryClientProvider>,
    );
    expect(screen.queryByTestId('share-manuscript-modal')).toBeNull();
  });
});
