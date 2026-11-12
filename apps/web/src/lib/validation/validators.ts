import type { CompletePaper, StructuralIssue } from '@/types/paper';
import { computePreflightCheck } from '@/lib/docx-parser';
import { checkLatexMath } from '@/lib/math-text';
import { analyzeNumbering } from './numbering';
import { resolvePublication, UNKNOWN } from '../publication';

export type ValidationGate = 'import' | 'export';
export type ValidationSeverity = 'error' | 'warning' | 'info';

export interface ValidationIssue {
  id: string;
  gate: ValidationGate;
  severity: ValidationSeverity;
  /** Stable machine code, e.g. "numbering.table". */
  code: string;
  title: string;
  message: string;
  suggestion?: string;
  fixTab?: StructuralIssue['fixTab'];
  /** True when renumberPaper() resolves the issue. */
  autoFixable?: boolean;
}

export interface ValidationReport {
  gate: ValidationGate;
  issues: ValidationIssue[];
  errorCount: number;
  warningCount: number;
  /** import: false only when the file is effectively empty. export: false while errors remain. */
  canProceed: boolean;
}

export interface ExportValidationOptions {
  /** Last PDF compile succeeded (when exporting PDF). undefined = not applicable. */
  pdfCompiled?: boolean;
  /** Format about to be produced; PDF additionally requires a successful compile. */
  format?: 'docx' | 'pdf' | 'xml';
}

const DATE_RE = /^(0?[1-9]|[12]\d|3[01])[-/.](0?[1-9]|1[0-2])[-/.](\d{4})$/;

function wordCount(s: string): number {
  return (s || '').trim().split(/\s+/).filter(Boolean).length;
}

function parseDate(s: string): number | null {
  const m = (s || '').trim().match(DATE_RE);
  if (!m) return null;
  const [y, mo, d] = [Number(m[3]), Number(m[2]), Number(m[1])];
  const t = Date.UTC(y, mo - 1, d);
  const back = new Date(t);
  // Reject impossible calendar dates such as 31/02.
  return back.getUTCFullYear() === y && back.getUTCMonth() === mo - 1 && back.getUTCDate() === d ? t : null;
}

function build(gate: ValidationGate, issues: ValidationIssue[], emptyDoc: boolean): ValidationReport {
  const errorCount = issues.filter((i) => i.severity === 'error').length;
  const warningCount = issues.filter((i) => i.severity === 'warning').length;
  return {
    gate,
    issues,
    errorCount,
    warningCount,
    // Import: only an empty file stops. Export is advisory: issues are listed but never block,
    // except a PDF that could not be compiled (there is nothing to download).
    canProceed: gate === 'import' ? !emptyDoc : !issues.some((i) => i.code === 'export.pdf.compile'),
  };
}

/** Checks shared by both gates: numbering, dates, equations, captions, sources. */
function coreChecks(paper: CompletePaper, gate: ValidationGate): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const push = (i: Omit<ValidationIssue, 'gate'>) => issues.push({ ...i, gate });
  const md = paper.metadata;
  const a = analyzeNumbering(paper);

  // ---- required front-matter fields (template: "Điền từng ngày dd/mm/yyyy") ----
  const dates: Array<[keyof typeof md.dates, string]> = [
    ['received', 'Ngày nhận bài'],
    ['revised', 'Ngày sửa bài'],
    ['accepted', 'Ngày chấp nhận'],
  ];
  const parsed: Record<string, number | null> = {};
  const missingDates: string[] = [];
  dates.forEach(([key, label]) => {
    const v = (md.dates?.[key] as string) || '';
    if (!v.trim()) {
      missingDates.push(label);
      parsed[key] = null;
      return;
    }
    parsed[key] = parseDate(v);
    if (parsed[key] === null) {
      push({ id: `date_${key}_format`, severity: 'error', code: 'field.date.format', title: `${label} sai định dạng`, message: `Giá trị "${v}" không phải ngày hợp lệ dd/mm/yyyy.`, suggestion: 'Nhập lại, ví dụ 08/09/2025.', fixTab: 'metadata' });
    }
  });
  if (missingDates.length === 1) {
    push({
      id: 'date_missing',
      severity: 'warning',
      code: 'field.date.missing',
      title: `Thiếu ${missingDates[0]}`,
      message: `${missingDates[0]} chưa được điền.`,
      suggestion: 'Nhập theo định dạng dd/mm/yyyy.',
      fixTab: 'metadata',
    });
  } else if (missingDates.length > 1) {
    push({
      id: 'date_missing',
      severity: 'warning',
      code: 'field.date.missing',
      title: `Thiếu ${missingDates.length} mốc ngày biên tập`,
      message: `Chưa điền: ${missingDates.join(', ')}.`,
      suggestion: 'Nhập theo định dạng dd/mm/yyyy.',
      fixTab: 'metadata',
    });
  }
  if (parsed.received && parsed.revised && parsed.revised < parsed.received) {
    push({ id: 'date_order_revised', severity: 'error', code: 'field.date.order', title: 'Ngày sửa bài trước ngày nhận bài', message: 'Ngày sửa bài phải sau hoặc bằng ngày nhận bài.', fixTab: 'metadata' });
  }
  if (parsed.revised && parsed.accepted && parsed.accepted < parsed.revised) {
    push({ id: 'date_order_accepted', severity: 'error', code: 'field.date.order', title: 'Ngày chấp nhận trước ngày sửa bài', message: 'Ngày chấp nhận phải sau hoặc bằng ngày sửa bài.', fixTab: 'metadata' });
  }

  if (md.titleOriginal && md.titleOriginal !== md.title) {
    push({ id: 'title_normalized', severity: 'info', code: 'field.title.normalized', title: 'Tựa đề đã chuyển từ chữ HOA sang kiểu câu', message: `Bản gốc trong Word: "${md.titleOriginal}".`, suggestion: 'Có thể hoàn tác ở thẻ "Tựa đề".', fixTab: 'metadata' });
  }

  // Word titles are often typed in capitals; the journal prints sentence case.
  const titleLetters = (md.title || '').replace(/[^A-Za-zÀ-ỹ]/g, '');
  if (titleLetters.length >= 12 && titleLetters === titleLetters.toUpperCase()) {
    push({ id: 'title_allcaps', severity: 'warning', code: 'field.title.allcaps', title: 'Tiêu đề đang viết hoa toàn bộ', message: 'Tạp chí in tiêu đề theo kiểu câu (chỉ viết hoa chữ đầu và tên riêng).', suggestion: 'Sửa lại ở thẻ "Tựa đề".', fixTab: 'metadata' });
  }

  // Publication data is assigned by the editorial office; the Word file normally lacks it.
  // "?" = never entered (warn); blank = the editor deliberately cleared it (no warning).
  const pubValues = resolvePublication(md);
  const missingPub = [
    pubValues.doi === UNKNOWN && 'DOI',
    pubValues.volume === UNKNOWN && 'Tập',
    pubValues.issue === UNKNOWN && 'Số',
    (pubValues.firstPage === UNKNOWN || pubValues.lastPage === UNKNOWN) && 'Trang',
    pubValues.published === UNKNOWN && 'Ngày đăng',
  ].filter(Boolean) as string[];
  if (missingPub.length) {
    push({ id: 'pub_info_missing', severity: 'warning', code: 'field.publication.missing', title: `Thiếu thông tin xuất bản: ${missingPub.join(', ')}`, message: 'Các trường này do ban biên tập cấp và thường không có trong file Word gốc.', suggestion: 'Nhập ở thẻ "Tựa đề" trước khi xuất bản.', fixTab: 'metadata' });
  }

  const words = wordCount(md.abstract);
  if (md.abstract?.trim() && (words < 275 || words > 500)) {
    push({ id: 'abstract_words', severity: 'warning', code: 'field.abstract.length', title: `Tóm tắt có ${words} từ`, message: 'Template quy định tóm tắt dài 275–500 từ.', suggestion: words < 275 ? 'Bổ sung nội dung tóm tắt.' : 'Rút gọn tóm tắt.', fixTab: 'abstract' });
  }
  const kw = (md.keywords || []).filter((k) => k.trim()).length;
  if (kw > 0 && (kw < 3 || kw > 5)) {
    push({ id: 'keywords_count', severity: 'warning', code: 'field.keywords.count', title: `Có ${kw} từ khóa`, message: 'Template quy định 3–5 từ khóa.', fixTab: 'abstract' });
  }

  // ---- numbering (STT) ----
  const labels: Record<string, string> = { table: 'Bảng', figure: 'Hình', equation: 'Phương trình' };
  a.objects.forEach((o) => {
    const label = labels[o.kind];
    if (o.num === undefined || o.num !== o.expected) {
      push({ id: `num_${o.kind}_${o.sectionIndex}`, severity: 'error', code: `numbering.${o.kind}`, title: `${label} đánh số sai thứ tự`, message: `${label} thứ ${o.expected} trong bài đang mang số ${o.num ?? '(trống)'}.`, suggestion: 'Dùng "Tự động đánh lại số thứ tự" để sửa.', fixTab: 'sections', autoFixable: true });
    } else if (o.firstMentionIndex === null) {
      push({ id: `ref_${o.kind}_${o.sectionIndex}`, severity: 'warning', code: `reference.${o.kind}.unmentioned`, title: `${label} ${o.num} chưa được nhắc trong văn bản`, message: `Cần đề cập ${label} ${o.num} trong văn bản trước khi ${label.toLowerCase()} xuất hiện.`, fixTab: 'sections' });
    } else if (o.firstMentionIndex > o.sectionIndex) {
      push({ id: `order_${o.kind}_${o.sectionIndex}`, severity: 'warning', code: `reference.${o.kind}.late`, title: `${label} ${o.num} xuất hiện trước khi được nhắc`, message: 'Template yêu cầu đề cập trước khi đối tượng xuất hiện.', fixTab: 'sections' });
    }
  });

  if (a.missingReferences.length) {
    push({ id: 'cite_missing', severity: 'error', code: 'citation.missing', title: `Trích dẫn [${a.missingReferences.join(', ')}] không có trong danh mục tham khảo`, message: 'Có số trích dẫn trong bài không khớp tài liệu tham khảo nào.', suggestion: 'Thêm tài liệu tham khảo tương ứng hoặc sửa số trích dẫn.', fixTab: 'refs' });
  }
  if (!a.referencesSequential) {
    push({ id: 'refs_sequential', severity: 'error', code: 'numbering.references', title: 'Danh mục tham khảo không đánh số liên tục', message: 'Số thứ tự tài liệu tham khảo phải là 1, 2, 3… liên tục.', fixTab: 'refs', autoFixable: true });
  }
  if (a.citationOrder.length && !a.citationsInOrder && a.missingReferences.length === 0) {
    push({ id: 'cite_order', severity: 'error', code: 'numbering.citations', title: 'Trích dẫn không theo thứ tự xuất hiện lần đầu', message: 'Kiểu Vancouver: số trích dẫn phải tăng dần theo lần xuất hiện đầu tiên.', suggestion: 'Dùng "Tự động đánh lại số thứ tự" để sửa.', fixTab: 'refs', autoFixable: true });
  }
  if (a.uncitedReferences.length) {
    push({ id: 'refs_uncited', severity: 'warning', code: 'citation.uncited', title: `${a.uncitedReferences.length} tài liệu tham khảo chưa được trích dẫn`, message: `Chưa được viện dẫn: [${a.uncitedReferences.join(', ')}].`, fixTab: 'refs' });
  }

  // ---- captions, sources, equations ----
  const missingFigureSources: string[] = [];
  const missingTableSources: string[] = [];
  (paper.sections || []).forEach((sec, idx) => {
    if (sec.type === 'figure' && sec.figure && !(sec.figure.source || '').trim()) {
      missingFigureSources.push(sec.figure.num != null ? String(sec.figure.num) : `#${idx + 1}`);
    }
    if (sec.type === 'table' && sec.table && !(sec.table.source || '').trim()) {
      missingTableSources.push(sec.table.num != null ? String(sec.table.num) : `#${idx + 1}`);
    }
    if (sec.type === 'equation') {
      const err = checkLatexMath(sec.equation?.latex || '');
      if (err) {
        push({ id: `eq_invalid_${idx}`, severity: 'error', code: 'equation.invalid', title: 'Công thức không hợp lệ', message: err, fixTab: 'sections' });
      }
    }
  });

  const pushMissingSource = (
    items: string[],
    opts: { id: string; code: string; singularLabel: string; nounLower: string; suggestion?: string }
  ) => {
    if (items.length === 0) return;
    const preview = items.slice(0, 6).join(', ') + (items.length > 6 ? ', …' : '');
    if (items.length === 1) {
      push({
        id: opts.id,
        severity: 'warning',
        code: opts.code,
        title: `${opts.singularLabel} ${items[0]} thiếu nguồn`,
        message: `Mỗi ${opts.nounLower} cần ghi "Nguồn: …".`,
        suggestion: opts.suggestion,
        fixTab: 'sections',
      });
      return;
    }
    push({
      id: opts.id,
      severity: 'warning',
      code: opts.code,
      title: `${items.length} ${opts.nounLower} thiếu nguồn`,
      message: `Chưa ghi "Nguồn: …": ${opts.singularLabel} ${preview}.`,
      suggestion: opts.suggestion,
      fixTab: 'sections',
    });
  };

  pushMissingSource(missingFigureSources, {
    id: 'fig_source',
    code: 'figure.source',
    singularLabel: 'Hình',
    nounLower: 'hình',
    suggestion: 'Ghi "Nguồn: Kết quả của nhóm tác giả" nếu do tác giả tạo ra.',
  });
  pushMissingSource(missingTableSources, {
    id: 'tbl_source',
    code: 'table.source',
    singularLabel: 'Bảng',
    nounLower: 'bảng',
  });

  return issues;
}

const CORE_SUPERSEDED_PREFLIGHT_IDS = new Set(['iss_missing_cites', 'iss_uncited_refs']);
const IMPORT_ADVISORY_PREFLIGHT_IDS = new Set(['iss_keywords_en', 'iss_methods', 'iss_conclusion']);

function collapsePreflightBatch(
  issues: ValidationIssue[],
  prefix: string,
  summaryId: string,
  pluralTitle: (count: number) => string
): ValidationIssue[] {
  const matching = issues.filter((i) => i.id.startsWith(prefix));
  if (matching.length <= 1) return issues;
  const first = matching[0];
  let inserted = false;
  return issues.flatMap((item) => {
    if (!item.id.startsWith(prefix)) return [item];
    if (inserted) return [];
    inserted = true;
    return [
      {
        ...first,
        id: summaryId,
        title: pluralTitle(matching.length),
      },
    ];
  });
}

function fromPreflight(paper: CompletePaper, gate: ValidationGate): ValidationIssue[] {
  const check = computePreflightCheck(paper);
  const hasAbstract = Boolean((paper.metadata?.abstract || '').trim());
  const hasKeywords = (paper.metadata?.keywords || []).some((k) => k.trim().length > 0);
  const hasEmptyTitle = !(paper.metadata?.title || '').trim();

  const mapped = (check.issues || [])
    .filter((i: StructuralIssue) => {
      if (CORE_SUPERSEDED_PREFLIGHT_IDS.has(i.id)) return false;
      if (i.id === 'iss_abstract' && hasAbstract) return false;
      if (i.id === 'iss_keywords' && hasKeywords) return false;
      if (gate === 'export' && i.id === 'iss_title' && hasEmptyTitle) return false;
      if (gate === 'import' && IMPORT_ADVISORY_PREFLIGHT_IDS.has(i.id)) return false;
      return true;
    })
    .map((i: StructuralIssue) => ({
      id: i.id,
      gate,
      severity: gate === 'import' && i.id === 'iss_missing_citation' ? ('warning' as const) : i.severity,
      code: `preflight.${i.category}`,
      title: i.title,
      message: i.message,
      suggestion: i.suggestion,
      fixTab: i.fixTab,
    }));

  const collapsedParas = collapsePreflightBatch(
    mapped,
    'iss_empty_para_',
    'iss_empty_para',
    (count) => `${count} đoạn văn bản để trống`
  );
  return collapsePreflightBatch(
    collapsedParas,
    'iss_empty_heading_',
    'iss_empty_heading',
    (count) => `${count} tiêu đề mục để trống`
  );
}

function dedupe(issues: ValidationIssue[]): ValidationIssue[] {
  const seen = new Set<string>();
  return issues.filter((i) => (seen.has(i.id) ? false : (seen.add(i.id), true)));
}

/**
 * GATE 1 — run right after a Word file is imported, before the user may open the editor.
 * Never throws; reports missing fields and numbering problems.
 */
export function validateForImport(paper: CompletePaper): ValidationReport {
  const issues = dedupe([...fromPreflight(paper, 'import'), ...coreChecks(paper, 'import')]);
  const emptyDoc = !(paper.sections || []).length && !(paper.metadata?.title || '').trim();
  return build('import', issues, emptyDoc);
}

/**
 * GATE 2 — run before producing the final deliverable. Advisory: every missing/incorrect item is
 * listed, and the user may still export. Only a failed PDF compile blocks (nothing to export).
 */
export function validateForExport(paper: CompletePaper, opts: ExportValidationOptions = {}): ValidationReport {
  const issues = dedupe([...fromPreflight(paper, 'export'), ...coreChecks(paper, 'export')]);
  if (opts.format === 'pdf' && opts.pdfCompiled === false) {
    issues.push({ id: 'pdf_compile', gate: 'export', severity: 'error', code: 'export.pdf.compile', title: 'PDF chưa biên dịch thành công', message: 'Cần biên dịch PDF không lỗi trước khi xuất.', suggestion: 'Mở bảng lỗi biên dịch và sửa nội dung.' });
  }
  if (!(paper.metadata?.title || '').trim()) {
    issues.push({ id: 'export_title', gate: 'export', severity: 'error', code: 'export.title', title: 'Chưa có tiêu đề', message: 'Không thể xuất tài liệu khi chưa có tiêu đề.', fixTab: 'metadata' });
  }
  const unique = dedupe(issues);
  return build('export', unique, false);
}
