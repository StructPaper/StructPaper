// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { LivePreviewPane } from '@/components/editor/LivePreviewPane';
import { DesktopTitleBar } from '@/components/titlebar/DesktopTitleBar';
import { EditorSessionProvider } from '@/context/EditorSessionContext';
import { PlatformProvider, createFakePlatform } from '@structpaper/platform';
import type { CompletePaper } from '@/types/paper';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  usePathname: () => '/editor',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

// Mock PdfInteractiveViewer
vi.mock('@/components/preview/PdfInteractiveViewer', () => ({
  PdfInteractiveViewer: () => <div data-testid="pdf-interactive-viewer">PdfInteractiveViewer Loaded</div>,
}));

describe('DesktopTitleBar & LivePreviewPane Focus Toggle Integration', () => {
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

  it('renders Focus toggle button on TitleBar to the right of the cloud icon', () => {
    const platform = createFakePlatform({ kind: 'web' });
    render(
      <PlatformProvider value={platform}>
        <EditorSessionProvider>
          <DesktopTitleBar />
        </EditorSessionProvider>
      </PlatformProvider>
    );

    const toggleBtn = screen.getByTestId('titlebar-toggle-interactive-pdf');
    expect(toggleBtn).toBeDefined();
    expect(toggleBtn.textContent).toContain('Focus định vị');

    // Cloud icon is present on the TitleBar to the left of the Focus toggle button
    const cloudIcon = screen.getByTestId('titlebar-cloud-icon');
    expect(cloudIcon).toBeDefined();
    expect(cloudIcon.compareDocumentPosition(toggleBtn) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('renders standard iframe by default without any top bar header in preview pane', () => {
    const platform = createFakePlatform({ kind: 'web' });
    render(
      <PlatformProvider value={platform}>
        <EditorSessionProvider>
          <LivePreviewPane
            paper={dummyPaper}
            compiledPdfUrl="blob:http://localhost/test.pdf"
            isCompilingPdf={false}
            compileStats={null}
            compileErrorInfo={null}
            onRecompile={vi.fn()}
            onClearError={vi.fn()}
          />
        </EditorSessionProvider>
      </PlatformProvider>
    );

    // Standard native iframe is rendered taking full space
    const iframe = screen.getByTitle('XeLaTeX Compiled PDF Live Preview');
    expect(iframe).toBeDefined();
    expect(iframe.getAttribute('src')).toBe('blob:http://localhost/test.pdf#toolbar=1&navpanes=0');

    // PdfInteractiveViewer is not rendered
    expect(screen.queryByTestId('pdf-interactive-viewer')).toBeNull();

    // Top control bar inside preview card is removed
    expect(screen.queryByText('Bản xem trước PDF')).toBeNull();
  });

  it('switches preview to PdfInteractiveViewer when TitleBar focus toggle is clicked, and back on second click', () => {
    const platform = createFakePlatform({ kind: 'web' });
    render(
      <PlatformProvider value={platform}>
        <EditorSessionProvider>
          <DesktopTitleBar />
          <LivePreviewPane
            paper={dummyPaper}
            compiledPdfUrl="blob:http://localhost/test.pdf"
            isCompilingPdf={false}
            compileStats={null}
            compileErrorInfo={null}
            onRecompile={vi.fn()}
            onClearError={vi.fn()}
          />
        </EditorSessionProvider>
      </PlatformProvider>
    );

    const toggleBtn = screen.getByTestId('titlebar-toggle-interactive-pdf');

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
    const platform = createFakePlatform({ kind: 'web' });
    render(
      <PlatformProvider value={platform}>
        <EditorSessionProvider>
          <LivePreviewPane
            paper={dummyPaper}
            compiledPdfUrl={null}
            isCompilingPdf={false}
            compileStats={null}
            compileErrorInfo={null}
            onRecompile={vi.fn()}
            onClearError={vi.fn()}
          />
        </EditorSessionProvider>
      </PlatformProvider>
    );

    expect(screen.getByText('Chưa có bản xem trước PDF')).toBeDefined();
  });
});
