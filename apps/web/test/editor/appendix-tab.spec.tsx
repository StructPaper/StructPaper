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
  it('has the placement, the turned pages and the numbering to choose, and says when there is no appendix', () => {
    const onSettings = vi.fn();
    render(<AppendixTab sections={[]} onChange={vi.fn()} metadata={base()} settings={DEFAULT_APPENDIX} onSettings={onSettings} />);
    expect(screen.getByTestId('appendix-settings')).toBeTruthy();
    expect(screen.getByTestId('appendix-empty')).toBeTruthy();
    // the default: after the references
    expect(screen.getByTestId('appendix-placement-afterReferences').getAttribute('aria-checked')).toBe('true');
    fireEvent.click(screen.getByTestId('appendix-placement-inContent'));
    expect(onSettings).toHaveBeenLastCalledWith({ placement: 'inContent' });
    fireEvent.click(screen.getByTestId('appendix-numbering-letter'));
    expect(onSettings).toHaveBeenLastCalledWith({ numbering: 'letter' });
    fireEvent.click(screen.getByLabelText('Xoay ngang các trang phụ lục'));
    expect(onSettings).toHaveBeenLastCalledWith({ landscape: false });
  });

  it('only a table or a figure can be added to the appendices', () => {
    render(<AppendixTab sections={[]} onChange={vi.fn()} metadata={base()} settings={DEFAULT_APPENDIX} onSettings={vi.fn()} />);
    expect(screen.getByText('+ Bảng phụ lục')).toBeTruthy();
    expect(screen.getByText('+ Hình phụ lục')).toBeTruthy();
    expect(screen.queryByText('+ Thêm đoạn văn')).toBeNull();
    expect(screen.queryByText('+ Thêm tiêu đề H1')).toBeNull();
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
