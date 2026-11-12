'use client';

import { registerSlot } from '@structpaper/platform';
import { DownloadDesktopCard } from '@/components/platform/DownloadDesktopCard';
import { CheckForUpdateCard } from '@/components/platform/CheckForUpdateCard';
import type { DocumentMenuBarProps } from '@/components/documents/DocumentMenuBar';

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

  // TitleBar is used on both Web and Desktop (without window controls on Web).
  // DocumentMenuBar is replaced on both platforms in favor of TitleBar.
  registerSlot<DocumentMenuBarProps>('editor-document-menubar', {
    web: null,
    desktop: null,
  });

  registered = true;
}

// Auto-register on import
registerAppSlots();

