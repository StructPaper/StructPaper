// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor, act, fireEvent } from '@testing-library/react';
import { PaperOverview } from '@/features/editor/overview/PaperOverview';
import { createEmptyPaper, type CompletePaper } from '@/types/paper';

afterEach(cleanup);

// the page loads the editors and the dialogs it can open the first time it is drawn, which takes a while on a busy machine
vi.setConfig({ testTimeout: 20000 });

function paper(): CompletePaper {
  const p = createEmptyPaper('VNUHCM-STD');
  p.metadata.title = 'Nghiên cứu <i>thử</i> nghiệm';
  p.metadata.abstract = 'Tóm tắt của bài.';
  p.metadata.keywords = ['một', 'hai'];
  p.metadata.authors = [{ id: 'a1', name: 'Nguyễn Văn A', affiliationIds: [1] }];
  p.references = [{ id: 1, raw: 'Tài liệu một', isCited: true, citationCount: 1 }];
  p.sections = [
    { id: 's1', type: 'h1', title: '1. Giới thiệu', content: '' },
    { id: 's2', type: 'paragraph', content: 'Đoạn có <b>đậm</b> và trích dẫn [1].' },
    {
      id: 's3',
      type: 'table',
      content: '',
      table: { id: 't1', num: 1, caption: 'Bảng thử', headers: ['A', 'B'], rows: [['1', '2']], borderStyle: 'grid', columnSpan: '2-column' },
    },
  ];
  return p;
}

const renderIt = (p = paper(), extra: Partial<React.ComponentProps<typeof PaperOverview>> = {}) =>
  render(<PaperOverview paper={p} lang="vi" citationText="A. Thử. 2026" onChange={vi.fn()} openTab={vi.fn()} {...extra} />);

describe('the overview page', () => {
  it('draws the front matter, the headings, the text, the table and the references', async () => {
    const { container } = renderIt();
    await waitFor(() => expect(container.querySelector('.ov-front-title')).not.toBeNull());
    expect(container.querySelector('.ov-front-title')!.textContent).toBe('Nghiên cứu thử nghiệm');
    expect(container.querySelector('.ov-front-title i, .ov-front-title em')).not.toBeNull();
    expect(container.querySelector('.ov-authors')!.textContent).toContain('Nguyễn Văn A');
    expect(container.querySelector('.ov-front-abstract')!.getAttribute('data-label')).toBe('TÓM TẮT');
    expect(container.querySelector('.ov-front-keywords')!.textContent).toBe('một, hai');
    // the number typed in Word is not printed by the journal
    expect(container.querySelector('h1')!.textContent).toBe('Giới thiệu');
    expect(container.querySelector('p strong, p b')!.textContent).toBe('đậm');
    expect(container.querySelector('.ov-cite')!.textContent).toBe('1');
    expect(container.querySelector('table')).not.toBeNull();
    expect(container.querySelectorAll('td, th').length).toBe(4);
    expect(container.querySelector('.ov-table-block')!.getAttribute('data-border')).toBe('grid');
    expect(container.querySelector('.ov-table-block')!.className).toContain('ov-span-all');
    expect(container.querySelector('.ov-ref')!.textContent).toBe('Tài liệu một');
  });

  it('uses the English fields when the page is in English', async () => {
    const p = paper();
    p.metadata.titleEn = 'English title';
    p.metadata.abstractEn = 'English abstract';
    const { container } = render(<PaperOverview paper={p} lang="en" citationText="" onChange={vi.fn()} openTab={vi.fn()} />);
    await waitFor(() => expect(container.querySelector('.ov-front-title')).not.toBeNull());
    expect(container.querySelector('.ov-front-title')!.textContent).toBe('English title');
    expect(container.querySelector('.ov-front-abstract')!.getAttribute('data-label')).toBe('ABSTRACT');
  });

  it('draws the body in one column when the paper is set to one column', async () => {
    const p = paper();
    p.layoutSettings = { columnLayout: '1-column' };
    const { container } = renderIt(p);
    await waitFor(() => expect(container.querySelector('.ov-page')).not.toBeNull());
    expect(container.querySelector('.ov-page')!.getAttribute('data-columns')).toBe('1');
  });

  it('draws the page again when the paper changes from outside (undo, another tab)', async () => {
    const p = paper();
    const { container, rerender } = renderIt(p);
    await waitFor(() => expect(container.querySelector('p strong, p b')).not.toBeNull());
    const changed = { ...p, sections: p.sections.map((s) => (s.id === 's2' ? { ...s, content: 'Đoạn khác hẳn.' } : s)) };
    await act(async () => {
      rerender(<PaperOverview paper={changed} lang="vi" citationText="" onChange={vi.fn()} openTab={vi.fn()} />);
    });
    await waitFor(() => expect(container.textContent).toContain('Đoạn khác hẳn.'));
  });

  it('does not touch the paper just by showing it', async () => {
    const onChange = vi.fn();
    const { container } = renderIt(paper(), { onChange });
    await waitFor(() => expect(container.querySelector('table')).not.toBeNull());
    await new Promise((r) => setTimeout(r, 300));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('shows what only the form edits, with a way there', async () => {
    const openTab = vi.fn();
    renderIt(paper(), { openTab });
    const btn = await screen.findByText('Sửa tác giả');
    btn.click();
    expect(openTab).toHaveBeenCalledWith('authors');
  });
});

describe('typing on the page', () => {
  it('hands the changed block back to the paper, and only that block', async () => {
    const p = paper();
    const onChange = vi.fn();
    const { container } = renderIt(p, { onChange });
    await waitFor(() => expect(container.querySelector('p[data-variant], .ProseMirror p:not([class])')).not.toBeNull());
    const para = Array.from(container.querySelectorAll('.ProseMirror p')).find((el) => el.textContent?.includes('Đoạn có')) as HTMLElement;
    expect(para).toBeTruthy();
    const textNode = Array.from(para.childNodes).find((n) => n.nodeType === 3) as Text;
    await act(async () => {
      textNode.textContent = 'Đoạn đã gõ lại ';
      await new Promise((r) => setTimeout(r, 400));
    });
    await waitFor(() => expect(onChange).toHaveBeenCalled(), { timeout: 2000 });
    const patch = onChange.mock.calls[0][0];
    expect(patch.sections[1].content).toContain('Đoạn đã gõ lại');
    expect(patch.sections[1].content).toContain('<b>đậm</b>');
    expect(patch.sections[0]).toBe(p.sections[0]);
    expect(patch.sections[2]).toBe(p.sections[2]);
    expect(patch.references).toBeUndefined();
    expect(patch.metadata).toBeUndefined();
  });
});

describe('the toolbar over the page', () => {
  const twoTables = (): CompletePaper => {
    const p = paper();
    p.sections.push({ id: 's4', type: 'table', content: '', table: { id: 't2', num: 2, caption: 'Bảng hai', headers: ['X', 'Y'], rows: [['9', '8']] } });
    return p;
  };

  it('shows table tools when the cursor is in a table, and applies a look to every table', async () => {
    const ref = { current: null as import('@tiptap/react').Editor | null };
    const onChange = vi.fn();
    const { container } = render(<PaperOverview paper={twoTables()} lang="vi" citationText="" onChange={onChange} openTab={vi.fn()} editorRef={ref} />);
    await waitFor(() => expect(container.querySelector('table')).not.toBeNull());
    expect(screen.queryByTestId('overview-table-tools')).toBeNull();
    // put the cursor in the first cell of the first table
    let cellPos = -1;
    ref.current!.state.doc.descendants((node, pos) => {
      if (cellPos < 0 && node.type.name === 'tableHeader') cellPos = pos;
      return cellPos < 0;
    });
    await act(async () => {
      ref.current!.commands.setTextSelection(cellPos + 2);
    });
    expect(await screen.findByTestId('overview-table-tools')).toBeDefined();
    // the table's own tools sit in the one bar, not in a second one under it, and do not repeat what the right-click menu has
    const bar = screen.getByTestId('overview-toolbar');
    expect(bar.querySelectorAll('[class*="rounded-2xl"][class*="shadow-"]').length).toBe(1);
    expect(bar.contains(screen.getByTestId('overview-table-tools'))).toBe(true);
    expect(screen.getByTestId('overview-open-sheet')).toBeDefined();
    expect(screen.getByTestId('overview-cell-fill')).toBeDefined();
    for (const title of ['Thêm hàng phía trên', 'Thêm hàng phía dưới', 'Xóa hàng', 'Thêm cột bên trái', 'Thêm cột bên phải', 'Xóa cột', 'Gộp các ô đang chọn', 'Tách ô đã gộp', 'Hàng đầu là hàng tiêu đề']) {
      expect(screen.queryByTitle(title)).toBeNull();
    }
    // open the table style panel and pick another kind of lines
    await act(async () => {
      screen.getByTestId('overview-table-style').click();
    });
    await act(async () => {
      screen.getByTestId('border-style-horizontal').click();
    });
    expect(onChange).toHaveBeenCalled();
    let patch = onChange.mock.calls.at(-1)![0];
    expect(patch.sections.find((s: any) => s.id === 's3').table.borderStyle).toBe('horizontal');
    expect(patch.sections.find((s: any) => s.id === 's4').table.borderStyle).toBeUndefined();
    // and copy that look to the other table
    await act(async () => {
      screen.getByTestId('table-apply-all').click();
    });
    patch = onChange.mock.calls.at(-1)![0];
    expect(patch.sections.find((s: any) => s.id === 's4').table.borderStyle).toBe('horizontal');
  });

  it('inserts a table after the block the cursor is in, with the "Chèn" menu', async () => {
    const ref = { current: null as import('@tiptap/react').Editor | null };
    const onChange = vi.fn();
    const { container } = render(<PaperOverview paper={paper()} lang="vi" citationText="" onChange={onChange} openTab={vi.fn()} editorRef={ref} />);
    await waitFor(() => expect(container.querySelector('.ov-front-title')).not.toBeNull());
    // the cursor in the first heading
    let headingPos = -1;
    ref.current!.state.doc.descendants((node, pos) => {
      if (headingPos < 0 && node.type.name === 'heading') headingPos = pos;
      return headingPos < 0;
    });
    await act(async () => {
      ref.current!.commands.setTextSelection(headingPos + 1);
    });
    // the toolbar has no "Chèn" button (the right-click menu has it, and so does the "/" menu)
    expect(screen.queryByTestId('overview-insert')).toBeNull();
    expect(screen.queryByTestId('overview-block-kind')).toBeNull();
    fireEvent.contextMenu(container.querySelector('.ov-page')!, { clientX: 20, clientY: 20 });
    await act(async () => {
      (await screen.findByTestId('menu-insert')).click();
    });
    await act(async () => {
      (await screen.findByTestId('menu-ins-table')).click();
    });
    await act(async () => {
      ref.current!.commands.focus();
      await new Promise((r) => setTimeout(r, 400));
    });
    // a table with no text yet is still a table section, right after the heading
    ref.current!.commands.setTextSelection(ref.current!.state.doc.content.size - 1);
    expect(container.querySelectorAll('.ov-table-block').length).toBe(2);
    await waitFor(() => expect(onChange).toHaveBeenCalled(), { timeout: 2000 });
    const sections = onChange.mock.calls.at(-1)![0].sections;
    expect(sections.map((s: any) => s.type)).toEqual(['h1', 'table', 'paragraph', 'table']);
  });

  it('opens the "/" menu in an empty line and inserts a heading', async () => {
    const ref = { current: null as import('@tiptap/react').Editor | null };
    const onChange = vi.fn();
    const { container } = render(<PaperOverview paper={paper()} lang="vi" citationText="" onChange={onChange} openTab={vi.fn()} editorRef={ref} />);
    await waitFor(() => expect(container.querySelector('.ov-front-title')).not.toBeNull());
    await act(async () => {
      ref.current!.chain().focus().insertContentAt(ref.current!.state.doc.content.size, { type: 'paragraph', attrs: { sid: null }, content: [{ type: 'text', text: '/muc' }] }).run();
    });
    expect(await screen.findByTestId('slash-menu')).toBeDefined();
    expect(screen.getByTestId('slash-h1')).toBeDefined();
    expect(screen.queryByTestId('slash-table')).toBeNull();
    await act(async () => {
      screen.getByTestId('slash-h2').click();
    });
    // the menu fades out, then it is gone
    await waitFor(() => expect(screen.queryByTestId('slash-menu')).toBeNull());
    // the new heading takes the place of the empty line, at the end of the page
    const doc = ref.current!.state.doc;
    const last = doc.lastChild!;
    expect(last.type.name).toBe('heading');
    expect(last.attrs.level).toBe(2);
  });
});
