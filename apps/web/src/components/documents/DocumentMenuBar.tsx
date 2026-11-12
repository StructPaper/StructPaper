'use client';

import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, FilePlus2, FolderOpen, Save, FileDown, Check, CloudOff, Loader2, AlertTriangle, Cloud } from 'lucide-react';
import type { SaveState } from '@/lib/documents/autosave-controller';

export type ExportFormat = 'docx' | 'pdf' | 'xml';

export interface DocumentMenuBarProps {
  name: string;
  onRename: (name: string) => void;
  saveState: SaveState;
  savedAt: number | null;
  onNew: () => void;
  onOpen: () => void;
  onSave: () => void;
  onExport: (format: ExportFormat) => void;
  onKeepMine?: () => void;
  exporting?: Partial<Record<ExportFormat, boolean>>;
}

const STATE_UI: Record<SaveState, { text: string; cls: string; icon: React.ReactNode }> = {
  idle: { text: 'Chưa có thay đổi', cls: 'text-zinc-500', icon: <Check className="w-3.5 h-3.5" /> },
  dirty: { text: 'Đang chờ lưu…', cls: 'text-zinc-500', icon: <Loader2 className="w-3.5 h-3.5 animate-pulse" /> },
  saving: { text: 'Đang lưu…', cls: 'text-zinc-600', icon: <Loader2 className="w-3.5 h-3.5 animate-spin" /> },
  saved: { text: 'Đã lưu', cls: 'text-lime-700', icon: <Cloud className="w-3.5 h-3.5" /> },
  'saved-local': { text: 'Đã lưu trên máy (chưa đồng bộ máy chủ)', cls: 'text-amber-700', icon: <CloudOff className="w-3.5 h-3.5" /> },
  conflict: { text: 'Xung đột phiên bản', cls: 'text-red-700', icon: <AlertTriangle className="w-3.5 h-3.5" /> },
  error: { text: 'Lưu thất bại', cls: 'text-red-700', icon: <AlertTriangle className="w-3.5 h-3.5" /> },
};

export const DocumentMenuBar: React.FC<DocumentMenuBarProps> = ({
  name,
  onRename,
  saveState,
  savedAt,
  onNew,
  onOpen,
  onSave,
  onExport,
  onKeepMine,
  exporting = {},
}) => {
  const [menu, setMenu] = useState<null | 'file' | 'export'>(null);
  const [draft, setDraft] = useState(name);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => setDraft(name), [name]);
  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setMenu(null);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [menu]);

  const commitName = () => {
    const v = draft.trim();
    if (!v) setDraft(name);
    else if (v !== name) onRename(v);
  };

  const st = STATE_UI[saveState];
  const busy = (Object.keys(exporting) as ExportFormat[]).find((f) => exporting[f]);
  const item = 'w-full text-left px-3 py-1.5 text-xs font-semibold text-zinc-800 hover:bg-lime-50 flex items-center gap-2 rounded-lg';

  return (
    <div
      ref={ref}
      data-testid="document-menu-bar"
      className="relative z-30 flex items-center gap-2 px-3 py-1.5 mb-1.5 rounded-2xl bg-white/80 backdrop-blur border border-zinc-200 shadow-2xs"
    >
      <div className="relative">
        <button
          type="button"
          onClick={() => setMenu(menu === 'file' ? null : 'file')}
          aria-haspopup="menu"
          aria-expanded={menu === 'file'}
          className="px-3 py-1 rounded-xl text-xs font-extrabold text-zinc-800 hover:bg-zinc-100 flex items-center gap-1"
        >
          Tệp <ChevronDown className="w-3 h-3" />
        </button>
        {menu === 'file' && (
          <div role="menu" className="absolute left-0 top-full mt-1 w-56 p-1 rounded-2xl bg-white border border-zinc-200 shadow-xl">
            <button role="menuitem" className={item} onClick={() => { setMenu(null); onNew(); }}>
              <FilePlus2 className="w-3.5 h-3.5" /> Mới…
            </button>
            <button role="menuitem" className={item} onClick={() => { setMenu(null); onOpen(); }}>
              <FolderOpen className="w-3.5 h-3.5" /> Mở…
            </button>
            <button role="menuitem" className={item} onClick={() => { setMenu(null); onSave(); }}>
              <Save className="w-3.5 h-3.5" /> Lưu <kbd className="ml-auto text-[10px] text-zinc-400">Ctrl+S</kbd>
            </button>
            <div className="my-1 border-t border-zinc-100" />
            <p className="px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-zinc-400">Xuất thành</p>
            {(['docx', 'pdf', 'xml'] as ExportFormat[]).map((f) => (
              <button
                key={f}
                role="menuitem"
                disabled={!!busy}
                className={`${item} disabled:opacity-50`}
                onClick={() => { setMenu(null); onExport(f); }}
              >
                {exporting[f] ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileDown className="w-3.5 h-3.5" />}
                {f === 'docx' ? 'Word (.docx)' : f === 'pdf' ? 'PDF (.pdf)' : 'XML JATS (.xml)'}
              </button>
            ))}
          </div>
        )}
      </div>

      {busy && (
        <span role="status" aria-live="polite" data-testid="export-status" className="flex items-center gap-1 text-[11px] font-bold text-lime-700 whitespace-nowrap">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          {busy === 'pdf' ? 'Đang xuất PDF…' : busy === 'docx' ? 'Đang xuất Word…' : 'Đang xuất XML…'}
        </span>
      )}

      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commitName}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          if (e.key === 'Escape') setDraft(name);
        }}
        aria-label="Tên tài liệu"
        maxLength={200}
        className="min-w-0 flex-1 max-w-md bg-transparent rounded-lg px-2 py-1 text-sm font-bold text-zinc-900 outline-none hover:bg-zinc-100 focus:bg-white focus:ring-2 focus:ring-lime-300 truncate"
      />

      <div className={`ml-auto flex items-center gap-1.5 text-[11px] font-bold ${st.cls}`} role="status" aria-live="polite" data-testid="save-status" data-state={saveState}>
        {st.icon}
        <span className="hidden sm:inline">{st.text}</span>
        {saveState === 'saved' && savedAt && (
          <span className="hidden md:inline font-medium opacity-70">
            {new Date(savedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
        {saveState === 'conflict' && onKeepMine && (
          <button type="button" onClick={onKeepMine} className="ml-1 px-2 py-0.5 rounded-lg bg-red-100 hover:bg-red-200 text-red-800 text-[10px] font-bold">
            Ghi đè bằng bản của tôi
          </button>
        )}
      </div>
    </div>
  );
};
