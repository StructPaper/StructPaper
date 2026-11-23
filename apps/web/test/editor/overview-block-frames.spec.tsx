// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, waitFor, act, fireEvent } from '@testing-library/react';
import type { Editor } from '@tiptap/react';
import { PaperOverview } from '@/features/editor/overview/PaperOverview';
import { POPUP_TOP } from '@/lib/popup-bounds';
import { createEmptyPaper, type CompletePaper } from '@/types/paper';

afterEach(cleanup);
vi.setConfig({ testTimeout: 20000 });

const PIXEL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

function paper(extra: { source?: string; colWeights?: number[]; sourceStyle?: { bold?: boolean; italic?: boolean; align?: 'left' | 'center' | 'right' } } = {}): CompletePaper {
  const p = createEmptyPaper('VNUHCM-STD');
  p.metadata.title = 'Tiêu đề';
  p.sections = [
    { id: 's1', type: 'paragraph', content: 'Một đoạn văn.' },
    {
      id: 's2',
      type: 'table',
      content: '',
      table: { id: 't1', num: 1, caption: 'Bảng thử', headers: ['A', 'B'], rows: [['1', '2']], columnSpan: '1-column', isFullWidth: false, source: extra.source ?? 'Nguồn: Tác giả', ...(extra.colWeights ? { colWeights: extra.colWeights } : {}), ...(extra.sourceStyle ? { sourceStyle: extra.sourceStyle } : {}) },
    },
    { id: 's3', type: 'figure', content: '', figure: { id: 'f1', num: 1, caption: 'Hình thử', src: PIXEL } },
  ];
  return p;
}

/** The page with a paper that takes back what the page changes, as the editor does. */
const Host: React.FC<{ initial: CompletePaper; onChange: (patch: Partial<CompletePaper>) => void; editorRef: { current: Editor | null } }> = ({ initial, onChange, editorRef }) => {
  const [p, setP] = React.useState(initial);
  return (
    <PaperOverview
      paper={p}
      lang="vi"
      citationText=""
      openTab={vi.fn()}
      editorRef={editorRef}
      onChange={(patch) => {
        onChange(patch);
        setP((prev) => ({ ...prev, ...patch }));
      }}
    />
  );
};

async function open(p = paper()) {
  const ref = { current: null as Editor | null };
  const onChange = vi.fn();
  const view = render(<Host initial={p} onChange={onChange} editorRef={ref} />);
  await waitFor(() => expect(view.container.querySelector('table')).not.toBeNull());
  const find = (pred: (n: import('@tiptap/pm/model').Node) => boolean) => {
    let pos = -1;
    ref.current!.state.doc.descendants((n, ps) => {
      if (pos < 0 && pred(n)) pos = ps;
      return pos < 0;
    });
    return pos;
  };
  const into = async (pos: number) => {
    await act(async () => {
      ref.current!.commands.setTextSelection(pos);
    });
  };
  const flushed = async () => {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 300));
    });
  };
  const last = () => onChange.mock.calls.at(-1)![0].sections as Array<{ id: string; table?: any }>;
  return { ref, onChange, container: view.container, find, into, flushed, last };
}

describe('the toolbar of the overview', () => {
  it('has no undo and redo of its own: the title bar has them for every tab', async () => {
    await open();
    expect(screen.queryByTitle('Hoàn tác (Ctrl+Z)')).toBeNull();
    expect(screen.queryByTitle('Làm lại (Ctrl+Y)')).toBeNull();
  });
});

describe('the lines under a table, on the page', () => {
  it('Enter starts a new line, and the lines are kept one under the other', async () => {
    const t = await open();
    const at = t.find((n) => n.type.name === 'tableSource');
    const end = at + 1 + t.ref.current!.state.doc.nodeAt(at)!.content.size;
    await t.into(end);
    await act(async () => {
      t.ref.current!.commands.splitBlock();
      t.ref.current!.commands.insertContent('Chú thích: ghi thêm');
    });
    expect(t.container.querySelectorAll('.ov-tab-source')).toHaveLength(2);
    await t.flushed();
    expect(t.last().find((s) => s.id === 's2')!.table.source).toBe('Nguồn: Tác giả\nChú thích: ghi thêm');
  });

  it('a note line is marked to be set in italic, a source line is not', async () => {
    const t = await open(paper({ source: 'Chú thích: a\nNguồn: b' }));
    const lines = Array.from(t.container.querySelectorAll('.ov-tab-source'));
    expect(lines).toHaveLength(2);
    expect(lines[0].classList.contains('ov-src-note')).toBe(true);
    expect(lines[1].classList.contains('ov-src-note')).toBe(false);
  });

  it('shows how they are set on the table block, as the author chose', async () => {
    const t = await open(paper({ sourceStyle: { bold: true, italic: true, align: 'center' } }));
    const block = t.container.querySelector('.ov-table-block')!;
    expect(block.getAttribute('data-src-bold')).toBe('true');
    expect(block.getAttribute('data-src-italic')).toBe('true');
    expect(block.getAttribute('data-src-align')).toBe('center');
    cleanup();
    const plain = await open();
    const b2 = plain.container.querySelector('.ov-table-block')!;
    expect(b2.getAttribute('data-src-bold')).toBeNull();
    expect(b2.getAttribute('data-src-italic')).toBeNull();
    expect(b2.getAttribute('data-src-align')).toBeNull();
  });

  it('has its own tools only while the cursor is in them, and they set the whole block', async () => {
    const t = await open();
    // in a cell: the table tools, not those of the lines under it
    await t.into(t.find((n) => n.type.name === 'tableHeader') + 2);
    expect(await screen.findByTestId('overview-table-tools')).toBeDefined();
    expect(screen.queryByTestId('overview-source-tools')).toBeNull();
    // in the line under the table: the tools for those lines appear, beside the others
    await t.into(t.find((n) => n.type.name === 'tableSource') + 2);
    expect(await screen.findByTestId('overview-source-tools')).toBeDefined();
    await act(async () => {
      screen.getByTestId('overview-source-italic').click();
    });
    expect(t.last().find((s) => s.id === 's2')!.table.sourceStyle).toEqual({ italic: true });
    await act(async () => {
      screen.getByTestId('overview-source-center').click();
    });
    expect(t.last().find((s) => s.id === 's2')!.table.sourceStyle).toEqual({ italic: true, align: 'center' });
    await act(async () => {
      screen.getByTestId('overview-source-bold').click();
    });
    expect(t.last().find((s) => s.id === 's2')!.table.sourceStyle).toEqual({ italic: true, align: 'center', bold: true });
  });
});

describe('a table whose columns were dragged', () => {
  it('can be given back the widths and heights it has without any dragging, from the right-click menu', async () => {
    const t = await open(paper({ colWeights: [0.8, 0.2] }));
    await t.into(t.find((n) => n.type.name === 'tableHeader') + 2);
    fireEvent.contextMenu(t.container.querySelector('.ov-page')!, { clientX: 20, clientY: 20 });
    const item = await screen.findByTestId('menu-reset-size');
    expect((item as HTMLButtonElement).disabled).toBe(false);
    await act(async () => {
      item.click();
    });
    const table = t.last().find((s) => s.id === 's2')!.table;
    expect(table.colWeights).toBeUndefined();
    expect(table.rowHeights).toBeUndefined();
  });

  it('has nothing to give back when nothing was dragged', async () => {
    const t = await open();
    await t.into(t.find((n) => n.type.name === 'tableHeader') + 2);
    fireEvent.contextMenu(t.container.querySelector('.ov-page')!, { clientX: 20, clientY: 20 });
    expect(((await screen.findByTestId('menu-reset-size')) as HTMLButtonElement).disabled).toBe(true);
  });

  it('is never drawn wider than its box, however the widths were saved', async () => {
    // the widths come from shares of the table's own box, and the view shows them as shares of it
    const t = await open(paper({ colWeights: [0.7, 0.3] }));
    const table = t.container.querySelector('.ov-table-block table') as HTMLElement;
    expect(table.style.width).toBe('100%');
    const cols = Array.from(table.querySelectorAll('col')) as HTMLElement[];
    const shares = cols.map((c) => parseFloat(c.style.width));
    expect(shares[0]).toBeCloseTo(70, 0);
    expect(shares[1]).toBeCloseTo(30, 0);
    expect(shares[0] + shares[1]).toBeCloseTo(100, 5);
  });
});

describe('choosing a block by clicking anywhere on it', () => {
  it('a click on the picture of a figure puts the cursor in the figure, so its tools show', async () => {
    const t = await open();
    expect(screen.queryByTestId('overview-figure-tools')).toBeNull();
    const img = t.container.querySelector('.ov-figure-frame img')!;
    await act(async () => {
      fireEvent.mouseDown(img, { button: 0 });
    });
    expect(await screen.findByTestId('overview-figure-tools')).toBeDefined();
  });
});

describe('the frames over the page', () => {
  beforeEach(() => {
    // the blocks have a place on the screen (the test document has none)
    vi.spyOn(HTMLElement.prototype, 'getClientRects').mockImplementation(function (this: HTMLElement) {
      const r = { left: 40, top: 60, width: 200, height: 30, right: 240, bottom: 90, x: 40, y: 60, toJSON: () => ({}) } as DOMRect;
      return [r] as unknown as DOMRectList;
    });
  });
  afterEach(() => vi.restoreAllMocks());

  it('frames the block under the pointer, and no other', async () => {
    const t = await open();
    const para = t.container.querySelector('p[data-sid="s1"]')!;
    expect(screen.getByTestId('overview-frames').querySelectorAll('.ov-frame')).toHaveLength(0);
    await act(async () => {
      fireEvent.mouseMove(para);
      await new Promise((r) => requestAnimationFrame(() => r(null)));
    });
    await waitFor(() => expect(screen.getByTestId('overview-frames').querySelectorAll('[data-kind="hover"]')).toHaveLength(1));
    // the pointer leaves the page: the frame goes
    await act(async () => {
      fireEvent.mouseLeave(t.container.querySelector('.ov-root')!);
      await new Promise((r) => requestAnimationFrame(() => r(null)));
    });
    await waitFor(() => expect(screen.getByTestId('overview-frames').querySelectorAll('[data-kind="hover"]')).toHaveLength(0));
  });

  it('frames the table the cursor is in, and says what it is', async () => {
    const t = await open();
    await act(async () => {
      t.ref.current!.commands.focus();
    });
    await t.into(t.find((n) => n.type.name === 'tableHeader') + 2);
    await waitFor(() => expect(screen.getByTestId('overview-frames').querySelectorAll('[data-kind="selected"]')).toHaveLength(1));
    expect(screen.getByTestId('overview-frames').querySelector('.ov-frame-tag')!.textContent).toBe('Bảng');
  });
});

describe('a menu taller than the window', () => {
  it('stays under the title bar and scrolls inside itself', async () => {
    Object.defineProperty(window, 'innerHeight', { value: 600, configurable: true });
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      return { left: 0, top: 0, width: 270, height: 900, right: 270, bottom: 900, x: 0, y: 0, toJSON: () => ({}) } as DOMRect;
    });
    const t = await open();
    await t.into(t.find((n) => n.type.name === 'tableHeader') + 2);
    fireEvent.contextMenu(t.container.querySelector('.ov-page')!, { clientX: 20, clientY: 0 });
    const menu = (await screen.findByTestId('overview-context-menu')) as HTMLElement;
    await waitFor(() => expect(menu.style.top).toBe(`${POPUP_TOP}px`));
    expect(menu.style.maxHeight).toBe(`${600 - POPUP_TOP - 8}px`);
    vi.restoreAllMocks();
    Object.defineProperty(window, 'innerHeight', { value: 768, configurable: true });
  });
});

describe('lists and footnotes on the page', () => {
  it('draws an item with its mark hanging, and Enter at its end starts the next item', async () => {
    const p = paper();
    p.sections = [{ id: 'l1', type: 'paragraph', content: '• Mục một' }, { id: 'tz', type: 'table', content: '', table: { id: 'tz', num: 9, caption: 'x', headers: ['A'], rows: [['1']] } }];
    const t = await open(p);
    expect(t.container.querySelector('p[data-sid="l1"]')!.classList.contains('ov-li')).toBe(true);
    const at = t.find((n) => n.type.name === 'paragraph' && n.textContent === '• Mục một');
    await t.into(at + 1 + '• Mục một'.length);
    await act(async () => {
      fireEvent.keyDown(t.container.querySelector('.ProseMirror')!, { key: 'Enter', code: 'Enter' });
    });
    await t.flushed();
    const texts = t.ref.current!.state.doc.content.toJSON().filter((n: any) => n.type === 'paragraph').map((n: any) => (n.content ?? []).map((c: any) => c.text).join(''));
    expect(texts).toContain('• Mục một');
    expect(texts).toContain('• ');
  });

  it('shows a footnote as a number in the text, and the right-click menu inserts one', async () => {
    const p = paper();
    p.sections = [{ id: 'f1', type: 'paragraph', content: 'Anh là Animus[[fn: Animus là một khái niệm.]] hết.' }, { id: 'tz', type: 'table', content: '', table: { id: 'tz', num: 9, caption: 'x', headers: ['A'], rows: [['1']] } }];
    const t = await open(p);
    expect(t.container.querySelectorAll('.ov-fn-mark')).toHaveLength(1);
    expect(t.container.querySelector('.ov-fn')!.getAttribute('title')).toBe('Animus là một khái niệm.');
    await t.into(t.find((n) => n.type.name === 'paragraph') + 3);
    fireEvent.contextMenu(t.container.querySelector('.ov-page')!, { clientX: 20, clientY: 20 });
    await act(async () => {
      (await screen.findByTestId('menu-footnote')).click();
    });
    // the note is written in a dialog, like the others that put something into the text
    const box = (await screen.findByLabelText('Nội dung chú thích chân trang')) as HTMLTextAreaElement;
    await act(async () => {
      fireEvent.change(box, { target: { value: 'Ghi chú mới' } });
    });
    await act(async () => {
      screen.getByRole('button', { name: 'Chèn' }).click();
    });
    await waitFor(() => expect(t.container.querySelectorAll('.ov-fn-mark')).toHaveLength(2));
  });
});

describe('references to tables and figures on the page', () => {
  it('are a label with the number of the block, in a paragraph and in a caption alike', async () => {
    const p = paper();
    p.sections = [
      { id: 'p1', type: 'paragraph', content: 'Xem [[tbl:t1]] và [[fig:f1]].' },
      { id: 'sx', type: 'table', content: '', table: { id: 't1', num: 1, caption: 'Bảng một, cũng như [[fig:f1]]', headers: ['A'], rows: [['1']], source: 'Nguồn: [[tbl:t1]]' } },
      { id: 'sf', type: 'figure', content: '', figure: { id: 'f1', num: 1, caption: 'Hình', src: PIXEL } },
    ];
    const t = await open(p);
    const labels = Array.from(t.container.querySelectorAll('.ov-xref')).map((e) => e.textContent);
    expect(labels).toEqual(['Bảng 1', 'Hình 1', 'Hình 1', 'Bảng 1']);
    // the dialog puts a reference into a caption too
    await t.into(t.find((n) => n.type.name === 'tableSource') + 1);
    fireEvent.contextMenu(t.container.querySelector('.ov-page')!, { clientX: 20, clientY: 20 });
    await act(async () => {
      (await screen.findByTestId('menu-ins-xref')).click();
    });
    await act(async () => {
      (await screen.findByTestId('xref-figure-1')).click();
    });
    await waitFor(() => expect(t.container.querySelectorAll('.ov-xref')).toHaveLength(5));
    await t.flushed();
    expect(t.last().find((x) => x.id === 'sx')!.table.source).toContain('[[fig:f1]]');
  });
});
