// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

vi.mock('@/context/StorageContext', () => ({
  useStorage: () => ({ isLocalAvailable: false }),
}));

import { PaperCard } from '@/features/papers/components/PaperCard';
import { paperAccessOfRecord } from '@/features/papers/access';

const paperWith = (remoteData?: any) =>
  ({
    info: {
      id: '11111111-2222-3333-4444-555555555555',
      displayName: 'Bài thử',
      workflowStatus: 'draft',
      pinned: false,
      archived: false,
      tags: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    doc: {
      id: '11111111-2222-3333-4444-555555555555',
      journalId: 'VNUHCM-STD',
      meta: { title: [{ t: 'text', v: 'Bài thử' }], authors: [] },
      sections: [],
      schemaVersion: 2,
    },
    syncState: 'synced',
    remoteData,
  }) as any;

const openMenu = (paper: any, onShare?: () => void) => {
  render(
    <PaperCard
      paper={paper}
      isMenuOpen
      onToggleMenu={vi.fn()}
      onCloseMenu={vi.fn()}
      onOpenEditor={vi.fn()}
      onQuickEdit={vi.fn()}
      onTogglePin={vi.fn()}
      onDuplicate={vi.fn()}
      onExportBackup={vi.fn()}
      onDelete={vi.fn()}
      onShare={onShare}
    />,
  );
};

describe('what the paper menu offers', () => {
  afterEach(cleanup);

  it('a deletable server paper the user owns: share and delete are both there', () => {
    const onShare = vi.fn();
    openMenu(paperWith({ access: { canEdit: true, canShare: true, canDelete: true } }), onShare);

    fireEvent.click(screen.getByTestId(/share-paper-/));
    expect(onShare).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId(/delete-paper-/)).toBeDefined();
  });

  it('a paper that is already in review: no delete icon at all', () => {
    openMenu(paperWith({ access: { canEdit: true, canShare: true, canDelete: false } }), vi.fn());

    expect(screen.queryByTestId(/delete-paper-/)).toBeNull();
    expect(screen.queryByText('Xóa bài báo')).toBeNull();
  });

  it('a paper shared with me for editing: I can not share it or delete it', () => {
    openMenu(paperWith({ access: { canEdit: true, canShare: false, canDelete: false } }), vi.fn());

    expect(screen.queryByTestId(/share-paper-/)).toBeNull();
    expect(screen.queryByTestId(/delete-paper-/)).toBeNull();
  });

  it('a local-only paper is the user own: deletable, nothing to share with', () => {
    openMenu(paperWith(undefined), vi.fn());

    expect(screen.getByTestId(/delete-paper-/)).toBeDefined();
    expect(screen.queryByTestId(/share-paper-/)).toBeNull();
  });

  it('a server paper without access info is denied by default', () => {
    expect(paperAccessOfRecord(paperWith({}))).toMatchObject({ canShare: false, canDelete: false, canEdit: false });
  });
});
