'use client';

import React, { useRef, useState } from 'react';
import {
  UploadCloud,
  FileText,
  CheckCircle2,
  BookOpen,
  Layers,
  ArrowRight,
  Sparkles,
  Filter,
  Loader2,
  FilePlus,
} from 'lucide-react';
import { CompletePaper, ALL_SAMPLE_PAPERS } from '@/lib/sample-papers';
import { createEmptyPaper } from '@/types/paper';
import { parseDocxFile } from '@/lib/docx-parser';
import { JOURNAL_TEMPLATES } from '@/lib/templates';
import { usePaper } from '@/context/PaperContext';
import { Select, SelectOption } from './ui/Select';
import { sileo } from '@/components/DynamicIslandToast';
import { usePaperDuplicateWarning, DuplicatePaperWarningModal } from '@/features/papers';

interface UploadViewProps {
  onPaperLoaded: (paper: CompletePaper) => void;
  currentPaper: CompletePaper;
}

const JOURNAL_OPTIONS: SelectOption[] = Object.values(JOURNAL_TEMPLATES).map((tmpl) => ({
  value: tmpl.id,
  label: tmpl.name,
  description: `${tmpl.shortName} • ${tmpl.id}`,
  color: tmpl.color,
  badge: tmpl.id.replace('VNUHCM-', ''),
}));

export const UploadView: React.FC<UploadViewProps> = ({ onPaperLoaded, currentPaper }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [parsingStatus, setParsingStatus] = useState<string>('');
  const [dragOver, setDragOver] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selectedFilter, setSelectedFilter] = useState<string>('all');
  const { currentJournal, setCurrentJournal } = usePaper();
  const activeTemplate = JOURNAL_TEMPLATES[currentJournal] || JOURNAL_TEMPLATES['VNUHCM-HS'];

  const {
    duplicatePrompt,
    checkAndPromptDuplicate,
    getAutoUniqueTitle,
    handleConfirmDuplicate,
    handleCloseDuplicate,
  } = usePaperDuplicateWarning();

  const handleFile = async (file: File) => {
    if (!file.name.endsWith('.docx') && !file.name.endsWith('.doc')) {
      setErrorMsg('Vui lòng chọn file tài liệu định dạng Microsoft Word (.docx hoặc .doc)');
      return;
    }
    setErrorMsg(null);
    setIsParsing(true);
    setParsingStatus('Đang đọc file Word...');
    try {
      const buffer = await file.arrayBuffer();
      setParsingStatus('Đang phân tích cấu trúc OpenXML...');
      const parsed = await parseDocxFile(buffer, file.name);

      if (parsed.metadata.journalId) {
        setCurrentJournal(parsed.metadata.journalId);
      } else {
        parsed.metadata.journalId = currentJournal;
        parsed.metadata.journalName = activeTemplate.name;
        parsed.metadata.journalAbbv = activeTemplate.shortName;
      }

      // Kiểm tra trùng lặp tiêu đề bài báo qua hook chuyên biệt
      const paperTitle = parsed.metadata.title?.trim() || file.name.replace(/\.[^/.]+$/, '');
      await checkAndPromptDuplicate(paperTitle, {
        journalId: parsed.metadata.journalId || currentJournal,
        onProceed: (resolvedTitle) => {
          parsed.metadata.title = resolvedTitle;
          (parsed as any).displayName = resolvedTitle;
          sileo.success({
            title: 'Tải lên thành công',
            description: `Đã xử lý & trích xuất cấu trúc văn bản "${file.name}"`,
          });
          onPaperLoaded(parsed);
        },
      });
    } catch (err: any) {
      console.error('Error parsing docx:', err);
      const msg = 'Có lỗi xảy ra khi đọc file Word: ' + (err.message || 'File không hợp lệ');
      setErrorMsg(msg);
      sileo.error({
        title: 'Tải lên thất bại',
        description: err.message || 'Không thể trích xuất cấu trúc tài liệu DOCX',
      });
    } finally {
      setIsParsing(false);
      setParsingStatus('');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleSelectSample = (sample: (typeof ALL_SAMPLE_PAPERS)[0]) => {
    if (sample.journalId) {
      setCurrentJournal(sample.journalId);
    }
    sileo.success({
      title: 'Tải bài mẫu thành công',
      description: `Đã nạp bài mẫu "${sample.label}"`,
    });
    onPaperLoaded({
      ...sample.paper,
      displayName: sample.paper.displayName || sample.label,
    });
  };

  const filteredSamples = ALL_SAMPLE_PAPERS.filter((item) => {
    if (selectedFilter === 'all') return true;
    return item.journalId === selectedFilter;
  });

  return (
    <div className="w-full max-w-5xl mx-auto space-y-3.5 my-auto pb-6">
      {/* Title & Introduction Banner */}


      {/* Target Journal Selection Card */}
      <div className="soft-card p-4 sm:p-5 bg-white border border-zinc-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#D9F99D]/60 border border-[#B4E50D]/40 flex items-center justify-center text-[#14532D] shadow-2xs flex-shrink-0">
            <BookOpen className="w-5 h-5 text-[#14532D]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-[#1A1A1A] text-sm sm:text-base">Mẫu tạp chí đích</span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-[#D9F99D] text-[#14532D]">
                {activeTemplate.id.replace('VNUHCM-', '')}
              </span>
            </div>
            <p className="text-xs text-zinc-500 mt-0.5">
              <span className="font-semibold text-zinc-700">{activeTemplate.name} ({activeTemplate.shortName})</span>.
            </p>
          </div>
        </div>

        <div className="w-full sm:w-80 rounded-[16px] shadow-md flex-shrink-0">
          <Select
            value={currentJournal}
            onChange={(val) => setCurrentJournal(val)}
            options={JOURNAL_OPTIONS}
            size="sm"
            searchable={true}
            searchPlaceholder="Tìm kiếm trong 7 tạp chí VNUHCM..."
          />
        </div>
      </div>

      {/* Side-by-side Top Row: 70% Word Upload Dropzone on Left + 30% Blank Template Card on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-10 gap-3 items-stretch">
        {/* Left Card: 70% width (lg:col-span-7) - Main Upload Dropzone */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => !isParsing && fileInputRef.current?.click()}
          className={`rounded-[48px] p-8 sm:p-12 text-center cursor-pointer transition-all border-2 border-dashed lg:col-span-7 flex flex-col items-center justify-center ${dragOver
            ? 'border-[#78C841] bg-[#78C841]/5 scale-[1.01]'
            : isParsing
              ? 'border-[#78C841] bg-gray-50 cursor-wait'
              : 'border-gray-200 hover:border-4 hover:bg-lime-50 hover:border-[#78C841] bg-white hover:shadow-md'
            }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".docx,.doc"
            className="hidden"
            disabled={isParsing}
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                handleFile(e.target.files[0]);
              }
            }}
          />

          <div
            className={`w-16 h-16 sm:w-20 sm:h-20 mx-auto rounded-3xl flex items-center justify-center mb-4 shadow-sm transition-all ${isParsing
              ? 'bg-[#1A1A1A] text-[#78C841] animate-pulse'
              : 'bg-[#78C841]/10 text-[#78C841]'
              }`}
          >
            {isParsing ? (
              <Loader2 className="w-8 h-8 sm:w-10 sm:h-10 animate-spin" />
            ) : (
              <UploadCloud className="w-8 h-8 sm:w-10 sm:h-10 animate-bounce text-[#78C841]" />
            )}
          </div>

          <h3 className="text-lg font-bold text-zinc-900 mb-1">
            {isParsing
              ? (parsingStatus || 'Đang xử lý tài liệu...')
              : 'Kéo thả file .docx vào đây để trích xuất chuẩn'}
          </h3>
          <p className="text-xs sm:text-sm text-zinc-500 max-w-md mx-auto mb-4">
            {isParsing
              ? 'Hệ thống đang trích xuất dữ liệu, bảo toàn công thức toán học và hình ảnh...'
              : `Trích xuất OpenXML siêu tốc nội bộ, bảo toàn ảnh vector và công thức toán theo mẫu ${activeTemplate.shortName}.`}
          </p>

          {!isParsing && (
            <div className="inline-flex items-center gap-2 btn-pill-lime text-sm cursor-pointer shadow-sm hover:shadow-md">
              <FileText className="w-4 h-4" /> Chọn file Word từ máy tính
            </div>
          )}

          {errorMsg && (
            <p className="mt-4 text-xs font-semibold text-rose-600 bg-rose-50 py-2 px-4 rounded-full inline-block border border-rose-200">
              {errorMsg}
            </p>
          )}
        </div>

        {/* Right Card: 30% width (lg:col-span-3) - Bắt đầu với template trống */}
        <div
          onClick={async () => {
            const blankPaper = createEmptyPaper(currentJournal || 'VNUHCM-HS');
            const uniqueTitle = await getAutoUniqueTitle('Bản thảo bài báo');
            blankPaper.metadata.title = uniqueTitle;
            (blankPaper as any).displayName = uniqueTitle;
            onPaperLoaded(blankPaper);
          }}
          className="rounded-[48px] p-8 sm:p-10 text-center cursor-pointer transition-all border-2 border-dashed border-gray-200 hover:border-4 hover:bg-lime-50 hover:border-[#78C841] bg-white hover:shadow-md lg:col-span-3 flex flex-col items-center justify-center group"
        >
          <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto rounded-3xl bg-[#78C841]/10 text-[#78C841] flex items-center justify-center mb-4 shadow-sm transition-all group-hover:scale-105">
            <FilePlus className="w-8 h-8 sm:w-10 sm:h-10 text-[#78C841]" />
          </div>

          <h3 className="text-lg font-bold text-zinc-900 mb-1">
            Template trống
          </h3>
          <p className="text-xs sm:text-sm text-zinc-500 max-w-xs mx-auto mb-4">
            Khởi tạo bản thảo bài báo mới theo chuẩn định dạng của <span className="font-bold text-zinc-800">{activeTemplate.shortName}</span> mà không cần tải file Word lên.
          </p>

          <div className="inline-flex items-center gap-2 btn-pill-lime text-sm cursor-pointer shadow-sm hover:shadow-md">
            <Sparkles className="w-4 h-4" /> Bắt đầu template trống
          </div>
        </div>
      </div>

      {/* Tạm thời ẩn phần thử nghiệm nhanh với các bài báo mẫu theo yêu cầu */}
      {false && (
        <div className="soft-card p-6 bg-white border border-gray-100/80 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-zinc-900" />
              <h3 className="font-extrabold text-[#1A1A1A] text-base">
                Thử nghiệm nhanh với các bài báo mẫu
              </h3>
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <Filter className="w-3.5 h-3.5 text-zinc-400 mr-1 hidden sm:inline" />
              <button
                onClick={() => setSelectedFilter('all')}
                className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${selectedFilter === 'all'
                  ? 'bg-[#1A1A1A] text-white shadow-xs'
                  : 'bg-gray-100 text-zinc-600 hover:bg-gray-200'
                  }`}
              >
                Tất cả (8)
              </button>
              {Object.values(JOURNAL_TEMPLATES).map((tmpl) => (
                <button
                  key={tmpl.id}
                  onClick={() => setSelectedFilter(tmpl.id)}
                  className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${selectedFilter === tmpl.id
                    ? 'text-white shadow-xs'
                    : 'bg-gray-100 text-zinc-600 hover:bg-gray-200'
                    }`}
                  style={
                    selectedFilter === tmpl.id
                      ? { backgroundColor: tmpl.color }
                      : {}
                  }
                >
                  {tmpl.shortName.replace('Sci. Tech. Dev. J.', 'STDJ')}
                </button>
              ))}
            </div>
          </div>

          {/* Grid of sample papers */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-1.5">
            {filteredSamples.map((item) => {
              const tmpl = JOURNAL_TEMPLATES[item.journalId] || JOURNAL_TEMPLATES['VNUHCM-HS'];
              const isSelected = currentPaper.id === item.paper.id;
              const refCount = item.paper.references.length;
              const tableCount = item.paper.sections.filter((s) => s.type === 'table').length;
              const figCount = item.paper.sections.filter((s) => s.type === 'figure').length;

              return (
                <div
                  key={item.id}
                  onClick={() => handleSelectSample(item)}
                  className={`bg-gray-200/50 p-4 rounded-3xl transition-all cursor-pointer flex flex-col justify-between hover:shadow-md ${isSelected
                    ? 'ring-2 ring-[#78C841]/20 shadow-md'
                    : 'hover:border-gray-300'
                    }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span
                        className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold text-white shadow-2xs"
                        style={{ backgroundColor: tmpl.color }}
                      >
                        {tmpl.id.replace('VNUHCM-', '')}
                      </span>
                      <span className="text-[10px] font-extrabold text-[#14532D] bg-[#D9F99D] px-2 py-0.5 rounded-full">
                        {refCount} TLTK
                      </span>
                    </div>

                    <h4 className="font-bold text-xs text-[#1A1A1A] line-clamp-2 mb-1.5 leading-snug">
                      {item.paper.metadata.title}
                    </h4>

                    <p className="text-[11px] text-zinc-500 line-clamp-2 mb-2">
                      {item.paper.metadata.authors.map((a) => a.name).join(', ') || 'Tác giả bài báo'}
                    </p>

                    <div className="flex items-center gap-2 text-[10px] text-zinc-400 font-semibold mb-2">
                      {tableCount > 0 && <span>{tableCount} Bảng</span>}
                      {figCount > 0 && <span>• {figCount} Hình</span>}
                    </div>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-gray-100 flex items-center justify-between text-xs font-bold text-zinc-800">
                    <span>Nạp bản thảo</span>
                    <ArrowRight className="w-3.5 h-3.5 text-[#78C841]" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Warning Modal when Uploaded Paper Title already exists in Database */}
      <DuplicatePaperWarningModal
        isOpen={Boolean(duplicatePrompt?.isOpen)}
        paperTitle={duplicatePrompt?.paperTitle || ''}
        suggestedTitle={duplicatePrompt?.suggestedTitle || ''}
        matchCount={duplicatePrompt?.matchCount || 1}
        journalId={duplicatePrompt?.journalId}
        onClose={handleCloseDuplicate}
        onConfirmUpload={handleConfirmDuplicate}
      />
    </div>
  );
};
