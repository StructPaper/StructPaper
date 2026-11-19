// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { EditorSessionProvider, useEditorSession } from '@/context/EditorSessionContext';

const Probe: React.FC = () => {
  const { pdfLanguage, pdfFocusMode } = useEditorSession();
  return <span data-testid="probe">{`${pdfLanguage}/${pdfFocusMode}`}</span>;
};

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('editor session preferences and hydration', () => {
  it('the first render ignores browser storage, so it always matches the server HTML', () => {
    localStorage.setItem('structpaper_pdf_language', 'en');
    localStorage.setItem('structpaper_pdf_interactive_mode', 'true');
    const html = renderToString(
      <EditorSessionProvider>
        <Probe />
      </EditorSessionProvider>,
    );
    expect(html).toContain('vi/false');
  });

  it('the stored choices are applied right after mount', async () => {
    localStorage.setItem('structpaper_pdf_language', 'en');
    localStorage.setItem('structpaper_pdf_interactive_mode', 'true');
    render(
      <EditorSessionProvider>
        <Probe />
      </EditorSessionProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('probe').textContent).toBe('en/true'));
  });
});
