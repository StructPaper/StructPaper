import type { ValidationIssue, ValidationSeverity } from '@/lib/validation/validators';

export type ValidationGroupKey =
  | 'general'
  | 'metadata'
  | 'authors'
  | 'abstract'
  | 'sections'
  | 'refs'
  | 'citation';

export interface ValidationGroupMeta {
  key: ValidationGroupKey;
  label: string;
  hint: string;
}

export interface ValidationIssueGroup extends ValidationGroupMeta {
  issues: ValidationIssue[];
  errorCount: number;
  warningCount: number;
  infoCount: number;
}

const SEVERITY_ORDER: Record<ValidationSeverity, number> = {
  error: 0,
  warning: 1,
  info: 2,
};

const GROUP_ORDER: readonly ValidationGroupKey[] = [
  'general',
  'metadata',
  'authors',
  'abstract',
  'sections',
  'refs',
  'citation',
];

const GROUP_META: Record<ValidationGroupKey, ValidationGroupMeta> = {
  general: { key: 'general', label: 'Kiểm tra chung', hint: 'Tài liệu' },
  metadata: { key: 'metadata', label: 'Tiêu đề & Thông tin', hint: 'Thẻ Tựa đề' },
  authors: { key: 'authors', label: 'Tác giả & Đơn vị', hint: 'Thẻ Tác giả' },
  abstract: { key: 'abstract', label: 'Tóm tắt & Từ khóa', hint: 'Thẻ Tóm tắt' },
  sections: { key: 'sections', label: 'Nội dung, Bảng & Hình', hint: 'Thẻ Nội dung' },
  refs: { key: 'refs', label: 'Tài liệu tham khảo', hint: 'Thẻ Tham khảo' },
  citation: { key: 'citation', label: 'Trích dẫn bài báo', hint: 'How to cite' },
};

/**
 * Groups validation diagnostics into VS-Code-inspired collapsible tree sections
 * ordered with error-bearing groups first and severity sorted inside each section.
 */
export function groupValidationIssues(issues: ValidationIssue[]): ValidationIssueGroup[] {
  const buckets = new Map<ValidationGroupKey, ValidationIssue[]>();

  for (const issue of issues) {
    const key: ValidationGroupKey = issue.fixTab ?? 'general';
    const list = buckets.get(key) ?? [];
    list.push(issue);
    buckets.set(key, list);
  }

  const groups: ValidationIssueGroup[] = [];
  for (const key of GROUP_ORDER) {
    const raw = buckets.get(key);
    if (!raw?.length) continue;
    const sorted = [...raw].sort(
      (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]
    );
    groups.push({
      ...GROUP_META[key],
      issues: sorted,
      errorCount: sorted.filter((i) => i.severity === 'error').length,
      warningCount: sorted.filter((i) => i.severity === 'warning').length,
      infoCount: sorted.filter((i) => i.severity === 'info').length,
    });
  }

  return groups.sort((a, b) => {
    const aHasErr = a.errorCount > 0 ? 0 : 1;
    const bHasErr = b.errorCount > 0 ? 0 : 1;
    if (aHasErr !== bHasErr) return aHasErr - bHasErr;
    return GROUP_ORDER.indexOf(a.key) - GROUP_ORDER.indexOf(b.key);
  });
}

function trimPeriod(text: string): string {
  return text.trim().replace(/\.$/, '');
}

/**
 * Extracts a short, non-redundant inline detail qualifier for minimalist rows.
 * Full explanation & suggestions stay accessible via native hover tooltip.
 */
export function getCompactIssueDetail(issue: ValidationIssue): string | null {
  const { code, message, title } = issue;

  if (code === 'field.publication.missing' || code.startsWith('preflight.')) {
    return null;
  }
  if (code === 'field.date.missing') {
    if (message.startsWith('Chưa điền: ')) {
      return trimPeriod(message.slice('Chưa điền: '.length));
    }
    return null;
  }
  if (code === 'field.date.format') {
    const quoted = message.match(/"([^"]+)"/);
    return quoted ? `"${quoted[1]}" · dd/mm/yyyy` : 'dd/mm/yyyy';
  }
  if (code === 'field.abstract.length') {
    return 'chuẩn 275–500 từ';
  }
  if (code === 'field.keywords.count') {
    return 'chuẩn 3–5 từ khóa';
  }
  if (code === 'citation.uncited') {
    const bracket = message.match(/\[[^\]]+\]/);
    return bracket ? bracket[0] : null;
  }
  if (code === 'figure.source' || code === 'table.source') {
    const prefix = 'Chưa ghi "Nguồn: …": ';
    return message.startsWith(prefix) ? trimPeriod(message.slice(prefix.length)) : null;
  }
  if (
    code === 'equation.invalid' ||
    code === 'field.title.normalized' ||
    code === 'field.date.order' ||
    code === 'export.pdf.compile' ||
    code.startsWith('numbering.')
  ) {
    return message ? trimPeriod(message) : null;
  }

  const cleaned = trimPeriod(message || '');
  if (!cleaned || cleaned === trimPeriod(title) || cleaned.length > 64) {
    return null;
  }
  return cleaned;
}

export function buildIssueTooltip(issue: ValidationIssue): string {
  return [issue.message, issue.suggestion].filter(Boolean).join(' — ');
}
