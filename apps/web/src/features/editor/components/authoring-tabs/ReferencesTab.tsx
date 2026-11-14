'use client';

import React, { useState } from 'react';
import { PaperReference } from '@/types/paper';
import {
  BookMarked,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Search,
  ExternalLink,
  Sparkles,
} from 'lucide-react';

interface ReferencesTabProps {
  references: PaperReference[];
  onChange: (updated: PaperReference[]) => void;
}

export const ReferencesTab: React.FC<ReferencesTabProps> = ({
  references = [],
  onChange,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [newRawCitation, setNewRawCitation] = useState('');

  const handleAddRawReference = () => {
    const trimmed = newRawCitation.trim();
    if (!trimmed) return;

    const nextId =
      references.length > 0
        ? Math.max(...references.map((r) => r.id)) + 1
        : 1;

    // Try to extract year in parentheses or 4 digits
    const yearMatch = trimmed.match(/\b(19\d\d|20\d\d)\b/);
    const year = yearMatch ? yearMatch[0] : new Date().getFullYear().toString();

    const newRef: PaperReference = {
      id: nextId,
      raw: trimmed,
      title: trimmed.slice(0, 80),
      year,
      isCited: true,
      citationCount: 1,
    };

    onChange([...references, newRef]);
    setNewRawCitation('');
  };

  const handleUpdateReference = (id: number, updated: Partial<PaperReference>) => {
    const next = references.map((r) => (r.id === id ? { ...r, ...updated } : r));
    onChange(next);
  };

  const handleDeleteReference = (id: number) => {
    const next = references.filter((r) => r.id !== id);
    onChange(next);
  };

  const handleMoveReference = (index: number, direction: 'up' | 'down') => {
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= references.length) return;
    const next = [...references];
    const temp = next[index];
    next[index] = next[target];
    next[target] = temp;
    onChange(next);
  };

  const filteredReferences = references.filter(
    (r) =>
      (r.raw || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.authors || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header Bar */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <BookMarked className="w-5 h-5 text-[#78C841]" />
            <div>
              <h3 className="font-extrabold text-sm sm:text-base text-slate-900">
                Tài liệu tham khảo ({references.length} mục)
              </h3>
              <p className="text-xs text-slate-500">
                Đánh số tự động [1], [2] theo chuẩn IEEE / APA và đồng bộ trực tiếp vào Typst bibliography
              </p>
            </div>
          </div>
        </div>

        {/* Quick Add Input */}
        <div className="space-y-2">
          <label className="block text-xs font-bold text-slate-700">
            Dán chuỗi trích dẫn (APA, IEEE, BibTeX raw string):
          </label>
          <div className="flex items-start gap-2">
            <textarea
              value={newRawCitation}
              onChange={(e) => setNewRawCitation(e.target.value)}
              rows={2}
              className="flex-1 text-xs font-medium rounded-xl border border-slate-200 p-2.5 text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#78C841]/30 transition-all resize-y"
              placeholder="VD: LeCun, Y., Bengio, Y., & Hinton, G. (2015). Deep learning. Nature, 521(7553), 436-444."
            />
            <button
              onClick={handleAddRawReference}
              disabled={!newRawCitation.trim()}
              className="inline-flex items-center gap-1.5 px-4 py-3 rounded-xl bg-linear-to-r from-[#78C841] to-emerald-600 text-white text-xs font-bold shadow-md shadow-emerald-600/20 hover:from-emerald-600 hover:to-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4" />
              Thêm trích dẫn
            </button>
          </div>
        </div>
      </div>

      {/* Search & References List */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs font-semibold rounded-xl border border-slate-200 pl-8 p-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#78C841]/30"
              placeholder="Tìm kiếm tài liệu tham khảo..."
            />
          </div>
          <span className="text-xs text-slate-400">
            Hiển thị {filteredReferences.length} / {references.length}
          </span>
        </div>

        <div className="space-y-3">
          {filteredReferences.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-xs">
              Chưa tìm thấy tài liệu tham khảo phù hợp.
            </div>
          ) : (
            filteredReferences.map((ref, idx) => (
              <div
                key={ref.id || idx}
                className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white hover:border-slate-300 transition-all space-y-2 group"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5 flex-1">
                    <span className="w-6 h-6 rounded-lg bg-emerald-100 text-[#14532D] text-xs font-black flex items-center justify-center shrink-0 mt-0.5">
                      [{ref.id}]
                    </span>
                    <div className="flex-1 space-y-1">
                      <textarea
                        value={ref.raw || ''}
                        onChange={(e) =>
                          handleUpdateReference(ref.id, { raw: e.target.value })
                        }
                        rows={2}
                        className="w-full text-xs text-slate-800 bg-transparent rounded p-1 border border-transparent hover:border-slate-200 focus:bg-white focus:border-emerald-500 focus:outline-none transition-all resize-y"
                      />
                      <div className="flex items-center gap-2 text-[11px] text-slate-400">
                        {ref.year && <span>Năm: {ref.year}</span>}
                        {ref.doi && (
                          <span className="text-emerald-700 font-mono">
                            DOI: {ref.doi}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      disabled={idx === 0}
                      onClick={() => handleMoveReference(idx, 'up')}
                      className="p-1 rounded-lg bg-white border border-slate-200 text-slate-500 hover:text-slate-800 disabled:opacity-30 cursor-pointer"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      disabled={idx === filteredReferences.length - 1}
                      onClick={() => handleMoveReference(idx, 'down')}
                      className="p-1 rounded-lg bg-white border border-slate-200 text-slate-500 hover:text-slate-800 disabled:opacity-30 cursor-pointer"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteReference(ref.id)}
                      className="p-1 rounded-lg bg-white border border-slate-200 text-red-500 hover:bg-red-50 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
