'use client';

import React, { useState } from 'react';
import { CompletePaper } from '@/types/paper';
import { UniversalTemplateSchema } from '@/types/template-builder';
import { compilePaperToTypst } from '@/lib/authoring/typst-paper-compiler';
import {
  Code2,
  Copy,
  Check,
  Download,
  Terminal,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import { toast } from '@/components/DynamicIslandToast';

interface TypstExportTabProps {
  paper: CompletePaper;
  template: UniversalTemplateSchema;
}

export const TypstExportTab: React.FC<TypstExportTabProps> = ({
  paper,
  template,
}) => {
  const [isCopied, setIsCopied] = useState(false);
  const typstCode = compilePaperToTypst(paper, template);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(typstCode);
      setIsCopied(true);
      toast.success('Đã sao chép mã nguồn Typst vào clipboard!');
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      toast.error('Không thể sao chép mã nguồn');
    }
  };

  const handleDownload = () => {
    const blob = new Blob([typstCode], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeTitle = (paper.metadata.title || 'paper')
      .replace(/[^a-zA-Z0-9_\u00C0-\u024F\u1E00-\u1EFF]/g, '_')
      .slice(0, 40);
    a.download = `${safeTitle}_typst.typ`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success(
      'Đã tải xuống tệp Typst (.typ)!',
      `Tệp ${a.download} đã sẵn sàng để biên dịch với trình biên dịch typst compile.`
    );
  };

  const lineCount = typstCode.split('\n').length;
  const byteCount = new Blob([typstCode]).size;

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Top action header */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-slate-900 text-[#78C841] flex items-center justify-center font-mono font-bold text-base">
            typ
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-extrabold text-sm sm:text-base text-slate-900">
                Mã nguồn Typst Hoàn chỉnh (.typ)
              </h3>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                Chuẩn Typst 0.13+
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Được tự động sinh từ cấu trúc mẫu &ldquo;{template.name}&rdquo; và dữ liệu bài báo của bạn
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-all cursor-pointer"
          >
            {isCopied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-emerald-600">Đã sao chép</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Sao chép mã</span>
              </>
            )}
          </button>

          <button
            onClick={handleDownload}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-linear-to-r from-[#78C841] to-emerald-600 text-white text-xs font-bold shadow-md shadow-emerald-600/20 hover:from-emerald-600 hover:to-emerald-700 active:scale-95 transition-all cursor-pointer"
          >
            <Download className="w-4 h-4" />
            Tải tệp .typ
          </button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="flex items-center justify-between text-xs text-slate-500 px-1">
        <div className="flex items-center gap-3">
          <span>{lineCount} dòng mã</span>
          <span>•</span>
          <span>{(byteCount / 1024).toFixed(1)} KB</span>
          <span>•</span>
          <span>Định dạng UTF-8</span>
        </div>
        <div className="flex items-center gap-1 text-[#14532D] font-medium">
          <Terminal className="w-3.5 h-3.5" />
          <span>Biên dịch: typst compile {paper.id}.typ {paper.id}.pdf</span>
        </div>
      </div>

      {/* Code Viewer Container */}
      <div className="rounded-2xl border border-slate-800 bg-[#0F172A] p-4 sm:p-5 shadow-xl overflow-hidden text-slate-200">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3 text-xs text-slate-400 font-mono">
          <span className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" />
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
            <span className="text-slate-300 font-bold ml-2">document.typ</span>
          </span>
          <span>Typst Scientific Document</span>
        </div>

        <pre className="text-xs font-mono leading-relaxed overflow-x-auto max-h-[600px] text-slate-300 selection:bg-emerald-500/30 selection:text-white">
          {typstCode}
        </pre>
      </div>
    </div>
  );
};
