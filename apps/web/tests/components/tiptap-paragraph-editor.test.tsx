// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import type { Inline } from '@structpaper/doc-model';
import type { PaperReference } from '@/types/paper';
import {
  tiptapDocToInlines,
  inlinesToTiptapDoc,
  tiptapDocToPlainText,
} from '@/features/editor/components/sections/tiptap-schema';
import { cleanWordPasteHtml } from '@/features/editor/components/sections/clean-word-paste';
import { TipTapParagraphEditor } from '@/features/editor/components/sections/TipTapParagraphEditor';

describe('Task 4.5: TipTap Paragraph Editor & Schema Bidirectional Mapping', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    act(() => {
      vi.runOnlyPendingTimers();
    });
    cleanup();
    vi.useRealTimers();
  });

  describe('1. TipTap Schema Bidirectional Conversion (inlines <-> tiptapDoc)', () => {
    it('handles empty inline array and null doc gracefully', () => {
      const emptyDoc = inlinesToTiptapDoc([]);
      expect(emptyDoc).toEqual({
        type: 'doc',
        content: [{ type: 'paragraph' }],
      });

      const convertedInlines = tiptapDocToInlines(emptyDoc);
      expect(convertedInlines).toEqual([{ t: 'text', v: '' }]);
    });

    it('converts plain text with marks (b, i, sup, sub, code) back and forth losslessly', () => {
      const inputInlines: Inline[] = [
        { t: 'text', v: 'Vi khuẩn ' },
        { t: 'text', v: 'H. pylori', marks: ['i'] },
        { t: 'text', v: ' và chỉ số FEV' },
        { t: 'text', v: '1', marks: ['sub'] },
        { t: 'text', v: ' cùng với 10' },
        { t: 'text', v: '3', marks: ['sup'] },
        { t: 'text', v: ' là ' },
        { t: 'text', v: 'quan trọng', marks: ['b'] },
        { t: 'text', v: '.' },
      ];

      const doc = inlinesToTiptapDoc(inputInlines);
      expect(doc.type).toBe('doc');
      expect(doc.content).toBeDefined();

      const outputInlines = tiptapDocToInlines(doc);
      expect(outputInlines).toEqual(inputInlines);
    });

    it('converts atom cite nodes bidirectional with refIds and labels', () => {
      const inputInlines: Inline[] = [
        { t: 'text', v: 'Theo nghiên cứu ' },
        { t: 'cite', refIds: ['ref-1', 'ref-2'] },
        { t: 'text', v: ' đã công bố.' },
      ];

      const doc = inlinesToTiptapDoc(inputInlines);
      const paraContent = doc.content?.[0].content;
      expect(paraContent).toHaveLength(3);
      expect(paraContent?.[1].type).toBe('cite');
      expect(paraContent?.[1].attrs?.label).toBe('[1, 2]');

      const outputInlines = tiptapDocToInlines(doc);
      expect(outputInlines).toEqual(inputInlines);
    });

    it('converts atom xref nodes bidirectional for figure, table, and equation', () => {
      const inputInlines: Inline[] = [
        { t: 'text', v: 'Xem ' },
        { t: 'xref', target: 'fig_1', kind: 'figure' },
        { t: 'text', v: ' và ' },
        { t: 'xref', target: 'tbl_2', kind: 'table' },
        { t: 'text', v: '.' },
      ];

      const doc = inlinesToTiptapDoc(inputInlines);
      const outputInlines = tiptapDocToInlines(doc);
      expect(outputInlines).toEqual(inputInlines);
    });

    it('converts atom math nodes bidirectional with latex string', () => {
      const inputInlines: Inline[] = [
        { t: 'text', v: 'Công thức năng lượng: ' },
        { t: 'math', latex: 'E = mc^2' },
        { t: 'text', v: '.' },
      ];

      const doc = inlinesToTiptapDoc(inputInlines);
      expect(doc.content?.[0].content?.[1].type).toBe('math');
      expect(doc.content?.[0].content?.[1].attrs?.latex).toBe('E = mc^2');

      const outputInlines = tiptapDocToInlines(doc);
      expect(outputInlines).toEqual(inputInlines);
    });

    it('merges adjacent text nodes with identical marks into a single node', () => {
      const doc = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: 'Hello ' },
              { type: 'text', text: 'world' },
              { type: 'text', text: '!', marks: [{ type: 'bold' }] },
            ],
          },
        ],
      };

      const inlines = tiptapDocToInlines(doc);
      expect(inlines).toEqual([
        { t: 'text', v: 'Hello world' },
        { t: 'text', v: '!', marks: ['b'] },
      ]);
    });

    it('generates Markdown plain text representation with tiptapDocToPlainText', () => {
      const doc = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: 'Vi khuẩn ' },
              { type: 'text', text: 'H. pylori', marks: [{ type: 'italic' }] },
              { type: 'cite', attrs: { id: 'ref-1', targetId: '1', label: '[1]' } },
              { type: 'text', text: ' với ' },
              { type: 'math', attrs: { latex: '\\alpha + \\beta' } },
            ],
          },
        ],
      };

      const text = tiptapDocToPlainText(doc);
      expect(text).toBe('Vi khuẩn *H. pylori*[1] với $\\alpha + \\beta$');
    });
  });

  describe('2. Word / Excel Paste Normalization (cleanWordPasteHtml)', () => {
    it('strips Microsoft Office conditional comments, styles, and xml blocks', () => {
      const wordHtml = `
        <!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View></w:WordDocument></xml><![endif]-->
        <style>
          <!--
          p.MsoNormal { mso-style-parent:""; font-family:"Times New Roman"; }
          -->
        </style>
        <p class="MsoNormal">Nội dung văn bản thông thường.</p>
      `;

      const cleaned = cleanWordPasteHtml(wordHtml);
      expect(cleaned).not.toContain('mso');
      expect(cleaned).not.toContain('w:WordDocument');
      expect(cleaned).not.toContain('style');
      expect(cleaned).toContain('<p>Nội dung văn bản thông thường.</p>');
    });

    it('preserves scientific italic names such as H. pylori from Word styling', () => {
      const wordItalicHtml = `
        <p class="MsoNormal">
          Khảo sát vi khuẩn <span style="font-size:12.0pt;font-family:'Times New Roman',serif;font-style:italic;mso-bidi-font-style:normal">Helicobacter pylori</span> trong dạ dày.
        </p>
      `;

      const cleaned = cleanWordPasteHtml(wordItalicHtml);
      expect(cleaned).toContain('<em>Helicobacter pylori</em>');
      expect(cleaned).not.toContain('MsoNormal');
      expect(cleaned).not.toContain('font-family');
    });

    it('preserves subscript (FEV1) and superscript (10^3) from Word styling', () => {
      const wordSubSupHtml = `
        <p class="MsoNormal">
          Chỉ số FEV<span style="vertical-align:sub">1</span> đạt mức 10<span style="vertical-align:super">3</span> tế bào.
        </p>
      `;

      const cleaned = cleanWordPasteHtml(wordSubSupHtml);
      expect(cleaned).toContain('FEV<sub>1</sub>');
      expect(cleaned).toContain('10<sup>3</sup>');
    });

    it('preserves bold text from Word styling', () => {
      const wordBoldHtml = `
        <p class="MsoNormal">
          Kết quả <span style="font-weight:bold;mso-bidi-font-weight:bold">rất khả quan</span>.
        </p>
      `;

      const cleaned = cleanWordPasteHtml(wordBoldHtml);
      expect(cleaned).toContain('<strong>rất khả quan</strong>');
    });
  });

  describe('3. TipTapParagraphEditor Component Interaction & Toolbar', () => {
    const mockReferences: PaperReference[] = [
      {
        id: 1,
        raw: 'Nguyen Van A, et al. (2024). Journal of Health Sciences.',
        authors: 'Nguyen Van A, et al.',
        year: '2024',
        isCited: false,
        citationCount: 0,
      },
      {
        id: 2,
        raw: 'Smith J, et al. (2023). Nature Medicine.',
        authors: 'Smith J, et al.',
        year: '2023',
        isCited: false,
        citationCount: 0,
      },
    ];

    it('renders preview mode with formatted inline nodes and triggers onStartEdit on click', () => {
      const onStartEdit = vi.fn();
      render(
        <TipTapParagraphEditor
          value="Nghiên cứu *H. pylori* [1] rất quan trọng."
          isEditing={false}
          onStartEdit={onStartEdit}
        />
      );

      // Check rendered text elements in preview mode
      expect(screen.getByText(/Nghiên cứu/i)).toBeDefined();
      expect(screen.getByText('H. pylori')).toBeDefined();
      expect(screen.getByText('[1]')).toBeDefined();

      // Click to edit
      const previewEl = screen.getByRole('textbox');
      fireEvent.click(previewEl);
      expect(onStartEdit).toHaveBeenCalledTimes(1);
    });

    it('renders mini toolbar when editing mode is active', () => {
      render(
        <TipTapParagraphEditor
          value="Nội dung kiểm thử toolbar."
          isEditing={true}
          references={mockReferences}
        />
      );

      // Mini toolbar should have Bold, Italic, x², x₂, Trích dẫn, Toán
      expect(screen.getByTitle(/Đậm \(Ctrl\+B\)/i)).toBeDefined();
      expect(screen.getByTitle(/Nghiên cứu \(Ctrl\+I\)|Nghiên \(Ctrl\+I\)|Nghiêng/i)).toBeDefined();
      expect(screen.getByTitle(/Chỉ số trên/i)).toBeDefined();
      expect(screen.getByTitle(/Chỉ số dưới/i)).toBeDefined();
      expect(screen.getByTitle(/Chèn trích dẫn/i)).toBeDefined();
      expect(screen.getByTitle(/Chèn công thức/i)).toBeDefined();
    });

    it('opens references dropdown on clicking citation button and inserts reference', () => {
      render(
        <TipTapParagraphEditor
          value="Đoạn văn cần trích dẫn"
          isEditing={true}
          references={mockReferences}
        />
      );

      // Click citation toolbar button
      const citeBtn = screen.getByTitle(/Chèn trích dẫn/i);
      fireEvent.click(citeBtn);

      // Should show reference choices
      expect(screen.getByText('Chọn tài liệu trích dẫn:')).toBeDefined();
      expect(screen.getByText(/Nguyen Van A/i)).toBeDefined();
      expect(screen.getByText(/Smith J/i)).toBeDefined();

      // Click reference [2]
      const ref2Btn = screen.getByText(/Smith J/i);
      fireEvent.click(ref2Btn);

      // Popover should close
      expect(screen.queryByText('Chọn tài liệu trích dẫn:')).toBeNull();
    });

    it('opens math popover on clicking math button and accepts formula input', () => {
      render(
        <TipTapParagraphEditor
          value="Đoạn văn có công thức"
          isEditing={true}
          references={mockReferences}
        />
      );

      // Click math button
      const mathBtn = screen.getByTitle(/Chèn công thức/i);
      fireEvent.click(mathBtn);

      expect(screen.getByText('Chèn công thức LaTeX:')).toBeDefined();
      const input = screen.getByPlaceholderText(/ví dụ: E = mc\^2/i);
      fireEvent.change(input, { target: { value: '\\sum_{i=1}^n x_i' } });

      const submitBtn = screen.getByRole('button', { name: 'Chèn' });
      fireEvent.click(submitBtn);

      expect(screen.queryByText('Chèn công thức LaTeX:')).toBeNull();
    });

    it('triggers debounced onChange after text edits', () => {
      const onChange = vi.fn();
      render(
        <TipTapParagraphEditor
          value="Văn bản gốc."
          isEditing={true}
          onChange={onChange}
        />
      );

      // Use the synced textarea to trigger change
      const textarea = screen.getByDisplayValue('Văn bản gốc.');
      fireEvent.change(textarea, { target: { value: 'Văn bản đã sửa.' } });

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith(
        [{ t: 'text', v: 'Văn bản đã sửa.' }],
        'Văn bản đã sửa.'
      );
    });
  });
});
