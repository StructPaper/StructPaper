'use client';

import React, { useState, useMemo } from 'react';
import {
  JournalProfile,
  resolveProfile,
  ALL_ARTICLE_TYPES,
} from '@structpaper/journal-profiles';
import { Copy, Check, Download, Code2, Layers } from 'lucide-react';
import { toast } from '@/components/DynamicIslandToast';

interface JournalJsonInspectorTabProps {
  profile: JournalProfile;
}

export const JournalJsonInspectorTab: React.FC<JournalJsonInspectorTabProps> = ({
  profile,
}) => {
  const [copied, setCopied] = useState(false);
  const [selectedArticleType, setSelectedArticleType] = useState<string>('research');

  // Compute resolved JSON preview dynamically
  const resolvedJson = useMemo(() => {
    try {
      // If journal is a recognized VNUHCM id, resolve it with chosen article type and current profile overrides
      const resolved = resolveProfile(profile.id, selectedArticleType, profile);
      return JSON.stringify(resolved, null, 2);
    } catch {
      // Fallback for custom journals
      return JSON.stringify({ ...profile, articleType: selectedArticleType }, null, 2);
    }
  }, [profile, selectedArticleType]);

  const handleCopy = () => {
    navigator.clipboard.writeText(resolvedJson);
    setCopied(true);
    toast.success('Đã sao chép JSON', 'Nội dung JSON cấu hình 3-tier đã được lưu vào clipboard.');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([resolvedJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `journal-profile-${profile.id || 'custom'}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Đã tải xuống JSON', `Đã xuất file journal-profile-${profile.id}.json`);
  };

  return (
    <div className="space-y-4 max-w-4xl">
      {/* Action Header */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Code2 className="w-4 h-4 text-[#78C841]" />
          <div>
            <h3 className="font-extrabold text-sm text-slate-900">
              Resolved JSON Profile (3-Tier Merged Result)
            </h3>
            <p className="text-[11px] text-slate-500">
              Kết quả hòa trộn tự động: Base Profile &rarr; Journal Tier &rarr; Article Type Tier &rarr; Overrides.
            </p>
          </div>
        </div>

        {/* Article type preview selector + Copy/Download buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <select
            value={selectedArticleType}
            onChange={(e) => setSelectedArticleType(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-800 outline-none"
          >
            {ALL_ARTICLE_TYPES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label.vi} ({t.id})
              </option>
            ))}
          </select>

          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-[#14532D]" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Đã sao chép' : 'Sao chép'}</span>
          </button>

          <button
            onClick={handleDownload}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-xs"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Tải JSON</span>
          </button>
        </div>
      </div>

      {/* Code Viewer */}
      <div className="bg-slate-950 text-lime-400 font-mono text-xs p-4 rounded-2xl border border-slate-800 shadow-md max-h-[500px] overflow-auto">
        <pre>{resolvedJson}</pre>
      </div>
    </div>
  );
};
