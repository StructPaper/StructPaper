// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { SectionActionToolbar } from '@/features/editor/components/sections/SectionActionToolbar';
import { SectionInsertDivider } from '@/features/editor/components/sections/SectionInsertDivider';
import { resetEditorPrefsForTest } from '@/lib/editor-prefs';

const counts = { all: 3, headings: 1, paragraphs: 1, tables: 1, figures: 0, equations: 0 };
const toolbar = (extra: Record<string, unknown> = {}) => (
  <SectionActionToolbar totalSections={3} filterType="all" onFilterChange={vi.fn()} counts={counts} {...extra} />
);
const divider = () => (
  <SectionInsertDivider idx={0} onAddHeading={vi.fn()} onAddParagraph={vi.fn()} onAddTable={vi.fn()} onAddFigure={vi.fn()} />
);

beforeEach(() => {
  localStorage.clear();
  resetEditorPrefsForTest();
});
afterEach(cleanup);

describe('the settings of the content tab', () => {
  it('unfolds the add strip under a block by default', () => {
    render(toolbar());
    const { container } = render(divider());
    expect(container.textContent).toContain('Thêm bên dưới');
    expect(screen.queryByTestId('content-add-block')).toBeNull();
  });

  it('turns the strip off in its popup, and nothing else appears in the title', () => {
    render(toolbar());
    const { container } = render(divider());
    fireEvent.click(screen.getByTestId('content-settings-button'));
    expect(screen.getByRole('dialog', { name: 'Cài đặt nội dung' })).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Bung nút thêm khối khi rê chuột'));
    fireEvent.click(screen.getByText('Lưu'));
    expect(container.textContent).not.toContain('Thêm bên dưới');
    expect(screen.queryByTestId('content-add-block')).toBeNull();
    // kept in the browser
    expect(localStorage.getItem('structpaper_hover_insert')).toBe('false');
  });

  it('cancelling the popup changes nothing', () => {
    render(toolbar());
    const { container } = render(divider());
    fireEvent.click(screen.getByTestId('content-settings-button'));
    fireEvent.click(screen.getByLabelText('Bung nút thêm khối khi rê chuột'));
    fireEvent.click(screen.getByText('Hủy'));
    expect(container.textContent).toContain('Thêm bên dưới');
  });
});
