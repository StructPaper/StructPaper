'use client';

import React, { useState } from 'react';
import { DocumentTemplateSchema } from '@/types/template-builder';
import { generateTypstTemplate } from '@/lib/template-builder/typst-generator';
import { generateLatexTemplate } from '@/lib/template-builder/latex-generator';
import { Copy, Check, Download, Code2, Terminal, Braces } from 'lucide-react';
import { toast } from '@/components/DynamicIslandToast';

interface CodePreviewTabsProps {
  schema: DocumentTemplateSchema;
}

export const CodePreviewTabs: React.FC<CodePreviewTabsProps> = ({ schema }) => {
  const [activeTab, setActiveTab] = useState<'typst' | 'latex' | 'json'>('typst');
  const [copied, setCopied] = useState<boolean>(false);

  const typstCode = generateTypstTemplate(schema);
  const latexCode = generateLatexTemplate(schema);
  const jsonCode = JSON.stringify(schema, null, 2);

  const currentCode =
    activeTab === 'typst' ? typstCode : activeTab === 'latex' ? latexCode : jsonCode;

  const currentFilename =
    activeTab === 'typst'
      ? `${schema.id || 'template'}.typ`
      : activeTab === 'latex'
      ? `${schema.id || 'template'}.tex`
      : `${schema.id || 'template'}.json`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(currentCode);
      setCopied(true);
      toast.success('Sao chép mã', 'Đã lưu mã nguồn vào clipboard!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Không thể sao chép');
    }
  };

  const handleDownload = () => {
    const mimeType =
      activeTab === 'json' ? 'application/json' : 'text/plain;charset=utf-8';
    const blob = new Blob([currentCode], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = currentFilename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Tải xuống', `Đã tải xuống file ${currentFilename}`);
  };

  return (
    <div className="flex flex-col h-full bg-[#1E293B] rounded-3xl border border-slate-700 overflow-hidden text-slate-100 shadow-xl">
      {/* Tab bar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900 border-b border-slate-700">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setActiveTab('typst')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'typst'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>Mã Typst (.typ)</span>
            <span className="px-1.5 py-0.2 rounded text-[9px] bg-blue-500/30 text-blue-200">
              0.05s Live
            </span>
          </button>

          <button
            onClick={() => setActiveTab('latex')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'latex'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>LaTeX XeTeX (.tex)</span>
          </button>

          <button
            onClick={() => setActiveTab('json')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'json'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Braces className="w-3.5 h-3.5" />
            <span>JSON Schema</span>
          </button>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Đã sao chép' : 'Sao chép'}</span>
          </button>

          <button
            onClick={handleDownload}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Tải về file</span>
          </button>
        </div>
      </div>

      {/* Code Editor Viewport */}
      <div className="flex-1 overflow-auto p-4 font-mono text-[11.5px] leading-relaxed text-slate-300 selection:bg-blue-600 selection:text-white">
        <pre className="whitespace-pre-wrap">{currentCode}</pre>
      </div>

      {/* Footer Info */}
      <div className="px-4 py-2 bg-slate-900/80 border-t border-slate-800 text-[10px] text-slate-400 flex items-center justify-between">
        <span>Template: {schema.name}</span>
        <span>
          Được sinh tự động từ Element Schema Engine • Sẵn sàng nạp vào Backend biên dịch
        </span>
      </div>
    </div>
  );
};
