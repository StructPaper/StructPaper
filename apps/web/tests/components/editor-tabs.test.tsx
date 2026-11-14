// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';

// Mock framer-motion to prevent unhandled animation issues in happy-dom
vi.mock('framer-motion', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('framer-motion');
  return {
    ...actual,
    AnimatePresence: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
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
            return (
              <Component ref={ref} {...strippedProps}>
                {children}
              </Component>
            );
          }
        );
        MotionComp.displayName = `Motion_${prop}`;
        return MotionComp;
      },
    }),
  };
});

import {
  MetadataTab,
  AuthorsTab,
  ReferencesTab,
  PreflightQCTab,
  createPaperCommandBus,
  computePreflightCheckWrapper,
} from '@/features/editor';
import {
  HistoryManager,
} from '@structpaper/editor-core';
import type { CompletePaper, PaperMetadata, PaperReference } from '@/types/paper';

const createMockPaper = (): CompletePaper => ({
  id: 'paper_test_tab_1',
  metadata: {
    title: 'Nghiên cứu cấu trúc tự động hóa bản thảo y sinh',
    titleEn: 'Automated Manuscript Structuring Study in Biomedicine',
    articleType: 'Bài báo nghiên cứu',
    journalId: 'VNUHCM-HS',
    journalName: 'Tạp chí Khoa học Sức khỏe ĐHQG-HCM',
    journalAbbv: 'Sci. Tech. Dev. J. - Health Sci.',
    authors: [
      {
        id: 'auth_1',
        name: 'Nguyễn Văn A',
        affiliationIds: [1],
        email: 'nva@vnuhcm.edu.vn',
        isCorresponding: true,
        orcid: '0000-0001-1111-2222',
      },
      {
        id: 'auth_2',
        name: 'Trần Thị B',
        affiliationIds: [1],
        email: 'ttb@vnuhcm.edu.vn',
        isCorresponding: false,
        orcid: '0000-0002-3333-4444',
      },
    ],
    affiliations: [
      { id: 1, name: 'Đại học Quốc gia TP.HCM', nameEn: 'VNUHCM' },
    ],
    corresponding: {
      name: 'Nguyễn Văn A',
      email: 'nva@vnuhcm.edu.vn',
      affiliation: 'Đại học Quốc gia TP.HCM',
    },
    abstract: 'Đây là tóm tắt thử nghiệm cho bài báo nghiên cứu khoa học đạt chuẩn quốc gia và quốc tế.',
    abstractEn: 'This is a test abstract for research article according to international academic standards.',
    keywords: ['y sinh', 'tự động hóa', 'cấu trúc'],
    keywordsEn: ['biomedical', 'automation', 'structure'],
    dates: {
      received: '2026-01-15',
      revised: '2026-02-20',
      accepted: '2026-03-10',
      published: '2026-04-01',
    },
    doi: '10.32508/stdjhs.v1i1.630',
    volume: '1',
    issue: '1',
    year: '2026',
    firstPage: 1,
    lastPage: 10,
  },
  sections: [
    {
      id: 'sec_1',
      title: '1. Đặt vấn đề / Mở đầu',
      content: 'Nghiên cứu về tự động hóa cấu trúc tài liệu y sinh [1].',
      type: 'paragraph',
    },
    {
      id: 'sec_2',
      title: '2. Phương pháp nghiên cứu',
      content: 'Thu thập 100 mẫu bệnh án và xử lý dữ liệu [1, 2].',
      type: 'paragraph',
    },
    {
      id: 'sec_3',
      title: '3. Kết quả',
      content: 'Độ chính xác đạt 99.5%.',
      type: 'paragraph',
    },
    {
      id: 'sec_4',
      title: '4. Kết luận',
      content: 'Mô hình hoạt động ổn định.',
      type: 'paragraph',
    },
  ],
  references: [
    {
      id: 1,
      raw: 'Nguyen VA, Tran TB. Medical Document Structuring. VNUHCM J. 2026;1(1):10-15.',
      doi: '10.1001/vnuhcm.2026.001',
      isCited: true,
      citationCount: 2,
    },
    {
      id: 2,
      raw: 'Le VC. Biomedical Automation with Deep Learning. MedTech. 2025;8(3):45-52.',
      doi: '10.1001/medtech.2025.045',
      isCited: true,
      citationCount: 1,
    },
  ],
});

describe('Task 4.3: Editor Tabs Refactoring to CommandBus', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  // ---------------------------------------------------------------------------
  // 1. MetadataTab Tests
  // ---------------------------------------------------------------------------
  describe('MetadataTab', () => {
    it('edits title, abstract, keywords, and received date and dispatches commands via CommandBus', () => {
      const paper = createMockPaper();
      const bus = createPaperCommandBus(paper);
      const dispatchSpy = vi.spyOn(bus, 'dispatch');
      const onChangeMock = vi.fn();

      render(
        <MetadataTab
          metadata={paper.metadata}
          onChange={onChangeMock}
          commandBus={bus}
          showAbstractAndKeywords={true}
        />
      );

      // 1. Edit Title (Tiếng Việt)
      const titleInput = screen.getByPlaceholderText('Nhập tựa đề bài báo tiếng Việt...');
      fireEvent.change(titleInput, { target: { value: 'Tiêu đề bài báo đã cập nhật mới' } });

      expect(onChangeMock).toHaveBeenCalled();
      const lastMeta = onChangeMock.mock.calls[onChangeMock.mock.calls.length - 1][0] as PaperMetadata;
      expect(lastMeta.title).toBe('Tiêu đề bài báo đã cập nhật mới');

      expect(dispatchSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'metadata/updateTitle',
          payload: { title: [{ t: 'text', v: 'Tiêu đề bài báo đã cập nhật mới' }] },
        })
      );

      // 2. Edit Abstract (Tóm tắt Tiếng Việt)
      const abstractInput = screen.getByPlaceholderText('Nhập phần tóm tắt tiếng Việt...');
      fireEvent.change(abstractInput, {
        target: { value: 'Nội dung tóm tắt mới sau khi biên tập kỹ càng.' },
      });

      expect(dispatchSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'metadata/updateAbstract',
          payload: { abstract: [[{ t: 'text', v: 'Nội dung tóm tắt mới sau khi biên tập kỹ càng.' }]] },
        })
      );

      // 3. Edit Keywords (Từ khóa)
      const keywordsInput = screen.getByPlaceholderText('nghiên cứu y sinh, tế bào, thử nghiệm lâm sàng');
      fireEvent.change(keywordsInput, {
        target: { value: 'y học, trí tuệ nhân tạo, v2' },
      });

      expect(dispatchSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'metadata/updateKeywords',
          payload: { keywords: ['y học', 'trí tuệ nhân tạo', 'v2'] },
        })
      );

      // 4. Edit Received Date (Ngày nhận) via DatePicker trigger button
      const receivedDateLabel = screen.getByText('Ngày nhận:');
      const receivedPickerBtn = receivedDateLabel.parentElement?.querySelector('button');
      expect(receivedPickerBtn).toBeDefined();

      if (receivedPickerBtn) {
        // Open calendar dropdown
        fireEvent.click(receivedPickerBtn);
        // Click "Hôm nay" button in footer shortcuts
        const todayBtn = screen.getByRole('button', { name: /Hôm nay/i });
        fireEvent.click(todayBtn);

        expect(dispatchSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'metadata/updateDates',
            payload: expect.objectContaining({
              dates: expect.objectContaining({
                received: expect.any(String),
              }),
            }),
          })
        );
      }
    });
  });

  // ---------------------------------------------------------------------------
  // 2. AuthorsTab Tests
  // ---------------------------------------------------------------------------
  describe('AuthorsTab', () => {
    it('adds a new author, updates email and orcid, toggles corresponding author, and deletes an author', async () => {
      const paper = createMockPaper();
      const bus = createPaperCommandBus(paper);
      const dispatchSpy = vi.spyOn(bus, 'dispatch');
      const onChangeMock = vi.fn();

      render(
        <AuthorsTab
          metadata={paper.metadata}
          onChange={onChangeMock}
          commandBus={bus}
        />
      );

      // 1. Add new author
      const addBtn = screen.getByRole('button', { name: /Thêm tác giả/i });
      fireEvent.click(addBtn);

      expect(onChangeMock).toHaveBeenCalled();
      const afterAddMeta = onChangeMock.mock.calls[onChangeMock.mock.calls.length - 1][0] as PaperMetadata;
      expect(afterAddMeta.authors).toHaveLength(3);
      expect(dispatchSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'author/add',
        })
      );

      // 2. Update email and ORCID on first author
      const emailInputs = screen.getAllByPlaceholderText('author@vnuhcm.edu.vn');
      fireEvent.change(emailInputs[0], { target: { value: 'new_author1@vnuhcm.edu.vn' } });

      expect(dispatchSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'author/update',
          payload: expect.objectContaining({
            authorId: 'auth_1',
          }),
        })
      );

      const orcidInputs = screen.getAllByPlaceholderText('0000-0002-1825-0097');
      fireEvent.change(orcidInputs[0], { target: { value: '0000-0003-9999-8888' } });

      const lastCallMeta = onChangeMock.mock.calls[onChangeMock.mock.calls.length - 1][0] as PaperMetadata;
      expect(lastCallMeta.authors[0].orcid).toBe('0000-0003-9999-8888');

      // 3. Toggle corresponding author on second author
      const corrCheckboxes = screen.getAllByRole('checkbox');
      expect(corrCheckboxes).toHaveLength(2);
      expect((corrCheckboxes[0] as HTMLInputElement).checked).toBe(true);
      expect((corrCheckboxes[1] as HTMLInputElement).checked).toBe(false);

      fireEvent.click(corrCheckboxes[1]);
      const corrMeta = onChangeMock.mock.calls[onChangeMock.mock.calls.length - 1][0] as PaperMetadata;
      expect(corrMeta.authors[1].isCorresponding).toBe(true);
      expect(corrMeta.corresponding.name).toBe('Trần Thị B');

      // 4. Delete first author
      const deleteButtons = screen.getAllByRole('button', { name: /Xóa/i });
      fireEvent.click(deleteButtons[0]);

      act(() => {
        vi.advanceTimersByTime(350);
      });

      expect(dispatchSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'author/remove',
          payload: { authorId: 'auth_1' },
        })
      );
      const afterDeleteMeta = onChangeMock.mock.calls[onChangeMock.mock.calls.length - 1][0] as PaperMetadata;
      expect(afterDeleteMeta.authors).toHaveLength(1);
      expect(afterDeleteMeta.authors[0].id).toBe('auth_2');
    });
  });

  // ---------------------------------------------------------------------------
  // 3. ReferencesTab Tests
  // ---------------------------------------------------------------------------
  describe('ReferencesTab', () => {
    it('adds a reference, edits citation raw text and DOI, and deletes a reference', () => {
      const paper = createMockPaper();
      const bus = createPaperCommandBus(paper);
      const dispatchSpy = vi.spyOn(bus, 'dispatch');
      const onChangeMock = vi.fn();

      render(
        <ReferencesTab
          references={paper.references}
          onChange={onChangeMock}
          commandBus={bus}
        />
      );

      // 1. Add Reference
      const addRefBtn = screen.getByRole('button', { name: /Thêm tài liệu/i });
      fireEvent.click(addRefBtn);

      expect(onChangeMock).toHaveBeenCalled();
      const afterAddRefs = onChangeMock.mock.calls[onChangeMock.mock.calls.length - 1][0] as PaperReference[];
      expect(afterAddRefs).toHaveLength(3);
      expect(afterAddRefs[2].id).toBe(3);
      expect(dispatchSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'reference/add',
        })
      );

      // 2. Edit Citation (Raw text & DOI)
      const rawTextareas = screen.getAllByPlaceholderText('Chuỗi trích dẫn theo chuẩn Vancouver...');
      fireEvent.change(rawTextareas[0], {
        target: { value: 'Updated Vancouver Citation Raw Text (2026).' },
      });

      expect(dispatchSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'reference/update',
          payload: expect.objectContaining({
            referenceId: '1',
            updates: { raw: 'Updated Vancouver Citation Raw Text (2026).' },
          }),
        })
      );

      const doiInputs = screen.getAllByPlaceholderText('10.1001/...');
      fireEvent.change(doiInputs[0], {
        target: { value: '10.1001/updated.doi.2026' },
      });

      expect(dispatchSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'reference/update',
          payload: expect.objectContaining({
            referenceId: '1',
            updates: { doi: '10.1001/updated.doi.2026' },
          }),
        })
      );

      // 3. Delete reference
      const deleteButtons = screen.getAllByTitle('Xóa tài liệu tham khảo');
      fireEvent.click(deleteButtons[0]);

      act(() => {
        vi.advanceTimersByTime(350);
      });

      expect(dispatchSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'reference/remove',
          payload: { referenceId: '1' },
        })
      );

      const afterDeleteRefs = onChangeMock.mock.calls[onChangeMock.mock.calls.length - 1][0] as PaperReference[];
      expect(afterDeleteRefs).toHaveLength(1);
      expect(afterDeleteRefs[0].id).toBe(1); // Renumbered from 2 to 1
    });
  });

  // ---------------------------------------------------------------------------
  // 4. PreflightQCTab Tests
  // ---------------------------------------------------------------------------
  describe('PreflightQCTab', () => {
    it('computes preflight checks from paper, displays score and 6 pillars, and supports navigation', () => {
      const paper = createMockPaper();
      const preflight = computePreflightCheckWrapper(paper);
      const onNavigateMock = vi.fn();

      render(
        <PreflightQCTab
          paper={paper}
          preflight={preflight}
          onNavigateTab={onNavigateMock}
        />
      );

      // Verify header and score display
      expect(screen.getByText('Kiểm Định Cấu Trúc & Tiêu Chuẩn')).toBeDefined();
      expect(screen.getByText(`${preflight.score}`)).toBeDefined();
      expect(screen.getByText('/100')).toBeDefined();

      // Verify the 6 pillars are visible
      expect(screen.getByText('1. Tiêu đề & Định danh')).toBeDefined();
      expect(screen.getByText('2. Tác giả & Đơn vị')).toBeDefined();
      expect(screen.getByText('3. Tóm tắt & Từ khóa')).toBeDefined();
      expect(screen.getByText('4. Khung cấu trúc IMRaD')).toBeDefined();
      expect(screen.getByText('5. Minh họa & Bảng biểu')).toBeDefined();
      expect(screen.getByText('6. Trích dẫn Vancouver')).toBeDefined();

      // Click on IMRaD pillar to navigate to sections tab
      const imradCard = screen.getByText('4. Khung cấu trúc IMRaD').closest('div[class*="cursor-pointer"]');
      if (imradCard) {
        fireEvent.click(imradCard);
        expect(onNavigateMock).toHaveBeenCalledWith('sections');
      }
    });
  });

  // ---------------------------------------------------------------------------
  // 5. Undo / Redo with CommandBus & HistoryManager
  // ---------------------------------------------------------------------------
  describe('CommandBus & HistoryManager Undo/Redo integration', () => {
    it('supports immediate Undo and Redo on manuscript mutations', () => {
      const paper = createMockPaper();
      const bus = createPaperCommandBus(paper);
      const history = new HistoryManager({ commandBus: bus });

      expect(history.canUndo).toBe(false);
      expect(history.canRedo).toBe(false);

      // Perform mutation 1: Update Title
      bus.dispatch({
        type: 'metadata/updateTitle',
        payload: { title: [{ t: 'text', v: 'Tiêu đề v2 đã đổi' }] },
      });

      expect(bus.getDocument()?.meta.title).toEqual([{ t: 'text', v: 'Tiêu đề v2 đã đổi' }]);
      expect(history.canUndo).toBe(true);

      // Perform mutation 2: Add Author
      bus.dispatch({
        type: 'author/add',
        payload: {
          author: {
            id: 'auth_undo_test',
            name: 'Phạm Thị Undo',
            affiliationIds: ['aff_1'],
          },
        },
      });

      expect(bus.getDocument()?.meta.authors).toHaveLength(3);

      // Undo mutation 2 (author add)
      const afterUndo1 = history.undo();
      expect(afterUndo1).not.toBeNull();
      expect(afterUndo1?.meta.authors).toHaveLength(2);
      expect(history.canRedo).toBe(true);

      // Undo mutation 1 (title update)
      const afterUndo2 = history.undo();
      expect(afterUndo2).not.toBeNull();
      expect(afterUndo2?.meta.title).toEqual([{ t: 'text', v: 'Nghiên cứu cấu trúc tự động hóa bản thảo y sinh' }]);

      // Redo mutation 1 (title update)
      const afterRedo1 = history.redo();
      expect(afterRedo1).not.toBeNull();
      expect(afterRedo1?.meta.title).toEqual([{ t: 'text', v: 'Tiêu đề v2 đã đổi' }]);

      // Redo mutation 2 (author add)
      const afterRedo2 = history.redo();
      expect(afterRedo2).not.toBeNull();
      expect(afterRedo2?.meta.authors).toHaveLength(3);
    });
  });
});
