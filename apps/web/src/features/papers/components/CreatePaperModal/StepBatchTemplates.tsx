'use client';

import React, { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, FileText } from 'lucide-react';
import { ManagedJournalProfile, getDefaultVnuhcmJournals } from '@/lib/templates/journal-storage';
import { CompactTemplateCard } from './CompactTemplateCard';

interface StepBatchTemplatesProps {
  files: File[];
  /** One template per file, in file order. */
  onConfirm: (choices: ManagedJournalProfile[]) => void;
  onBack: () => void;
}

const shortName = (j: ManagedJournalProfile) => j.profile.names?.short || j.id.toUpperCase();

/**
 * Template choice for a multi-file import: one template for every file (default), or a template of its
 * own for each file (e.g. a Health Sciences paper and an Economics paper in the same batch).
 */
export const StepBatchTemplates: React.FC<StepBatchTemplatesProps> = ({ files, onConfirm, onBack }) => {
  const journals = useMemo(() => getDefaultVnuhcmJournals(), []);
  const [perFile, setPerFile] = useState(false);
  const [shared, setShared] = useState<ManagedJournalProfile>(journals[0]);
  const [own, setOwn] = useState<string[]>(() => files.map(() => journals[0].id));

  const byId = (id: string) => journals.find((j) => j.id === id) || journals[0];
  const choices = perFile ? own.map(byId) : files.map(() => shared);
  const distinct = new Set(choices.map((c) => c.id)).size;

  const setAll = (id: string) => setOwn(files.map(() => id));

  return (
    <div className="flex-1 min-h-0 flex flex-col space-y-3">
      <div className="flex-shrink-0 flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Quay lại tải file</span>
        </button>
        <div className="inline-flex rounded-full bg-slate-200/70 p-0.5 text-[11px] font-extrabold" role="tablist">
          {[
            { id: false, label: 'Một mẫu cho tất cả', testid: 'batch-template-same' },
            { id: true, label: 'Mỗi tệp một mẫu', testid: 'batch-template-each' },
          ].map((o) => (
            <button
              key={o.testid}
              type="button"
              role="tab"
              aria-selected={perFile === o.id}
              data-testid={o.testid}
              onClick={() => setPerFile(o.id)}
              className={`px-3 py-1.5 rounded-full transition-all cursor-pointer ${perFile === o.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {!perFile ? (
        <div className="flex-1 min-h-0 p-1 px-1.5 grid grid-cols-1 sm:grid-cols-2 gap-2 overflow-y-auto pr-1 custom-scrollbar">
          {journals.map((j) => (
            <CompactTemplateCard key={j.id} managed={j} isSelected={shared.id === j.id} onSelect={setShared} />
          ))}
        </div>
      ) : (
        <div className="flex-1 min-h-0 flex flex-col space-y-2 overflow-hidden" data-testid="batch-template-list">
          <label className="flex-shrink-0 flex items-center justify-between gap-3 text-[11px] font-bold text-slate-500">
            <span>Đặt cùng một mẫu cho tất cả các tệp</span>
            <select
              data-testid="batch-template-all"
              value=""
              onChange={(e) => e.target.value && setAll(e.target.value)}
              className="rounded-xl bg-white border border-zinc-200 px-2.5 py-1.5 text-xs font-semibold text-zinc-800 cursor-pointer"
            >
              <option value="">Chọn…</option>
              {journals.map((j) => (
                <option key={j.id} value={j.id}>
                  {shortName(j)}
                </option>
              ))}
            </select>
          </label>
          <ul className="flex-1 min-h-0 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
            {files.map((f, i) => (
              <li key={`${i}:${f.name}`} className="flex items-center gap-2.5 rounded-2xl bg-white border border-slate-200 px-3 py-2">
                <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                <span className="min-w-0 flex-1 truncate text-[13px] font-bold text-slate-900" title={f.name}>
                  {f.name}
                </span>
                <select
                  data-testid="batch-template-select"
                  aria-label={`Mẫu tạp chí cho ${f.name}`}
                  value={own[i]}
                  onChange={(e) => setOwn((prev) => prev.map((v, k) => (k === i ? e.target.value : v)))}
                  className="shrink-0 max-w-[48%] rounded-xl bg-white border border-zinc-200 px-2.5 py-1.5 text-xs font-semibold text-zinc-800 cursor-pointer"
                >
                  {journals.map((j) => (
                    <option key={j.id} value={j.id}>
                      {shortName(j)} – {j.profile.names?.vi || j.profile.names?.en || j.id}
                    </option>
                  ))}
                </select>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex-shrink-0 pt-3 border-t border-slate-200/60 flex items-center justify-between">
        <div className="text-xs text-slate-500 font-medium" data-testid="batch-template-hint">
          {perFile ? (
            <>
              <span className="font-black text-slate-900">{files.length}</span> tệp · <span className="font-black text-slate-900">{distinct}</span> mẫu khác nhau
            </>
          ) : (
            <>
              Mẫu đang chọn: <span className="font-black text-slate-900">{shortName(shared)}</span>
            </>
          )}
        </div>
        <button
          type="button"
          data-testid="continue-to-editor-btn"
          onClick={() => onConfirm(choices)}
          className="px-6 py-2.5 rounded-full bg-[#78C841] hover:bg-[#6cb43a] text-zinc-950 font-extrabold text-xs inline-flex items-center gap-2 shadow-md shadow-[#78C841]/20 hover:scale-102 active:scale-98 transition-all cursor-pointer"
        >
          <span>Tiếp tục</span>
          <ArrowRight className="w-4 h-4 stroke-[2.5]" />
        </button>
      </div>
    </div>
  );
};
