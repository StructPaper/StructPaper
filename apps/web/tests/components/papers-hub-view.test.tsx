// @vitest-environment happy-dom
import 'fake-indexeddb/auto';
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup, waitFor } from '@testing-library/react';

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
vi.mock('@/components/DynamicIslandToast', () => ({
  toast: {
    success: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

// Mock framer-motion to prevent unhandled animation aborts in happy-dom
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

import {
  RecentPapersRow,
  PaperFiltersBar,
  PaperCard,
  PaperTable,
  PaperTableShimmer,
  PaperQuickEditModal,
  PaperDeleteConfirmModal,
  type FilterWorkflowStatus,
  CreatePaperModal,
  DuplicatePaperWarningModal,
  PaperHubView,
} from '@/features/papers';
import { getUniquePaperTitle, countDuplicatePapers } from '@/lib/storage/paper-naming';
import { SAMPLE_VNUHCM_RECORDS } from '@/lib/authoring/sample-records-seeder';
import { defaultDatabase } from '@structpaper/storage';

describe('Task 4: Quản lý Bài báo UI & Top Recent Papers Row', () => {
  beforeEach(async () => {
    mockPush.mockClear();
    // Clean indexedDB database between tests
    await defaultDatabase.manuscripts.clear();
  });

  afterEach(() => {
    cleanup();
  });

  describe('RecentPapersRow Component', () => {
    it('renders recent papers with A4 cards, journal badges and workflow status', () => {
      const handleOpen = vi.fn();
      render(
        <RecentPapersRow
          papers={SAMPLE_VNUHCM_RECORDS}
          onOpenPaper={handleOpen}
          onCreateNew={vi.fn()}
        />
      );

      // Verify title & section heading
      expect(screen.getByText('Bài chỉnh sửa gần đây')).toBeDefined();
      expect(screen.getByText('Tạo bài báo mới')).toBeDefined();

      // Verify journal badges render
      expect(screen.getByText('VNUHCM-HS')).toBeDefined();
      expect(screen.getByText('VNUHCM-STD')).toBeDefined();

      // Verify first paper card can be clicked
      const firstCard = screen.getByTestId(`recent-paper-${SAMPLE_VNUHCM_RECORDS[0].info.id}`);
      expect(firstCard).toBeDefined();

      fireEvent.click(firstCard);
      expect(handleOpen).toHaveBeenCalledWith(SAMPLE_VNUHCM_RECORDS[0].info.id);
    });
  });

  describe('PaperFiltersBar Component', () => {
    it('handles filter status changes, search query and view mode toggle', () => {
      const handleSearch = vi.fn();
      const handleStatusChange = vi.fn();
      const handleJournalChange = vi.fn();
      const handleSortChange = vi.fn();
      const handleViewModeChange = vi.fn();

      render(
        <PaperFiltersBar
          searchQuery=""
          onSearchChange={handleSearch}
          statusFilter="all"
          onStatusFilterChange={handleStatusChange}
          journalFilter="all"
          onJournalFilterChange={handleJournalChange}
          sortBy="newest"
          onSortChange={handleSortChange}
          viewMode="grid"
          onViewModeChange={handleViewModeChange}
          countsByStatus={{ all: 5, draft: 1, 'in-review': 1, ready: 1, published: 2 }}
        />
      );

      // Status chip buttons
      const inReviewChip = screen.getByTestId('filter-chip-in-review');
      expect(inReviewChip).toBeDefined();
      fireEvent.click(inReviewChip);
      expect(handleStatusChange).toHaveBeenCalledWith('in-review');

      // Search input
      const searchInput = screen.getByTestId('paper-search-input');
      fireEvent.change(searchInput, { target: { value: 'IoT' } });
      expect(handleSearch).toHaveBeenCalledWith('IoT');

      // Journal select
      const journalSelect = screen.getByTestId('filter-journal-select');
      fireEvent.change(journalSelect, { target: { value: 'hs' } });
      expect(handleJournalChange).toHaveBeenCalledWith('hs');

      // View mode toggle
      const tableBtn = screen.getByTestId('view-mode-table');
      fireEvent.click(tableBtn);
      expect(handleViewModeChange).toHaveBeenCalledWith('table');
    });
  });

  describe('PaperQuickEditModal Component', () => {
    it('edits displayName, submissionId, status and tags, and calls onSave', async () => {
      const handleSave = vi.fn().mockResolvedValue(undefined);
      const handleClose = vi.fn();
      const targetPaper = SAMPLE_VNUHCM_RECORDS[0];

      render(
        <PaperQuickEditModal
          paper={targetPaper}
          isOpen={true}
          onClose={handleClose}
          onSave={handleSave}
        />
      );

      // Check fields are populated
      const nameInput = screen.getByTestId('quick-edit-displayname') as HTMLInputElement;
      expect(nameInput.value).toBe(targetPaper.info.displayName);

      // Change displayName
      fireEvent.change(nameInput, {
        target: { value: 'Tiêu đề cập nhật thử nghiệm 2026' },
      });

      // Change status to in-review
      const statusSelect = screen.getByTestId('quick-edit-status');
      fireEvent.change(statusSelect, { target: { value: 'in-review' } });

      // Add tag
      const tagInput = screen.getByTestId('quick-edit-tags-input');
      fireEvent.change(tagInput, { target: { value: 'KiemThu' } });
      fireEvent.keyDown(tagInput, { key: 'Enter', code: 'Enter' });

      // Submit form
      const submitBtn = screen.getByTestId('quick-edit-submit');
      await act(async () => {
        fireEvent.click(submitBtn);
      });

      expect(handleSave).toHaveBeenCalledWith(
        targetPaper.info.id,
        expect.objectContaining({
          displayName: 'Tiêu đề cập nhật thử nghiệm 2026',
          workflowStatus: 'in-review',
        })
      );
      expect(handleClose).toHaveBeenCalled();
    });
  });

  describe('PaperTableShimmer Component', () => {
    it('renders full table header and shimmering row skeletons', () => {
      render(<PaperTableShimmer rowCount={5} />);

      // Verify table shimmer container exists
      const tableShimmer = screen.getByTestId('papers-table-shimmer');
      expect(tableShimmer).toBeDefined();

      // Verify full headers are displayed
      expect(screen.getByText('Ghim')).toBeDefined();
      expect(screen.getByText('Tên bài báo & Mã bài')).toBeDefined();
      expect(screen.getByText('Tạp chí')).toBeDefined();
      expect(screen.getByText('Trạng thái')).toBeDefined();
      expect(screen.getByText('Tác giả')).toBeDefined();
      expect(screen.getByText('Cập nhật')).toBeDefined();
      expect(screen.getByText('Thao tác')).toBeDefined();

      // Verify 5 rows rendered
      const rows = tableShimmer.querySelectorAll('tbody tr');
      expect(rows.length).toBe(5);
    });
  });

  describe('PaperTable Component with Portal Floating Menu', () => {
    it('renders table rows, toggles 3-dots popup in portal without clipping, and executes actions', async () => {
      const handleToggleMenu = vi.fn();
      const handleCloseMenu = vi.fn();
      const handleOpenEditor = vi.fn();
      const handleQuickEdit = vi.fn();
      const handleTogglePin = vi.fn();
      const handleDuplicate = vi.fn();
      const handleExportBackup = vi.fn();
      const handleDelete = vi.fn();

      const { rerender } = render(
        <PaperTable
          papers={SAMPLE_VNUHCM_RECORDS}
          activeMenuId={null}
          onToggleMenu={handleToggleMenu}
          onCloseMenu={handleCloseMenu}
          onOpenEditor={handleOpenEditor}
          onQuickEdit={handleQuickEdit}
          onTogglePin={handleTogglePin}
          onDuplicate={handleDuplicate}
          onExportBackup={handleExportBackup}
          onDelete={handleDelete}
        />
      );

      const targetId = SAMPLE_VNUHCM_RECORDS[0].info.id;
      const triggerBtn = screen.getByTestId(`menu-trigger-${targetId}`);
      expect(triggerBtn).toBeDefined();

      // Click trigger button
      fireEvent.click(triggerBtn);
      expect(handleToggleMenu).toHaveBeenCalledWith(targetId, expect.anything());

      // Re-render with activeMenuId set to targetId (simulating parent state)
      rerender(
        <PaperTable
          papers={SAMPLE_VNUHCM_RECORDS}
          activeMenuId={targetId}
          onToggleMenu={handleToggleMenu}
          onCloseMenu={handleCloseMenu}
          onOpenEditor={handleOpenEditor}
          onQuickEdit={handleQuickEdit}
          onTogglePin={handleTogglePin}
          onDuplicate={handleDuplicate}
          onExportBackup={handleExportBackup}
          onDelete={handleDelete}
        />
      );

      // Verify portal popup renders in document.body
      const popup = screen.getByTestId(`paper-menu-${targetId}`);
      expect(popup).toBeDefined();
      expect(screen.getByText('Thao tác bài báo')).toBeDefined();
      expect(screen.getByText('Mở soạn thảo')).toBeDefined();
      expect(screen.getByText('Sửa thông tin nhanh')).toBeDefined();
      expect(screen.getByText('Bỏ ghim')).toBeDefined();
      expect(screen.getByText('Nhân bản bài báo')).toBeDefined();
      expect(screen.getByText('Xuất .structpaper')).toBeDefined();
      expect(screen.getByText('Xóa bài báo')).toBeDefined();

      // Click "Nhân bản bài báo"
      const duplicateBtn = screen.getByText('Nhân bản bài báo');
      fireEvent.click(duplicateBtn);
      expect(handleDuplicate).toHaveBeenCalledWith(SAMPLE_VNUHCM_RECORDS[0]);
      expect(handleCloseMenu).toHaveBeenCalled();
    });
  });

  describe('PaperDeleteConfirmModal Component', () => {
    it('renders 3D warning header, paper details, and triggers deletion on confirm', async () => {
      const targetPaper = SAMPLE_VNUHCM_RECORDS[0];
      const handleClose = vi.fn();
      const handleConfirm = vi.fn();

      render(
        <PaperDeleteConfirmModal
          paper={targetPaper}
          isOpen={true}
          onClose={handleClose}
          onConfirm={handleConfirm}
        />
      );

      // Verify modal and heading
      expect(screen.getByTestId('paper-delete-modal')).toBeDefined();
      expect(screen.getByText('Xóa bài báo này?')).toBeDefined();
      expect(screen.getByText(/bị xóa khỏi máy của bạn/i)).toBeDefined();

      // Click cancel
      const cancelBtn = screen.getByRole('button', { name: 'Hủy' });
      fireEvent.click(cancelBtn);
      expect(handleClose).toHaveBeenCalled();

      // Click confirm delete
      const confirmBtn = screen.getByTestId('confirm-delete-btn');
      await act(async () => {
        fireEvent.click(confirmBtn);
      });
      expect(handleConfirm).toHaveBeenCalledWith(targetPaper.info.id);
    });
  });

  describe('CreatePaperModal Component', () => {
    it('supports 2-step flow: step 1 dropzone / skip to blank -> step 2 compact templates -> editor', async () => {
      const handleClose = vi.fn();

      render(
        <CreatePaperModal
          isOpen={true}
          onClose={handleClose}
        />
      );

      expect(screen.getByTestId('create-paper-modal')).toBeDefined();
      expect(screen.getByTestId('create-paper-dropzone')).toBeDefined();

      // Click "Bỏ qua & Bắt đầu bằng bản thảo trắng" -> advances to Step 2
      const skipBtn = screen.getByTestId('skip-to-blank-btn');
      await act(async () => {
        fireEvent.click(skipBtn);
      });

      // Step 2: verify compact template cards
      expect(screen.getByText('7 Mẫu tạp chí ĐHQG-HCM')).toBeDefined();
      const stdTemplateCard = screen.getByTestId('compact-template-std');
      expect(stdTemplateCard).toBeDefined();

      // Select STD template -> updates selection
      await act(async () => {
        fireEvent.click(stdTemplateCard);
      });

      // Verify selected tick icon is rendered without text
      expect(screen.getByTestId('selected-tick-std')).toBeDefined();

      // Verify "Tiếp tục" button is present and click it -> redirects to editor
      const continueBtn = screen.getByTestId('continue-to-editor-btn');
      expect(continueBtn).toBeDefined();

      await act(async () => {
        fireEvent.click(continueBtn);
      });

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/editor');
      });
    });
  });

  describe('PaperHubView Full Integration', () => {
    it('renders clean EmptyPapersState when database is empty (no auto-seeding)', async () => {
      render(<PaperHubView />);

      await waitFor(() => {
        expect(screen.getByTestId('empty-papers-state')).toBeDefined();
      });

      expect(screen.getByText('Chưa có bài báo nào')).toBeDefined();
      expect(screen.getAllByText('Tạo từ mẫu').length).toBeGreaterThan(0);
    });

    it('renders top row, filters, pins, and quick edits when papers exist in IndexedDB', async () => {
      // Pre-seed records into IndexedDb for populated test
      for (const sample of SAMPLE_VNUHCM_RECORDS) {
        await defaultDatabase.manuscripts.put({
          id: sample.info.id,
          schemaVersion: 2,
          rev: 1,
          syncState: 'synced',
          createdAt: sample.info.createdAt,
          updatedAt: sample.info.updatedAt,
          journalId: sample.doc.journalId,
          title: sample.info.displayName,
          status: sample.info.workflowStatus,
          displayName: sample.info.displayName,
          workflowStatus: sample.info.workflowStatus,
          tags: sample.info.tags,
          pinned: sample.info.pinned,
          archived: sample.info.archived,
          doc: sample.doc as any,
        });
      }

      render(<PaperHubView />);

      // Wait for records to be loaded from IndexedDB
      await waitFor(() => {
        expect(screen.getByTestId('papers-grid')).toBeDefined();
      }, { timeout: 3000 });

      const stickyToolbar = screen.getByTestId('paper-hub-sticky-toolbar');
      expect(stickyToolbar.className).toContain('sticky');
      expect(stickyToolbar.className).toContain('top-[var(--titlebar-height,0px)]');

      // Verify ID630_HS card exists
      expect(screen.getByTestId('paper-card-vnuhcm-hs-id630')).toBeDefined();

      // Test Status Filter: switch to "Đang duyệt" (in-review)
      const inReviewFilter = screen.getByTestId('filter-chip-in-review');
      await act(async () => {
        fireEvent.click(inReviewFilter);
      });

      // After filtering by "in-review", STDJ IoT paper should be displayed
      expect(
        screen.getAllByText(/Phân tích hiệu năng giao thức định tuyến/).length
      ).toBeGreaterThan(0);

      // Switch back to "Tất cả"
      const allFilter = screen.getByTestId('filter-chip-all');
      await act(async () => {
        fireEvent.click(allFilter);
      });

      // Test Quick Edit modal open
      const hsCard = screen.getByTestId('paper-card-vnuhcm-hs-id630');
      const menuTrigger = screen.getByTestId('menu-trigger-vnuhcm-hs-id630');
      fireEvent.click(menuTrigger);

      const quickEditBtn = screen.getByTestId('quick-edit-vnuhcm-hs-id630');
      await act(async () => {
        fireEvent.click(quickEditBtn);
      });

      // Verify modal is open
      const modal = screen.getByTestId('quick-edit-modal');
      expect(modal).toBeDefined();

      // Change title inside modal and save
      const nameInput = screen.getByTestId('quick-edit-displayname');
      fireEvent.change(nameInput, {
        target: { value: 'Bài báo Y sinh AI Đã sửa nhanh' },
      });

      const submitBtn = screen.getByTestId('quick-edit-submit');
      await act(async () => {
        fireEvent.click(submitBtn);
      });

      // Verify updated title is reflected in the UI
      await waitFor(() => {
        expect(
          screen.getAllByText('Bài báo Y sinh AI Đã sửa nhanh').length
        ).toBeGreaterThan(0);
      });

      // Test Table View Mode
      const tableModeBtn = screen.getByTestId('view-mode-table');
      await act(async () => {
        fireEvent.click(tableModeBtn);
      });

      expect(screen.getByTestId('papers-table')).toBeDefined();
    });
  });

  describe('Duplicate Paper Warning Modal & Paper Naming Utilities', () => {
    it('getUniquePaperTitle generates incremented suffix when duplicates exist', () => {
      const existing = ['Bản thảo bài báo', 'Bản thảo bài báo (1)', 'Nghiên cứu AI'];
      expect(getUniquePaperTitle('Bản thảo bài báo', existing)).toBe('Bản thảo bài báo (2)');
      expect(getUniquePaperTitle('Nghiên cứu AI', existing)).toBe('Nghiên cứu AI (1)');
      expect(getUniquePaperTitle('Bài báo mới', existing)).toBe('Bài báo mới');
    });

    it('renders DuplicatePaperWarningModal with suggested incremented title and triggers actions', async () => {
      const handleClose = vi.fn();
      const handleConfirmUpload = vi.fn();

      render(
        <DuplicatePaperWarningModal
          isOpen={true}
          paperTitle="Nghiên cứu học máy trong y tế"
          suggestedTitle="Nghiên cứu học máy trong y tế (1)"
          matchCount={1}
          journalId="VNUHCM-HS"
          onClose={handleClose}
          onConfirmUpload={handleConfirmUpload}
        />
      );

      // Verify modal content
      expect(screen.getByTestId('duplicate-paper-warning-modal')).toBeDefined();
      expect(screen.getByText('Bài báo đã tồn tại?')).toBeDefined();
      expect(screen.getByText('Nghiên cứu học máy trong y tế')).toBeDefined();
      expect(screen.getByText('Nghiên cứu học máy trong y tế (1)')).toBeDefined();

      // Click "Vẫn tải lên"
      const confirmBtn = screen.getByTestId('confirm-upload-anyway-btn');
      fireEvent.click(confirmBtn);
      expect(handleConfirmUpload).toHaveBeenCalledTimes(1);

      // Click "Hủy bỏ"
      const cancelBtn = screen.getByText('Hủy bỏ');
      fireEvent.click(cancelBtn);
      expect(handleClose).toHaveBeenCalledTimes(1);
    });
  });
});
