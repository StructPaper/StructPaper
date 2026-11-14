// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor, act } from '@testing-library/react';

// Mock next/navigation
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/templates',
  useParams: () => ({ id: 'hs' }),
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

// Suppress unhandled rejection on happy-dom animation cancel on unmount
if (typeof Element !== 'undefined' && Element.prototype.animate) {
  const origAnimate = Element.prototype.animate;
  Element.prototype.animate = function (...args: Parameters<typeof origAnimate>) {
    const anim = origAnimate.apply(this, args);
    if (anim && anim.finished) {
      anim.finished.catch(() => {});
    }
    return anim;
  };
}

import {
  JournalHubView,
  JournalProfileCard,
  JournalFiltersBar,
  JournalProfilesList,
  JournalDetailEditor,
} from '@/features/templates';
import { ActionConfirmModal } from '@/components/modals';
import { Sidebar } from '@/components/Sidebar';
import {
  getManagedJournals,
  getManagedJournalById,
  getDefaultVnuhcmJournals,
} from '@/lib/templates/journal-storage';

describe('Task 5: Journal Profile & Template Management UI', () => {
  beforeEach(() => {
    mockPush.mockClear();
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  describe('1. Sidebar Navigation with Templates Tab', () => {
    it('renders the 5 main flow items including /templates and /papers', () => {
      render(<Sidebar />);

      // Verify the new Templates tab
      expect(screen.getAllByText('Quản lý Mẫu & Tạp chí').length).toBeGreaterThan(0);
      expect(screen.getAllByText('7 Tạp chí ĐHQG & Quy định').length).toBeGreaterThan(0);

      // Verify papers tab
      expect(screen.getAllByText('Quản lý Bài báo').length).toBeGreaterThan(0);

      // Verify upload tab
      expect(screen.getAllByText('Tải file DOCX').length).toBeGreaterThan(0);
    });
  });

  describe('2. JournalHubView & 7 VNUHCM Journals Rendering', () => {
    it('renders all 7 VNUHCM journals with bilingual titles, brand badges and specifications', () => {
      render(<JournalHubView />);

      // Verify top heading & sticky toolbar titlebar offset
      expect(screen.getByText('Quản Lý Mẫu & Tạp Chí Khoa Học')).toBeDefined();
      const stickyToolbar = screen.getByTestId('journal-hub-sticky-toolbar');
      expect(stickyToolbar.className).toContain('sticky');
      expect(stickyToolbar.className).toContain('top-[var(--titlebar-height,0px)]');

      // Check for the 7 short codes
      expect(screen.getByText('VNUHCM-STD')).toBeDefined();
      expect(screen.getByText('VNUHCM-HS')).toBeDefined();
      expect(screen.getByText('VNUHCM-SSH')).toBeDefined();
      expect(screen.getByText('VNUHCM-EBL')).toBeDefined();
      expect(screen.getByText('VNUHCM-ET')).toBeDefined();
      expect(screen.getByText('VNUHCM-EES')).toBeDefined();
      expect(screen.getByText('VNUHCM-ARNS')).toBeDefined();

      // Check for specific Vietnamese names
      expect(
        screen.getAllByText('Tạp chí Phát triển KH&CN - Khoa học Sức khỏe').length
      ).toBeGreaterThanOrEqual(1);
      expect(
        screen.getByText('Tạp chí Phát triển KH&CN - Môi trường & Khoa học Trái đất')
      ).toBeDefined();

      // Check summary specs are present
      expect(screen.getAllByText(/Loại bài báo/).length).toBeGreaterThanOrEqual(7);
      expect(screen.getAllByText(/Tóm tắt:/).length).toBe(7);
      expect(screen.getAllByText(/Trích dẫn:/).length).toBe(7);
      expect(screen.getAllByText(/Bố cục:/).length).toBe(7);
    });

    it('filters journals by search query matching short code or name', () => {
      render(<JournalHubView />);

      const searchInput = screen.getByRole('searchbox');
      fireEvent.change(searchInput, { target: { value: 'Sức khỏe' } });

      // Should only show HS
      expect(screen.getByText('VNUHCM-HS')).toBeDefined();
      expect(screen.queryByText('VNUHCM-STD')).toBeNull();
      expect(screen.queryByText('VNUHCM-SSH')).toBeNull();

      // Clear search
      fireEvent.change(searchInput, { target: { value: '' } });
      expect(screen.getByText('VNUHCM-STD')).toBeDefined();
      expect(screen.getByText('VNUHCM-HS')).toBeDefined();
    });

    it('filters journals by status (published vs draft)', () => {
      render(<JournalHubView />);

      // Click "Bản nháp" filter
      const draftButton = screen.getByRole('button', { name: 'Bản nháp' });
      fireEvent.click(draftButton);

      // ARNS is draft by default
      expect(screen.getByText('VNUHCM-ARNS')).toBeDefined();
      expect(screen.queryByText('VNUHCM-HS')).toBeNull();

      // Click "Đang phát hành" filter
      const publishedButton = screen.getByRole('button', { name: 'Đang phát hành' });
      fireEvent.click(publishedButton);

      expect(screen.getByText('VNUHCM-HS')).toBeDefined();
      expect(screen.getByText('VNUHCM-STD')).toBeDefined();
      expect(screen.queryByText('VNUHCM-ARNS')).toBeNull();
    });

    it('opens upload modal when clicking "Tạo bài báo từ mẫu" and redirects to editor on skip or upload', async () => {
      render(<JournalHubView />);

      const createButtons = screen.getAllByRole('button', { name: /Tạo bài báo từ mẫu/i });
      expect(createButtons.length).toBe(7);

      // Click create on first journal -> opens modal
      fireEvent.click(createButtons[0]);

      // Verify modal is open with dropzone and skip button
      const skipBtn = await screen.findByTestId('skip-to-blank-btn');
      expect(skipBtn).toBeDefined();

      // Click skip to create blank paper
      await act(async () => {
        fireEvent.click(skipBtn);
      });

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/editor');
      });
    });
  });

  describe('3. JournalDetailEditor Component (Subpage)', () => {
    const sampleManaged = getDefaultVnuhcmJournals().find((j) => j.id === 'hs')!;

    it('renders header, brand color, status and tab navigation', () => {
      render(<JournalDetailEditor initialManaged={sampleManaged} isNew={false} />);

      expect(
        screen.getAllByText('Tạp chí Phát triển KH&CN - Khoa học Sức khỏe').length
      ).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('VNUHCM-HS').length).toBeGreaterThanOrEqual(1);

      // Verify the 4 editor tabs exist (Tab 5 removed and numbers/icons removed as per requirement)
      expect(screen.getAllByText('Nhận diện & Thương hiệu').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Tóm tắt & Từ khóa').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Chuyên mục & Loại bài').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Dàn trang').length).toBeGreaterThanOrEqual(1);
    });

    it('switches tabs and renders respective settings panels', () => {
      render(<JournalDetailEditor initialManaged={sampleManaged} isNew={false} />);

      // Switch to FrontMatter tab
      fireEvent.click(screen.getAllByText('Tóm tắt & Từ khóa')[0]);
      expect(screen.getAllByText('Quy định Phần Tóm Tắt (Abstract Guidelines)').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Quy định Từ Khóa (Keywords Guidelines)').length).toBeGreaterThanOrEqual(1);

      // Switch to Article Types tab
      fireEvent.click(screen.getAllByText('Chuyên mục & Loại bài')[0]);
      expect(screen.getAllByText(/Chuyên Mục/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Bài báo nghiên cứu').length).toBeGreaterThan(0);

      // Switch to Layout tab (Technical boxes removed)
      fireEvent.click(screen.getAllByText('Dàn trang')[0]);
      expect(screen.getAllByText('Dàn Trang & Bố Cục Bản In').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Khổ giấy').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Số cột nội dung').length).toBeGreaterThanOrEqual(1);
    });

    it('saves changes to localStorage on "Lưu Thay Đổi" after confirming warning modal', () => {
      render(<JournalDetailEditor initialManaged={sampleManaged} isNew={false} />);

      // Modify short code input
      const shortInput = screen.getAllByPlaceholderText(/VNUHCM-HS/)[0];
      fireEvent.change(shortInput, { target: { value: 'STDJ-HEALTH' } });

      // Click save from dock -> opens ActionConfirmModal
      const saveBtn = screen.getAllByRole('button', { name: 'Lưu Thay Đổi' })[0];
      fireEvent.click(saveBtn);

      // Verify warning modal is open
      expect(screen.getByTestId('template-save-confirm-modal')).toBeDefined();
      expect(screen.getByText('Lưu cấu hình tạp chí?')).toBeDefined();

      // Click confirm in modal
      const confirmBtn = screen.getByTestId('confirm-save-template-btn');
      fireEvent.click(confirmBtn);

      const stored = getManagedJournalById('hs');
      expect(stored?.profile.names?.short).toBe('STDJ-HEALTH');
    });

    it('rejects saving when template short code or name conflicts with existing journal', () => {
      render(<JournalDetailEditor initialManaged={sampleManaged} isNew={false} />);

      // Try setting short code to existing journal "VNUHCM-STD"
      const shortInput = screen.getAllByPlaceholderText(/VNUHCM-HS/)[0];
      fireEvent.change(shortInput, { target: { value: 'VNUHCM-STD' } });

      // Click save
      const saveBtn = screen.getAllByRole('button', { name: 'Lưu Thay Đổi' })[0];
      fireEvent.click(saveBtn);

      // Modal should NOT open because of duplicate validation error
      expect(screen.queryByTestId('template-save-confirm-modal')).toBeNull();
    });
  });

  describe('4. ActionConfirmModal Unified Modal System', () => {
    it('renders with polymorphic variants (danger, warning, info, success) and handles actions', () => {
      const handleClose = vi.fn();
      const handleConfirm = vi.fn();

      const { rerender } = render(
        <ActionConfirmModal
          isOpen={true}
          onClose={handleClose}
          onConfirm={handleConfirm}
          variant="warning"
          title="Cảnh báo kiểm tra"
          description="Nội dung mô tả cảnh báo"
          confirmLabel="Đồng ý"
          cancelLabel="Bỏ qua"
        />
      );

      expect(screen.getByText('Cảnh báo kiểm tra')).toBeDefined();
      expect(screen.getByText('Nội dung mô tả cảnh báo')).toBeDefined();

      // Test confirm click
      fireEvent.click(screen.getByTestId('action-confirm-submit-btn'));
      expect(handleConfirm).toHaveBeenCalledTimes(1);

      // Test cancel click
      fireEvent.click(screen.getByText('Bỏ qua'));
      expect(handleClose).toHaveBeenCalledTimes(1);

      // Rerender as danger
      rerender(
        <ActionConfirmModal
          isOpen={true}
          onClose={handleClose}
          onConfirm={handleConfirm}
          variant="danger"
          title="Xác nhận xóa nguy hiểm"
          description="Dữ liệu sẽ bị xóa vĩnh viễn"
        />
      );
      expect(screen.getByText('Xác nhận xóa nguy hiểm')).toBeDefined();
    });
  });
});
