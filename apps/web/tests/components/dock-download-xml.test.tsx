// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { DockDownloadMenu } from '@/components/editor/DockDownloadMenu';

afterEach(cleanup);

const base = (over: Record<string, unknown> = {}) => ({
  isDownloadOpen: true,
  setIsDownloadOpen: vi.fn(),
  setIsStatusOpen: vi.fn(),
  downloadMenuRef: { current: null },
  isTest: true,
  springTransition: { duration: 0 },
  isExportingDocx: false,
  isExportingPdf: false,
  isExportingZip: false,
  isExportingTypst: false,
  isAnyExporting: false,
  onDownloadDocx: vi.fn(),
  onDownloadZip: vi.fn(),
  compiledPdfUrl: null,
  ...over,
});

describe('download menu offers XML', () => {
  it('has XML and XML + images entries that call their handlers', () => {
    const onDownloadXml = vi.fn();
    const onDownloadXmlPackage = vi.fn();
    render(<DockDownloadMenu {...(base({ onDownloadXml, onDownloadXmlPackage }) as any)} />);
    fireEvent.click(screen.getByTestId('download-xml'));
    fireEvent.click(screen.getByTestId('download-xml-package'));
    expect(onDownloadXml).toHaveBeenCalledTimes(1);
    expect(onDownloadXmlPackage).toHaveBeenCalledTimes(1);
  });

  it('shows no XML entries where the host has no XML export', () => {
    render(<DockDownloadMenu {...(base() as any)} />);
    expect(screen.queryByTestId('download-xml')).toBeNull();
  });
});
