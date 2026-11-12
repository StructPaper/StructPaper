// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { PlatformProvider, createFakePlatform } from '@structpaper/platform';
import { EditorDocumentMenuBarSlot } from '@/components/documents/EditorDocumentMenuBarSlot';
import type { DocumentMenuBarProps } from '@/components/documents/DocumentMenuBar';

const baseProps: DocumentMenuBarProps = {
  name: 'Bản thảo slot test',
  onRename: vi.fn(),
  saveState: 'saved-local',
  savedAt: null,
  onNew: vi.fn(),
  onOpen: vi.fn(),
  onSave: vi.fn(),
  onExport: vi.fn(),
};

describe('EditorDocumentMenuBarSlot (Platform Slot)', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders DocumentMenuBar on Web platform', () => {
    const webPlatform = createFakePlatform({ kind: 'web' });
    render(
      <PlatformProvider value={webPlatform}>
        <EditorDocumentMenuBarSlot {...baseProps} />
      </PlatformProvider>
    );

    expect(screen.getByTestId('save-status')).toBeTruthy();
    expect(screen.getByDisplayValue('Bản thảo slot test')).toBeTruthy();
  });

  it('suppresses DocumentMenuBar on Desktop platform so controls live in DesktopTitleBar', () => {
    const desktopPlatform = createFakePlatform({ kind: 'desktop' });
    render(
      <PlatformProvider value={desktopPlatform}>
        <EditorDocumentMenuBarSlot {...baseProps} />
      </PlatformProvider>
    );

    expect(screen.queryByTestId('save-status')).toBeNull();
    expect(screen.queryByDisplayValue('Bản thảo slot test')).toBeNull();
  });

  it('falls back to Web DocumentMenuBar safely when rendered without PlatformProvider', () => {
    render(<EditorDocumentMenuBarSlot {...baseProps} />);

    expect(screen.getByTestId('save-status')).toBeTruthy();
    expect(screen.getByDisplayValue('Bản thảo slot test')).toBeTruthy();
  });
});
