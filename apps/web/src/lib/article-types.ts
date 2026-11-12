/**
 * Article types. The list is a set of suggestions, not a closed vocabulary: an editor can type any
 * Vietnamese name and any English name (printed on the English summary page, in the Word file and in the
 * XML). Nothing here forces a journal to a fixed set.
 */

export interface ArticleTypePreset {
  /** Name printed in the Vietnamese article (stored in metadata.articleType). */
  vi: string;
  /** English name (metadata.articleTypeEn when set, else this one). */
  en: string;
  /** JATS `article-type` value (controlled vocabulary of JATS 1.2). */
  jats: string;
  description: string;
}

export const ARTICLE_TYPE_PRESETS: ArticleTypePreset[] = [
  { vi: 'Bài báo nghiên cứu', en: 'Research Article', jats: 'research-article', description: 'Công trình nghiên cứu khoa học nguyên bản' },
  { vi: 'Bài nghiên cứu', en: 'Research Article', jats: 'research-article', description: 'Tên gọi in trên bài mẫu của một số tạp chí (VNUHCM-EBL)' },
  { vi: 'Bài tổng quan', en: 'Review Article', jats: 'review-article', description: 'Tổng quan hệ thống, tổng quan tài liệu' },
  { vi: 'Báo cáo ca lâm sàng', en: 'Case Report', jats: 'case-report', description: 'Báo cáo ca bệnh điển hình lâm sàng' },
  { vi: 'Thông tin ngắn', en: 'Short Communication', jats: 'brief-report', description: 'Công bố ngắn kết quả nghiên cứu' },
  { vi: 'Phương pháp luận', en: 'Methodology', jats: 'other', description: 'Phương pháp và kỹ thuật nghiên cứu' },
  { vi: 'Bình luận & Ý kiến', en: 'Commentary', jats: 'discussion', description: 'Bình luận, trao đổi học thuật' },
  { vi: 'Đính chính', en: 'Correction', jats: 'correction', description: 'Đính chính thông tin đã công bố' },
  { vi: 'Bài xã luận', en: 'Editorial', jats: 'editorial', description: 'Xã luận của ban biên tập' },
  { vi: 'Thư gửi tòa soạn', en: 'Letter', jats: 'letter', description: 'Thư góp ý và thảo luận gửi tòa soạn' },
];

/** The types Health Sciences (VNUHCM-HS) works with; shown first for that journal. */
export const HS_ARTICLE_TYPES = [
  'Bài báo nghiên cứu',
  'Bài tổng quan',
  'Báo cáo ca lâm sàng',
  'Phương pháp luận',
  'Bình luận & Ý kiến',
  'Đính chính',
  'Bài xã luận',
  'Thư gửi tòa soạn',
];

/** The types the other journals normally use. */
export const STANDARD_ARTICLE_TYPES = ['Bài báo nghiên cứu', 'Bài nghiên cứu'];

const norm = (s: string) => s.trim().toLowerCase();

export function findArticleTypePreset(vi?: string): ArticleTypePreset | undefined {
  const t = norm(vi || '');
  return ARTICLE_TYPE_PRESETS.find((p) => norm(p.vi) === t || norm(p.en) === t);
}

/** English name guessed from the Vietnamese one (used when the editor has not typed one). */
export function suggestArticleTypeEn(vi?: string): string {
  const preset = findArticleTypePreset(vi);
  if (preset) return preset.en;
  const t = norm(vi || '');
  if (/tổng quan|review/.test(t)) return 'Review Article';
  if (/ca lâm sàng|case/.test(t)) return 'Case Report';
  if (/thư|letter/.test(t)) return 'Letter';
  return 'Research Article';
}

interface TypeFields {
  articleType?: string;
  articleTypeEn?: string;
}

/** English article type of a paper: what the editor typed, else the suggestion. */
export function articleTypeEnglish(md: TypeFields): string {
  return md.articleTypeEn?.trim() || suggestArticleTypeEn(md.articleType);
}

/** JATS `article-type` for a paper: a controlled value for a known type, a slug of the English name otherwise. */
export function articleTypeJats(md: TypeFields): string {
  const en = articleTypeEnglish(md);
  const known = ARTICLE_TYPE_PRESETS.find((p) => norm(p.en) === norm(en));
  if (known) return known.jats;
  const slug = en
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'research-article';
}

/** Presets with the ones this journal normally uses first. */
export function articleTypeOptionsFor(journalId?: string): ArticleTypePreset[] {
  const isHs = !journalId || journalId === 'VNUHCM-HS' || journalId.includes('HS');
  const first = isHs ? HS_ARTICLE_TYPES : STANDARD_ARTICLE_TYPES;
  const head = first.map((vi) => ARTICLE_TYPE_PRESETS.find((p) => p.vi === vi)!).filter(Boolean);
  return [...head, ...ARTICLE_TYPE_PRESETS.filter((p) => !first.includes(p.vi))];
}
