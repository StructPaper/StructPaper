// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor, act, fireEvent } from '@testing-library/react';
import type { Editor } from '@tiptap/react';
import { PaperOverview } from '@/features/editor/overview/PaperOverview';
import { convertBlock, deleteBlock, duplicateBlock, moveBlock, canMove, currentBlock } from '@/features/editor/overview/overview-commands';
import { createEmptyPaper, type CompletePaper } from '@/types/paper';

afterEach(cleanup);

const paper = (): CompletePaper => {
  const p = createEmptyPaper('VNUHCM-STD');
  p.sections = [
    { id: 'h', type: 'h1', title: 'Mở đầu', content: '' },
    { id: 'a', type: 'paragraph', content: 'Đoạn A' },
    { id: 'b', type: 'paragraph', content: 'Đoạn B' },
    { id: 'c', type: 'h2', title: 'Mục con', content: 'Dưới mục con' },
  ];
  return p;
};

async function open() {
  const ref = { current: null as Editor | null };
  const onChange = vi.fn();
  const { container } = render(<PaperOverview paper={paper()} lang="vi" citationText="" onChange={onChange} openTab={vi.fn()} editorRef={ref} />);
  await waitFor(() => expect(container.querySelector('.ov-front-title')).not.toBeNull());
  const into = async (sid: string) => {
    let pos = -1;
    ref.current!.state.doc.descendants((n, p) => {
      if (pos < 0 && n.attrs?.sid === sid) pos = p;
      return pos < 0;
    });
    await act(async () => {
      ref.current!.commands.setTextSelection(pos + 2);
    });
  };
  const last = () => onChange.mock.calls.at(-1)![0].sections as Array<{ id: string; type: string; title?: string; content: string }>;
  const flushed = async () => {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 300));
    });
  };
  return { ref, container, onChange, into, last, flushed };
}

describe('commands on a block of the page', () => {
  it('turns a paragraph into a heading and back into a paragraph', async () => {
    const t = await open();
    await t.into('a');
    expect(currentBlock(t.ref.current!)!.kind).toBe('paragraph');
    await act(async () => void convertBlock(t.ref.current!, 'h2'));
    await t.flushed();
    let a = t.last().find((s) => s.id === 'a')!;
    expect(a).toMatchObject({ type: 'h2', title: 'Đoạn A', content: '' });
    await act(async () => void convertBlock(t.ref.current!, 'quote'));
    await t.flushed();
    a = t.last().find((s) => s.id === 'a')!;
    expect(a).toMatchObject({ type: 'quote', content: 'Đoạn A' });
    expect(a.title).toBeUndefined();
  });

  it('turns a heading into a paragraph without losing the text under it', async () => {
    const t = await open();
    await t.into('c');
    expect(currentBlock(t.ref.current!)!.kind).toBe('h2');
    await act(async () => void convertBlock(t.ref.current!, 'paragraph'));
    await t.flushed();
    const secs = t.last();
    expect(secs.find((s) => s.id === 'c')).toMatchObject({ type: 'paragraph', content: 'Mục con' });
    // the text that was written under the heading is still there, as its own paragraph
    expect(secs.some((s) => s.content === 'Dưới mục con')).toBe(true);
  });

  it('moves a block up and down, and a heading takes the text under it along', async () => {
    const t = await open();
    await t.into('b');
    expect(canMove(t.ref.current!, 1)).toBe(true);
    await act(async () => void moveBlock(t.ref.current!, -1));
    await t.flushed();
    expect(t.last().map((s) => s.id)).toEqual(['h', 'b', 'a', 'c']);
    await t.into('c');
    expect(canMove(t.ref.current!, 1)).toBe(false); // the last one
    await act(async () => void moveBlock(t.ref.current!, -1));
    await t.flushed();
    expect(t.last().map((s) => s.id)).toEqual(['h', 'b', 'c', 'a']);
    expect(t.last().find((s) => s.id === 'c')!.content).toBe('Dưới mục con');
  });

  it('duplicates and deletes a block', async () => {
    const t = await open();
    await t.into('a');
    await act(async () => void duplicateBlock(t.ref.current!));
    await t.flushed();
    let secs = t.last();
    expect(secs.map((s) => s.content || s.title)).toEqual(['Mở đầu', 'Đoạn A', 'Đoạn A', 'Đoạn B', 'Dưới mục con']);
    expect(new Set(secs.map((s) => s.id)).size).toBe(secs.length);
    await t.into('b');
    await act(async () => void deleteBlock(t.ref.current!));
    await t.flushed();
    secs = t.last();
    expect(secs.some((s) => s.id === 'b')).toBe(false);
  });
});

describe('the right-click menu', () => {
  it('opens on the block under the pointer and converts it', async () => {
    const t = await open();
    await t.into('a');
    const page = t.container.querySelector('.ov-page')!;
    fireEvent.contextMenu(page, { clientX: 200, clientY: 200 });
    expect(await screen.findByTestId('overview-context-menu')).toBeDefined();
    expect(screen.getByTestId('menu-cut')).toBeDefined();
    expect(screen.getByTestId('menu-bold')).toBeDefined();
    await act(async () => {
      screen.getByTestId('menu-convert').click();
    });
    await act(async () => {
      screen.getByTestId('menu-to-h2').click();
    });
    await t.flushed();
    expect(t.last().find((s) => s.id === 'a')!.type).toBe('h2');
    expect(screen.queryByTestId('overview-context-menu')).toBeNull();
  });

  it('opens a group in a panel beside its item when the pointer is over it, and closes it when the pointer leaves', async () => {
    const t = await open();
    await t.into('a');
    fireEvent.contextMenu(t.container.querySelector('.ov-page')!, { clientX: 200, clientY: 200 });
    await screen.findByTestId('overview-context-menu');
    expect(screen.queryByTestId('flyout-convert')).toBeNull();
    // over the item: its group opens beside it, not under it
    fireEvent.mouseEnter(screen.getByTestId('menu-convert'));
    const fly = await screen.findByTestId('flyout-convert');
    expect(fly.getAttribute('data-overview-flyout')).not.toBeNull();
    expect(fly.querySelector('[data-testid="menu-to-h1"]')).not.toBeNull();
    expect(screen.getByTestId('overview-context-menu').contains(fly)).toBe(false);
    // the pointer reaches the panel and moves over its items: the panel stays
    fireEvent.mouseLeave(screen.getByTestId('menu-convert'));
    fireEvent.mouseEnter(fly);
    fireEvent.mouseEnter(screen.getByTestId('menu-to-h1'));
    await new Promise((r) => setTimeout(r, 600));
    expect(screen.queryByTestId('flyout-convert')).not.toBeNull();
    // over another item: the group makes way for that item's own
    fireEvent.mouseEnter(screen.getByTestId('menu-insert'));
    await screen.findByTestId('flyout-insert');
    await waitFor(() => expect(screen.queryByTestId('flyout-convert')).toBeNull());
    // pointer away: closed after a moment
    fireEvent.mouseLeave(screen.getByTestId('menu-insert'));
    await waitFor(() => expect(screen.queryByTestId('flyout-insert')).toBeNull(), { timeout: 2000 });
    // a click in the panel does what its item says
    fireEvent.mouseEnter(screen.getByTestId('menu-convert'));
    await screen.findByTestId('flyout-convert');
    await act(async () => {
      screen.getByTestId('menu-to-h3').click();
    });
    await t.flushed();
    expect(t.last().find((s) => s.id === 'a')!.type).toBe('h3');
  });

  it('offers table commands inside a table and closes with Escape', async () => {
    const p = paper();
    p.sections.push({ id: 't', type: 'table', content: '', table: { id: 't1', num: 1, caption: 'B', headers: ['A', 'B'], rows: [['1', '2']] } });
    const ref = { current: null as Editor | null };
    const { container } = render(<PaperOverview paper={p} lang="vi" citationText="" onChange={vi.fn()} openTab={vi.fn()} editorRef={ref} />);
    await waitFor(() => expect(container.querySelector('table')).not.toBeNull());
    let pos = -1;
    ref.current!.state.doc.descendants((n, ps) => {
      if (pos < 0 && n.type.name === 'tableCell') pos = ps;
      return pos < 0;
    });
    await act(async () => {
      ref.current!.commands.setTextSelection(pos + 2);
    });
    fireEvent.contextMenu(container.querySelector('.ov-page')!, { clientX: 10, clientY: 10 });
    expect(await screen.findByTestId('menu-row-down')).toBeDefined();
    expect(screen.getByTestId('menu-merge')).toBeDefined();
    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByTestId('overview-context-menu')).toBeNull());
  });
});
