'use client';

import React, { useState } from 'react';
import { PaperSection, PaperFigure } from '@/types/paper';
import {
  Image as ImageIcon,
  Plus,
  Trash2,
  Maximize2,
  Link as LinkIcon,
  Eye,
  Sliders,
} from 'lucide-react';

interface FiguresTabProps {
  sections: PaperSection[];
  onChange: (updated: PaperSection[]) => void;
}

const PRESET_SAMPLE_FIGURES = [
  {
    name: 'Biểu đồ ROC Đường cong Phân loại',
    src: '/sample-media/roc_curve.png',
  },
  {
    name: 'Sơ đồ Khối Kiến trúc Mô hình (Workflow)',
    src: '/sample-media/architecture_pipeline.png',
  },
  {
    name: 'Biểu đồ Phân phối & Boxplot',
    src: '/sample-media/data_distribution.png',
  },
];

export const FiguresTab: React.FC<FiguresTabProps> = ({ sections, onChange }) => {
  const figureSections = sections
    .map((sec, originalIndex) => ({ sec, originalIndex }))
    .filter((item) => item.sec.type === 'figure' && item.sec.figure);

  const [activeFigIdx, setActiveFigIdx] = useState<number>(0);

  const handleAddFigure = () => {
    const nextNum = figureSections.length + 1;
    const newFig: PaperFigure = {
      id: `fig_${Date.now()}`,
      num: nextNum,
      caption: `Hình ${nextNum}: Sơ đồ kiến trúc mô hình và kết quả thực nghiệm`,
      src: '/demo-files/sample_diagram.png',
      isFullWidth: false,
      placement: 'auto',
    };

    const newSection: PaperSection = {
      id: `sec_fig_${Date.now()}`,
      type: 'figure',
      title: newFig.caption,
      content: '',
      figure: newFig,
    };

    onChange([...sections, newSection]);
    setActiveFigIdx(figureSections.length);
  };

  const handleUpdateCurrentFigure = (updatedFig: PaperFigure) => {
    if (figureSections.length === 0) return;
    const target = figureSections[activeFigIdx];
    if (!target) return;

    const nextSections = [...sections];
    nextSections[target.originalIndex] = {
      ...nextSections[target.originalIndex],
      title: updatedFig.caption,
      figure: updatedFig,
    };
    onChange(nextSections);
  };

  const handleDeleteCurrentFigure = () => {
    if (figureSections.length === 0) return;
    const target = figureSections[activeFigIdx];
    if (!target) return;

    const nextSections = [...sections];
    nextSections.splice(target.originalIndex, 1);
    onChange(nextSections);
    setActiveFigIdx(Math.max(0, activeFigIdx - 1));
  };

  const currentFigSection = figureSections[activeFigIdx]?.sec;
  const currentFig = currentFigSection?.figure;

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header Bar */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <ImageIcon className="w-5 h-5 text-[#78C841]" />
          <div>
            <h3 className="font-extrabold text-sm sm:text-base text-slate-900">
              Quản lý Hình ảnh & Đồ thị ({figureSections.length} hình)
            </h3>
            <p className="text-xs text-slate-500">
              Chèn đồ thị, sơ đồ nghiên cứu và tự động đánh số thứ tự trong Typst
            </p>
          </div>
        </div>

        <button
          onClick={handleAddFigure}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-linear-to-r from-[#78C841] to-emerald-600 text-white text-xs font-bold shadow-md shadow-emerald-600/20 hover:from-emerald-600 hover:to-emerald-700 active:scale-95 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Thêm hình ảnh mới
        </button>
      </div>

      {figureSections.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 border border-slate-200/80 text-center space-y-3">
          <ImageIcon className="w-12 h-12 text-slate-300 mx-auto stroke-1" />
          <h4 className="font-bold text-sm text-slate-700">Chưa có hình ảnh nào trong bài báo</h4>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Nhấn vào nút &ldquo;Thêm hình ảnh mới&rdquo; để tải lên hình chụp, biểu đồ khoa học hoặc sơ đồ hệ thống.
          </p>
          <button
            onClick={handleAddFigure}
            className="px-4 py-2 rounded-xl bg-emerald-50 text-[#14532D] text-xs font-bold hover:bg-emerald-100 transition-colors cursor-pointer"
          >
            + Thêm hình ảnh đầu tiên
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Figure tabs switcher */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {figureSections.map((item, idx) => (
              <button
                key={idx}
                onClick={() => setActiveFigIdx(idx)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer border ${
                  activeFigIdx === idx
                    ? 'bg-emerald-800 text-white border-emerald-900 shadow-xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                }`}
              >
                Hình {item.sec.figure?.num || idx + 1}
              </button>
            ))}
          </div>

          {currentFig && (
            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-5">
              {/* Caption & Number */}
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-1">
                  <span className="text-xs font-extrabold text-[#14532D] bg-emerald-100 px-2 py-1 rounded-lg">
                    Hình {currentFig.num}
                  </span>
                  <input
                    type="text"
                    value={currentFig.caption}
                    onChange={(e) =>
                      handleUpdateCurrentFigure({ ...currentFig, caption: e.target.value })
                    }
                    className="font-bold text-sm text-slate-900 bg-white border border-slate-200 rounded-lg p-2 flex-1 focus:outline-none focus:ring-2 focus:ring-[#78C841]/30"
                    placeholder="Chú thích hình (VD: Hình 1: Cấu trúc mô hình tích chập 3D)"
                  />
                </div>

                <button
                  onClick={handleDeleteCurrentFigure}
                  className="p-2 rounded-lg text-red-500 hover:bg-red-50 transition-colors cursor-pointer"
                  title="Xóa hình này"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* Image URL & Width toggle */}
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Đường dẫn tệp hình ảnh (Image URL / Path)
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={currentFig.src || ''}
                      onChange={(e) =>
                        handleUpdateCurrentFigure({ ...currentFig, src: e.target.value })
                      }
                      className="w-full text-xs font-semibold rounded-xl border border-slate-200 pl-8 p-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#78C841]/30"
                      placeholder="https://example.com/figure1.png hoặc /sample-media/..."
                    />
                    <LinkIcon className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  </div>
                </div>

                {/* Preset shortcuts */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">
                    Chọn nhanh mẫu đồ thị minh họa:
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {PRESET_SAMPLE_FIGURES.map((preset, pIdx) => (
                      <button
                        key={pIdx}
                        type="button"
                        onClick={() => handleUpdateCurrentFigure({ ...currentFig, src: preset.src })}
                        className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-emerald-50 text-slate-700 border border-slate-200 transition-colors cursor-pointer"
                      >
                        {preset.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Toggles */}
                <div className="flex items-center gap-6 pt-1">
                  <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-semibold text-slate-700">
                    <input
                      type="checkbox"
                      checked={currentFig.isFullWidth || false}
                      onChange={(e) =>
                        handleUpdateCurrentFigure({
                          ...currentFig,
                          isFullWidth: e.target.checked,
                        })
                      }
                      className="rounded text-emerald-600 focus:ring-[#78C841]"
                    />
                    <span>Hình tràn cả 2 cột (Full-width width: 100%)</span>
                  </label>
                </div>
              </div>

              {/* Visual Preview Box */}
              <div className="pt-2 border-t border-slate-100">
                <span className="block text-xs font-bold text-slate-700 mb-2">
                  Xem trước hình ảnh thực tế:
                </span>
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 flex flex-col items-center justify-center min-h-[180px]">
                  {currentFig.src ? (
                    <div className="space-y-2 text-center max-w-md">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={currentFig.src}
                        alt={currentFig.caption}
                        onError={(e) => {
                          // Fallback to placeholder if image src is broken
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                        className="max-h-56 mx-auto rounded-lg shadow-xs object-contain"
                      />
                      <p className="text-xs font-bold text-slate-700 italic">
                        {currentFig.caption}
                      </p>
                    </div>
                  ) : (
                    <div className="text-center text-slate-400 space-y-1">
                      <ImageIcon className="w-8 h-8 mx-auto stroke-1" />
                      <p className="text-xs">Chưa có đường dẫn ảnh</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
