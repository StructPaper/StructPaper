// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { LivePreviewPane } from '@/features/editor/components/LivePreviewPane';

const paper: any = { id: 'p', metadata: {}, sections: [], references: [] };

const renderPane = (props: Record<string, any>) =>
  render(
    <LivePreviewPane
      paper={paper}
      compiledPdfUrl={null}
      isCompilingPdf={false}
      compileStats={null}
      compileErrorInfo={null}
      onRecompile={vi.fn()}
      onClearError={vi.fn()}
      {...(props as any)}
    />,
  );

describe('compile failure is shown in the status strip, not in a modal', () => {
  afterEach(cleanup);

  it('shows the error in the strip with retry and close, and opens no dialog', () => {
    const onRecompile = vi.fn();
    const onClearError = vi.fn();
    renderPane({ compileErrorInfo: { error: 'Backend biên dịch trả lỗi (413)', details: '{"code":"TOO_LARGE"}' }, onRecompile, onClearError });

    const strip = screen.getByTestId('compile-status');
    expect(strip.getAttribute('data-state')).toBe('error');
    expect(strip.textContent).toContain('Backend biên dịch trả lỗi (413)');
    expect(screen.queryByRole('dialog')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    expect(onRecompile).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Đóng thông báo lỗi' }));
    expect(onClearError).toHaveBeenCalledTimes(1);
  });

  it('technical details stay hidden until asked for', () => {
    renderPane({ compileErrorInfo: { error: 'Lỗi', details: 'chi tiết kỹ thuật' } });

    expect(screen.queryByText('chi tiết kỹ thuật')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Chi tiết' }));
    expect(screen.getByText('chi tiết kỹ thuật')).toBeDefined();
  });

  it('no strip at all when nothing is happening', () => {
    renderPane({});
    expect(screen.queryByTestId('compile-status')).toBeNull();
  });
});
