// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { PdfExportOptionsModal } from '@/features/editor/components/PdfExportOptionsModal';
import { LayoutSettingsDrawer } from '@/features/editor';
import { DEFAULT_LAYOUT_SETTINGS } from '@/types/paper';
import { resolveTheme } from '@/lib/theme-config';

afterEach(cleanup);

describe('the popup of the PDF download', () => {
  it('goes on with the answer it shows', () => {
    const onContinue = vi.fn();
    render(<PdfExportOptionsModal initial={{ rotateSheets: true }} onContinue={onContinue} onClose={vi.fn()} />);
    expect(screen.getByRole('dialog', { name: 'Tùy chọn tải PDF' })).toBeTruthy();
    fireEvent.click(screen.getByText('Tiếp tục'));
    expect(onContinue).toHaveBeenCalledWith({ rotateSheets: true });
  });

  it('keeps the sheets upright when the switch is turned off', () => {
    const onContinue = vi.fn();
    render(<PdfExportOptionsModal initial={{ rotateSheets: true }} onContinue={onContinue} onClose={vi.fn()} />);
    fireEvent.click(screen.getByLabelText('Xoay tờ giấy'));
    fireEvent.click(screen.getByText('Tiếp tục'));
    expect(onContinue).toHaveBeenCalledWith({ rotateSheets: false });
  });

  it('downloads nothing when it is cancelled', () => {
    const onContinue = vi.fn();
    const onClose = vi.fn();
    render(<PdfExportOptionsModal initial={{ rotateSheets: true }} onContinue={onContinue} onClose={onClose} />);
    fireEvent.click(screen.getByText('Hủy'));
    expect(onClose).toHaveBeenCalled();
    expect(onContinue).not.toHaveBeenCalled();
  });
});

describe('turning the sheets', () => {
  it('is on by default for the paper', () => {
    expect(resolveTheme(undefined).turnSheets).toBe(true);
  });

  it('is one switch in the layout drawer, with the tables and headings (none beside the page settings)', () => {
    render(<LayoutSettingsDrawer isOpen onClose={vi.fn()} settings={DEFAULT_LAYOUT_SETTINGS} onApplySettings={vi.fn()} />);
    expect(screen.queryByLabelText('Xoay tờ giấy ở trang xoay')).toBeNull();
  });
});
