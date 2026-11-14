// @vitest-environment happy-dom
import 'fake-indexeddb/auto';
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup, act } from '@testing-library/react';

// Mock next/navigation
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/papers',
}));

// Mock DynamicIslandToast
vi.mock('@/components/toast', () => ({
  toast: {
    success: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

// Mock framer-motion to avoid animation hanging in happy-dom
vi.mock('framer-motion', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('framer-motion');
  return {
    ...actual,
    AnimatePresence: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
    LayoutGroup: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
    motion: new Proxy(actual.motion as Record<string, unknown>, {
      get: (_target, prop: string) => {
        const MotionComp = React.forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement>>(
          ({ children, ...props }, ref) => {
            const Component = prop as unknown as React.ElementType;
            const strippedProps = { ...props } as Record<string, unknown>;
            delete strippedProps.initial;
            delete strippedProps.animate;
            delete strippedProps.exit;
            delete strippedProps.transition;
            delete strippedProps.whileHover;
            delete strippedProps.whileTap;
            delete strippedProps.layoutId;
            delete strippedProps.layout;
            return <Component ref={ref} {...strippedProps}>{children}</Component>;
          }
        );
        MotionComp.displayName = `motion.${prop}`;
        return MotionComp;
      },
    }),
  };
});

import { PaperHubView } from '@/features/papers';
import { defaultDatabase, IndexedDbManuscriptRepo } from '@structpaper/storage';
import { manuscriptApi, setAccessToken } from '@structpaper/api-client';
import { useAuthStore } from '@/lib/auth-store';

describe('Task 7: Unified Papers Hub & Background Auto-Sync Reconciler', () => {
  const repo = new IndexedDbManuscriptRepo(defaultDatabase);

  beforeEach(async () => {
    mockPush.mockClear();
    vi.restoreAllMocks();
    setAccessToken(null);
    useAuthStore.getState().clearAuth();
    await defaultDatabase.manuscripts.clear();
    await defaultDatabase.revisions.clear();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders a single unified papers hub without the fragmented 2-tab switcher', async () => {
    // Seed a paper into IndexedDB
    const doc = {
      id: 'a1111111-1111-4111-a111-111111111111',
      journalId: 'VNUHCM-STD',
      meta: {
        title: [{ t: 'text', v: 'Bài Báo Nghiên Cứu Mạng Nơ-ron' }],
        authors: [{ name: 'Nguyen Van A' }],
      },
      schemaVersion: 2,
    };
    await repo.save(doc as any, {
      id: 'a1111111-1111-4111-a111-111111111111',
      displayName: 'Bài Báo Nghiên Cứu Mạng Nơ-ron',
      workflowStatus: 'draft',
      tags: ['VNUHCM-STD'],
    });

    render(<PaperHubView />);

    // 1. Verify 2-tab switcher is completely gone
    expect(screen.queryByTestId('tab-source-local')).toBeNull();
    expect(screen.queryByTestId('tab-source-server')).toBeNull();
    expect(screen.queryByText('Bản thảo cục bộ (Offline)')).toBeNull();
    expect(screen.queryByText('Bản thảo máy chủ (Cloud API)')).toBeNull();

    // 2. Verify unified list renders the paper
    await waitFor(() => {
      expect(screen.getAllByText('Bài Báo Nghiên Cứu Mạng Nơ-ron').length).toBeGreaterThan(0);
    });

    // 3. Verify sticky toolbar and view controls are present
    expect(screen.getByTestId('paper-hub-sticky-toolbar')).toBeDefined();
    expect(screen.getByTestId('paper-search-input')).toBeDefined();
  });

  it('displays correct sync status badges for cloud synced vs local-only papers', async () => {
    // Synced paper (valid UUID)
    const syncedDoc = {
      id: 'b2222222-2222-4222-b222-222222222222',
      journalId: 'VNUHCM-STD',
      meta: {
        title: [{ t: 'text', v: 'Bài Báo Đã Đồng Bộ Cloud' }],
        authors: [{ name: 'Tran Van B' }],
      },
      schemaVersion: 2,
    };
    await repo.save(syncedDoc as any, {
      id: 'b2222222-2222-4222-b222-222222222222',
      displayName: 'Bài Báo Đã Đồng Bộ Cloud',
      workflowStatus: 'ready',
    });

    // Local paper (non-UUID id)
    const localDoc = {
      id: 'local_paper_offline_99',
      journalId: 'VNUHCM-HS',
      meta: {
        title: [{ t: 'text', v: 'Bản Thảo Offline Trên Máy' }],
        authors: [{ name: 'Le Van C' }],
      },
      schemaVersion: 2,
    };
    await repo.save(localDoc as any, {
      id: 'local_paper_offline_99',
      displayName: 'Bản Thảo Offline Trên Máy',
      workflowStatus: 'draft',
    });

    render(<PaperHubView />);

    await waitFor(() => {
      expect(screen.getAllByText('Bài Báo Đã Đồng Bộ Cloud').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Bản Thảo Offline Trên Máy').length).toBeGreaterThan(0);
    });

    // Verify Cloud Synced badge
    const syncedBadges = screen.getAllByTestId('sync-badge-b2222222-2222-4222-b222-222222222222');
    expect(syncedBadges.length).toBeGreaterThan(0);
    expect(syncedBadges[0].textContent).toContain('Đã đồng bộ');

    // Verify Local Only badge
    const localBadges = screen.getAllByTestId('sync-badge-local_paper_offline_99');
    expect(localBadges.length).toBeGreaterThan(0);
    expect(localBadges[0].textContent).toContain('Chỉ trên máy');
  });

  it('executes background auto-sync reconciliation for local drafts when user is authenticated', async () => {
    // 1. Seed local-only draft in IndexedDB
    const localDraft = {
      id: 'paper_local_draft_unreconciled',
      journalId: 'VNUHCM-STD',
      meta: {
        title: [{ t: 'text', v: 'Nghiên Cứu Sinh Học Phân Tử Offline' }],
        authors: [{ name: 'Hoang Van D' }],
      },
      schemaVersion: 2,
    };
    await repo.save(localDraft as any, {
      id: 'paper_local_draft_unreconciled',
      displayName: 'Nghiên Cứu Sinh Học Phân Tử Offline',
      workflowStatus: 'draft',
      tags: ['VNUHCM-STD'],
    });

    // 2. Authenticate the user
    const token = 'jwt-mock-sync-token';
    setAccessToken(token);
    useAuthStore.getState().setToken(token);
    useAuthStore.getState().setUser({ id: 'u-1', email: 'user@vnuhcm.edu.vn', displayName: 'Dr. Hoang' });

    // 3. Spy on manuscriptApi.list and manuscriptApi.create
    vi.spyOn(manuscriptApi, 'list').mockResolvedValue([]);

    const createdUuid = 'e5555555-5555-4555-e555-555555555555';
    const createSpy = vi.spyOn(manuscriptApi, 'create').mockResolvedValue({
      id: createdUuid,
      journalId: 'VNUHCM-STD',
      title: 'Nghiên Cứu Sinh Học Phân Tử Offline',
      status: 'DRAFT',
      createdBy: 'u-1',
      currentServerRev: 1,
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as any);

    // 4. Render unified hub
    render(<PaperHubView />);

    // 5. Wait for background reconciliation to call manuscriptApi.create
    await waitFor(() => {
      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Nghiên Cứu Sinh Học Phân Tử Offline',
          journalId: 'VNUHCM-STD',
        })
      );
    });

    // 6. Verify local record was updated with the new server UUID
    await waitFor(async () => {
      const oldRecord = await repo.getRecord('paper_local_draft_unreconciled');
      expect(oldRecord).toBeNull();

      const newRecord = await repo.getRecord(createdUuid);
      expect(newRecord).toBeDefined();
      expect(newRecord?.info.displayName).toBe('Nghiên Cứu Sinh Học Phân Tử Offline');
    });

    // 7. Verify UI updates to show synced badge for the newly assigned UUID
    await waitFor(() => {
      const newBadges = screen.getAllByTestId(`sync-badge-${createdUuid}`);
      expect(newBadges.length).toBeGreaterThan(0);
      expect(newBadges[0].textContent).toContain('Đã đồng bộ');
    });
  });

  it('merges remote server manuscripts into the unified list alongside local papers', async () => {
    // 1. Seed local paper
    const localPaper = {
      id: 'f6666666-6666-4666-f666-666666666666',
      journalId: 'VNUHCM-STD',
      meta: {
        title: [{ t: 'text', v: 'Bài Báo Cục Bộ Đã Lưu' }],
      },
      schemaVersion: 2,
    };
    await repo.save(localPaper as any, {
      id: 'f6666666-6666-4666-f666-666666666666',
      displayName: 'Bài Báo Cục Bộ Đã Lưu',
      workflowStatus: 'ready',
    });

    // 2. Authenticate user
    const token = 'jwt-remote-list-token';
    setAccessToken(token);
    useAuthStore.getState().setToken(token);

    // 3. Mock remote list returning a paper created from another device
    const remoteId = '99999999-9999-4999-9999-999999999999';
    vi.spyOn(manuscriptApi, 'list').mockResolvedValue([
      {
        id: remoteId,
        journalId: 'VNUHCM-SSH',
        title: 'Bài Báo Nghiên Cứu Xã Hội Từ Thiết Bị Khác',
        status: 'SUBMITTED',
        createdBy: 'u-other',
        currentServerRev: 2,
        version: 2,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as any,
    ]);

    render(<PaperHubView />);

    // Both local paper and remote paper must appear in the unified list!
    await waitFor(() => {
      expect(screen.getAllByText('Bài Báo Cục Bộ Đã Lưu').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Bài Báo Nghiên Cứu Xã Hội Từ Thiết Bị Khác').length).toBeGreaterThan(0);
    });

    // Remote paper should show cloud synced badge
    const remoteBadges = screen.getAllByTestId(`sync-badge-${remoteId}`);
    expect(remoteBadges.length).toBeGreaterThan(0);
    expect(remoteBadges[0].textContent).toContain('Đã đồng bộ');
  });
});
