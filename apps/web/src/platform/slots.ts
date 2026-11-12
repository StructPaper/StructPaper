'use client';

import { registerSlot } from '@structpaper/platform';
import { DownloadDesktopCard } from '@/components/platform/DownloadDesktopCard';
import { CheckForUpdateCard } from '@/components/platform/CheckForUpdateCard';
import { DocumentMenuBar, type DocumentMenuBarProps } from '@/components/documents/DocumentMenuBar';

let registered = false;

/**
 * Registers application-level polymorphic slots.
 * Guarantees that Web and Desktop platform mappings exist for each registered slot.
 */
export function registerAppSlots(): void {
  if (registered) {
    return;
  }

  registerSlot('app-distribution', {
    web: DownloadDesktopCard,
    desktop: CheckForUpdateCard,
  });

  // Web renders the inline DocumentMenuBar; Desktop surfaces these actions inside DesktopTitleBar.
  registerSlot<DocumentMenuBarProps>('editor-document-menubar', {
    web: DocumentMenuBar,
    desktop: null,
  });

  registered = true;
}

// Auto-register on import
registerAppSlots();

