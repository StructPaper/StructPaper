// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, cleanup, waitFor, act } from '@testing-library/react';
import { createEmptyPaper, type CompletePaper } from '@/types/paper';
import { goToPdfPage, onGoToPdfPage } from '@/lib/editor/pdf-nav';

// what the PDF says: line by line, the page and the column each line was printed in
const pdf = vi.hoisted(() => ({ current: null as null | { lines: Array<{ page: number; col: 0 | 1 | 2; text: string }>; pageCount: number } }));
vi.mock('@/features/editor/overview/usePdfLines', () => ({
  usePdfLines: () => pdf.current,
}));

import { PaperOverview } from '@/features/editor/overview/PaperOverview';

afterEach(cleanup);

const LINES = { lines: [
  { page: 1, col: 0 as const, text: 'MỞ ĐẦU' },
  { page: 1, col: 0 as const, text: 'Đoạn một.' },
  { page: 2, col: 0 as const, text: 'Đoạn trên trang hai.' },
], pageCount: 2 };

const paper = (): CompletePaper => {
  const p = createEmptyPaper('VNUHCM-STD');
  p.sections = [
    { id: 's1', type: 'h1', title: 'Mở đầu', content: '' },
    { id: 's2', type: 'paragraph', content: 'Đoạn một.' },
    { id: 's3', type: 'paragraph', content: 'Đoạn trên trang hai.' },
  ];
  return p;
};

describe('the page and the PDF', () => {
  beforeEach(() => {
    pdf.current = LINES;
  });

  it('cuts the page into printed sheets before the block that starts a page, with the foot and the head', async () => {
    const p = paper();
    p.metadata.volume = '7';
    p.metadata.issue = '1';
    const { container } = render(<PaperOverview paper={p} lang="vi" citationText="A. Thử. 2026" compiledPdfUrl="blob:x" onChange={vi.fn()} openTab={vi.fn()} />);
    await waitFor(() => expect(container.querySelectorAll('.ov-pagegap').length).toBe(2));
    const gaps = container.querySelectorAll('.ov-pagegap');
    expect(gaps.length).toBe(2); // the one before page 2, and the end of the last sheet
    const brk = gaps[0];
    expect(brk.getAttribute('data-page')).toBe('2');
    expect(brk.nextElementSibling!.getAttribute('data-sid')).toBe('s3');
    // the foot of page 1 holds the "how to cite" strip and the page number; the head of page 2 the running header
    expect(brk.querySelector('.ov-cite-foot')!.textContent).toContain('A. Thử. 2026');
    expect(brk.querySelector('.ov-pageno')!.textContent).toBe('1');
    expect(brk.querySelector(".ov-head-text")!.textContent).toContain("(1):");
    expect(gaps[1].classList.contains('ov-pagegap-last')).toBe(true);
    expect(container.querySelector('.ov-page')!.getAttribute('data-paged')).toBe('true');
  });

  it('cuts a long table that runs the whole width between two of its rows, and a table in one column is left whole', async () => {
    const mk = (span: '1-column' | '2-column') => {
      const p = paper();
      p.sections = [
        {
          id: 't1',
          type: 'table',
          content: '',
          table: { id: 'tb', num: 1, caption: 'Bang dai', headers: ['A', 'B'], rows: [['r1a', 'r1b'], ['r2a', 'r2b'], ['r3a', 'r3b'], ['r4a', 'r4b']], columnSpan: span, isFullWidth: span === '2-column' },
        },
      ];
      return p;
    };
    pdf.current = {
      lines: [
        { page: 1, col: 0, text: 'Bang dai A B r1a r1b r2a r2b' },
        { page: 2, col: 0, text: 'r3a r3b r4a r4b' },
      ],
      pageCount: 2,
    };
    const ed = { current: null as import('@tiptap/react').Editor | null };
    const wide = render(<PaperOverview editorRef={ed} paper={mk('2-column')} lang="en" citationText="" compiledPdfUrl="blob:x" onChange={vi.fn()} openTab={vi.fn()} />);
    await waitFor(() => expect(wide.container.querySelectorAll('.ov-pagegap').length).toBe(2));
    await waitFor(() => expect(wide.container.querySelector('tr.ov-pagegap-row')).not.toBeNull());
    const gap = wide.container.querySelector('tr.ov-pagegap-row')!;
    // the gap is a row of its own between the second and the third row, with the foot and the head of the sheets
    const rows = Array.from(wide.container.querySelectorAll('tbody tr')).map((r) => r.textContent);
    expect(rows.findIndex((t) => t!.includes('r3a'))).toBe(Array.from(wide.container.querySelectorAll('tbody tr')).indexOf(gap) + 3); // after the "continued" line and the head again
    expect(gap.querySelector('.ov-pagegap')!.getAttribute('data-page')).toBe('2');
    // the next sheet starts as the PDF's does: "Table N continued", then the head of the table again
    const all = Array.from(wide.container.querySelectorAll('tbody tr'));
    expect(all[all.indexOf(gap) + 1].classList.contains('ov-continued-row')).toBe(true);
    expect(all[all.indexOf(gap) + 2].classList.contains('ov-repeat-head')).toBe(true);
    expect(all[all.indexOf(gap) + 2].textContent).toBe('AB');
    cleanup();
    const narrow = render(<PaperOverview paper={mk('1-column')} lang="en" citationText="" compiledPdfUrl="blob:x" onChange={vi.fn()} openTab={vi.fn()} />);
    await waitFor(() => expect(narrow.container.querySelectorAll('.ov-pagegap').length).toBeGreaterThan(0));
    expect(narrow.container.querySelector('tr.ov-pagegap-row')).toBeNull();
  });

  it('never cuts through a cell that spans down over the break: the sheet ends before the rows it begins at', async () => {
    const p = paper();
    p.sections = [
      {
        id: 't1',
        type: 'table',
        content: '',
        table: {
          id: 'tb', num: 1, caption: 'Bang dai', headers: ['A', 'B'], rows: [],
          columnSpan: '2-column', isFullWidth: true,
          headerRows: [[{ text: 'A', isHeader: true }, { text: 'B', isHeader: true }]],
          bodyRows: [
            [{ text: 'g', rowSpan: 3 }, { text: 'x1' }],
            [{ text: 'x2' }],
            [{ text: 'x3' }],
            [{ text: 'h' }, { text: 'x4' }],
          ],
        },
      },
    ];
    pdf.current = { lines: [{ page: 1, col: 0, text: 'Bang dai A B g x1 x2' }, { page: 2, col: 0, text: 'x3 h x4' }], pageCount: 2 };
    const { container } = render(<PaperOverview paper={p} lang="en" citationText="" compiledPdfUrl="blob:x" onChange={vi.fn()} openTab={vi.fn()} />);
    await waitFor(() => expect(container.querySelector('tr.ov-pagegap-row')).not.toBeNull());
    const rows = Array.from(container.querySelectorAll('tbody tr'));
    const gap = rows.indexOf(container.querySelector('tr.ov-pagegap-row')!);
    // the cell "g" spans the rows x1 to x3, so the break is before the row that holds it
    expect(rows[gap + 1].classList.contains('ov-continued-row')).toBe(true);
    expect(rows.slice(gap + 1).map((r) => r.textContent).join('|')).toContain('gx1');
    expect(rows.slice(0, gap).map((r) => r.textContent).join('|')).not.toContain('g');
  });

  it('breaks a page and a column in the middle of a paragraph, at the word where the PDF does', async () => {
    const p = paper();
    p.sections = [{ id: 'p1', type: 'paragraph', content: 'alpha beta gamma delta epsilon zeta eta theta iota kappa' }];
    pdf.current = {
      lines: [
        { page: 1, col: 0, text: 'alpha beta' },
        { page: 1, col: 1, text: 'gamma delta epsilon' },
        { page: 2, col: 0, text: 'zeta eta theta iota kappa' },
      ],
      pageCount: 2,
    };
    const { container } = render(<PaperOverview paper={p} lang="en" citationText="" compiledPdfUrl="blob:x" onChange={vi.fn()} openTab={vi.fn()} />);
    await waitFor(() => expect(container.querySelectorAll('.ov-pagegap').length).toBe(2));
    const para = container.querySelector('[data-sid="p1"]')!;
    // the page break and the column break are inside the paragraph, which is set line by line and keeps its last line unspread
    expect(para.querySelector('.ov-colbreak')).not.toBeNull();
    expect(para.querySelector('.ov-pagegap')).not.toBeNull();
    expect(para.classList.contains('ov-cut')).toBe(true);
    expect(para.querySelector('.ov-tail')).not.toBeNull();
  });

  it('sets a paragraph the PDF printed line by line, and lets it flow again once the author edits it', async () => {
    const p = paper();
    p.sections = [
      { id: 'p1', type: 'paragraph', content: 'alpha beta gamma delta epsilon zeta eta theta iota kappa' },
      { id: 'p2', type: 'paragraph', content: 'lambda mu nu xi omicron pi rho sigma tau upsilon' },
    ];
    pdf.current = {
      lines: [
        { page: 1, col: 0, text: 'alpha beta gamma' },
        { page: 1, col: 0, text: 'delta epsilon zeta' },
        { page: 1, col: 0, text: 'eta theta iota kappa' },
        { page: 1, col: 0, text: 'lambda mu nu xi' },
        { page: 1, col: 0, text: 'omicron pi rho sigma tau upsilon' },
      ],
      pageCount: 1,
    };
    const ref = { current: null as import('@tiptap/react').Editor | null };
    const { container } = render(<PaperOverview paper={p} lang="en" citationText="" compiledPdfUrl="blob:x" onChange={vi.fn()} openTab={vi.fn()} editorRef={ref} />);
    await waitFor(() => expect(container.querySelectorAll('[data-sid="p1"] .ov-lb').length).toBe(2));
    expect(container.querySelectorAll('[data-sid="p2"] .ov-lb').length).toBe(1);
    expect(container.querySelector('[data-sid="p1"]')!.classList.contains('ov-pinned')).toBe(true);
    // typing in the first paragraph takes its lines away; the second keeps them
    await act(async () => {
      let at = -1;
      ref.current!.state.doc.descendants((n, pos) => {
        if (at < 0 && n.attrs?.sid === 'p1') at = pos;
        return at < 0;
      });
      ref.current!.chain().focus().setTextSelection(at + 3).insertContent('X').run();
    });
    await waitFor(() => expect(container.querySelectorAll('[data-sid="p1"] .ov-lb').length).toBe(0));
    expect(container.querySelectorAll('[data-sid="p2"] .ov-lb').length).toBe(1);
  });

  it('keeps a page of one column in the first column', async () => {
    const p = paper();
    p.sections = [{ id: 'p1', type: 'paragraph', content: 'alpha beta gamma delta epsilon zeta' }];
    pdf.current = {
      lines: [
        { page: 1, col: 0, text: 'alpha beta gamma delta epsilon zeta' },
      ],
      pageCount: 1,
    };
    const { container } = render(<PaperOverview paper={p} lang="en" citationText="" compiledPdfUrl="blob:x" onChange={vi.fn()} openTab={vi.fn()} />);
    await waitFor(() => expect(container.querySelector('.ov-colbreak')).not.toBeNull());
    expect(container.querySelectorAll('.ov-pagegap').length).toBe(1);
  });

  it('draws the head of the first page and the column of contact details on the left', async () => {
    const p = paper();
    p.metadata.corresponding = { name: 'Nguyễn Văn A', email: 'a@x.vn', affiliation: 'ĐHQG' };
    const { container } = render(<PaperOverview paper={p} lang="vi" citationText="" compiledPdfUrl="blob:x" onChange={vi.fn()} openTab={vi.fn()} />);
    await waitFor(() => expect(container.querySelector('.ov-p1-head')).not.toBeNull());
    expect(container.querySelector('.ov-rail')!.textContent).toContain('Liên hệ');
    expect(container.querySelector('.ov-rail')!.textContent).toContain('a@x.vn');
    expect(container.querySelector('.ov-qr svg')).not.toBeNull();
  });

  it('labels the contact details in English on an English page', async () => {
    const { container } = render(<PaperOverview paper={paper()} lang="en" citationText="" compiledPdfUrl="blob:x" onChange={vi.fn()} openTab={vi.fn()} />);
    await waitFor(() => expect(container.querySelector('.ov-rail')).not.toBeNull());
    expect(container.querySelector('.ov-rail')!.textContent).toContain('Correspondence');
  });

  it('turns the preview to the page of the block the cursor moves into', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const ref = { current: null as import('@tiptap/react').Editor | null };
    const asked: number[] = [];
    const off = onGoToPdfPage((p) => asked.push(p));
    const { container } = render(<PaperOverview paper={paper()} lang="vi" citationText="" compiledPdfUrl="blob:x" onChange={vi.fn()} openTab={vi.fn()} editorRef={ref} />);
    await waitFor(() => expect(container.querySelectorAll('.ov-pagegap').length).toBe(2));
    let pos = -1;
    ref.current!.state.doc.descendants((n, p) => {
      if (pos < 0 && n.attrs?.sid === 's3') pos = p;
      return pos < 0;
    });
    await act(async () => {
      ref.current!.commands.setTextSelection(pos + 2);
      vi.advanceTimersByTime(400);
    });
    expect(asked).toEqual([2]);
    off();
    vi.useRealTimers();
  });

  it('scrolls to and marks the block the preview pointed at', async () => {
    const p = paper();
    const { container, rerender } = render(<PaperOverview paper={p} lang="vi" citationText="" compiledPdfUrl="blob:x" onChange={vi.fn()} openTab={vi.fn()} />);
    await waitFor(() => expect(container.querySelector('[data-sid="s2"]')).not.toBeNull());
    const el = container.querySelector('[data-sid="s2"]') as HTMLElement;
    el.scrollIntoView = vi.fn();
    await act(async () => {
      rerender(<PaperOverview paper={p} lang="vi" citationText="" compiledPdfUrl="blob:x" focusRequest={{ id: 's2', n: 1 }} onChange={vi.fn()} openTab={vi.fn()} />);
    });
    expect(el.scrollIntoView).toHaveBeenCalled();
    expect(el.classList.contains('ov-flash')).toBe(true);
  });
});

describe('the page request bus', () => {
  it('reaches whoever listens, and ignores a page that is not a page', () => {
    const got: number[] = [];
    const off = onGoToPdfPage((p) => got.push(p));
    goToPdfPage(3);
    goToPdfPage(0);
    goToPdfPage(NaN);
    goToPdfPage(4.7);
    off();
    goToPdfPage(9);
    expect(got).toEqual([3, 4]);
  });
});
