'use client';

import React, { useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PreflightQCTabProps, EditorTabKey } from './types';
import {
  AlertCircle,
  AlertTriangle,
  AlignLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  FileText,
  Info,
  Layers,
  Quote,
  Users,
  XCircle,
} from 'lucide-react';
import { computePreflightCheckWrapper } from './preflight-wrapper';
import { useTabScrollRestoration } from './hooks';
import {
  getCompactIssueDetail,
  groupValidationIssues,
  type ValidationGroupKey,
} from '@/components/documents/validation-report-helpers';
import type { ValidationIssue } from '@/lib/validation/validators';

const SEVERITY_ICON: Record<string, React.ReactNode> = {
  error: <XCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />,
  warning: <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />,
  info: <Info className="w-4 h-4 text-sky-500 shrink-0 mt-0.5" />,
};

const GROUP_ICON: Record<ValidationGroupKey, React.ReactNode> = {
  general: <AlertCircle className="w-3.5 h-3.5 text-zinc-400 shrink-0" />,
  metadata: <FileText className="w-3.5 h-3.5 text-zinc-400 shrink-0" />,
  authors: <Users className="w-3.5 h-3.5 text-zinc-400 shrink-0" />,
  abstract: <AlignLeft className="w-3.5 h-3.5 text-zinc-400 shrink-0" />,
  sections: <Layers className="w-3.5 h-3.5 text-zinc-400 shrink-0" />,
  refs: <BookOpen className="w-3.5 h-3.5 text-zinc-400 shrink-0" />,
  citation: <Quote className="w-3.5 h-3.5 text-zinc-400 shrink-0" />,
};

const isTest = typeof process !== 'undefined' && process.env.NODE_ENV === 'test';

export const PreflightQCTab: React.FC<PreflightQCTabProps> = ({
  preflight,
  paper,
  onNavigateTab,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  useTabScrollRestoration('preflight', scrollContainerRef);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  // Evaluates preflight check via wrapper (ready for @structpaper/qc-engine in Phase 5)
  const activePreflight = useMemo(() => {
    return computePreflightCheckWrapper(preflight || paper);
  }, [preflight, paper]);

  const validationIssues: ValidationIssue[] = useMemo(() => {
    return (activePreflight.issues || []).map((issue) => {
      let fixTab = issue.fixTab;
      if (!fixTab) {
        if (issue.category === 'metadata') fixTab = 'metadata';
        else if (issue.category === 'author') fixTab = 'authors';
        else if (issue.category === 'abstract') fixTab = 'abstract';
        else if (issue.category === 'content' || issue.category === 'table_fig') fixTab = 'sections';
        else if (issue.category === 'reference') fixTab = 'refs';
      }

      return {
        id: issue.id,
        severity: issue.severity,
        code: `preflight.${issue.category}`,
        title: issue.title,
        message: issue.message,
        suggestion: issue.suggestion,
        category: issue.category,
        fixTab,
      };
    });
  }, [activePreflight.issues]);

  const groups = useMemo(() => groupValidationIssues(validationIssues), [validationIssues]);

  const toggleGroup = (key: ValidationGroupKey) => {
    setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const allCollapsed = useMemo(() => {
    if (groups.length === 0) return false;
    return groups.every((g) => Boolean(collapsed[g.key]));
  }, [groups, collapsed]);

  const toggleAllGroups = () => {
    const nextState = !allCollapsed;
    const next: Record<string, boolean> = {};
    for (const g of groups) {
      next[g.key] = nextState;
    }
    setCollapsed(next);
  };

  const totalErrors = activePreflight.issues?.filter((i) => i.severity === 'error').length || 0;
  const totalWarnings = activePreflight.issues?.filter((i) => i.severity === 'warning').length || 0;
  const totalIssues = activePreflight.issues?.length || 0;

  return (
    <div className="h-full flex flex-col min-h-0 space-y-4 p-4 sm:p-5 sm:pt-4 sm:pb-1">
      {/* Header Summary directly on background */}
      <div className="flex-shrink-0 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-zinc-200/80">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-extrabold text-base sm:text-lg text-zinc-900">
              Kiểm Định Cấu Trúc & Tiêu Chuẩn
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">
              Điểm chuẩn hóa
            </span>
          </div>
          <span
            className={`text-2xl font-black ${
              activePreflight.score >= 85
                ? 'text-[#14532D]'
                : activePreflight.score >= 70
                  ? 'text-amber-700'
                  : 'text-red-700'
            }`}
          >
            {activePreflight.score}
            <span className="text-xs font-normal text-zinc-400">/100</span>
          </span>
        </div>
      </div>

      {/* Internal Scrollable Content */}
      <div ref={scrollContainerRef} className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-6">
        {/* Issues list (VS Code-style collapsible grouped tree) */}
        <div className="space-y-3">

          {totalIssues > 0 ? (
            <div
              data-testid="preflight-issues-tree"
              className="space-y-1 select-text"
            >
              <div className="px-1 py-1 flex items-center justify-between gap-2 text-xs text-zinc-500">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-zinc-500">
                    {groups.length} nhóm tài liệu có lưu ý
                  </span>
                </div>
                {groups.length > 0 && (
                  <button
                    type="button"
                    onClick={toggleAllGroups}
                    className="text-[11px] font-semibold text-zinc-500 hover:text-zinc-900 transition-colors cursor-pointer"
                  >
                    {allCollapsed ? 'Mở rộng tất cả' : 'Thu gọn tất cả'}
                  </button>
                )}
              </div>

              <div className="space-y-1">
                {groups.map((group) => {
                  const isCollapsed = Boolean(collapsed[group.key]);
                  return (
                    <div key={group.key} className="space-y-0.5">
                      <button
                        type="button"
                        onClick={() => toggleGroup(group.key)}
                        aria-expanded={!isCollapsed}
                        data-testid={`preflight-group-${group.key}`}
                        className="w-full px-3 py-2 rounded-xl flex items-center gap-2 text-left hover:bg-zinc-200/80 active:bg-zinc-300/80 transition-colors cursor-pointer select-none"
                      >
                        <ChevronDown
                          className={`w-3.5 h-3.5 text-zinc-600 shrink-0 transition-transform duration-150 ${
                            isCollapsed ? '-rotate-90' : ''
                          }`}
                          strokeWidth={2.5}
                        />
                        {GROUP_ICON[group.key]}
                        <span className="text-[12.5px] font-bold text-zinc-900 shrink-0">
                          {group.label}
                        </span>
                        <span className="text-[11px] text-zinc-400 truncate">
                          {group.hint}
                        </span>
                        <span
                          className={`ml-auto shrink-0 min-w-[20px] h-[20px] px-1.5 rounded-full text-[10.5px] font-bold inline-flex items-center justify-center tabular-nums ${
                            group.errorCount > 0
                              ? 'bg-rose-100 text-rose-700 border border-rose-200/60'
                              : 'bg-zinc-200/80 text-zinc-700'
                          }`}
                        >
                          {group.issues.length}
                        </span>
                      </button>

                      {isTest ? (
                        !isCollapsed && (
                          <ul className="ml-5 pl-3 border-l-2 border-zinc-300/70 my-1 space-y-1">
                            {group.issues.map((issue) => {
                              const detail = getCompactIssueDetail(issue);
                              return (
                                <li
                                  key={issue.id}
                                  className="group/row flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 rounded-xl p-2 sm:px-3 sm:py-2 hover:bg-zinc-200/75 active:bg-zinc-300/70 transition-colors"
                                >
                                  <div className="flex items-start gap-2 min-w-0 flex-1">
                                    {SEVERITY_ICON[issue.severity]}
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-[12.5px] font-semibold text-zinc-900 leading-snug">
                                          {issue.title}
                                        </span>
                                        {detail && (
                                          <span className="text-[11px] text-zinc-400 font-normal">
                                            ({detail})
                                          </span>
                                        )}
                                        <span
                                          className={`text-[9.5px] font-bold px-1.5 py-0.2 rounded-full uppercase tracking-wider ${
                                            issue.severity === 'error'
                                              ? 'bg-rose-100/70 text-rose-700'
                                              : issue.severity === 'warning'
                                                ? 'bg-amber-100/70 text-amber-800'
                                                : 'bg-sky-100/70 text-sky-700'
                                          }`}
                                        >
                                          {issue.severity === 'error'
                                            ? 'Bắt buộc'
                                            : issue.severity === 'warning'
                                              ? 'Khuyến nghị'
                                              : 'Gợi ý'}
                                        </span>
                                      </div>
                                      {issue.message && (
                                        <p className="text-[11.5px] text-zinc-600 mt-0.5 leading-snug">
                                          {issue.message}
                                        </p>
                                      )}
                                      {issue.suggestion && (
                                        <p className="text-[11px] text-zinc-400 mt-0.5">
                                          💡 {issue.suggestion}
                                        </p>
                                      )}
                                    </div>
                                  </div>

                                  {issue.fixTab && (
                                    <button
                                      type="button"
                                      onClick={() => onNavigateTab(issue.fixTab as EditorTabKey)}
                                      className="shrink-0 self-end sm:self-center px-2.5 py-1 rounded-xl text-xs font-bold text-zinc-700 bg-white hover:bg-zinc-100 border border-zinc-200/90 shadow-2xs flex items-center gap-1 cursor-pointer transition-colors"
                                    >
                                      <span>Sửa ngay</span>
                                      <ArrowRight className="w-3 h-3 text-zinc-500" />
                                    </button>
                                  )}
                                </li>
                              );
                            })}
                          </ul>
                        )
                      ) : (
                        <AnimatePresence initial={false}>
                          {!isCollapsed && (
                            <motion.div
                              key={`preflight-issues-${group.key}`}
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                              className="overflow-hidden"
                            >
                              <ul className="ml-5 pl-3 border-l-2 border-zinc-300/70 my-1.5 space-y-1">
                                {group.issues.map((issue) => {
                                  const detail = getCompactIssueDetail(issue);
                                  return (
                                    <li
                                      key={issue.id}
                                      className="group/row flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 rounded-xl p-2 sm:px-3 sm:py-2 hover:bg-zinc-200/75 active:bg-zinc-300/70 transition-colors"
                                    >
                                      <div className="flex items-start gap-2 min-w-0 flex-1">
                                        {SEVERITY_ICON[issue.severity]}
                                        <div className="min-w-0 flex-1">
                                          <div className="flex items-center gap-2 flex-wrap">
                                            <span className="text-[12.5px] font-semibold text-zinc-900 leading-snug">
                                              {issue.title}
                                            </span>
                                            {detail && (
                                              <span className="text-[11px] text-zinc-400 font-normal">
                                                ({detail})
                                              </span>
                                            )}
                                            <span
                                              className={`text-[9.5px] font-bold px-1.5 py-0.2 rounded-full uppercase tracking-wider ${
                                                issue.severity === 'error'
                                                  ? 'bg-rose-100/70 text-rose-700'
                                                  : issue.severity === 'warning'
                                                    ? 'bg-amber-100/70 text-amber-800'
                                                    : 'bg-sky-100/70 text-sky-700'
                                              }`}
                                            >
                                              {issue.severity === 'error'
                                                ? 'Bắt buộc'
                                                : issue.severity === 'warning'
                                                  ? 'Khuyến nghị'
                                                  : 'Gợi ý'}
                                            </span>
                                          </div>
                                          {issue.message && (
                                            <p className="text-[11.5px] text-zinc-600 mt-0.5 leading-snug">
                                              {issue.message}
                                            </p>
                                          )}
                                          {issue.suggestion && (
                                            <p className="text-[11px] text-zinc-400 mt-0.5">
                                              💡 {issue.suggestion}
                                            </p>
                                          )}
                                        </div>
                                      </div>

                                      {issue.fixTab && (
                                        <button
                                          type="button"
                                          onClick={() => onNavigateTab(issue.fixTab as EditorTabKey)}
                                          className="shrink-0 self-end sm:self-center px-2.5 py-1 rounded-xl text-xs font-bold text-zinc-700 bg-white hover:bg-zinc-100 border border-zinc-200/90 shadow-2xs flex items-center gap-1 cursor-pointer transition-colors"
                                        >
                                          <span>Sửa ngay</span>
                                          <ArrowRight className="w-3 h-3 text-zinc-500" />
                                        </button>
                                      )}
                                    </li>
                                  );
                                })}
                              </ul>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-lime-50/80 border border-lime-200/80 text-lime-800 text-xs flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-lime-600 flex-shrink-0" />
              <div>
                <h5 className="font-bold">Bản thảo hoàn hảo và đầy đủ 100%!</h5>
                <p className="text-[11px] text-lime-700 mt-0.5">
                  Tất cả các trường dữ liệu tiêu đề, tác giả, tóm tắt, từ khóa và trích dẫn đều đạt chuẩn xuất bản của ĐHQG-HCM.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* 6 Pillars Breakdown */}
        <div className="space-y-3 pt-2">
          <h4 className="font-bold text-xs uppercase tracking-wider text-zinc-900">
            Bảng đối soát tiêu chuẩn cấu trúc
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-1.5">
            {/* Pillar 1: Metadata */}
            <div className="p-3.5 rounded-3xl bg-gray-200/50 space-y-2 transition-all">
              <h5 className="font-bold text-xs text-zinc-900 flex items-center gap-1.5">
                1. Tiêu đề & Định danh
              </h5>
              <div className="space-y-1.5 text-xs">
                <div className="flex items-center justify-between py-0.5 border-b border-zinc-100">
                  <span className="text-zinc-500">Tiêu đề tiếng Việt:</span>
                  {activePreflight.titleOk ? (
                    <span className="text-lime-700 font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Đạt
                    </span>
                  ) : (
                    <span className="text-red-600 font-bold flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> Thiếu
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between py-0.5 border-b border-zinc-100">
                  <span className="text-zinc-500">Tiêu đề tiếng Anh:</span>
                  {activePreflight.titleEnOk ? (
                    <span className="text-lime-700 font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Đạt
                    </span>
                  ) : (
                    <span className="text-amber-600 font-bold flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> Thiếu
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between py-0.5">
                  <span className="text-zinc-500">Mã DOI:</span>
                  <span className="font-mono text-[11px] text-zinc-800">
                    {activePreflight.titleOk ? '✓ Khả dụng' : 'Chưa có'}
                  </span>
                </div>
              </div>
            </div>

            {/* Pillar 2: Authors */}
            <div className="p-3.5 rounded-3xl bg-gray-200/50 space-y-2 transition-all">
              <h5 className="font-bold text-xs text-zinc-900 flex items-center gap-1.5">
                2. Tác giả & Đơn vị
              </h5>
              <div className="space-y-1.5 text-xs">
                <div className="flex items-center justify-between py-0.5 border-b border-zinc-100">
                  <span className="text-zinc-500">Số lượng tác giả:</span>
                  <span className="font-bold text-zinc-900">{activePreflight.authorsCount} tác giả</span>
                </div>
                <div className="flex items-center justify-between py-0.5 border-b border-zinc-100">
                  <span className="text-zinc-500">Đơn vị công tác:</span>
                  <span className="font-bold text-zinc-900">{activePreflight.affiliationsCount} cơ quan</span>
                </div>
                <div className="flex items-center justify-between py-0.5">
                  <span className="text-zinc-500">Email liên hệ:</span>
                  {activePreflight.correspondingOk ? (
                    <span className="text-lime-700 font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Hợp lệ
                    </span>
                  ) : (
                    <span className="text-amber-600 font-bold flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> Thiếu
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Pillar 3: Abstracts & Keywords */}
            <div className="p-3.5 rounded-3xl bg-gray-200/50 space-y-2 transition-all">
              <h5 className="font-bold text-xs text-zinc-900 flex items-center gap-1.5">
                3. Tóm tắt & Từ khóa
              </h5>
              <div className="space-y-1.5 text-xs">
                <div className="flex items-center justify-between py-0.5 border-b border-zinc-100">
                  <span className="text-zinc-500">Tóm tắt tiếng Việt:</span>
                  {activePreflight.abstractOk ? (
                    <span className="text-lime-700 font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Đạt chuẩn
                    </span>
                  ) : (
                    <span className="text-amber-600 font-bold flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> Cần bổ sung
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between py-0.5 border-b border-zinc-100">
                  <span className="text-zinc-500">Abstract tiếng Anh:</span>
                  {activePreflight.abstractEnOk ? (
                    <span className="text-lime-700 font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Đạt chuẩn
                    </span>
                  ) : (
                    <span className="text-amber-600 font-bold flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> Thiếu
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between py-0.5">
                  <span className="text-zinc-500">Từ khóa song ngữ:</span>
                  <span className="font-bold text-zinc-900">
                    {activePreflight.keywordsCount} VN / {activePreflight.keywordsEnCount} EN
                  </span>
                </div>
              </div>
            </div>

            {/* Pillar 4: IMRaD Sections */}
            <div
              onClick={() => onNavigateTab('sections')}
              className="p-3.5 rounded-3xl bg-gray-200/50 space-y-2 cursor-pointer hover:bg-zinc-50/90 hover:border-zinc-300 transition-all group"
              title="Nhấp để chuyển tới tab Nội dung"
            >
              <h5 className="font-bold text-xs text-zinc-900 flex items-center justify-between gap-1.5">
                <span>4. Khung cấu trúc IMRaD</span>
                <span className="text-[10px] text-zinc-400 group-hover:text-zinc-700 transition-colors font-medium">Sửa →</span>
              </h5>
              <div className="space-y-1.5 text-xs">
                <div className="flex items-center justify-between py-0.5 border-b border-zinc-100">
                  <span className="text-zinc-500">Mở đầu / Giới thiệu:</span>
                  <span className={activePreflight.foundImradSections.intro ? 'text-lime-700 font-bold' : 'text-zinc-400 font-normal'}>
                    {activePreflight.foundImradSections.intro ? '✓ Có' : 'Chưa rõ'}
                  </span>
                </div>
                <div className="flex items-center justify-between py-0.5 border-b border-zinc-100">
                  <span className="text-zinc-500">Phương pháp (Methods):</span>
                  <span className={activePreflight.foundImradSections.methods ? 'text-lime-700 font-bold' : 'text-zinc-400 font-normal'}>
                    {activePreflight.foundImradSections.methods ? '✓ Có' : 'Chưa rõ'}
                  </span>
                </div>
                <div className="flex items-center justify-between py-0.5">
                  <span className="text-zinc-500">Kết quả & Kết luận:</span>
                  <span className={activePreflight.foundImradSections.results && activePreflight.foundImradSections.conclusion ? 'text-lime-700 font-bold' : 'text-amber-600 font-bold'}>
                    {activePreflight.foundImradSections.results && activePreflight.foundImradSections.conclusion ? '✓ Đạt' : 'Một phần'}
                  </span>
                </div>
              </div>
            </div>

            {/* Pillar 5: Figures & Tables */}
            <div
              onClick={() => onNavigateTab('sections')}
              className="p-3.5 rounded-3xl bg-gray-200/50 space-y-2 cursor-pointer hover:bg-zinc-50/90 hover:border-zinc-300 transition-all group"
              title="Nhấp để chuyển tới tab Nội dung (Bảng & Hình)"
            >
              <h5 className="font-bold text-xs text-zinc-900 flex items-center justify-between gap-1.5">
                <span>5. Minh họa & Bảng biểu</span>
                <span className="text-[10px] text-zinc-400 group-hover:text-zinc-700 transition-colors font-medium">Sửa →</span>
              </h5>
              <div className="space-y-1.5 text-xs">
                <div className="flex items-center justify-between py-0.5 border-b border-zinc-100">
                  <span className="text-zinc-500">Tổng số bảng biểu:</span>
                  <span className="font-bold text-zinc-900">{activePreflight.totalTables} bảng</span>
                </div>
                <div className="flex items-center justify-between py-0.5 border-b border-zinc-100">
                  <span className="text-zinc-500">Tổng số hình ảnh:</span>
                  <span className="font-bold text-zinc-900">{activePreflight.totalFigures} hình</span>
                </div>
                <div className="flex items-center justify-between py-0.5">
                  <span className="text-zinc-500">Trạng thái dữ liệu:</span>
                  <span className="text-lime-700 font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Đã bóc tách
                  </span>
                </div>
              </div>
            </div>

            {/* Pillar 6: Vancouver Citations */}
            <div className="p-3.5 rounded-3xl bg-gray-200/50 space-y-2 transition-all">
              <h5 className="font-bold text-xs text-zinc-900 flex items-center gap-1.5">
                6. Trích dẫn Vancouver
              </h5>
              <div className="space-y-1.5 text-xs">
                <div className="flex items-center justify-between py-0.5 border-b border-zinc-100">
                  <span className="text-zinc-500">Tổng số tài liệu:</span>
                  <span className="font-bold text-zinc-900">{activePreflight.totalReferences} mục</span>
                </div>
                <div className="flex items-center justify-between py-0.5 border-b border-zinc-100">
                  <span className="text-zinc-500">Chưa gọi trong bài:</span>
                  {activePreflight.uncitedReferences.length === 0 ? (
                    <span className="text-lime-700 font-bold">0 mục (Tốt)</span>
                  ) : (
                    <span className="text-amber-600 font-bold">{activePreflight.uncitedReferences.length} mục</span>
                  )}
                </div>
                <div className="flex items-center justify-between py-0.5">
                  <span className="text-zinc-500">Thiếu danh mục:</span>
                  {activePreflight.missingCitations.length === 0 ? (
                    <span className="text-lime-700 font-bold">0 (Đạt)</span>
                  ) : (
                    <span className="text-red-600 font-bold">{activePreflight.missingCitations.length} mục</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
