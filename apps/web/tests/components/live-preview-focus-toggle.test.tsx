// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { LivePreviewPane } from '@/components/editor/LivePreviewPane';
import type { CompletePaper } from '@/types/paper';

// Mock PdfInteractiveViewer
vi.mock('@/components/preview/PdfInteractiveViewer', () => ({
  PdfInteractiveViewer: () => <div data-testid="pdf-interactive-viewer">PdfInteractiveViewer Loaded</div>,
}));

describe('LivePreviewPane Focus Toggle', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  const dummyPaper: CompletePaper = {
    id: 'paper-preview-test',
    metadata: {
      title: 'Bài báo thử nghiệm Preview',
      titleEn: 'Test Paper for Preview',
      articleType: 'Research Article',
      journalId: 'test-journal',
      journalName: 'Tạp chí Test',
      journalAbbv: 'Test J.',
      authors: [],
      affiliations: [],
      corresponding: { name: '', email: '', affiliation: '' },
      abstract: 'Abstract test',
      abstractEn: 'Abstract en test',
      keywords: [],
      keywordsEn: [],
      dates: { received: '', revised: '', accepted: '', published: '' },
      doi: '',
      volume: '1',
      issue: '1',
      year: '2026',
      firstPage: '1',
      lastPage: '10',
    },
    sections: [],
    references: [],
  };

  it('renders standard iframe by default when compiledPdfUrl is present', () => {
    render(
      <LivePreviewPane
        paper={dummyPaper}
        compiledPdfUrl="blob:http://localhost/test.pdf"
        isCompilingPdf={false}
      />
    );

    // Toggle button should be present
    const toggleBtn = screen.getByTestId('toggle-interactive-pdf');
    expect(toggleBtn).toBeDefined();
    expect(toggleBtn.textContent).toContain('Focus định vị');

    // By default (interactiveMode = false), standard iframe is rendered
    const iframe = screen.getByTitle('XeLaTeX Compiled PDF Live Preview');
    expect(iframe).toBeDefined();
    expect(iframe.getAttribute('src')).toBe('blob:http://localhost/test.pdf#toolbar=1&navpanes=0');

    // PdfInteractiveViewer is not rendered
    expect(screen.queryByTestId('pdf-interactive-viewer')).toBeNull();
  });

  it('switches to PdfInteractiveViewer when toggle button is clicked, and back to iframe on second click', () => {
    render(
      <LivePreviewPane
        paper={dummyPaper}
        compiledPdfUrl="blob:http://localhost/test.pdf"
        isCompilingPdf={false}
      />
    );

    const toggleBtn = screen.getByTestId('toggle-interactive-pdf');

    // Click to enable Focus mode
    fireEvent.click(toggleBtn);

    // Now PdfInteractiveViewer should be rendered
    expect(screen.getByTestId('pdf-interactive-viewer')).toBeDefined();
    expect(screen.queryByTitle('XeLaTeX Compiled PDF Live Preview')).toBeNull();
    expect(localStorage.getItem('structpaper_pdf_interactive_mode')).toBe('true');

    // Click again to disable Focus mode
    fireEvent.click(toggleBtn);

    // Iframe is rendered again
    expect(screen.getByTitle('XeLaTeX Compiled PDF Live Preview')).toBeDefined();
    expect(screen.queryByTestId('pdf-interactive-viewer')).toBeNull();
    expect(localStorage.getItem('structpaper_pdf_interactive_mode')).toBe('false');
  });

  it('renders empty state when compiledPdfUrl is null', () => {
    render(
      <LivePreviewPane
        paper={dummyPaper}
        compiledPdfUrl={null}
        isCompilingPdf={false}
      />
    );

    expect(screen.getByText('Chưa có bản xem trước PDF')).toBeDefined();
    expect(screen.queryByTestId('toggle-interactive-pdf')).toBeNull();
  });
});
