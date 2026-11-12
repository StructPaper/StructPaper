'use client';

import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertCircle,
  AlertTriangle,
  AlignLeft,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  FileText,
  Info,
  Layers,
  Quote,
  Users,
  Wand2,
  X,
  XCircle,
} from 'lucide-react';
import { ModalPortal } from '@/components/modals/ModalPortal';
import type { ValidationIssue, ValidationReport } from '@/lib/validation/validators';
import {
  buildIssueTooltip,
  getCompactIssueDetail,
  groupValidationIssues,
  type ValidationGroupKey,
} from './validation-report-helpers';

const SEVERITY_ICON: Record<ValidationIssue['severity'], React.ReactNode> = {
  error: <XCircle className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-[2px]" />,
  warning: <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-[2px]" />,
  info: <Info className="w-3.5 h-3.5 text-sky-500 shrink-0 mt-[2px]" />,
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

export const ValidationReportView: React.FC<{
  report: ValidationReport;
  onFix?: (issue: ValidationIssue) => void;
}> = ({ report, onFix }) => {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const groups = useMemo(() => groupValidationIssues(report.issues), [report.issues]);

  if (report.issues.length === 0) {
    return (
      <div
        data-testid="validation-issues"
        className="flex items-center gap-2 rounded-2xl bg-lime-50/80 border border-lime-200/80 text-lime-800 px-3.5 py-2.5 text-[12.5px] font-semibold"
      >
        <CheckCircle2 className="w-4 h-4 text-[#65A30D] shrink-0" />
        <span>Không phát hiện vấn đề nào.</span>
      </div>
    );
  }

  const toggleGroup = (key: ValidationGroupKey) => {
    setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div
      data-testid="validation-issues"
      className="flex-1 min-h-0 overflow-y-auto select-text pr-1 space-y-0.5"
    >
      {groups.map((group) => {
        const isCollapsed = Boolean(collapsed[group.key]);
        return (
          <div key={group.key} className="space-y-0.5">
            <button
              type="button"
              onClick={() => toggleGroup(group.key)}
              aria-expanded={!isCollapsed}
              data-testid={`validation-group-${group.key}`}
              className="w-full px-3 py-2 rounded-xl flex items-center gap-1.5 text-left hover:bg-zinc-200/80 active:bg-zinc-300/70 transition-colors cursor-pointer select-none"
            >
              <ChevronDown
                className={`w-3.5 h-3.5 text-zinc-600 shrink-0 transition-transform duration-150 ${
                  isCollapsed ? '-rotate-90' : ''
                }`}
                strokeWidth={2.5}
              />
              {GROUP_ICON[group.key]}
              <span className="text-[12px] font-bold text-zinc-800 shrink-0">{group.label}</span>
              <span className="text-[11px] text-zinc-400 truncate">{group.hint}</span>
              <span
                className={`ml-auto shrink-0 min-w-[18px] h-[18px] px-1.5 rounded-full text-[10px] font-bold inline-flex items-center justify-center tabular-nums ${
                  group.errorCount > 0
                    ? 'bg-rose-100 text-rose-700'
                    : 'bg-zinc-200/80 text-zinc-700'
                }`}
              >
                {group.issues.length}
              </span>
            </button>

            {isTest ? (
              !isCollapsed && (
                <ul className="ml-[18px] mr-2 mb-2 pl-2.5 border-l-2 border-zinc-300/70 space-y-0.5">
                  {group.issues.map((issue) => {
                    const detail = getCompactIssueDetail(issue);
                    const tooltip = buildIssueTooltip(issue);
                    return (
                      <li
                        key={issue.id}
                        data-severity={issue.severity}
                        title={tooltip || undefined}
                        className="group/row flex items-start gap-2 rounded-xl px-2.5 py-1.5 hover:bg-zinc-200/70 active:bg-zinc-300/60 transition-colors"
                      >
                        {SEVERITY_ICON[issue.severity]}
                        <div className="min-w-0 flex-1 text-[12px] leading-snug">
                          <span className="font-medium text-zinc-800">{issue.title}</span>
                          {detail && (
                            <span className="ml-1.5 text-[11px] text-zinc-400">{detail}</span>
                          )}
                        </div>
                        {issue.fixTab && onFix && (
                          <button
                            type="button"
                            onClick={() => onFix(issue)}
                            className="shrink-0 opacity-80 group-hover/row:opacity-100 px-2 py-0.5 rounded-md text-[10.5px] font-bold text-zinc-600 hover:text-zinc-950 bg-white hover:bg-zinc-100 border border-zinc-200 shadow-2xs transition-all cursor-pointer"
                          >
                            Đi tới
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
                    key={`group-issues-${group.key}`}
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                    className="overflow-hidden"
                  >
                    <ul className="ml-[18px] mr-2 my-1.5 pl-2.5 border-l-2 border-zinc-300/70 space-y-0.5">
                      {group.issues.map((issue) => {
                        const detail = getCompactIssueDetail(issue);
                        const tooltip = buildIssueTooltip(issue);
                        return (
                          <li
                            key={issue.id}
                            data-severity={issue.severity}
                            title={tooltip || undefined}
                            className="group/row flex items-start gap-2 rounded-xl px-2.5 py-1.5 hover:bg-zinc-200/70 active:bg-zinc-300/60 transition-colors"
                          >
                            {SEVERITY_ICON[issue.severity]}
                            <div className="min-w-0 flex-1 text-[12px] leading-snug">
                              <span className="font-medium text-zinc-800">{issue.title}</span>
                              {detail && (
                                <span className="ml-1.5 text-[11px] text-zinc-400">{detail}</span>
                              )}
                            </div>
                            {issue.fixTab && onFix && (
                              <button
                                type="button"
                                onClick={() => onFix(issue)}
                                className="shrink-0 opacity-80 group-hover/row:opacity-100 px-2 py-0.5 rounded-md text-[10.5px] font-bold text-zinc-600 hover:text-zinc-950 bg-white hover:bg-zinc-100 border border-zinc-200 shadow-2xs transition-all cursor-pointer"
                              >
                                Đi tới
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
  );
};

interface GateProps {
  isOpen: boolean;
  report: ValidationReport | null;
  onClose: () => void;
  /** Applies renumberPaper() and re-validates. */
  onAutoFix: () => void;
  onFix?: (issue: ValidationIssue) => void;
}

const Shell: React.FC<{
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
}> = ({ title, subtitle, onClose, children }) => (
  <motion.div
    role="dialog"
    aria-label={title}
    initial={isTest ? undefined : { opacity: 0, scale: 0.92, y: 20 }}
    animate={isTest ? undefined : { opacity: 1, scale: 1, y: 0 }}
    exit={
      isTest
        ? undefined
        : {
            opacity: 0,
            scale: 0.92,
            y: 20,
            transition: { duration: 0.2, ease: [0.32, 0, 0.67, 0] },
          }
    }
    transition={isTest ? { duration: 0 } : { duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
    className="bg-[#F8F9FA] w-full max-w-xl h-[80vh] max-h-[90vh] flex flex-col rounded-[32px] shadow-2xl border border-white/40 overflow-hidden"
  >
    <div className="flex-shrink-0 px-6 pt-5 pb-3 flex items-start justify-between gap-3 border-b border-zinc-200/60">
      <div className="min-w-0">
        <h3 className="text-[17px] font-black text-slate-900 tracking-tight">{title}</h3>
        {subtitle && (
          <p className="text-xs text-slate-500 mt-0.5 truncate" title={subtitle}>
            {subtitle}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Đóng"
        className="w-9 h-9 shrink-0 rounded-full bg-gray-200/70 flex items-center justify-center text-gray-500 hover:bg-gray-200 hover:text-zinc-800 transition-colors cursor-pointer"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
    <div className="flex-1 min-h-0 px-6 py-4 flex flex-col space-y-3">{children}</div>
  </motion.div>
);

const Counts: React.FC<{ report: ValidationReport }> = ({ report }) => {
  const infoCount = report.issues.filter((i) => i.severity === 'info').length;
  if (report.issues.length === 0) return null;
  return (
    <div className="flex-shrink-0 flex flex-wrap items-center gap-3 text-[11.5px] font-semibold px-0.5">
      {report.errorCount > 0 && (
        <span className="inline-flex items-center gap-1 text-rose-600">
          <XCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{report.errorCount} lỗi</span>
        </span>
      )}
      {report.warningCount > 0 && (
        <span className="inline-flex items-center gap-1 text-amber-600">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          <span>{report.warningCount} cảnh báo</span>
        </span>
      )}
      {infoCount > 0 && (
        <span className="inline-flex items-center gap-1 text-zinc-500">
          <Info className="w-3.5 h-3.5 shrink-0" />
          <span>{infoCount} gợi ý</span>
        </span>
      )}
    </div>
  );
};

/** GATE 1 — shown after importing the original Word file, before the editor opens. */
export const ImportValidationModal: React.FC<
  GateProps & { onContinue: () => void; fileLabel?: string }
> = ({ isOpen, report, onClose, onContinue, onAutoFix, onFix, fileLabel }) => {
  if (!report) return null;
  const canFix = report.issues.some((i) => i.autoFixable);
  return (
    <ModalPortal isOpen={isOpen} onClose={onClose} zIndex={130}>
      <Shell
        title="Kiểm tra tài liệu vừa nhập"
        subtitle={fileLabel?.trim() || undefined}
        onClose={onClose}
      >
        <Counts report={report} />
        <ValidationReportView report={report} onFix={onFix} />
        <div className="flex-shrink-0 pt-2 border-t border-zinc-200/50 flex items-center justify-between gap-2">
          {canFix ? (
            <button
              type="button"
              onClick={onAutoFix}
              className="px-3.5 py-2 rounded-full bg-white border border-zinc-200 text-xs font-bold text-zinc-800 flex items-center gap-1.5 hover:bg-zinc-100 transition-colors cursor-pointer shadow-2xs"
            >
              <Wand2 className="w-3.5 h-3.5" /> Tự động đánh lại số thứ tự
            </button>
          ) : (
            <span />
          )}
          <button
            type="button"
            disabled={!report.canProceed}
            onClick={onContinue}
            className="px-5 py-2 rounded-full bg-[#78C841] text-zinc-950 text-xs font-black disabled:opacity-40 hover:brightness-95 transition cursor-pointer shadow-sm"
          >
            Vào chỉnh sửa
          </button>
        </div>
        {report.errorCount + report.warningCount > 0 && (
          <p className="flex-shrink-0 text-[11px] text-zinc-400">
            Vẫn có thể vào soạn thảo ngay; các mục này được giữ trong thẻ “Kiểm tra”.
          </p>
        )}
      </Shell>
    </ModalPortal>
  );
};

/** GATE 2 — shown before producing the final Word / PDF / XML. Errors block, warnings need acknowledgement. */
export const ExportGateModal: React.FC<
  GateProps & { format: 'docx' | 'pdf' | 'xml'; onExport: () => void }
> = ({ isOpen, report, onClose, onExport, onAutoFix, onFix, format }) => {
  if (!report) return null;
  const canFix = report.issues.some((i) => i.autoFixable);
  const label = format === 'docx' ? 'Word' : format.toUpperCase();
  return (
    <ModalPortal isOpen={isOpen} onClose={onClose} zIndex={130}>
      <Shell
        title={`Kiểm tra trước khi xuất ${label}`}
        subtitle={
          !report.canProceed
            ? 'PDF chưa biên dịch được nên chưa thể xuất. Hãy sửa lỗi biên dịch trước.'
            : report.issues.length > 0
              ? `Còn ${report.issues.length} mục cần lưu ý trước khi xuất bản.`
              : 'Không phát hiện vấn đề. Sẵn sàng xuất file.'
        }
        onClose={onClose}
      >
        <Counts report={report} />
        <ValidationReportView report={report} onFix={onFix} />
        <div className="flex-shrink-0 pt-2 border-t border-zinc-200/50 flex items-center justify-between gap-2">
          <div className="flex gap-2">
            {canFix && (
              <button
                type="button"
                onClick={onAutoFix}
                className="px-3.5 py-2 rounded-full bg-white border border-zinc-200 text-xs font-bold text-zinc-800 flex items-center gap-1.5 hover:bg-zinc-100 transition-colors cursor-pointer shadow-2xs"
              >
                <Wand2 className="w-3.5 h-3.5" /> Tự động đánh lại số thứ tự
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-full bg-white border border-zinc-200 text-xs font-bold text-zinc-700 hover:bg-zinc-100 transition-colors cursor-pointer shadow-2xs"
            >
              Quay lại sửa
            </button>
          </div>
          <button
            type="button"
            disabled={!report.canProceed}
            onClick={onExport}
            className="px-5 py-2 rounded-full bg-[#78C841] text-zinc-950 text-xs font-black disabled:opacity-40 hover:brightness-95 transition cursor-pointer shadow-sm"
          >
            {report.issues.length > 0 ? `Vẫn xuất ${label}` : `Xuất ${label}`}
          </button>
        </div>
      </Shell>
    </ModalPortal>
  );
};
