'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { Cloud, CloudOff, Crosshair } from 'lucide-react';
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
 * Top-level application chrome bar.
 * Rendered on both Desktop and Web platforms.
 * Displays full editor controls (App icon, File menu, AutoSave switch, Paper title & save state)
 * on Editor routes, and a minimal Logo on all other routes.
 *
 * On Desktop: includes native window caption controls (Minimize, Maximize, Close).
 * On Web: identical chrome without the window control buttons.
 */
export const DesktopTitleBar: React.FC = () => {
  const { kind } = useCapabilities();
  const pathname = usePathname();
  const { autoSaveEnabled, toggleAutoSave, documentSession, pdfFocusMode, togglePdfFocusMode } = useEditorSession();
  const { handleMouseDown, handleDoubleClick } = useWindowDrag();

  const isDesktop = kind === 'desktop';
  const isEditorRoute = isEditorTitleBarRoute(pathname);
  const isLocalOnly =
    isEditorRoute &&
    documentSession?.saveState === 'saved' &&
    documentSession?.rawSaveState === 'saved-local';
  const localOnlyTooltip = formatLocalOnlyTooltip(documentSession?.savedAt);

  return (
    <header
      data-testid="desktop-titlebar"
      data-tauri-drag-region={isDesktop ? '' : undefined}
      onMouseDown={isDesktop ? handleMouseDown : undefined}
      onDoubleClick={isDesktop ? handleDoubleClick : undefined}
      className={`fixed top-0 left-0 right-0 z-[100005] h-[38px] w-full bg-gray-200/80 backdrop-blur-sm flex items-center justify-between pl-3 ${isDesktop ? 'pr-0' : 'pr-3'} select-none`}
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
        data-tauri-drag-region={isDesktop ? '' : undefined}
        className="flex-1 h-full min-w-[24px]"
        aria-hidden="true"
      />

      <div className="flex items-center gap-1.5 shrink-0 h-full pr-1">
        {isEditorRoute && (
          <button
            type="button"
            onClick={togglePdfFocusMode}
            data-testid="titlebar-toggle-interactive-pdf"
            data-no-drag="true"
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold transition-all cursor-pointer select-none ${
              pdfFocusMode
                ? 'bg-[#78C841] text-zinc-950 shadow-2xs ring-1 ring-[#78C841]/50'
                : 'bg-zinc-100 hover:bg-zinc-200/80 text-zinc-600'
            }`}
            title={
              pdfFocusMode
                ? 'Chế độ định vị đang bật: Nhấp đúp vào văn bản trên PDF để nhảy đến khối tương ứng. Bấm để tắt.'
                : 'Bật chế độ định vị: Cho phép nhấp đúp vào văn bản trên PDF để nhảy đến khối tương ứng trong bài.'
            }
          >
            <Crosshair className={`w-3.5 h-3.5 ${pdfFocusMode ? 'text-zinc-950' : 'text-zinc-500'}`} />
            <span>Focus định vị</span>
            <span
              className={`w-1.5 h-1.5 rounded-full transition-colors ${
                pdfFocusMode ? 'bg-zinc-950' : 'bg-zinc-400'
              }`}
            />
          </button>
        )}

        {isLocalOnly ? (
          <span
            data-testid="titlebar-local-only-icon"
            data-no-drag="true"
            title={localOnlyTooltip}
            aria-label={localOnlyTooltip}
            className="inline-flex items-center justify-center px-1.5 h-full text-zinc-500 shrink-0 select-none"
          >
            <CloudOff className="w-3.5 h-3.5" strokeWidth={2} aria-hidden="true" />
          </span>
        ) : isEditorRoute ? (
          <span
            data-testid="titlebar-cloud-icon"
            data-no-drag="true"
            title="Đã đồng bộ máy chủ"
            aria-label="Đã đồng bộ máy chủ"
            className="inline-flex items-center justify-center px-1.5 h-full text-zinc-500 shrink-0 select-none"
          >
            <Cloud className="w-3.5 h-3.5 text-zinc-500" strokeWidth={2} aria-hidden="true" />
          </span>
        ) : null}
      </div>

      {isDesktop && <WindowControls />}
    </header>
  );
};
