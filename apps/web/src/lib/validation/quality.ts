import type { CompletePaper, PreflightCheck, StructuralIssue } from '@/types/paper';
import { computePreflightCheck } from '@/lib/docx-parser';
import { collectIssues, type ValidationIssue } from './validators';

const TABLE_FIG_CODE = /^(numbering\.(table|figure|equation)|reference\.(table|figure|equation)|figure\.|table\.|equation\.)/;

const categoryOf = (i: ValidationIssue): StructuralIssue['category'] => {
  if (i.code.startsWith('preflight.')) return i.code.slice('preflight.'.length) as StructuralIssue['category'];
  if (TABLE_FIG_CODE.test(i.code)) return 'table_fig';
  switch (i.fixTab) {
    case 'authors':
      return 'author';
    case 'abstract':
      return 'abstract';
    case 'sections':
      return 'content';
    case 'refs':
      return 'reference';
    default:
      return 'metadata';
  }
};

const toStructural = (i: ValidationIssue): StructuralIssue => ({
  id: i.id,
  category: categoryOf(i),
  severity: i.severity,
  title: i.title,
  message: i.message,
  suggestion: i.suggestion ?? '',
  fixTab: i.fixTab,
  code: i.code,
});

/**
 * The paper's quality check as the QC tab, the dock badge and the tab marks show it: the structure
 * counts of the preflight, with EVERY issue the import and export gates know about (numbering,
 * dates, publication data, authors, tables, references, leftover template text...).
 * One list for all of them, so what the upload warns about is what the QC tab shows.
 */
export function computeQualityCheck(paper: CompletePaper): PreflightCheck {
  const base = computePreflightCheck(paper);
  const issues = collectIssues(paper, 'export').map(toStructural);

  // the preflight score already counts its own findings; the extra ones lower it a little more
  const preflightIds = new Set((base.issues || []).map((i) => i.id));
  const extra = issues.filter((i) => !preflightIds.has(i.id));
  const penalty = extra.reduce((sum, i) => sum + (i.severity === 'error' ? 5 : i.severity === 'warning' ? 2 : 0), 0);

  return { ...base, issues, score: Math.max(0, Math.round(base.score - penalty)) };
}
