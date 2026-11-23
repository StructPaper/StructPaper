// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { AppendixTab } from '@/features/editor/components/AppendixTab';
import { DEFAULT_APPENDIX } from '@/lib/appendix';
import { createEmptyPaper } from '@/types/paper';

afterEach(cleanup);
vi.setConfig({ testTimeout: 20000 });

const base = () => createEmptyPaper().metadata;

describe('the Phụ lục tab', () => {
  it('has a settings button in its title, and a popup with the placement and the numbering', () => {
    const onSettings = vi.fn();
    render(<AppendixTab sections={[]} onChange={vi.fn()} metadata={base()} settings={DEFAULT_APPENDIX} onSettings={onSettings} />);
    expect(screen.getByTestId('appendix-empty')).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByTestId('appendix-settings-button'));
    expect(screen.getByRole('dialog', { name: 'Cài đặt phụ lục' })).toBeTruthy();
    // the default: after the references, the sheet upright
    expect(screen.getByTestId('appendix-placement-afterReferences').getAttribute('aria-checked')).toBe('true');
    fireEvent.click(screen.getByTestId('appendix-placement-inContent'));
    fireEvent.click(screen.getByTestId('appendix-numbering-letter'));
    fireEvent.click(screen.getByText('Lưu'));
    expect(onSettings).toHaveBeenLastCalledWith({ placement: 'inContent', numbering: 'letter' });
  });

  it('a table, a figure or some text can be added to the appendices', () => {
    render(<AppendixTab sections={[]} onChange={vi.fn()} metadata={base()} settings={DEFAULT_APPENDIX} onSettings={vi.fn()} />);
    expect(screen.getByText('+ Bảng phụ lục')).toBeTruthy();
    expect(screen.getByText('+ Hình phụ lục')).toBeTruthy();
    expect(screen.getByText('+ Tiêu đề phụ lục')).toBeTruthy();
    expect(screen.getByText('+ Đoạn văn')).toBeTruthy();
  });

  it('a paragraph added there is a block of the appendices', () => {
    const onChange = vi.fn();
    render(<AppendixTab sections={[]} onChange={onChange} metadata={base()} settings={DEFAULT_APPENDIX} onSettings={vi.fn()} />);
    fireEvent.click(screen.getByText('+ Đoạn văn'));
    const next = onChange.mock.calls.at(-1)![0];
    expect(next[0]).toMatchObject({ type: 'paragraph', appendix: true });
  });

  it('adds an appendix table numbered after the ones there are, flagged as an appendix', () => {
    const onChange = vi.fn();
    render(<AppendixTab sections={[]} onChange={onChange} metadata={base()} settings={DEFAULT_APPENDIX} onSettings={vi.fn()} />);
    fireEvent.click(screen.getByText('+ Bảng phụ lục'));
    expect(onChange).toHaveBeenCalled();
    const next = onChange.mock.calls.at(-1)![0];
    expect(next).toHaveLength(1);
    expect(next[0].table.appendix).toBe(true);
    expect(next[0].table.num).toBe(1);
    expect(next[0].table.caption).toMatch(/^Phụ lục 1/);
  });
});
