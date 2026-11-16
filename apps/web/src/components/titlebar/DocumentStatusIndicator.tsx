'use client';

import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Cloud, CloudOff, Loader2, Pencil } from 'lucide-react';
import { useStorage } from '@/context/StorageContext';
import type { SaveState } from '@/lib/documents/autosave-controller';
import {
  formatLocalOnlyTooltip,
  formatSavedTime,
  getSaveStateMetadata,
  resolveDocumentDisplayTitle,
  type DocumentSaveState,
} from '@/lib/editor/save-status';

export interface DocumentStatusIndicatorProps {
  title?: string;
  saveState: DocumentSaveState;
  rawSaveState?: SaveState;
  savedAt?: number | null;
  onManualSave?: () => Promise<void> | void;
  onRename?: (name: string) => void;
  onKeepMine?: () => Promise<void> | void;
}

const STATUS_STYLE_MAP: Record<
  DocumentSaveState,
  {
    pillClass: string;
    icon: React.ReactNode;
  }
> = {
  saved: {
    pillClass:
      'bg-[#ECFCCB]/85 text-[#14532D] border-[#D9F99D] shadow-[inset_0_0_8px_rgba(101,163,13,0.16)]',
    icon: <CheckCircle2 className="w-3 h-3 text-[#65A30D] shrink-0" strokeWidth={2.6} />,
  },
  saving: {
    pillClass:
      'bg-sky-50/90 text-sky-700 border-sky-200/80 shadow-[inset_0_0_8px_rgba(2,132,199,0.14)]',
    icon: <Loader2 className="w-3 h-3 text-sky-600 animate-spin shrink-0" strokeWidth={2.6} />,
  },
  unsaved: {
    pillClass:
      'bg-amber-50/95 hover:bg-amber-100/90 text-amber-800 border-amber-200/90 shadow-[inset_0_0_8px_rgba(217,119,6,0.16)]',
    icon: <span className="w-2 h-2 rounded-full bg-[#FF9B2F] shrink-0" />,
  },
  error: {
    pillClass:
      'bg-rose-50/95 hover:bg-rose-100/90 text-rose-700 border-rose-200/90 shadow-[inset_0_0_8px_rgba(225,29,72,0.16)]',
    icon: <AlertCircle className="w-3 h-3 text-rose-600 shrink-0" strokeWidth={2.6} />,
  },
};

export const DocumentStatusIndicator: React.FC<DocumentStatusIndicatorProps> = ({
  title,
  saveState,
  rawSaveState,
  savedAt,
  onManualSave,
  onRename,
  onKeepMine,
}) => {
  const storage = useStorage();
  const isLocalAvailable = storage.isLocalAvailable;

  const displayTitle = resolveDocumentDisplayTitle(title);
  const metadata = getSaveStateMetadata(saveState);
  const visual = STATUS_STYLE_MAP[saveState];
  const canManualSave = Boolean(
    onManualSave && (saveState === 'unsaved' || saveState === 'error')
  );
  const isLocalOnly = saveState === 'saved' && rawSaveState === 'saved-local';
  const isConflict = rawSaveState === 'conflict';
  const savedTime = formatSavedTime(savedAt);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(displayTitle);
  const [minEditWidth, setMinEditWidth] = useState<number | null>(null);
  const titleButtonRef = useRef<HTMLButtonElement>(null);
  const escapingRef = useRef(false);

  useEffect(() => {
    if (!editing) {
      setDraft(displayTitle);
    }
  }, [displayTitle, editing]);

  const commitRename = () => {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed && trimmed !== displayTitle) {
      onRename?.(trimmed);
    } else {
      setDraft(displayTitle);
    }
  };

  let savedTooltip: string | undefined;
  if (!isLocalAvailable) {
    if (saveState === 'saved') {
      savedTooltip = savedTime ? `Đã lưu vào máy chủ lúc ${savedTime}` : 'Đã lưu vào máy chủ';
    } else if (saveState === 'saving') {
      savedTooltip = 'Đang lưu vào máy chủ...';
    } else if (saveState === 'unsaved') {
      savedTooltip = 'Có thay đổi chưa lưu. Nhấn để lưu ngay (Ctrl+S)';
    } else if (saveState === 'error') {
      savedTooltip = 'Lỗi lưu vào máy chủ. Nhấn để thử lại';
    } else if (isConflict) {
      savedTooltip = 'Xung đột phiên bản trên máy chủ. Chọn Ghi đè để áp dụng bản sửa đổi của bạn.';
    }
  } else {
    if (isLocalOnly) {
      savedTooltip = formatLocalOnlyTooltip(savedAt);
    } else if (saveState === 'saved' && savedTime) {
      savedTooltip = `Đã lưu và đồng bộ lúc ${savedTime}`;
    } else if (isConflict) {
      savedTooltip = 'Xung đột phiên bản trên máy chủ';
    }
  }

  const renderCloudIndicator = () => {
    switch (saveState) {
      case 'saved':
        return (
          <Cloud
            data-testid="titlebar-cloud-icon"
            className="w-4 h-4 text-emerald-600 shrink-0"
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
    <div
      data-testid="titlebar-document-status"
      className="flex items-center gap-1.5 min-w-0"
    >
      <div className="h-3.5 w-[1px] bg-zinc-300/80 mx-1 shrink-0" aria-hidden="true" />

      {onRename && editing ? (
        <span
          data-testid="titlebar-paper-title-editor-wrap"
          style={minEditWidth ? { minWidth: `${minEditWidth}px` } : undefined}
          className="inline-grid items-center min-w-0 max-w-[220px] sm:max-w-[320px] md:max-w-[460px]"
        >
          <span
            aria-hidden="true"
            className="col-start-1 row-start-1 invisible whitespace-pre overflow-hidden max-w-full px-2 text-[12px] font-bold tracking-tight pointer-events-none"
          >
            {draft || displayTitle || ' '}
          </span>
          <input
            type="text"
            data-testid="titlebar-paper-title-input"
            data-no-drag="true"
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => {
              if (escapingRef.current) {
                escapingRef.current = false;
                return;
              }
              commitRename();
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                commitRename();
              } else if (e.key === 'Escape') {
                e.preventDefault();
                escapingRef.current = true;
                setDraft(displayTitle);
                setEditing(false);
              }
            }}
            onFocus={(e) => e.currentTarget.select()}
            className="col-start-1 row-start-1 w-full min-w-0 h-6 px-1.5 text-[12px] font-bold text-zinc-900 bg-white/95 border border-zinc-300 rounded-md outline-none focus:ring-2 focus:ring-zinc-400/40 tracking-tight"
          />
        </span>
      ) : onRename ? (
        <button
          ref={titleButtonRef}
          type="button"
          data-testid="titlebar-paper-title"
          data-no-drag="true"
          onClick={() => {
            const rectWidth = titleButtonRef.current?.getBoundingClientRect().width ?? 0;
            setMinEditWidth(rectWidth > 0 ? Math.ceil(rectWidth) : null);
            escapingRef.current = false;
            setDraft(displayTitle);
            setEditing(true);
          }}
          title={`Nhấp để đổi tên hiển thị: ${displayTitle}`}
          className="group inline-flex items-center min-w-0 text-[12px] font-bold text-zinc-800 hover:bg-zinc-300/50 px-1.5 py-0.5 rounded-md max-w-[180px] sm:max-w-[300px] md:max-w-[440px] tracking-tight transition-colors duration-200 cursor-text"
        >
          <span className="truncate min-w-0">{displayTitle}</span>
          <span
            data-testid="titlebar-paper-title-pencil"
            aria-hidden="true"
            className="inline-flex items-center overflow-hidden max-w-0 opacity-0 ml-0 group-hover:max-w-[14px] group-hover:opacity-100 group-hover:ml-1 transition-all duration-200 ease-out shrink-0"
          >
            <Pencil className="w-2.5 h-2.5 text-zinc-400 shrink-0" />
          </span>
        </button>
      ) : (
        <span
          data-testid="titlebar-paper-title"
          title={displayTitle}
          className="text-[12px] font-bold text-zinc-800 truncate max-w-[180px] sm:max-w-[300px] md:max-w-[440px] tracking-tight"
        >
          {displayTitle}
        </span>
      )}

      <span className="text-zinc-400 text-[10px] shrink-0 select-none" aria-hidden="true">
        •
      </span>

      {!isLocalAvailable ? (
        canManualSave ? (
          <button
            type="button"
            data-testid="titlebar-save-state"
            data-save-state={saveState}
            data-no-drag="true"
            onClick={() => void onManualSave?.()}
            aria-label={`${metadata.ariaLabel} — Nhấn để lưu`}
            title={savedTooltip}
            className="p-1 rounded-md hover:bg-zinc-300/50 text-zinc-600 shrink-0 transition-colors cursor-pointer inline-flex items-center justify-center"
          >
            {renderCloudIndicator()}
          </button>
        ) : (
          <span
            data-testid="titlebar-save-state"
            data-save-state={saveState}
            aria-label={metadata.ariaLabel}
            title={savedTooltip}
            className="p-1 rounded-md text-zinc-600 shrink-0 inline-flex items-center justify-center select-none"
          >
            {renderCloudIndicator()}
          </span>
        )
      ) : canManualSave ? (
        <button
          type="button"
          data-testid="titlebar-save-state"
          data-save-state={saveState}
          data-no-drag="true"
          onClick={() => void onManualSave?.()}
          aria-label={`${metadata.ariaLabel} — Nhấn để lưu`}
          title={savedTooltip ?? 'Nhấn để lưu ngay (Ctrl+S)'}
          className={`px-2 py-[2px] rounded-full border text-[11px] font-semibold inline-flex items-center gap-1 shrink-0 transition-colors cursor-pointer ${visual.pillClass}`}
        >
          {visual.icon}
          <span>{metadata.label}</span>
        </button>
      ) : (
        <span
          data-testid="titlebar-save-state"
          data-save-state={saveState}
          aria-label={metadata.ariaLabel}
          title={savedTooltip}
          className={`px-2 py-[2px] rounded-full border text-[11px] font-semibold inline-flex items-center gap-1 shrink-0 select-none ${visual.pillClass}`}
        >
          {visual.icon}
          <span>{metadata.label}</span>
        </span>
      )}

      {isConflict && onKeepMine && (
        <button
          type="button"
          data-testid="titlebar-conflict-resolve"
          data-no-drag="true"
          onClick={() => void onKeepMine()}
          title="Ghi đè bản trên máy chủ bằng bản đang sửa trên máy"
          className="px-2 py-[2px] rounded-full border border-rose-300 bg-rose-100 hover:bg-rose-200 text-rose-800 text-[10.5px] font-bold shrink-0 cursor-pointer transition-colors"
        >
          Ghi đè
        </button>
      )}
    </div>
  );
};
