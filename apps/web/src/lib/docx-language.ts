import { splitKeywords } from './docx-english-backmatter';

export type DocLanguage = 'vi' | 'en';

/** Labels of the journal templates (docs/StandardTemplate): the first page is labelled in ONE language. */
const VI_SIGNALS = [
  /^loại bài( báo| viết)?\s*:/i,
  /^ngày (nhận|sửa|chấp nhận|xuất bản)/i,
  /^\*?\s*tác giả liên hệ/i,
  /^tóm tắt\b/i,
  /^từ kh(?:oá|óa)\s*[:.]/i,
];
const EN_SIGNALS = [
  /^article type\s*:/i,
  /^(received|revised|accepted|published( online)?)\s*:/i,
  /^\*?\s*corresponding author/i,
  /^abstract\b/i,
  /^key\s?w+ords?\s*[:.]/i,
];

const REFERENCES_RE = /^(tài liệu tham khảo|references|bibliography)$/i;

/** Vietnamese-only letters (a plain English text has none). */
const VI_LETTERS = /[ăâđêôơưàáảãạằắẳẵặầấẩẫậèéẻẽẹềếểễệìíỉĩịòóỏõọồốổỗộờớởỡợùúủũụừứửữựỳýỷỹỵ]/gi;

/**
 * Which language is the paper written in? The template labels the first page in one language
 * ("Article type:" / "Loại bài báo:", "Received:" / "Ngày nhận bài:", "Abstract" / "Tóm tắt",
 * "Keywords:" / "Từ khóa:"), so those labels decide. Only when they say nothing (or tie) does the
 * share of Vietnamese letters in the opening lines decide, and Vietnamese is the default.
 */
export function detectPrimaryLanguage(rawLines: string[]): DocLanguage {
  const lines = rawLines.map((l) => (l || '').trim()).filter(Boolean);
  const refIdx = lines.findIndex((l) => REFERENCES_RE.test(l));
  // the front page lives before the references (and well before them in practice)
  const front = lines.slice(0, Math.min(refIdx < 0 ? lines.length : refIdx, 60));

  const count = (signals: RegExp[]) => front.filter((l) => signals.some((re) => re.test(l))).length;
  const vi = count(VI_SIGNALS);
  const en = count(EN_SIGNALS);
  if (vi !== en) return vi > en ? 'vi' : 'en';

  const sample = front.slice(0, 12).join(' ');
  const letters = (sample.match(/\p{L}/gu) || []).length;
  const viLetters = (sample.match(VI_LETTERS) || []).length;
  return letters > 0 && viLetters / letters < 0.02 ? 'en' : 'vi';
}

/** "Trương Quang Huy" -> "truong quang huy" (to match the same person written with and without marks). */
export const foldVietnamese = (s: string): string =>
  (s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

/** Line that opens the second-language page after the references ("Phần ngôn ngữ thứ hai" / "… thứ 2"). */
export const SECOND_LANGUAGE_MARKER_RE = /^phần ngôn ngữ thứ\s*(hai|2)\b\.?$/i;

const VI_INSTITUTION_RE = /\b(trường|đại học|viện|bệnh viện|học viện|khoa|trung tâm|sở|công ty|tổng cục|bộ)\b/i;

export interface VietnameseBackMatter {
  /** rawLines index of the marker. */
  start: number;
  /** rawLines index of the last line that belongs to the block. */
  end: number;
  title: string;
  abstract: string;
  keywords: string[];
  /** Author names as written on this page (with their Vietnamese marks). */
  authorNames: string[];
  /** Institution as written on this page. */
  institution: string;
  email: string;
}

/**
 * The Vietnamese page that follows the references of an English paper (the mirror of the English
 * summary page of a Vietnamese paper): marker, Vietnamese title, "TÓM TẮT", abstract,
 * "Từ khóa: …", "Thông tin tác giả: …", "Email: …".
 * Returns null without the explicit marker (it never guesses).
 */
export function findVietnameseBackMatter(rawLines: string[]): VietnameseBackMatter | null {
  const lines = rawLines.map((l) => (l || '').trim());
  const refIdx = lines.findIndex((l) => REFERENCES_RE.test(l));
  if (refIdx < 0) return null;
  const start = lines.findIndex((l, i) => i > refIdx && SECOND_LANGUAGE_MARKER_RE.test(l));
  if (start < 0) return null;

  const next = (from: number) => {
    let k = from;
    while (k < lines.length && !lines[k]) k++;
    return k;
  };
  const isAbstractHead = (l: string) => /^(tóm tắt|abstract)\b/i.test(l);
  const isKeywords = (l: string) => /^từ kh(?:oá|óa)\s*[:.]?/i.test(l);
  const isAuthorInfo = (l: string) => /^(thông tin tác giả|tác giả liên hệ|liên hệ)\s*:/i.test(l);
  const isEmail = (l: string) => /^e-?mail\s*:/i.test(l);
  const isGuide = (l: string) => /^(hướng dẫn dành cho tác giả|author guidelines)/i.test(l);

  // title (a title wrapped onto a second line starts in lower case)
  let k = next(start + 1);
  let title = '';
  while (k < lines.length && !isAbstractHead(lines[k]) && !isKeywords(lines[k]) && !isAuthorInfo(lines[k])) {
    if (!title) title = lines[k];
    else if (/^[a-zà-ỹ(]/.test(lines[k])) title += ' ' + lines[k];
    else break;
    k = next(k + 1);
  }

  let end = Math.max(start, k - 1);
  let abstract = '';
  if (k < lines.length && isAbstractHead(lines[k])) {
    abstract = lines[k].replace(/^(tóm tắt|abstract)\s*[:.]?\s*/i, '').trim();
    end = k;
    for (k = next(k + 1); k < lines.length; k = next(k + 1)) {
      const l = lines[k];
      if (isKeywords(l) || isAuthorInfo(l) || isEmail(l) || isGuide(l)) break;
      abstract += (abstract ? ' ' : '') + l;
      end = k;
    }
  }

  let keywords: string[] = [];
  if (k < lines.length && isKeywords(lines[k])) {
    let text = lines[k].replace(/^từ kh(?:oá|óa)\s*[:.]?\s*/i, '').trim();
    end = k;
    if (!text && k + 1 < lines.length) {
      k = next(k + 1);
      text = lines[k] ?? '';
      end = k;
    }
    keywords = splitKeywords(text);
    k = next(k + 1);
  }

  let authorNames: string[] = [];
  let institution = '';
  let email = '';
  for (; k < lines.length && !isGuide(lines[k]); k = next(k + 1)) {
    const l = lines[k];
    if (isAuthorInfo(l)) {
      const text = l.replace(/^[^:]+:\s*/, '');
      const m = text.match(VI_INSTITUTION_RE);
      const namePart = m && m.index! > 0 ? text.slice(0, m.index).replace(/[,\s]+$/, '') : text;
      institution = m && m.index! > 0 ? text.slice(m.index).trim().replace(/[.\s]+$/, '') : '';
      authorNames = namePart.split(/,|\s+và\s+/i).map((s) => s.trim()).filter(Boolean);
      end = k;
    } else if (isEmail(l) || /@/.test(l)) {
      email = (l.match(/[^\s:;,]+@[^\s;,]+/) || [''])[0].replace(/[.\s]+$/, '');
      end = k;
    } else {
      break;
    }
  }

  return { start, end, title: title.trim(), abstract: abstract.trim(), keywords, authorNames, institution, email };
}
