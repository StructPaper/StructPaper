'use client';

import React from 'react';
import { Slot, useOptionalPlatform } from '@structpaper/platform';
import { registerAppSlots } from '@/platform/slots';
import { DocumentMenuBar, type DocumentMenuBarProps } from './DocumentMenuBar';

registerAppSlots();

/**
 * Platform-aware top bar wrapper for the editor manuscript menu.
 * Renders via `'editor-document-menubar'` slot inside PlatformProvider (Web: DocumentMenuBar, Desktop: null),
 * and falls back safely to Web DocumentMenuBar in isolated test trees without PlatformProvider.
 */
export const EditorDocumentMenuBarSlot: React.FC<DocumentMenuBarProps> = (props) => {
  const platform = useOptionalPlatform();
  if (!platform) {
    return <DocumentMenuBar {...props} />;
  }
  return <Slot id="editor-document-menubar" {...props} />;
};
