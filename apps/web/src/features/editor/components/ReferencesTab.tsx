'use client';

import React, { useState, useEffect, useRef } from 'react';
import { ReferencesTabProps } from './types';
import { Quote, Plus, Trash2, ExternalLink, CheckCircle, AlertTriangle } from 'lucide-react';
import { EndOfListIndicator } from './EndOfListIndicator';
import { useTabScrollRestoration } from '../hooks';
import {
  useEditorCommandBus,
  dispatchAddReference,
  dispatchUpdateReference,
  dispatchRemoveReference,
} from './command-bus-adapter';

interface AutoResizeTextareaProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
}

const AutoResizeTextarea: React.FC<AutoResizeTextareaProps> = ({
  value,
  onChange,
  placeholder,
  className = '',
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const resize = React.useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  useEffect(() => {
    resize();
  }, [value, resize]);

  useEffect(() => {
    const handleWindowResize = () => resize();
    window.addEventListener('resize', handleWindowResize);
    return () => window.removeEventListener('resize', handleWindowResize);
  }, [resize]);

  return (
    <textarea
      ref={textareaRef}
      value={value}
      onChange={(e) => {
        onChange(e.target.value);
        resize();
      }}
      rows={1}
      placeholder={placeholder}
      spellCheck={false}
      autoCorrect="off"
      autoCapitalize="off"
      style={{ resize: 'none', overflow: 'hidden' }}
      className={`[field-sizing:content] ${className}`}
    />
  );
};

export const ReferencesTab: React.FC<ReferencesTabProps> = ({
  references,
  onChange,
  commandBus: propCommandBus,
}) => {
  const contextCommandBus = useEditorCommandBus().commandBus;
  const activeBus = propCommandBus || contextCommandBus;

  const [newlyAddedId, setNewlyAddedId] = useState<number | null>(null);
  const [deletingRefIds, setDeletingRefIds] = useState<Set<number>>(new Set());
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const { commitScrollTop } = useTabScrollRestoration('refs', scrollContainerRef);

  // Smooth scroll and auto-focus newly added reference
  useEffect(() => {
    if (newlyAddedId === null) return;

    const timer = setTimeout(() => {
      const el = document.getElementById(`ref-item-${newlyAddedId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        const inputEl = el.querySelector<HTMLTextAreaElement | HTMLInputElement>(
          'textarea, input[type="text"]'
        );
        if (inputEl) {
          inputEl.focus();
        }
      }
    }, 100);

    const clearTimer = setTimeout(() => {
      setNewlyAddedId(null);
    }, 1800);

    return () => {
      clearTimeout(timer);
      clearTimeout(clearTimer);
    };
  }, [newlyAddedId]);

  const handleAddReference = () => {
    const nextId = (references.length || 0) + 1;
    const newRef = {
      id: nextId,
      raw: '',
      isCited: true,
      citationCount: 1,
    };
    dispatchAddReference(activeBus, newRef, onChange, references);
    setNewlyAddedId(nextId);
  };

  const handleRemoveReference = (id: number) => {
    if (deletingRefIds.has(id)) return;

    setDeletingRefIds((prev) => new Set(prev).add(id));

    setTimeout(() => {
      dispatchRemoveReference(activeBus, id, onChange, references);
      setDeletingRefIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, 320);
  };

  const handleUpdateRaw = (refId: number, val: string) => {
    dispatchUpdateReference(activeBus, refId, { raw: val }, onChange, references);
  };

  const handleUpdateDoi = (refId: number, val: string) => {
    dispatchUpdateReference(activeBus, refId, { doi: val }, onChange, references);
  };

  return (
    <div className="h-full flex flex-col min-h-0 space-y-4 p-4 sm:p-5 sm:pt-4 sm:pb-1">
      {/* Top Header directly on background */}
      <div className="flex items-center justify-between pb-2 border-b border-zinc-200/80 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Quote className="w-4 h-4 text-zinc-700" />
          <h3 className="font-extrabold text-sm sm:text-base text-zinc-900">
            Tài liệu Tham khảo ({references.length})
          </h3>
        </div>
        <button
          type="button"
          onClick={handleAddReference}
          className="btn-pill-lime text-xs py-1.5 px-3 flex items-center gap-1.5 shadow-xs hover:scale-105 active:scale-95 transition-all cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Thêm tài liệu</span>
        </button>
      </div>

      <div ref={scrollContainerRef} className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-2 scroll-smooth">
        <p className="text-xs text-zinc-500 pb-1">
          Hệ thống tự động đồng bộ số thứ tự [1], [2], [3]... theo đúng chuẩn Vancouver khi bạn chỉnh sửa hoặc xóa mục.
        </p>
        {references.map((ref, idx) => {
          const isDeleting = deletingRefIds.has(ref.id);
          const isNewlyAdded = ref.id === newlyAddedId;

          return (
            <div
              key={ref.id || idx}
              id={`ref-item-${ref.id}`}
              className={`grid transition-all duration-300 ease-in-out ${
                isDeleting
                  ? 'grid-rows-[0fr] opacity-0 scale-95 -translate-y-2 pointer-events-none'
                  : 'grid-rows-[1fr] opacity-100 scale-100 translate-y-0'
              } ${isNewlyAdded ? 'animate-section-enter' : ''}`}
            >
              <div className="">
                <div
                  className={`p-3.5 rounded-3xl bg-gray-200/50 flex items-start gap-3 shadow-2xs transition-all duration-300 ${
                    isNewlyAdded ? 'section-highlight-glow ring-2 ring-blue-300' : ''
                  }`}
                >
                  {/* Number Pill */}
                  <span className="w-7 h-7 rounded-full bg-zinc-900 text-white flex items-center justify-center text-xs font-bold flex-shrink-0 mt-1 shadow-2xs">
                    {ref.id}
                  </span>

                  {/* Input & DOI */}
                  <div className="flex-1 space-y-2">
                    <AutoResizeTextarea
                      value={ref.raw}
                      onChange={(val) => handleUpdateRaw(ref.id, val)}
                      placeholder="Chuỗi trích dẫn theo chuẩn Vancouver..."
                      className="w-full p-2.5 rounded-2xl text-xs text-zinc-900 bg-white leading-relaxed focus:outline-none focus:ring-4 focus:ring-blue-200 focus:border-blue-300 transition-all shadow-2xs"
                    />

                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[11px] font-bold text-zinc-500">DOI:</span>
                      <input
                        type="text"
                        value={ref.doi || ''}
                        placeholder="10.1001/..."
                        onChange={(e) => handleUpdateDoi(ref.id, e.target.value)}
                        spellCheck={false}
                        autoCorrect="off"
                        autoCapitalize="off"
                        className="p-1 px-2.5 rounded-2xl text-[11px] font-mono text-zinc-900 bg-white min-w-[200px] flex-1 sm:flex-none focus:outline-none focus:ring-4 focus:ring-blue-200 focus:border-blue-300 shadow-2xs"
                      />

                      {ref.doi && (
                        <a
                          href={`https://doi.org/${ref.doi}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] text-blue-600 font-bold hover:underline"
                        >
                          Xem link <ExternalLink className="w-3 h-3" />
                        </a>
                      )}

                      <div className="ml-auto">
                        {ref.isCited ? (
                          <span className="text-[10px] font-bold bg-lime-200/70 text-lime-700 px-2 py-0.5 rounded-full flex items-center gap-1 shadow-2xs">
                            <CheckCircle className="w-3 h-3" /> Đã cite trong bài
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3 text-amber-600" /> Chưa gọi cite
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Delete button */}
                  <button
                    type="button"
                    disabled={isDeleting}
                    onClick={() => handleRemoveReference(ref.id)}
                    className="p-1.5 rounded-xl text-zinc-400 hover:text-red-600 hover:bg-red-50 transition-colors self-start cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Xóa tài liệu tham khảo"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {references.length > 0 ? (
          <EndOfListIndicator
            title="Bạn đã lướt đến cuối danh sách"
            subtitle={`Đã hiển thị toàn bộ ${references.length} tài liệu tham khảo`}
            onScrollToTop={() => {
              scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
              commitScrollTop(0);
            }}
          />
        ) : (
          <div className="p-8 text-center rounded-3xl bg-gray-200/50 space-y-3">
            <Quote className="w-8 h-8 text-zinc-400 mx-auto" />
            <p className="text-sm font-semibold text-zinc-600">
              Chưa có tài liệu tham khảo nào trong danh sách.
            </p>
            <button
              type="button"
              onClick={handleAddReference}
              className="btn-pill-lime text-xs"
            >
              + Thêm tài liệu đầu tiên
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
