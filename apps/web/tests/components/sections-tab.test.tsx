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
  SectionsTab,
  createPaperCommandBus,
} from '@/components/editor';
import {
  TemporaryParagraphInput,
  displayTextToInlines,
  inlinesToDisplayText,
} from '@/components/editor/sections/TemporaryParagraphInput';
import type { CompletePaper, PaperSection } from '@/types/paper';
import type { Inline } from '@structpaper/doc-model';

const createMockPaper = (): CompletePaper => ({
  id: 'paper_test_sections_1',
  metadata: {
    title: 'Nghiên cứu về Tái cấu trúc Document Model',
    articleType: 'Bài báo nghiên cứu',
    journalId: 'VNUHCM-HS',
    authors: [],
    affiliations: [],
    abstract: 'Tóm tắt bài báo thử nghiệm.',
    keywords: ['kiến trúc', 'tái cấu trúc'],
  } as any,
  sections: [
    {
      id: 'sec_1',
      type: 'h1',
      title: '1. ĐẶT VẤN ĐỀ',
      content: '',
    },
    {
      id: 'sec_2',
      type: 'paragraph',
      content: 'Nghiên cứu của *Nguyễn và cs.* [1] chứng minh hiệu quả thuật toán.',
    },
    {
      id: 'sec_3',
      type: 'table',
      content: 'Bảng 1: Bảng thông số thực nghiệm',
      table: {
        id: 'tab_1',
        num: 1,
        caption: 'Bảng 1: Bảng thông số thực nghiệm',
        headers: ['STT', 'Tên chỉ số', 'Giá trị'],
        rows: [['1', 'Độ chính xác', '98.5%']],
        isFullWidth: true,
      },
    },
    {
      id: 'sec_4',
      type: 'figure',
      content: 'Hình 1: Sơ đồ kiến trúc mô hình',
      figure: {
        id: 'fig_1',
        num: 1,
        caption: 'Hình 1: Sơ đồ kiến trúc mô hình',
        src: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
        isFullWidth: true,
      },
    },
  ],
  references: [
    {
      id: 1,
      raw: 'Nguyễn Văn A, Trần Thị B. Tạp chí KH&CN ĐHQG-HCM, 2026.',
      isCited: true,
      citationCount: 1,
    },
  ],
});

describe('Task 4.4: SectionsTab & TemporaryParagraphInput Refactor', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  describe('1. TemporaryParagraphInput Unit Tests & Conversion', () => {
    it('converts markdown italic and citations to Inline[] correctly', () => {
      const text = 'Nghiên cứu của *Nguyễn và cs.* [1] cùng công thức $E=mc^2$.';
      const inlines = displayTextToInlines(text);

      expect(inlines).toHaveLength(7);
      expect(inlines[0]).toEqual({ t: 'text', v: 'Nghiên cứu của ' });
      expect(inlines[1]).toEqual({ t: 'text', v: 'Nguyễn và cs.', marks: ['i'] });
      expect(inlines[2]).toEqual({ t: 'text', v: ' ' });
      expect(inlines[3]).toEqual({ t: 'cite', refIds: ['ref-1'] });
      expect(inlines[4]).toEqual({ t: 'text', v: ' cùng công thức ' });
      expect(inlines[5]).toEqual({ t: 'math', latex: 'E=mc^2' });
      expect(inlines[6]).toEqual({ t: 'text', v: '.' });
    });

    it('converts Inline[] back into display text with preserved markdown', () => {
      const inlines: Inline[] = [
        { t: 'text', v: 'Đoạn mở đầu có ' },
        { t: 'text', v: 'từ khóa nghiêng', marks: ['i'] },
        { t: 'text', v: ' và trích dẫn ' },
        { t: 'cite', refIds: ['ref-1', 'ref-2'] },
      ];

      const displayText = inlinesToDisplayText(inlines);
      expect(displayText).toBe('Đoạn mở đầu có *từ khóa nghiêng* và trích dẫn [1, 2]');
    });

    it('renders preview with formatted badges and triggers onStartEdit on click', () => {
      const onStartEdit = vi.fn();
      const onChange = vi.fn();

      render(
        <TemporaryParagraphInput
          value="Đoạn văn có *từ khóa quan trọng* và trích dẫn [1]."
          isEditing={false}
          onStartEdit={onStartEdit}
          onChange={onChange}
        />
      );

      // Verify citation badge rendered
      expect(screen.getByText('[1]')).toBeDefined();
      // Verify italic text rendered
      const italicEl = screen.getByText('từ khóa quan trọng');
      expect(italicEl.tagName.toLowerCase()).toBe('em');

      // Click to edit
      fireEvent.click(screen.getByRole('textbox'));
      expect(onStartEdit).toHaveBeenCalledTimes(1);
    });

    it('renders editing textarea when isEditing is true and triggers onChange with both inlines and text', () => {
      const onChange = vi.fn();

      render(
        <TemporaryParagraphInput
          value="Nội dung ban đầu"
          isEditing={true}
          onChange={onChange}
        />
      );

      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
      expect(textarea.tagName.toLowerCase()).toBe('textarea');
      expect(textarea.value).toBe('Nội dung ban đầu');

      fireEvent.change(textarea, {
        target: { value: 'Nội dung cập nhật *in nghiêng* [2]' },
      });

      expect(onChange).toHaveBeenCalledTimes(1);
      const [emittedInlines, emittedText] = onChange.mock.calls[0];
      expect(emittedText).toBe('Nội dung cập nhật *in nghiêng* [2]');
      expect(emittedInlines.some((i: Inline) => i.t === 'cite')).toBe(true);
      expect(emittedInlines.some((i: Inline) => i.t === 'text' && i.marks?.includes('i'))).toBe(true);
    });
  });

  describe('2. SectionsTab Rendering & Filtering', () => {
    it('renders full list of sections and block elements properly', () => {
      const paper = createMockPaper();
      const onChange = vi.fn();

      render(
        <SectionsTab
          sections={paper.sections}
          onChange={onChange}
          metadata={paper.metadata}
          references={paper.references}
        />
      );

      // Verify header and counts
      expect(screen.getByText(/Nội dung bài báo \(4\)/i)).toBeDefined();
      expect(screen.getByText(/Tất cả \(4\)/i)).toBeDefined();
      expect(screen.getByText(/Tiêu đề \(1\)/i)).toBeDefined();
      expect(screen.getByText(/Đoạn văn \(1\)/i)).toBeDefined();
      expect(screen.getByText(/Bảng \(1\)/i)).toBeDefined();
      expect(screen.getByText(/Hình \(1\)/i)).toBeDefined();

      // Verify section items
      expect(screen.getByDisplayValue('1. ĐẶT VẤN ĐỀ')).toBeDefined();
      expect(screen.getByText(/Nghiên cứu của/i)).toBeDefined();
      expect(screen.getByText(/Bảng 1: Bảng thông số thực nghiệm/i)).toBeDefined();
      expect(screen.getByText(/Hình 1: Sơ đồ kiến trúc mô hình/i)).toBeDefined();
    });

    it('filters blocks correctly when filter chips are clicked', () => {
      const paper = createMockPaper();
      const onChange = vi.fn();

      render(
        <SectionsTab
          sections={paper.sections}
          onChange={onChange}
          metadata={paper.metadata}
          references={paper.references}
        />
      );

      // Filter by "Tiêu đề"
      const headingFilterBtn = screen.getByText(/Tiêu đề \(1\)/i);
      fireEvent.click(headingFilterBtn);

      expect(screen.getByDisplayValue('1. ĐẶT VẤN ĐỀ')).toBeDefined();
      expect(screen.queryByText(/Bảng 1: Bảng thông số thực nghiệm/i)).toBeNull();

      // Filter by "Bảng"
      const tableFilterBtn = screen.getByText(/Bảng \(1\)/i);
      fireEvent.click(tableFilterBtn);

      expect(screen.getByText(/Bảng 1: Bảng thông số thực nghiệm/i)).toBeDefined();
      expect(screen.queryByDisplayValue('1. ĐẶT VẤN ĐỀ')).toBeNull();
    });
  });

  describe('3. Adding, Editing, Deleting, and Reordering Sections', () => {
    it('adds a new paragraph section when + Đoạn văn is clicked', () => {
      const paper = createMockPaper();
      let currentSections = [...paper.sections];
      const onChange = vi.fn((updated: PaperSection[]) => {
        currentSections = updated;
      });

      render(
        <SectionsTab
          sections={currentSections}
          onChange={onChange}
          metadata={paper.metadata}
        />
      );

      const addParagraphButtons = screen.getAllByTitle('Thêm đoạn văn bản ngay bên dưới');
      fireEvent.click(addParagraphButtons[addParagraphButtons.length - 1]);

      expect(onChange).toHaveBeenCalledTimes(1);
      const updatedList = onChange.mock.calls[0][0] as PaperSection[];
      expect(updatedList).toHaveLength(5);
      expect(updatedList[4].type).toBe('paragraph');
      expect(updatedList[4].content).toBe('');
    });

    it('edits paragraph content via TemporaryParagraphInput', () => {
      const paper = createMockPaper();
      const onChange = vi.fn();

      render(
        <SectionsTab
          sections={paper.sections}
          onChange={onChange}
          metadata={paper.metadata}
        />
      );

      // Click paragraph preview to enter edit mode
      const paraPreview = screen.getByText(/Nghiên cứu của/i);
      fireEvent.click(paraPreview);

      // Fast-forward any state updates
      act(() => {
        vi.runAllTimers();
      });

      // Find textarea and edit
      const textarea = screen.getByDisplayValue(
        'Nghiên cứu của *Nguyễn và cs.* [1] chứng minh hiệu quả thuật toán.'
      );
      fireEvent.change(textarea, {
        target: { value: 'Nội dung đoạn văn mới được cập nhật.' },
      });

      expect(onChange).toHaveBeenCalled();
      const updatedList = onChange.mock.calls[0][0] as PaperSection[];
      expect(updatedList[1].content).toBe('Nội dung đoạn văn mới được cập nhật.');
    });

    it('deletes a section when remove button is clicked', () => {
      const paper = createMockPaper();
      const onChange = vi.fn();

      render(
        <SectionsTab
          sections={paper.sections}
          onChange={onChange}
          metadata={paper.metadata}
        />
      );

      // SectionCardHeader delete button has title="Xóa phần này"
      const deleteButtons = screen.getAllByTitle('Xóa phần này');
      expect(deleteButtons.length).toBeGreaterThan(0);

      // Click delete on the first section
      fireEvent.click(deleteButtons[0]);

      // Fast-forward the 320ms deletion animation timeout
      act(() => {
        vi.advanceTimersByTime(350);
      });

      expect(onChange).toHaveBeenCalledTimes(1);
      const updatedList = onChange.mock.calls[0][0] as PaperSection[];
      expect(updatedList).toHaveLength(3);
      expect(updatedList[0].id).toBe('sec_2');
    });

    it('moves section order down and up smoothly', () => {
      const paper = createMockPaper();
      const onChange = vi.fn();

      render(
        <SectionsTab
          sections={paper.sections}
          onChange={onChange}
          metadata={paper.metadata}
        />
      );

      // SectionCardHeader move down button has title="Di chuyển xuống dưới"
      const moveDownButtons = screen.getAllByTitle('Di chuyển xuống dưới');
      expect(moveDownButtons.length).toBeGreaterThan(0);

      fireEvent.click(moveDownButtons[0]);

      expect(onChange).toHaveBeenCalledTimes(1);
      const movedList = onChange.mock.calls[0][0] as PaperSection[];
      expect(movedList[0].id).toBe('sec_2');
      expect(movedList[1].id).toBe('sec_1');
    });
  });

  describe('4. CommandBus Integration', () => {
    it('dispatches block/update command to CommandBus when a section is modified', () => {
      const paper = createMockPaper();
      const bus = createPaperCommandBus(paper);
      const dispatchSpy = vi.spyOn(bus, 'dispatch');
      const onChange = vi.fn();

      render(
        <SectionsTab
          sections={paper.sections}
          onChange={onChange}
          metadata={paper.metadata}
          commandBus={bus}
        />
      );

      // Click to edit paragraph
      const paraPreview = screen.getByText(/Nghiên cứu của/i);
      fireEvent.click(paraPreview);

      act(() => {
        vi.runAllTimers();
      });

      const textarea = screen.getByDisplayValue(
        'Nghiên cứu của *Nguyễn và cs.* [1] chứng minh hiệu quả thuật toán.'
      );
      fireEvent.change(textarea, {
        target: { value: 'Cập nhật qua CommandBus.' },
      });

      expect(dispatchSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'block/update',
          payload: expect.objectContaining({
            blockId: 'sec_2',
          }),
        })
      );
      expect(onChange).toHaveBeenCalled();
    });

    it('dispatches block/insert command when a new paragraph block is added', () => {
      const paper = createMockPaper();
      const bus = createPaperCommandBus(paper);
      const dispatchSpy = vi.spyOn(bus, 'dispatch');
      const onChange = vi.fn();

      render(
        <SectionsTab
          sections={paper.sections}
          onChange={onChange}
          metadata={paper.metadata}
          commandBus={bus}
        />
      );

      const addParagraphButtons = screen.getAllByTitle('Thêm đoạn văn bản ngay bên dưới');
      fireEvent.click(addParagraphButtons[0]);

      expect(dispatchSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'block/insert',
          payload: expect.objectContaining({
            block: expect.objectContaining({
              type: 'paragraph',
            }),
          }),
        })
      );
    });

    it('dispatches block/remove command when a block is deleted', () => {
      const paper = createMockPaper();
      const bus = createPaperCommandBus(paper);
      const dispatchSpy = vi.spyOn(bus, 'dispatch');
      const onChange = vi.fn();

      render(
        <SectionsTab
          sections={paper.sections}
          onChange={onChange}
          metadata={paper.metadata}
          commandBus={bus}
        />
      );

      const deleteButtons = screen.getAllByTitle('Xóa phần này');
      fireEvent.click(deleteButtons[1]); // delete paragraph

      act(() => {
        vi.advanceTimersByTime(350);
      });

      expect(dispatchSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'block/remove',
          payload: expect.objectContaining({
            blockId: 'sec_2',
          }),
        })
      );
      expect(onChange).toHaveBeenCalled();
    });
  });
});
