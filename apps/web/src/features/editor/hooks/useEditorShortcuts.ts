'use client';

import { useEffect } from 'react';

export interface UseEditorShortcutsOptions {
  onSave: () => void;
  enabled?: boolean;
}

export function useEditorShortcuts({
  onSave,
  enabled = true,
}: UseEditorShortcutsOptions) {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        onSave();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onSave, enabled]);
}
