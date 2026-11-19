'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { Cloud, CloudOff, Crosshair } from 'lucide-react';
import { useCapabilities } from '@structpaper/platform';
import { useStorage } from '@/context/StorageContext';
import { useEditorSession } from '@/context/EditorSessionContext';
import { formatLocalOnlyTooltip } from '@/lib/editor/save-status';
import { isEditorTitleBarRoute, isJournalDetailRoute, isPaperHistoryRoute } from './titlebar-routes';
import { useWindowDrag } from './useWindowDrag';
import { AppLogoMark } from './AppLogoMark';
import { AutoSaveToggle } from './AutoSaveToggle';
import { DocumentStatusIndicator } from './DocumentStatusIndicator';
import { TitleBarFileMenu } from './TitleBarFileMenu';
import { WindowControls } from './WindowControls';
import { ShareManuscriptButton } from '@/features/sharing';
import { PdfLanguageSelect } from './PdfLanguageSelect';
import { CompileActivityPill } from './CompileActivityPill';
import { UndoRedoButtons } from './UndoRedoButtons';
import { PaperHistoryTitleBarInfo, PaperHistorySaveButton } from './PaperHistoryTitleBarInfo';
import { JournalTitleBarInfo, JournalHistoryButton } from './JournalTitleBarInfo';
import { PaperProfileInfoButton } from '@/features/journals/components/PaperProfileInfoButton';

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
  const isJournalRoute = isJournalDetailRoute(pathname);
  const isHistoryRoute = isPaperHistoryRoute(pathname);
  const readOnly = Boolean(documentSession?.readOnly);
  const canEditHere = isEditorRoute && !readOnly;
  const isLocalOnly =
    canEditHere &&
    storage.isLocalAvailable &&
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
        <AppLogoMark showWordmark={!isEditorRoute && !isJournalRoute && !isHistoryRoute} />

        {isJournalRoute && <JournalTitleBarInfo />}
        {isHistoryRoute && <PaperHistoryTitleBarInfo />}

        {isEditorRoute && (
          <>
            {canEditHere && (
              <TitleBarFileMenu
              onNew={documentSession?.onNew}
              onOpen={documentSession?.onOpen}
              onSave={documentSession?.onManualSave}
              onExport={documentSession?.onExport}
              onHistory={documentSession?.onOpenHistory}
              exporting={documentSession?.exporting}
            />
            )}
            {canEditHere && <AutoSaveToggle enabled={autoSaveEnabled} onToggle={toggleAutoSave} />}
            {canEditHere && <UndoRedoButtons />}
            <DocumentStatusIndicator
              title={documentSession?.title}
              saveState={documentSession?.saveState ?? 'saved'}
              rawSaveState={documentSession?.rawSaveState}
              savedAt={documentSession?.savedAt}
              onManualSave={documentSession?.onManualSave}
              onRename={readOnly ? undefined : documentSession?.onRename}
              readOnly={readOnly}
              onKeepMine={documentSession?.onKeepMine}
            />
          </>
        )}
      </div>

      <div
        data-testid="titlebar-drag-region"
        data-tauri-drag-region={isDesktop ? '' : undefined}
        className="flex-1 h-full min-w-[24px] flex items-center justify-center"
      >
        <CompileActivityPill />
      </div>

      <div className="flex items-center gap-1.5 shrink-0 h-full pr-1">
        {storage.isLocalAvailable && isLocalOnly ? (
          <span
            data-testid="titlebar-local-only-icon"
            data-no-drag="true"
            title={localOnlyTooltip}
            aria-label={localOnlyTooltip}
            className="inline-flex items-center justify-center px-1.5 h-full text-zinc-500 shrink-0 select-none"
          >
            <CloudOff className="w-3.5 h-3.5" strokeWidth={3.3} aria-hidden="true" />
          </span>
        ) : storage.isLocalAvailable && canEditHere ? (
          <span
            data-testid="titlebar-cloud-icon"
            data-no-drag="true"
            title="Đã đồng bộ máy chủ"
            aria-label="Đã đồng bộ máy chủ"
            className="inline-flex items-center justify-center px-1.5 h-full text-zinc-500 shrink-0 select-none"
          >
            <Cloud className="w-3.5 h-3.5 text-zinc-500" strokeWidth={3.3} aria-hidden="true" />
          </span>
        ) : null}

        {(canEditHere || isJournalRoute) && <PdfLanguageSelect />}

        {isJournalRoute && <JournalHistoryButton />}

        {canEditHere && (
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
        )}

        {isHistoryRoute && <PaperHistorySaveButton />}
        {isEditorRoute && <ShareManuscriptButton manuscriptId={documentSession?.paperId} />}
        {isEditorRoute && <PaperProfileInfoButton />}
      </div>

      {isDesktop && <WindowControls />}
    </header>
  );
};
