'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { CloudOff } from 'lucide-react';
import { useCapabilities } from '@structpaper/platform';
import { useEditorSession } from '@/context/EditorSessionContext';
import { formatLocalOnlyTooltip } from '@/lib/editor/save-status';
import { isEditorTitleBarRoute } from './titlebar-routes';
import { useWindowDrag } from './useWindowDrag';
import { AppLogoMark } from './AppLogoMark';
import { AutoSaveToggle } from './AutoSaveToggle';
import { DocumentStatusIndicator } from './DocumentStatusIndicator';
import { TitleBarFileMenu } from './TitleBarFileMenu';
import { WindowControls } from './WindowControls';

/**
 * Custom desktop window chrome bar replacing the OS title bar in Tauri.
 * Displays full editor controls (App icon, AutoSave switch, Paper title & save state)
 * on Editor routes, and a minimal Logo + Window Controls chrome on all other routes.
 */
export const DesktopTitleBar: React.FC = () => {
  const { kind } = useCapabilities();
  const pathname = usePathname();
  const { autoSaveEnabled, toggleAutoSave, documentSession } = useEditorSession();
  const { handleMouseDown, handleDoubleClick } = useWindowDrag();

  if (kind !== 'desktop') {
    return null;
  }

  const isEditorRoute = isEditorTitleBarRoute(pathname);
  const isLocalOnly =
    isEditorRoute &&
    documentSession?.saveState === 'saved' &&
    documentSession?.rawSaveState === 'saved-local';
  const localOnlyTooltip = formatLocalOnlyTooltip(documentSession?.savedAt);

  return (
    <header
      data-testid="desktop-titlebar"
      data-tauri-drag-region
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
      className="fixed top-0 left-0 right-0 z-[100005] h-[38px] w-full bg-gray-200/80 backdrop-blur-sm flex items-center justify-between pl-3 pr-0 select-none"
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <AppLogoMark showWordmark={!isEditorRoute} />

        {isEditorRoute && (
          <>
            <TitleBarFileMenu
              onNew={documentSession?.onNew}
              onOpen={documentSession?.onOpen}
              onSave={documentSession?.onManualSave}
              onExport={documentSession?.onExport}
              exporting={documentSession?.exporting}
            />
            <AutoSaveToggle enabled={autoSaveEnabled} onToggle={toggleAutoSave} />
            <DocumentStatusIndicator
              title={documentSession?.title}
              saveState={documentSession?.saveState ?? 'saved'}
              rawSaveState={documentSession?.rawSaveState}
              savedAt={documentSession?.savedAt}
              onManualSave={documentSession?.onManualSave}
              onRename={documentSession?.onRename}
              onKeepMine={documentSession?.onKeepMine}
            />
          </>
        )}
      </div>

      <div
        data-testid="titlebar-drag-region"
        data-tauri-drag-region
        className="flex-1 h-full min-w-[24px]"
        aria-hidden="true"
      />

      {isLocalOnly && (
        <span
          data-testid="titlebar-local-only-icon"
          data-no-drag="true"
          title={localOnlyTooltip}
          aria-label={localOnlyTooltip}
          className="inline-flex items-center justify-center px-2 h-full text-zinc-500 shrink-0 select-none"
        >
          <CloudOff className="w-3.5 h-3.5" strokeWidth={2} aria-hidden="true" />
        </span>
      )}

      <WindowControls />
    </header>
  );
};
