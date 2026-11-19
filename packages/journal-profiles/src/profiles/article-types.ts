import { ArticleTypeProfile, JournalArticleType } from '../types';

export const ALL_ARTICLE_TYPES: JournalArticleType[] = [
  {
    id: 'research',
    label: {
      vi: 'Bài báo nghiên cứu',
      en: 'Research Article',
    },
    requiredSections: ['heading.abstract', 'h1', 'heading.references'],
  },
  {
    id: 'review',
    label: {
      vi: 'Bài tổng quan',
      en: 'Review',
    },
    requiredSections: ['heading.abstract', 'h1', 'heading.references'],
  },
  {
    id: 'editorial',
    label: {
      vi: 'Bài xã luận',
      en: 'Editorial',
    },
    requiredSections: ['h1'],
  },
  {
    id: 'commentary',
    label: {
      vi: 'Bình luận & Ý kiến',
      en: 'Commentary',
    },
    requiredSections: ['heading.abstract', 'h1', 'heading.references'],
  },
  {
    id: 'letter',
    label: {
      vi: 'Thư gửi tòa soạn',
      en: 'Letter',
    },
    requiredSections: ['h1'],
  },
  {
    id: 'correction',
    label: {
      vi: 'Đính chính',
      en: 'Correction',
    },
    requiredSections: ['h1'],
  },
  {
    id: 'methodology',
    label: {
      vi: 'Phương pháp luận',
      en: 'Methodology',
    },
    requiredSections: ['heading.abstract', 'h1', 'heading.references'],
  },
  {
    id: 'case-report',
    label: {
      vi: 'Báo cáo ca lâm sàng',
      en: 'Case Report',
    },
    requiredSections: ['heading.abstract', 'h1', 'heading.references'],
  },
  {
    id: 'special-topic',
    label: {
      vi: 'Chuyên đề đặc biệt',
      en: 'Special Topic',
    },
    requiredSections: ['heading.abstract', 'h1', 'heading.references'],
  },
];

export const ARTICLE_TYPE_DEFINITIONS: Record<string, ArticleTypeProfile> = {
  research: {
    id: 'research',
    label: {
      vi: 'Bài báo nghiên cứu',
      en: 'Research Article',
    },
    requiredSections: ['heading.abstract', 'h1', 'heading.references'],
  },
  review: {
    id: 'review',
    label: {
      vi: 'Bài tổng quan',
      en: 'Review',
    },
    requiredSections: ['heading.abstract', 'h1', 'heading.references'],
  },
  editorial: {
    id: 'editorial',
    label: {
      vi: 'Bài xã luận',
      en: 'Editorial',
    },
    requiredSections: ['h1'],
    frontMatter: {
      abstract: null,
    },
  },
  commentary: {
    id: 'commentary',
    label: {
      vi: 'Bình luận & Ý kiến',
      en: 'Commentary',
    },
    requiredSections: ['heading.abstract', 'h1', 'heading.references'],
  },
  letter: {
    id: 'letter',
    label: {
      vi: 'Thư gửi tòa soạn',
      en: 'Letter',
    },
    requiredSections: ['h1'],
    frontMatter: {
      abstract: null,
    },
  },
  correction: {
    id: 'correction',
    label: {
      vi: 'Đính chính',
      en: 'Correction',
    },
    requiredSections: ['h1'],
    frontMatter: {
      abstract: null,
    },
  },
  methodology: {
    id: 'methodology',
    label: {
      vi: 'Phương pháp luận',
      en: 'Methodology',
    },
    requiredSections: ['heading.abstract', 'h1', 'heading.references'],
  },
  'case-report': {
    id: 'case-report',
    label: {
      vi: 'Báo cáo ca lâm sàng',
      en: 'Case Report',
    },
    requiredSections: ['heading.abstract', 'h1', 'heading.references'],
  },
  'special-topic': {
    id: 'special-topic',
    label: {
      vi: 'Chuyên đề đặc biệt',
      en: 'Special Topic',
    },
    requiredSections: ['heading.abstract', 'h1', 'heading.references'],
  },
};

export const ARTICLE_TYPE_ALIASES: Record<string, string> = {
  research: 'research',
  'research-article': 'research',
  'research_article': 'research',
  review: 'review',
  'review-article': 'review',
  'review_article': 'review',
  editorial: 'editorial',
  commentary: 'commentary',
  letter: 'letter',
  correction: 'correction',
  methodology: 'methodology',
  'case-report': 'case-report',
  'case_report': 'case-report',
  casereport: 'case-report',
  'special-topic': 'special-topic',
  special_topic: 'special-topic',
  specialtopic: 'special-topic',
};

export function normalizeArticleTypeId(rawId: string): string {
  const normalized = rawId.trim().toLowerCase();
  return ARTICLE_TYPE_ALIASES[normalized] || normalized;
}
