import { looksEnglish } from './docx-affiliations';

/** "Keywords", "Key words", and typos like "Keywwords". */
export const KEYWORDS_EN_RE = /^key\s?w+ords?\b\s*[:.]?\s*/i;

/** Where the institution starts inside an "authors, institution" line. */
const INSTITUTION_RE = /\b(sub-?institute|university|institute|college|hospital|academy|faculty|school|centre|center|department)\b/i;

/** Line that opens the second-language summary page placed after the reference list. */
const MARKER_RE =
  /^((original\s+)?research|review)(\s+article)?$|^case report$|^short communication$|^phần ngôn ngữ thứ\s*(hai|2)$/i;

export interface EnglishBackMatter {
  /** rawLines index where the block starts (marker or English title). */
  start: number;
  /** rawLines index of the block's last line (keywords line). */
  end: number;
  titleEn: string;
  affiliationsEn: { id: number; name: string }[];
  abstractEn: string;
  keywordsEn: string[];
}

/**
 * Finds the English summary page that many VNUHCM manuscripts append after the references
 * (article type, English title, authors, affiliations, correspondence, ABSTRACT, Keywords),
 * so it is read as metadata instead of being swallowed into the reference list.
 * Returns null when there is no Abstract after the references (the common case).
 */
export function findEnglishBackMatter(rawLines: string[]): EnglishBackMatter | null {
  const lines = rawLines.map((l) => (l || '').trim());
  const refIdx = lines.findIndex((l) => /^(tài liệu tham khảo|references|bibliography)$/i.test(l));
  if (refIdx < 0) return null;
  const absIdx = lines.findIndex((l, i) => i > refIdx && /^abstract\b/i.test(l));
  if (absIdx < 0) return null;

  let start = -1;
  for (let i = refIdx + 1; i < absIdx; i++) {
    if (MARKER_RE.test(lines[i])) {
      start = i;
      break;
    }
  }
  if (start < 0) return null; // no explicit marker: do not guess

  const nonEmpty = (from: number): number => {
    let k = from;
    while (k < absIdx && !lines[k]) k++;
    return k;
  };

  let k = nonEmpty(start + 1);
  if (k >= absIdx) return null;
  let titleEn = '';
  // A plain marker line ("Phần ngôn ngữ thứ hai") may be followed by an explicit "Title:" label
  titleEn = lines[k].replace(/^title\s*:\s*/i, '');
  k = nonEmpty(k + 1);
  while (k < absIdx && /^[a-z(]/.test(lines[k])) {
    titleEn += ' ' + lines[k]; // a title wrapped onto a second paragraph: "in the southeastern area …"
    k = nonEmpty(k + 1);
  }
  // The English author line. Some manuscripts put the institution on the same line
  // ("Pham My Duyen, Le Nguyen Thuy An, University of Economics and Law, …"): keep that part as the affiliation.
  const affiliationsEn: { id: number; name: string }[] = [];
  const onAuthorLine = lines[k].match(INSTITUTION_RE);
  if (onAuthorLine && onAuthorLine.index! > 0 && lines[k].slice(0, onAuthorLine.index).includes(',')) {
    affiliationsEn.push({ id: 1, name: lines[k].slice(onAuthorLine.index).trim().replace(/[.\s]+$/, '') });
  }
  k++;

  for (; k < absIdx; k++) {
    const l = lines[k];
    if (!l) continue;
    if (/^(correspondence|corresponding author)\b/i.test(l)) {
      // "Correspondence: Name" is followed by the repeated address line
      if (!/@/.test(l) && k + 1 < absIdx && !/@/.test(lines[k + 1])) k++;
      continue;
    }
    if (/^e-?mail\b/i.test(l) || /@/.test(l)) continue;
    const m = l.match(/^(\d{1,2})\s*[.:]?\s+(.{10,})$/);
    if (m) affiliationsEn.push({ id: +m[1], name: m[2].trim() });
    else if (looksEnglish(l) && l.length > 15) affiliationsEn.push({ id: affiliationsEn.length + 1, name: l });
  }

  let abstractEn = lines[absIdx].replace(/^abstract\s*[:.]?\s*/i, '').trim();
  let end = absIdx;
  let keywordsEn: string[] = [];
  for (let j = absIdx + 1; j < lines.length; j++) {
    const l = lines[j];
    if (!l) continue;
    if (KEYWORDS_EN_RE.test(l)) {
      let kw = l.replace(KEYWORDS_EN_RE, '').trim();
      end = j;
      if (!kw && j + 1 < lines.length) {
        kw = lines[j + 1];
        end = j + 1;
      }
      keywordsEn = kw
        .split(/[,;]/)
        .map((s) => s.trim().replace(/[.\s]+$/, ''))
        .filter(Boolean);
      break;
    }
    if (/^(tóm tắt|từ kho[áa]|tài liệu tham khảo|references)\b/i.test(l)) break;
    abstractEn += (abstractEn ? ' ' : '') + l;
    end = j;
  }

  return { start, end, titleEn: titleEn.trim(), affiliationsEn, abstractEn: abstractEn.trim(), keywordsEn };
}

/** "a, b; c." -> ['a', 'b', 'c'] (no trailing period on the last keyword). */
export function splitKeywords(text: string): string[] {
  return text
    .split(/[,;]/)
    .map((k) => k.trim().replace(/[.\s]+$/, ''))
    .filter(Boolean);
}
