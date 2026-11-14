'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Cloud, HardDrive, FileText, Loader2, Search, X } from 'lucide-react';
import { ModalPortal } from '@/components/modals/ModalPortal';
import { defaultDatabase, IndexedDbManuscriptRepo } from '@structpaper/storage';
import { DocumentApi } from '@/lib/documents/document-api';

export interface OpenListItem {
  id: string;
  name: string;
  journalId?: string | null;
  status?: string;
  updatedAt?: string;
  where: 'local' | 'cloud' | 'both';
}

/** Merge local (IndexedDB) and server lists by id; newest first. Pure → unit-testable. */
export function mergeDocumentLists(
  local: Array<{ id: string; name: string; journalId?: string; status?: string; updatedAt?: string }>,
  cloud: Array<{ id: string; name: string; journalId?: string | null; status?: string; updatedAt?: string }>
): OpenListItem[] {
  const map = new Map<string, OpenListItem>();
  for (const l of local) map.set(l.id, { ...l, where: 'local' });
  for (const c of cloud) {
    const cur = map.get(c.id);
    if (cur) {
      const newer = (c.updatedAt || '') > (cur.updatedAt || '');
      map.set(c.id, { ...cur, ...(newer ? { name: c.name, updatedAt: c.updatedAt } : {}), where: 'both' });
    } else {
      map.set(c.id, { ...c, where: 'cloud' });
    }
  }
  return [...map.values()].sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onOpen: (item: OpenListItem) => Promise<void> | void;
  api?: DocumentApi;
}

export const OpenDocumentDialog: React.FC<Props> = ({ isOpen, onClose, onOpen, api }) => {
  const [items, setItems] = useState<OpenListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [cloudError, setCloudError] = useState(false);
  const [query, setQuery] = useState('');
  const [openingId, setOpeningId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    let alive = true;
    setLoading(true);
    setCloudError(false);
    (async () => {
      let local: Parameters<typeof mergeDocumentLists>[0] = [];
      try {
        const repo = new IndexedDbManuscriptRepo(defaultDatabase);
        const recs = await repo.listRecords();
        local = recs
          .filter((r) => !r.info.archived)
          .map((r) => ({
            id: r.info.id,
            name: r.info.displayName,
            journalId: r.doc?.journalId,
            status: r.info.workflowStatus,
            updatedAt: r.info.updatedAt,
          }));
      } catch {
        /* IndexedDB unavailable: continue with cloud only */
      }
      let cloud: Parameters<typeof mergeDocumentLists>[1] = [];
      try {
        cloud = await (api ?? new DocumentApi()).list();
      } catch {
        if (alive) setCloudError(true);
      }
      if (alive) {
        setItems(mergeDocumentLists(local, cloud));
        setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [isOpen, api]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? items.filter((i) => i.name.toLowerCase().includes(q)) : items;
  }, [items, query]);

  const open = async (item: OpenListItem) => {
    setOpeningId(item.id);
    try {
      await onOpen(item);
    } finally {
      setOpeningId(null);
    }
  };

  return (
    <ModalPortal isOpen={isOpen} onClose={onClose} zIndex={130}>
      <div className="bg-[#F8F9FA] w-full max-w-lg rounded-[32px] shadow-2xl border border-white/20 overflow-hidden" role="dialog" aria-label="Mở tài liệu">
        <div className="px-6 pt-5 pb-3 flex items-center justify-between">
          <h3 className="text-lg font-black text-slate-900 tracking-tight">Mở tài liệu</h3>
          <button type="button" onClick={onClose} aria-label="Đóng" className="w-9 h-9 rounded-full bg-gray-200/70 flex items-center justify-center text-gray-500 hover:bg-gray-200">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-6 pb-6 space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tìm theo tên tài liệu…"
              aria-label="Tìm tài liệu"
              className="w-full rounded-full bg-white border border-zinc-200 pl-9 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-lime-300"
            />
          </div>
          {cloudError && (
            <p className="text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-1.5">
              Không kết nối được máy chủ — chỉ hiển thị tài liệu lưu trên máy này.
            </p>
          )}
          <ul className="max-h-[50vh] overflow-y-auto space-y-1.5" data-testid="open-document-list">
            {loading && (
              <li className="flex items-center gap-2 text-sm text-zinc-500 py-6 justify-center">
                <Loader2 className="w-4 h-4 animate-spin" /> Đang tải danh sách…
              </li>
            )}
            {!loading && filtered.length === 0 && (
              <li className="text-sm text-zinc-500 text-center py-6">Chưa có tài liệu nào được lưu.</li>
            )}
            {filtered.map((it) => (
              <li key={it.id}>
                <button
                  type="button"
                  onClick={() => open(it)}
                  disabled={openingId !== null}
                  className="w-full text-left flex items-center gap-3 rounded-2xl bg-white hover:bg-lime-50 border border-zinc-200 px-3.5 py-2.5 disabled:opacity-60"
                >
                  <FileText className="w-4 h-4 text-zinc-500 shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold text-zinc-900 truncate">{it.name}</span>
                    <span className="block text-[11px] text-zinc-500">
                      {it.updatedAt ? new Date(it.updatedAt).toLocaleString('vi-VN') : '—'}
                    </span>
                  </span>
                  {openingId === it.id ? (
                    <Loader2 className="w-4 h-4 animate-spin text-zinc-500" />
                  ) : (
                    <span className="flex items-center gap-1 text-zinc-400" title={it.where === 'both' ? 'Trên máy và máy chủ' : it.where === 'cloud' ? 'Trên máy chủ' : 'Trên máy này'}>
                      {(it.where === 'local' || it.where === 'both') && <HardDrive className="w-3.5 h-3.5" />}
                      {(it.where === 'cloud' || it.where === 'both') && <Cloud className="w-3.5 h-3.5" />}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </ModalPortal>
  );
};
