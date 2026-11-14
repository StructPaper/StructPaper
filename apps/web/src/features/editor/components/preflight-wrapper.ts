/**
 * Preflight QC Engine Wrapper
 * 
 * Routes preflight checks to @structpaper/qc-engine, bridging legacy CompletePaper
 * contracts and v2 Manuscript specifications while preserving 100% UI compatibility.
 */

import type { CompletePaper, PreflightCheck, StructuralIssue, PaperMetadata } from '@/types/paper';
import type { Manuscript, Command } from '@structpaper/doc-model';
import { migrateV1toV2, computeNumbering } from '@structpaper/doc-model';
import { getJournalProfile, VNUHCM_HS_PROFILE, JournalProfile } from '@structpaper/journal-profiles';
import { runQc, defaultQcEngine, QcResult } from '@structpaper/qc-engine';

export interface PreflightEngineOptions {
  strictImrad?: boolean;
  minAbstractWords?: number;
}

export interface ExtendedPreflightCheck extends PreflightCheck {
  qcResult?: QcResult;
  pillars?: QcResult['pillars'];
}

function mapPillarToCategory(
  pillar: string,
  issueId: string
): 'metadata' | 'author' | 'abstract' | 'content' | 'table_fig' | 'reference' {
  const p = pillar.toLowerCase();
  if (p === 'imrad') return 'content';
  if (p === 'figures' || p === 'tables' || p === 'floats') return 'table_fig';
  if (p === 'citations' || p === 'references') return 'reference';
  if (p === 'authors_abstract') {
    if (issueId.includes('author') || issueId.includes('affil') || issueId.includes('corr')) {
      return 'author';
    }
    return 'abstract';
  }
  return 'metadata';
}

function resolveJournalProfile(journalId?: string): JournalProfile {
  if (!journalId) return VNUHCM_HS_PROFILE;
  try {
    return getJournalProfile(journalId);
  } catch {
    return VNUHCM_HS_PROFILE;
  }
}

/**
 * Computes preflight check results using @structpaper/qc-engine.
 */
export function computePreflightCheckWrapper(
  input: CompletePaper | Manuscript | PreflightCheck | null | undefined,
  _options?: PreflightEngineOptions
): ExtendedPreflightCheck {
  if (!input) {
    return {
      titleOk: false,
      titleEnOk: false,
      abstractOk: false,
      abstractEnOk: false,
      keywordsCount: 0,
      keywordsEnCount: 0,
      authorsCount: 0,
      affiliationsCount: 0,
      correspondingOk: false,
      imradOk: false,
      foundImradSections: {
        intro: false,
        methods: false,
        results: false,
        discussion: false,
        conclusion: false,
      },
      totalFigures: 0,
      totalTables: 0,
      totalReferences: 0,
      uncitedReferences: [],
      missingCitations: [],
      vancouverConformant: false,
      score: 0,
      issues: [
        {
          id: 'missing_paper',
          category: 'metadata',
          severity: 'error',
          title: 'Thiếu dữ liệu bản thảo',
          message: 'Không tìm thấy dữ liệu bài báo để kiểm định.',
          suggestion: 'Vui lòng tải lên hoặc tạo mới bài báo.',
          fixTab: 'metadata',
        },
      ],
    };
  }

  // If already a PreflightCheck object
  if ('score' in input && 'foundImradSections' in input && 'issues' in input) {
    return input as ExtendedPreflightCheck;
  }

  // Convert to Manuscript if v1 CompletePaper
  let v2Doc: Manuscript;
  let rawPaper: CompletePaper | undefined;

  if ('schemaVersion' in input && input.schemaVersion === 2) {
    v2Doc = input as Manuscript;
  } else {
    rawPaper = input as CompletePaper;
    v2Doc = migrateV1toV2(rawPaper);
  }

  const profile = resolveJournalProfile(rawPaper?.metadata?.journalId || v2Doc.journalId);
  const qcResult = runQc(v2Doc, profile);
  const numbering = computeNumbering(v2Doc);

  // Extract metadata checks
  const meta: Partial<PaperMetadata> = rawPaper?.metadata || {};

  const titleText = meta.title || '';
  const titleOk = Boolean(titleText && titleText !== 'Bản thảo chưa đặt tiêu đề' && titleText.length > 10);
  const titleEnOk = Boolean(meta.titleEn && meta.titleEn.trim().length > 10);

  const abstractWordCount = meta.abstract ? meta.abstract.split(/\s+/).filter(Boolean).length : 0;
  const abstractOk = Boolean(
    meta.abstract &&
    abstractWordCount >= 40 &&
    !meta.abstract.includes('Chưa phát hiện phần tóm tắt')
  );

  const abstractEnWordCount = meta.abstractEn ? meta.abstractEn.split(/\s+/).filter(Boolean).length : 0;
  const abstractEnOk = Boolean(meta.abstractEn && abstractEnWordCount >= 30);

  const keywordsCount = meta.keywords ? meta.keywords.filter(Boolean).length : 0;
  const keywordsEnCount = meta.keywordsEn ? meta.keywordsEn.filter(Boolean).length : 0;
  const authorsCount = meta.authors ? meta.authors.length : 0;
  const affiliationsCount = meta.affiliations ? meta.affiliations.length : 0;

  const corrEmail = meta.corresponding?.email || meta.authors?.find((a) => a.isCorresponding)?.email || '';
  const correspondingOk = Boolean(
    (meta.corresponding?.name || meta.authors?.some((a) => a.isCorresponding)) &&
    corrEmail.includes('@')
  );

  const rawSections = rawPaper?.sections || [];
  const allTitles = rawSections.map((s) => (s.title || '').toLowerCase());
  const foundImradSections = {
    intro: allTitles.some((t) => /giới thiệu|đặt vấn đề|mở đầu|introduction/i.test(t)),
    methods: allTitles.some((t) => /phương pháp|vật liệu|thực nghiệm|đối tượng|methods|materials|khảo sát/i.test(t)),
    results: allTitles.some((t) => /kết quả|results|thực nghiệm và thảo luận/i.test(t)),
    discussion: allTitles.some((t) => /bàn luận|thảo luận|discussion|kết quả và thảo luận|tổng quan/i.test(t)),
    conclusion: allTitles.some((t) => /kết luận|conclusions?|kết luận và kiến nghị/i.test(t)),
  };

  const imradCount = Object.values(foundImradSections).filter(Boolean).length;
  const imradOk = imradCount >= 3;

  const totalFigures = rawSections.filter((s) => s.type === 'figure').length;
  const totalTables = rawSections.filter((s) => s.type === 'table').length;

  const citationSec = rawSections.find((s) => s.type === 'citation');
  const citationOk = Boolean(citationSec && citationSec.content && citationSec.content.trim().length > 10);

  // Map numbering issues
  const uncitedReferences = (numbering.uncitedRefs || []).map((id, idx) => {
    const num = parseInt(id.replace(/\D/g, ''), 10);
    return isNaN(num) ? idx + 1 : num;
  });

  const missingCitations = (numbering.danglingCites || []).map((id, idx) => {
    const num = parseInt(id.replace(/\D/g, ''), 10);
    return isNaN(num) ? idx + 1 : num;
  });

  const rawReferences = rawPaper?.references || v2Doc.references || [];

  // Transform QcIssues to StructuralIssues
  const issues: (StructuralIssue & { fix?: Command })[] = qcResult.issues.map((i) => ({
    id: i.id,
    category: mapPillarToCategory(i.pillar, i.id),
    severity: i.severity,
    title: i.title || i.message,
    message: i.message,
    suggestion: i.suggestion || '',
    fixTab: (i.fixTab as StructuralIssue['fixTab']) || 'sections',
    fix: i.fix,
  }));

  return {
    titleOk,
    titleEnOk,
    abstractOk,
    abstractEnOk,
    citationOk,
    keywordsCount,
    keywordsEnCount,
    authorsCount,
    affiliationsCount,
    correspondingOk,
    imradOk,
    foundImradSections,
    totalFigures,
    totalTables,
    totalReferences: rawReferences.length,
    uncitedReferences,
    missingCitations,
    vancouverConformant: rawReferences.length > 0 && missingCitations.length === 0,
    score: qcResult.score,
    issues,
    qcResult,
    pillars: qcResult.pillars,
  };
}

export const runPreflightCheck = computePreflightCheckWrapper;
export { defaultQcEngine };
