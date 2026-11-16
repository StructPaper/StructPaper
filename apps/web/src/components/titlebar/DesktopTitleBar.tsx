'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { Cloud, CloudOff, Crosshair, Loader2 } from 'lucide-react';
import { useCapabilities } from '@structpaper/platform';
import { useStorage } from '@/context/StorageContext';
import { useEditorSession } from '@/context/EditorSessionContext';
import { formatLocalOnlyTooltip, formatSavedTime } from '@/lib/editor/save-status';
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
  const storage = useStorage();
  const { autoSaveEnabled, toggleAutoSave, documentSession, pdfFocusMode, togglePdfFocusMode } = useEditorSession();
  const { handleMouseDown, handleDoubleClick } = useWindowDrag();

  const isDesktop = kind === 'desktop';
  const isEditorRoute = isEditorTitleBarRoute(pathname);
  const saveState = documentSession?.saveState ?? 'saved';
  const isLocalOnly =
    isEditorRoute &&
    storage.isLocalAvailable &&
    saveState === 'saved' &&
    documentSession?.rawSaveState === 'saved-local';
  const localOnlyTooltip = formatLocalOnlyTooltip(documentSession?.savedAt);
  const savedTime = formatSavedTime(documentSession?.savedAt);

  const canManualSave = Boolean(
    documentSession?.onManualSave && (saveState === 'unsaved' || saveState === 'error')
  );

  let cloudTooltip: string;
  if (storage.isLocalAvailable && isLocalOnly) {
    cloudTooltip = localOnlyTooltip;
  } else if (saveState === 'saved') {
    cloudTooltip = savedTime
      ? (storage.isLocalAvailable ? `Đã đồng bộ máy chủ lúc ${savedTime}` : `Đã lưu vào máy chủ lúc ${savedTime}`)
      : (storage.isLocalAvailable ? 'Đã đồng bộ máy chủ' : 'Đã lưu vào máy chủ');
  } else if (saveState === 'saving') {
    cloudTooltip = 'Đang lưu vào máy chủ...';
  } else if (saveState === 'unsaved') {
    cloudTooltip = 'Có thay đổi chưa lưu. Nhấn để lưu ngay (Ctrl+S)';
  } else if (saveState === 'error') {
    cloudTooltip = 'Lỗi lưu vào máy chủ. Nhấn để thử lại';
  } else {
    cloudTooltip = 'Đã lưu vào máy chủ';
  }

  const renderCloudIcon = () => {
    if (storage.isLocalAvailable && isLocalOnly) {
      return (
        <CloudOff
          data-testid="titlebar-cloud-icon"
          className="w-4 h-4 text-zinc-500 shrink-0"
          strokeWidth={2}
          aria-hidden="true"
        />
      );
    }
    switch (saveState) {
      case 'saved':
        return (
          <Cloud
            data-testid="titlebar-cloud-icon"
            className="w-4 h-4 text-[#78C841] shrink-0"
            strokeWidth={2}
            aria-hidden="true"
          />
        );
      case 'saving':
        return (
          <Loader2
            data-testid="titlebar-cloud-icon"
            className="w-4 h-4 text-sky-600 animate-spin shrink-0"
            strokeWidth={2.2}
            aria-hidden="true"
          />
        );
      case 'unsaved':
        return (
          <span className="relative inline-flex items-center justify-center shrink-0">
            <Cloud
              data-testid="titlebar-cloud-icon"
              className="w-4 h-4 text-amber-500 shrink-0"
              strokeWidth={2}
              aria-hidden="true"
            />
            <span
              className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-[#FF9B2F] ring-1 ring-white"
              aria-hidden="true"
            />
          </span>
        );
      case 'error':
        return (
          <CloudOff
            data-testid="titlebar-cloud-icon"
            className="w-4 h-4 text-rose-500 shrink-0"
            strokeWidth={2}
            aria-hidden="true"
          />
        );
      default:
        return (
          <Cloud
            data-testid="titlebar-cloud-icon"
            className="w-4 h-4 text-zinc-400 shrink-0"
            strokeWidth={2}
            aria-hidden="true"
          />
        );
    }
  };

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
          <>
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
            </button>

            {canManualSave ? (
              <button
                type="button"
                data-testid={!storage.isLocalAvailable ? 'titlebar-save-state' : undefined}
                data-save-state={!storage.isLocalAvailable ? saveState : undefined}
                data-no-drag="true"
                onClick={() => void documentSession?.onManualSave?.()}
                aria-label={cloudTooltip}
                title={cloudTooltip}
                className="p-1 rounded-md hover:bg-zinc-300/50 text-zinc-600 shrink-0 transition-colors cursor-pointer inline-flex items-center justify-center select-none"
              >
                {renderCloudIcon()}
              </button>
            ) : (
              <span
                data-testid={
                  !storage.isLocalAvailable
                    ? 'titlebar-save-state'
                    : isLocalOnly
                    ? 'titlebar-local-only-icon'
                    : undefined
                }
                data-save-state={!storage.isLocalAvailable ? saveState : undefined}
                data-no-drag="true"
                aria-label={cloudTooltip}
                title={cloudTooltip}
                className={`p-1 rounded-md shrink-0 inline-flex items-center justify-center select-none ${
                  isLocalOnly ? 'text-zinc-500' : 'text-zinc-600'
                }`}
              >
                {renderCloudIcon()}
              </span>
            )}
          </>
        )}
      </div>

      {isDesktop && <WindowControls />}
    </header>
  );
};
