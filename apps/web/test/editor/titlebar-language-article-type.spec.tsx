// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';

vi.mock('next/navigation', () => ({
  usePathname: () => '/papers/11111111-2222-3333-4444-555555555555',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}));
vi.mock('@/context/StorageContext', () => ({
  useStorage: () => ({ isLocalAvailable: false }),
}));

import { PdfLanguageSelect } from '@/components/titlebar/PdfLanguageSelect';
import { EditorSessionProvider, useEditorSession } from '@/context/EditorSessionContext';
import { ArticleTypeField } from '@/features/editor/components/ArticleTypeField';
import { LayoutSettingsDrawer } from '@/features/editor';
import { DEFAULT_LAYOUT_SETTINGS } from '@/types/paper';

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe('PDF language select in the title bar', () => {
  const Probe = () => <span data-testid="lang">{useEditorSession().pdfLanguage}</span>;

  it('starts in Vietnamese and switches the session language to English', async () => {
    render(
      <EditorSessionProvider>
        <PdfLanguageSelect />
        <Probe />
      </EditorSessionProvider>,
    );
    expect(screen.getByTestId('lang').textContent).toBe('vi');

    fireEvent.click(screen.getByRole('button', { name: /Tiếng Việt/ }));
    fireEvent.click(await screen.findByText('English'));

    await waitFor(() => expect(screen.getByTestId('lang').textContent).toBe('en'));
    expect(window.localStorage.getItem('structpaper_pdf_language')).toBe('en');
  });

  it('remembers the choice', () => {
    window.localStorage.setItem('structpaper_pdf_language', 'en');
    render(
      <EditorSessionProvider>
        <Probe />
      </EditorSessionProvider>,
    );
    expect(screen.getByTestId('lang').textContent).toBe('en');
  });
});

describe('Article type', () => {
  const metadata: any = { journalId: 'VNUHCM-STD', articleType: 'Bài báo nghiên cứu', authors: [] };

  it('is a plain choice: no typed name, no English name box, no "other / type it" option', async () => {
    const onChange = vi.fn();
    render(<ArticleTypeField metadata={metadata} onChange={onChange} />);

    expect(screen.queryByTestId('article-type-custom')).toBeNull();
    expect(screen.queryByTestId('article-type-en')).toBeNull();
    expect(screen.queryByRole('textbox')).toBeNull();

    fireEvent.click(screen.getAllByRole('button')[0]);
    expect(screen.queryByText(/Khác/)).toBeNull();
  });

  it('keeps a stored value that is not in the list, selectable, until another is chosen', () => {
    render(<ArticleTypeField metadata={{ ...metadata, articleType: 'Research Article' }} onChange={vi.fn()} />);
    expect(screen.getAllByRole('button')[0].textContent).toContain('Research Article');
  });
});

describe('Layout settings panel', () => {
  it('opens below the title bar, with flat sections (no cards inside cards)', () => {
    render(
      <LayoutSettingsDrawer
        isOpen
        onClose={vi.fn()}
        settings={DEFAULT_LAYOUT_SETTINGS}
        journalId="VNUHCM-STD"
        onApplySettings={vi.fn()}
      />,
    );

    const root = document.querySelector('[class*="titlebar-height"]');
    expect(root).not.toBeNull();
    expect(document.querySelector('.rounded-3xl.bg-white.border')).toBeNull();
    expect(screen.getByText(/Đánh số trang/)).toBeDefined();
  });
});
