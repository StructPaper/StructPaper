// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import type { PaperReference } from '@/types/paper';
import { TipTapParagraphEditor } from '@/features/editor/components/sections/TipTapParagraphEditor';
import { AutoResizeTextarea } from '@/features/editor/components/sections/AutoResizeTextarea';
import { supportsCssFieldSizing } from '@/hooks/useSupportsCssFieldSizing';

const mockReferences: PaperReference[] = [
  {
    id: 1,
    raw: 'Nguyen Van A, et al. (2024). Journal of Health Sciences.',
    authors: 'Nguyen Van A, et al.',
    year: '2024',
    isCited: false,
    citationCount: 0,
  },
];

describe('Task 1: Lazy TipTap Mounting & CSS-First AutoResizeTextarea', () => {
  const originalCSS = globalThis.CSS;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    act(() => {
      vi.runOnlyPendingTimers();
    });
    cleanup();
    vi.restoreAllMocks();
    vi.useRealTimers();
    Object.defineProperty(globalThis, 'CSS', {
      value: originalCSS,
      writable: true,
      configurable: true,
    });
  });

  describe('1. TipTapParagraphEditor Lazy Mounting', () => {
    it('renders static preview with zero ProseMirror/toolbar mounts when isEditing is false, and mounts active editor when toggled to true', () => {
      const { rerender } = render(
        <TipTapParagraphEditor
          value="Nghiên cứu *H. pylori* [1] quan trọng."
          isEditing={false}
          references={mockReferences}
        />
      );

      // Preview inline nodes rendered
      const italicEl = screen.getByText('H. pylori');
      expect(italicEl.tagName.toLowerCase()).toBe('em');
      expect(screen.getByText('[1]')).toBeDefined();

      // Zero ProseMirror / active TipTap toolbar / sr-only textarea mounted
      expect(document.querySelectorAll('.ProseMirror')).toHaveLength(0);
      expect(document.querySelector('.tiptap-paragraph-editor')).toBeNull();
      expect(screen.queryByTitle(/Đậm \(Ctrl\+B\)/i)).toBeNull();
      expect(document.querySelector('textarea.sr-only')).toBeNull();

      // Even with isEditing=true, readOnly=true must NOT mount active TipTap editor
      rerender(
        <TipTapParagraphEditor
          value="Nghiên cứu *H. pylori* [1] quan trọng."
          isEditing={true}
          readOnly={true}
          references={mockReferences}
        />
      );
      expect(document.querySelectorAll('.ProseMirror')).toHaveLength(0);
      expect(screen.queryByTitle(/Đậm \(Ctrl\+B\)/i)).toBeNull();

      // Toggling to active edit mode mounts ProseMirror, mini toolbar, and sr-only textarea
      rerender(
        <TipTapParagraphEditor
          value="Nghiên cứu *H. pylori* [1] quan trọng."
          isEditing={true}
          readOnly={false}
          references={mockReferences}
        />
      );
      expect(document.querySelectorAll('.ProseMirror')).toHaveLength(1);
      expect(document.querySelector('.tiptap-paragraph-editor')).not.toBeNull();
      expect(screen.getByTitle(/Đậm \(Ctrl\+B\)/i)).toBeDefined();
      const srTextarea = document.querySelector('textarea.sr-only') as HTMLTextAreaElement | null;
      expect(srTextarea).not.toBeNull();
      expect(srTextarea?.value).toBe('Nghiên cứu *H. pylori* [1] quan trọng.');
    });

    it('supports uncontrolled click-to-edit without mounting ProseMirror until clicked', () => {
      render(
        <TipTapParagraphEditor
          value="Đoạn văn bản tương tác"
          references={mockReferences}
        />
      );

      expect(document.querySelectorAll('.ProseMirror')).toHaveLength(0);

      fireEvent.click(screen.getByRole('textbox'));

      expect(document.querySelectorAll('.ProseMirror')).toHaveLength(1);
      expect(screen.getByTitle(/Đậm \(Ctrl\+B\)/i)).toBeDefined();
    });

    it('enters edit mode and mounts TipTapActiveEditor on Enter or Space keydown on preview', () => {
      const { unmount } = render(
        <TipTapParagraphEditor value="Phím tắt Enter" references={mockReferences} />
      );
      expect(document.querySelectorAll('.ProseMirror')).toHaveLength(0);

      fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });
      expect(document.querySelectorAll('.ProseMirror')).toHaveLength(1);
      expect(screen.getByTitle(/Đậm \(Ctrl\+B\)/i)).toBeDefined();
      unmount();

      render(<TipTapParagraphEditor value="Phím tắt Space" references={mockReferences} />);
      expect(document.querySelectorAll('.ProseMirror')).toHaveLength(0);

      fireEvent.keyDown(screen.getByRole('textbox'), { key: ' ' });
      expect(document.querySelectorAll('.ProseMirror')).toHaveLength(1);
      expect(screen.getByTitle(/Đậm \(Ctrl\+B\)/i)).toBeDefined();
    });

    it('flushes pending 150ms debounced TipTap edits on unmount without losing or duplicating changes', () => {
      const onChange = vi.fn();
      const { rerender } = render(
        <TipTapParagraphEditor
          value="Đoạn văn ban đầu "
          isEditing={true}
          onChange={onChange}
          references={mockReferences}
        />
      );

      // Trigger a real TipTap transaction (insert math node) which starts the 150ms debounce
      fireEvent.click(screen.getByTitle(/Chèn công thức/i));
      const latexInput = screen.getByPlaceholderText(/ví dụ: E = mc\^2/i);
      fireEvent.change(latexInput, { target: { value: 'E=mc^2' } });
      fireEvent.click(screen.getByRole('button', { name: 'Chèn' }));

      // Before 150ms expires, debounced onChange has not fired yet
      expect(onChange).not.toHaveBeenCalled();

      // Advance less than 150ms and unmount active editor by closing edit mode
      act(() => {
        vi.advanceTimersByTime(50);
      });
      rerender(
        <TipTapParagraphEditor
          value="Đoạn văn ban đầu "
          isEditing={false}
          onChange={onChange}
          references={mockReferences}
        />
      );

      // Pending edit must flush immediately on unmount
      expect(onChange).toHaveBeenCalledTimes(1);
      const [flushedInlines, flushedText] = onChange.mock.calls[0];
      expect(flushedText).toContain('$E=mc^2$');
      expect(flushedInlines.some((node: { t: string; latex?: string }) => node.t === 'math' && node.latex === 'E=mc^2')).toBe(
        true
      );

      // Advancing past 150ms must NOT fire a duplicate callback
      act(() => {
        vi.advanceTimersByTime(300);
      });
      expect(onChange).toHaveBeenCalledTimes(1);
    });

    it('does not re-emit on unmount when the 150ms debounce timer already flushed', () => {
      const onChange = vi.fn();
      const { unmount } = render(
        <TipTapParagraphEditor
          value="Nội dung "
          isEditing={true}
          onChange={onChange}
          references={mockReferences}
        />
      );

      fireEvent.click(screen.getByTitle(/Chèn trích dẫn/i));
      fireEvent.click(screen.getByText(/Nguyen Van A/i));

      expect(onChange).not.toHaveBeenCalled();

      act(() => {
        vi.advanceTimersByTime(160);
      });
      expect(onChange).toHaveBeenCalledTimes(1);

      unmount();
      expect(onChange).toHaveBeenCalledTimes(1);
    });

    it('flushes pending 150ms debounced edit once on full unmount() without duplicating', () => {
      const onChange = vi.fn();
      const { unmount } = render(
        <TipTapParagraphEditor
          value="Nội dung "
          isEditing={true}
          onChange={onChange}
          references={mockReferences}
        />
      );

      fireEvent.click(screen.getByTitle(/Chèn trích dẫn/i));
      fireEvent.click(screen.getByText(/Nguyen Van A/i));
      expect(onChange).not.toHaveBeenCalled();

      act(() => {
        vi.advanceTimersByTime(40);
      });
      unmount();

      expect(onChange).toHaveBeenCalledTimes(1);
      const [flushedInlines, flushedText] = onChange.mock.calls[0];
      expect(flushedText).toContain('[1]');
      expect(flushedInlines.some((node: { t: string }) => node.t === 'cite')).toBe(true);

      act(() => {
        vi.advanceTimersByTime(300);
      });
      expect(onChange).toHaveBeenCalledTimes(1);
    });

    it('keeps active editor and popovers open on internal focus transfer and closes only on outside blur', () => {
      const onBlurSpy = vi.fn();
      const ControlledWrapper: React.FC = () => {
        const [isEditing, setIsEditing] = React.useState(true);
        return (
          <div>
            <TipTapParagraphEditor
              value="Nội dung tương tác"
              isEditing={isEditing}
              onStartEdit={() => setIsEditing(true)}
              onBlur={() => {
                onBlurSpy();
                setIsEditing(false);
              }}
              references={mockReferences}
            />
            <button type="button" data-testid="outside-btn">
              Ngoài vùng soạn thảo
            </button>
          </div>
        );
      };

      render(<ControlledWrapper />);

      const proseMirror = document.querySelector('.ProseMirror') as HTMLElement;
      const outsideBtn = screen.getByTestId('outside-btn');
      expect(proseMirror).not.toBeNull();

      // Open ReferencePickerPopover and simulate focus moving from .ProseMirror to popover input
      fireEvent.click(screen.getByTitle(/Chèn trích dẫn/i));
      const refInput = screen.getByPlaceholderText('Tìm số hoặc tác giả...');
      fireEvent.blur(proseMirror, { relatedTarget: refInput });

      expect(onBlurSpy).not.toHaveBeenCalled();
      expect(document.querySelectorAll('.ProseMirror')).toHaveLength(1);
      expect(screen.getByText('Chọn tài liệu trích dẫn')).toBeDefined();

      // Closing ref picker via Escape keeps active editor mounted and resets search
      fireEvent.change(refInput, { target: { value: 'Nguyen' } });
      fireEvent.keyDown(refInput, { key: 'Escape' });
      expect(screen.queryByText('Chọn tài liệu trích dẫn')).toBeNull();
      expect(onBlurSpy).not.toHaveBeenCalled();
      expect(document.querySelectorAll('.ProseMirror')).toHaveLength(1);

      // Open MathInputPopover and simulate focus transfer from .ProseMirror to latex input
      fireEvent.click(screen.getByTitle(/Chèn công thức/i));
      const mathInput = screen.getByPlaceholderText(/ví dụ: E = mc\^2/i);
      fireEvent.blur(proseMirror, { relatedTarget: mathInput });

      expect(onBlurSpy).not.toHaveBeenCalled();
      expect(screen.getByText('Chèn công thức LaTeX')).toBeDefined();
      expect(document.querySelectorAll('.ProseMirror')).toHaveLength(1);

      // Blurring from popover input to an outside element closes edit mode cleanly once
      fireEvent.blur(mathInput, { relatedTarget: outsideBtn });
      expect(onBlurSpy).toHaveBeenCalledTimes(1);
      expect(document.querySelectorAll('.ProseMirror')).toHaveLength(0);
    });
  });

  describe('2. CSS field-sizing: content Detection & AutoResizeTextarea', () => {
    const mockCssSupports = (supported: boolean) => {
      Object.defineProperty(globalThis, 'CSS', {
        value: {
          supports: vi.fn((prop: string, val: string) => prop === 'field-sizing' && val === 'content' && supported),
        },
        writable: true,
        configurable: true,
      });
    };

    it('returns false safely from supportsCssFieldSizing when CSS.supports is unavailable', () => {
      Object.defineProperty(globalThis, 'CSS', {
        value: undefined,
        writable: true,
        configurable: true,
      });
      expect(supportsCssFieldSizing()).toBe(false);
    });

    it('skips window resize listener, scrollHeight reads, and inline style.height writes when CSS field-sizing: content is supported', () => {
      mockCssSupports(true);
      expect(supportsCssFieldSizing()).toBe(true);

      const addListenerSpy = vi.spyOn(window, 'addEventListener');
      const scrollHeightSpy = vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get');
      const onChange = vi.fn();

      const { rerender, container } = render(
        <AutoResizeTextarea value="Ban đầu" onChange={onChange} />
      );

      const textarea = container.querySelector('textarea') as HTMLTextAreaElement;
      expect(textarea.className).toContain('[field-sizing:content]');
      expect(textarea.style.height).toBe('');
      expect(scrollHeightSpy).not.toHaveBeenCalled();

      const resizeCalls = addListenerSpy.mock.calls.filter(([eventName]) => eventName === 'resize');
      expect(resizeCalls).toHaveLength(0);

      // Update via prop and via user change event — inline style.height & scrollHeight remain untouched
      rerender(<AutoResizeTextarea value={'Dòng 1\nDòng 2\nDòng 3'} onChange={onChange} />);
      expect(textarea.style.height).toBe('');
      expect(scrollHeightSpy).not.toHaveBeenCalled();

      fireEvent.change(textarea, { target: { value: 'Cập nhật mới' } });
      expect(onChange).toHaveBeenCalledWith('Cập nhật mới');
      expect(textarea.style.height).toBe('');
      expect(scrollHeightSpy).not.toHaveBeenCalled();
    });

    it('clears stale inline style.height if CSS field-sizing becomes supported after JS fallback', () => {
      mockCssSupports(false);
      vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(88);

      const { rerender, container } = render(
        <AutoResizeTextarea value="Ban đầu" onChange={vi.fn()} />
      );
      const textarea = container.querySelector('textarea') as HTMLTextAreaElement;
      expect(textarea.style.height).toBe('88px');

      mockCssSupports(true);
      rerender(<AutoResizeTextarea value="Đã cập nhật" onChange={vi.fn()} />);
      expect(textarea.style.height).toBe('');
    });

    it('registers window resize listener and adjusts inline height via scrollHeight when CSS field-sizing is unsupported', () => {
      mockCssSupports(false);
      expect(supportsCssFieldSizing()).toBe(false);

      const addListenerSpy = vi.spyOn(window, 'addEventListener');
      const removeListenerSpy = vi.spyOn(window, 'removeEventListener');

      let currentScrollHeight = 84;
      const scrollHeightSpy = vi
        .spyOn(HTMLElement.prototype, 'scrollHeight', 'get')
        .mockImplementation(() => currentScrollHeight);

      const onChange = vi.fn();
      const { container, unmount } = render(
        <AutoResizeTextarea value="Dòng 1\nDòng 2" onChange={onChange} />
      );

      const textarea = container.querySelector('textarea') as HTMLTextAreaElement;
      expect(scrollHeightSpy).toHaveBeenCalled();
      expect(textarea.style.height).toBe('84px');

      const resizeCalls = addListenerSpy.mock.calls.filter(([eventName]) => eventName === 'resize');
      expect(resizeCalls).toHaveLength(1);

      // Window resize triggers JS height recalculation
      currentScrollHeight = 112;
      act(() => {
        window.dispatchEvent(new Event('resize'));
      });
      expect(textarea.style.height).toBe('112px');

      // Typing triggers JS height recalculation
      currentScrollHeight = 140;
      fireEvent.change(textarea, { target: { value: 'Dòng 1\nDòng 2\nDòng 3' } });
      expect(onChange).toHaveBeenCalledWith('Dòng 1\nDòng 2\nDòng 3');
      expect(textarea.style.height).toBe('140px');

      // Unmount cleans up the resize listener
      unmount();
      const removeResizeCalls = removeListenerSpy.mock.calls.filter(([eventName]) => eventName === 'resize');
      expect(removeResizeCalls).toHaveLength(1);
    });
  });
});
