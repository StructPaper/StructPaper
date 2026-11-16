// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import {
  normalizeWorkflowStatus,
  getWorkflowStatusConfig,
  WORKFLOW_STATUS_CONFIG,
} from '@/features/papers/components/types';
import { PaperCard } from '@/features/papers/components/PaperCard';
import { DockStatusMenu } from '@/features/editor/components/DockStatusMenu';

vi.mock('@/context/StorageContext', () => ({
  useStorage: () => ({ isLocalAvailable: false }),
}));

afterEach(() => {
  cleanup();
});

describe('Workflow status normalization & display', () => {
  it('normalizes backend uppercase and alias statuses to frontend WorkflowStatus keys', () => {
    expect(normalizeWorkflowStatus('DRAFT')).toBe('draft');
    expect(normalizeWorkflowStatus('IN_REVIEW')).toBe('in-review');
    expect(normalizeWorkflowStatus('SUBMITTED')).toBe('in-review');
    expect(normalizeWorkflowStatus('UNDER_REVIEW')).toBe('in-review');
    expect(normalizeWorkflowStatus('PROOFING')).toBe('proofing');
    expect(normalizeWorkflowStatus('READY')).toBe('ready');
    expect(normalizeWorkflowStatus('ACCEPTED')).toBe('ready');
    expect(normalizeWorkflowStatus('PUBLISHED')).toBe('published');
    expect(normalizeWorkflowStatus(undefined)).toBe('draft');
  });

  it('returns correct badge config even when raw backend uppercase status is passed', () => {
    expect(getWorkflowStatusConfig('IN_REVIEW').label).toBe(WORKFLOW_STATUS_CONFIG['in-review'].label);
    expect(getWorkflowStatusConfig('PROOFING').label).toBe(WORKFLOW_STATUS_CONFIG.proofing.label);
    expect(getWorkflowStatusConfig('READY').label).toBe(WORKFLOW_STATUS_CONFIG.ready.label);
    expect(getWorkflowStatusConfig('PUBLISHED').label).toBe(WORKFLOW_STATUS_CONFIG.published.label);
  });

  it('renders normalized status label on PaperCard even if remoteData has uppercase status', () => {
    const paper = {
      info: {
        id: '11111111-2222-3333-4444-555555555555',
        displayName: 'Sample Paper',
        workflowStatus: 'IN_REVIEW' as any,
        pinned: false,
        archived: false,
        tags: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      doc: {
        id: '11111111-2222-3333-4444-555555555555',
        journalId: 'VNUHCM-STD',
        meta: { title: [{ t: 'text', v: 'Sample Paper' }], authors: [] },
        sections: [],
        schemaVersion: 2,
      },
      syncState: 'synced',
    } as any;

    render(
      <PaperCard
        paper={paper}
        isMenuOpen={false}
        onToggleMenu={vi.fn()}
        onCloseMenu={vi.fn()}
        onOpenEditor={vi.fn()}
        onQuickEdit={vi.fn()}
        onTogglePin={vi.fn()}
        onDuplicate={vi.fn()}
        onExportBackup={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    expect(screen.getByText('Đang duyệt')).toBeDefined();
  });

  it('shows active indicator and highlights selected uppercase status in DockStatusMenu', () => {
    const onUpdateWorkflowStatus = vi.fn();
    const statusMenuRef = React.createRef<HTMLDivElement>();
    const currentStatusConfig = getWorkflowStatusConfig('PROOFING');
    render(
      <DockStatusMenu
        setIsDownloadOpen={vi.fn()}
        isStatusOpen={true}
        setIsStatusOpen={vi.fn()}
        statusMenuRef={statusMenuRef}
        springTransition={{ duration: 0 }}
        workflowStatus={'PROOFING' as any}
        currentStatusConfig={currentStatusConfig}
        currentStatusTheme={{ innerShadow: '', border: '' }}
        onUpdateWorkflowStatus={onUpdateWorkflowStatus}
        isTest={true}
      />
    );

    const proofingBtn = screen.getByTestId('status-option-proofing');
    expect(proofingBtn.className).toContain('bg-zinc-100 text-zinc-950 font-bold');

    fireEvent.click(screen.getByTestId('status-option-ready'));
    expect(onUpdateWorkflowStatus).toHaveBeenCalledWith('ready');
  });
});
