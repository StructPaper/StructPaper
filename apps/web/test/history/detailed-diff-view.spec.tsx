// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react';
import { DetailedDiffView } from '@/features/history/components/DetailedDiffView';
import { blockSettingChanges } from '@/features/history/lib/block-settings';

afterEach(cleanup);

const table = (over: Record<string, any> = {}) => ({ id: 't1', type: 'table', table: { num: 1, caption: 'Kết quả', headers: ['A'], rows: [['1']], ...over } });
const doc = (over: Record<string, any> = {}): any => ({
  metadata: { title: 'Tiêu đề', authors: [{ id: 'a1', name: 'An' }], affiliations: [], abstract: 'Tóm tắt cũ', keywords: [] },
  sections: [{ id: 'p1', type: 'paragraph', content: 'Đoạn văn' }, table()],
  references: [],
  layoutSettings: {},
  ...over,
});

describe('what changed in how a block is set', () => {
  it('lists a table\'s settings that changed, with what they were and what they became', () => {
    const changes = blockSettingChanges(table(), table({ isRotated: true, columnSpan: '1-column', fontSize: '10pt' }));
    expect(changes).toEqual(
      expect.arrayContaining([
        { label: 'Hướng bảng', from: 'Hướng dọc', to: 'Hướng ngang (xoay 90°)' },
        { label: 'Số cột của bảng', from: '2 cột', to: '1 cột' },
        { label: 'Cỡ chữ bảng', from: 'Chữ 8pt', to: 'Chữ 10pt' },
      ]),
    );
  });

  it('lists the page layout started at a block and a page break after it', () => {
    const a = { id: 'p1', type: 'paragraph', content: 'x' };
    const b = { ...a, pageLayout: { orientation: 'landscape', columns: '1-column' }, pageBreakAfter: true };
    expect(blockSettingChanges(a, b)).toEqual([
      { label: 'Bố cục trang', from: 'Mặc định', to: 'Trang mới · 1 cột · Ngang' },
      { label: 'Ngắt trang sau khối', from: 'Không', to: 'Có' },
    ]);
  });

  it('says nothing when only the text changed', () => {
    expect(blockSettingChanges(table(), table({ rows: [['2']] }))).toEqual([]);
  });
});

describe('the detailed way of reading a version', () => {
  it('has the editor\'s tabs and one for the page layout, and counts the changes in each', () => {
    const before = doc();
    const after = doc({
      metadata: { title: 'Tiêu đề mới', authors: [{ id: 'a1', name: 'An' }], affiliations: [], abstract: 'Tóm tắt cũ', keywords: [] },
      sections: [{ id: 'p1', type: 'paragraph', content: 'Đoạn văn' }, table({ isRotated: true })],
      layoutSettings: { columnLayout: '1-column' },
    });
    render(<DetailedDiffView doc={after} compareTo={before} showChanges />);
    for (const key of ['metadata', 'authors', 'abstract', 'sections', 'refs', 'citation', 'layout']) expect(screen.getByTestId(`detail-tab-${key}`)).toBeTruthy();
    expect(screen.getByTestId('detail-count-metadata').textContent).toBe('1');
    expect(screen.getByTestId('detail-count-sections').textContent).toBe('1');
    // the layout tab counts the paper's own layout settings; a table's settings are in the content tab
    expect(screen.getByTestId('detail-count-layout').textContent).toBe('1');
    expect(screen.queryByTestId('detail-count-abstract')).toBeNull();
  });

  it('shows a changed field as before and after', () => {
    render(<DetailedDiffView doc={doc({ metadata: { ...doc().metadata, title: 'Tiêu đề mới' } })} compareTo={doc()} showChanges />);
    const panel = screen.getByTestId('detail-panel-metadata');
    // laid out like the editor's metadata tab: its heading and labels, the new value in the box and the old one under it
    expect(panel.textContent).toContain('Thông tin cơ bản bài báo & Xuất bản');
    expect(panel.textContent).toContain('Tựa đề bài báo (Tiếng Việt):');
    expect(screen.getByTestId('before-value').textContent).toContain('Tiêu đề');
    expect(panel.textContent).toContain('Tiêu đề mới');
  });

  it('lists the settings of a table in the content tab and what changed', () => {
    const after = doc({ sections: [{ id: 'p1', type: 'paragraph', content: 'Đoạn văn' }, table({ isRotated: true })] });
    render(<DetailedDiffView doc={after} compareTo={doc()} showChanges />);
    fireEvent.click(screen.getByTestId('detail-tab-sections'));
    const chips = screen.getByTestId('block-settings-t1');
    expect(within(chips).getByTestId('setting-orientation').textContent).toContain('Hướng ngang');
    expect(screen.getByTestId('setting-changes').textContent).toContain('Hướng bảng');
  });

  it("the layout tab holds only the paper's layout settings (the blocks' settings are in the content tab)", () => {
    const after = doc({ layoutSettings: { columnLayout: '1-column' }, sections: [{ id: 'f1', type: 'figure', figure: { num: 1, caption: 'Sơ đồ', scalePercent: 60 } }] });
    render(<DetailedDiffView doc={after} compareTo={null} showChanges={false} />);
    fireEvent.click(screen.getByTestId('detail-tab-layout'));
    expect(screen.getByTestId('doc-layout').textContent).toContain('1-column');
    expect(screen.queryByTestId('doc-block-settings')).toBeNull();
    expect(screen.getByTestId('detail-panel-layout').textContent).not.toContain('Kích thước 60%');
    fireEvent.click(screen.getByTestId('detail-tab-sections'));
    expect(screen.getByTestId('detail-panel-sections').textContent).toContain('Kích thước 60%');
  });
  it('without changes marked the tabs show how much they hold', () => {
    render(<DetailedDiffView doc={doc()} compareTo={null} showChanges={false} />);
    expect(screen.getByTestId('detail-count-authors').textContent).toBe('1');
    expect(screen.getByTestId('detail-count-sections').textContent).toBe('2');
    expect(screen.queryByTestId('detail-summary')).toBeNull();
  });
});

describe('walking through the changes', () => {
  const changed = () => {
    const before = doc({ sections: [{ id: 'p1', type: 'paragraph', content: 'Một' }, { id: 'p2', type: 'paragraph', content: 'Hai' }, { id: 'p3', type: 'paragraph', content: 'Ba' }] });
    const after = doc({
      metadata: { ...doc().metadata, title: 'Tiêu đề mới' },
      sections: [{ id: 'p1', type: 'paragraph', content: 'Một sửa' }, { id: 'p2', type: 'paragraph', content: 'Hai' }, { id: 'p3', type: 'paragraph', content: 'Ba sửa' }],
    });
    return { before, after };
  };

  it('has next and previous buttons that count the changes of the tab on screen only', () => {
    const { before, after } = changed();
    const scroll = vi.fn();
    (window.HTMLElement.prototype as any).scrollIntoView = scroll;
    render(<DetailedDiffView doc={after} compareTo={before} showChanges />);
    // the metadata tab holds one change (the title); the content tab two
    expect(screen.getByTestId('detail-nav-position').textContent).toBe('–/1');
    fireEvent.click(screen.getByTestId('detail-tab-sections'));
    expect(screen.getByTestId('detail-nav-position').textContent).toBe('–/2');
    fireEvent.click(screen.getByTestId('detail-next'));
    expect(screen.getByTestId('detail-nav-position').textContent).toBe('1/2');
    fireEvent.click(screen.getByTestId('detail-next'));
    expect(screen.getByTestId('detail-nav-position').textContent).toBe('2/2');
    fireEvent.click(screen.getByTestId('detail-next'));
    expect(screen.getByTestId('detail-nav-position').textContent).toBe('1/2');
    fireEvent.click(screen.getByTestId('detail-prev'));
    expect(screen.getByTestId('detail-nav-position').textContent).toBe('2/2');
    expect(scroll).toHaveBeenCalled();
    // another tab starts again from its own changes
    fireEvent.click(screen.getByTestId('detail-tab-metadata'));
    expect(screen.getByTestId('detail-nav-position').textContent).toBe('–/1');
  });

  it('shows no buttons for a tab without changes, or when changes are not marked', () => {
    const { before, after } = changed();
    render(<DetailedDiffView doc={after} compareTo={before} showChanges />);
    fireEvent.click(screen.getByTestId('detail-tab-refs'));
    expect(screen.queryByTestId('detail-nav')).toBeNull();
    cleanup();
    render(<DetailedDiffView doc={after} compareTo={before} showChanges={false} />);
    expect(screen.queryByTestId('detail-nav')).toBeNull();
  });
});


describe('every setting of a block is covered, not only a table\'s or figure\'s', () => {
  it('shows a heading turned into a paragraph, or H2 into H3', () => {
    const h = (type: string) => ({ id: 'h1', type, title: 'Giới thiệu', content: '' });
    expect(blockSettingChanges(h('h2'), h('paragraph'))).toEqual([{ label: 'Loại khối', from: 'Mục cấp 2 (H2)', to: 'Đoạn văn' }]);
    expect(blockSettingChanges(h('h2'), h('h3'))).toEqual([{ label: 'Loại khối', from: 'Mục cấp 2 (H2)', to: 'Mục cấp 3 (H3)' }]);
    expect(blockSettingChanges({ id: 'q', type: 'paragraph', content: 'x' }, { id: 'q', type: 'quote', content: 'x' })[0]).toMatchObject({ to: 'Trích dẫn' });
  });

  it('shows an equation numbering, and no column setting (it follows the paper)', () => {
    const eq = (over: Record<string, any>) => ({ id: 'e1', type: 'equation', content: 'a=b', equation: { latex: 'a=b', numbered: true, ...over } });
    expect(blockSettingChanges(eq({}), eq({ numbered: false, columnSpan: '2-column' }))).toEqual([{ label: 'Đánh số công thức', from: 'Có đánh số', to: 'Không đánh số' }]);
    expect(blockSettingChanges(eq({}), eq({ columnSpan: '2-column' }))).toEqual([]);
  });

  it('lists a changed heading type in the content tab', () => {
    const before = doc({ sections: [{ id: 'h1', type: 'h2', title: 'Giới thiệu', content: '' }] });
    const after = doc({ sections: [{ id: 'h1', type: 'paragraph', content: 'Giới thiệu' }] });
    render(<DetailedDiffView doc={after} compareTo={before} showChanges />);
    fireEvent.click(screen.getByTestId('detail-tab-sections'));
    expect(screen.getByTestId('setting-changes').textContent).toContain('Loại khối');
    expect(screen.getByTestId('setting-changes').textContent).toContain('Mục cấp 2 (H2)');
  });

  it('the layout tab is just "Dàn trang"', () => {
    render(<DetailedDiffView doc={doc()} compareTo={null} showChanges={false} />);
    expect(screen.getByTestId('detail-tab-layout').textContent).toBe('Dàn trang');
  });

  it('caps the width in pixels', () => {
    render(<DetailedDiffView doc={doc()} compareTo={null} showChanges={false} />);
    expect(screen.getByTestId('detailed-diff-view').className).toContain('max-w-[880px]');
  });
});

vi.mock('@/context/EditorSessionContext', () => ({ useEditorSession: () => ({}) }));
