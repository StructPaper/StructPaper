'use client';

import React, { useState } from 'react';
import { Copy, Check, Download, ExternalLink, Archive, FileCode } from 'lucide-react';
import { CompletePaper } from '@/lib/sample-papers';
import { generateFullJournalLatex, generateLatexPackageZip } from '@/lib/latex-template';
import { downloadTextFile } from '@/lib/exporters';

interface LatexSourceViewProps {
  paper: CompletePaper;
}

export const LatexSourceView: React.FC<LatexSourceViewProps> = ({ paper }) => {
  const [copied, setCopied] = useState<boolean>(false);
  const [isZipping, setIsZipping] = useState<boolean>(false);

  const latexCode = generateFullJournalLatex(paper);
  const lineCount = latexCode.split('\n').length;
  const charCount = latexCode.length;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(latexCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = latexCode;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleDownloadTex = () => {
    downloadTextFile(
      latexCode,
      `${paper.metadata.journalId || 'Article'}_${paper.metadata.year || '2026'}.tex`,
      'text/plain'
    );
  };

  const handleDownloadZip = async () => {
    try {
      setIsZipping(true);
      const blob = await generateLatexPackageZip(paper);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${paper.metadata.journalId || 'Article'}_LaTeX_Package.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e: any) {
      console.error(e);
      alert('Lỗi tạo gói ZIP: ' + e.message);
    } finally {
      setIsZipping(false);
    }
  };

  return (
    <div className="soft-card bg-white border border-zinc-200 overflow-hidden shadow-md">
      {/* Top Banner / Toolbar */}
      <div className="bg-zinc-50 border-b border-zinc-200 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-zinc-100 text-zinc-700 flex items-center justify-center font-bold">
            <FileCode className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-zinc-900 font-mono">
                {paper.metadata.journalId || 'article'}.tex
              </span>
              <span className="pill-badge bg-emerald-100 text-emerald-800 text-[10px] py-0.5 px-2">
                XeLaTeX Ready
              </span>
            </div>
            <p className="text-xs text-zinc-500">
              Đã thế nội dung bài báo vào mẫu gốc VNUHCM ({lineCount.toLocaleString()} dòng • {(charCount / 1024).toFixed(1)} KB)
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleCopy}
            className={`btn-pill-subtle text-xs py-1.5 px-3 ${
              copied ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : ''
            }`}
            title="Sao chép toàn bộ mã nguồn LaTeX"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Đã sao chép!' : 'Sao chép mã'}</span>
          </button>

          <button
            onClick={handleDownloadTex}
            className="btn-pill-subtle text-xs py-1.5 px-3 hover:bg-white"
            title="Tải về file article.tex"
          >
            <Download className="w-3.5 h-3.5 text-gray-700" />
            <span>Tải .tex</span>
          </button>

          <button
            onClick={handleDownloadZip}
            disabled={isZipping}
            className="btn-pill-subtle text-xs py-1.5 px-3 bg-zinc-100 border-zinc-200 text-zinc-700 font-bold hover:bg-zinc-200"
            title="Tải trọn bộ gói ZIP gồm file .tex, .bib và toàn bộ hình ảnh"
          >
            <Archive className="w-3.5 h-3.5 text-zinc-700" />
            <span>{isZipping ? 'Đang nén ZIP...' : 'Tải trọn gói ZIP (tex + ảnh)'}</span>
          </button>

          {/* Form to submit directly to Overleaf */}
          <form
            action="https://www.overleaf.com/docs"
            method="POST"
            target="_blank"
            className="inline-block"
          >
            <input type="hidden" name="snip" value={latexCode} />
            <button
              type="submit"
              className="btn-pill-green text-xs py-1.5 px-3.5 font-bold shadow-xs flex items-center gap-1.5"
              title="Mở và biên dịch trực tiếp trên trình soạn thảo Overleaf"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Mở trên Overleaf</span>
            </button>
          </form>
        </div>
      </div>

      {/* LaTeX Code Display Area */}
      <div className="relative bg-[#1E1E2E] text-[#CDD6F4] text-xs font-mono p-4 max-h-[750px] overflow-auto leading-relaxed select-text">
        <pre className="overflow-x-auto whitespace-pre font-mono">
          <code>
            {latexCode.split('\n').map((line, idx) => {
              const lineNum = idx + 1;
              const isComment = line.trim().startsWith('%');
              const isCommand = line.trim().startsWith('\\');
              const isBeginEnd = line.includes('\\begin{') || line.includes('\\end{');

              let lineClass = 'text-[#CDD6F4]';
              if (isComment) lineClass = 'text-[#6C7086] italic';
              else if (isBeginEnd) lineClass = 'text-[#F5C2E7] font-semibold';
              else if (isCommand) lineClass = 'text-[#89B4FA]';

              return (
                <div key={lineNum} className="table-row hover:bg-white/5 py-0.5">
                  <span className="table-cell select-none text-right pr-4 text-[#585B70] w-12 font-mono">
                    {lineNum}
                  </span>
                  <span className={`table-cell ${lineClass}`}>
                    {line}
                  </span>
                </div>
              );
            })}
          </code>
        </pre>
      </div>

      {/* Footer Info */}
      <div className="bg-zinc-50 border-t border-zinc-200 px-4 py-2.5 text-[11px] text-zinc-500 flex items-center justify-between">
        <span>
          💡 <strong>Khuyên dùng:</strong> Bấm <em>&quot;Tải trọn gói ZIP&quot;</em> hoặc <em>&quot;Mở trên Overleaf&quot;</em> để biên dịch ra file PDF hoàn toàn 100% giống mẫu tạp chí VNUHCM với font Minion Pro &amp; Myriad Pro.
        </span>
        <span className="font-mono text-gray-500">
          Template: ID630_HS XeLaTeX
        </span>
      </div>
    </div>
  );
};
