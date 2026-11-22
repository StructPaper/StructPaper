/**
 * The editorial dates of a paper (received, revised, accepted, published), read from the way an author really writes them:
 * one label per line, or all of them on one line ("Ngày nhận bài: 06-10-2025Ngày chỉnh sửa: 02-10-2026Ngày chấp nhận: 14-07-2026"),
 * in Vietnamese or English, with any usual separator, or the year first.
 */

export type DateKey = 'received' | 'revised' | 'accepted' | 'published';
export type EditorialDates = Partial<Record<DateKey, string>>;

const LABELS: Array<[DateKey, string]> = [
  ['received', 'ngày\\s+(?:nhận|gửi)(?:\\s+bài)?|received|submitted'],
  ['revised', 'ngày\\s+(?:nhận\\s+)?chỉnh\\s+sửa|ngày\\s+sửa(?:\\s+(?:đổi|bài))?|ngày\\s+hoàn\\s+thiện|revised|revision(?:\\s+received)?'],
  ['accepted', 'ngày\\s+(?:chấp\\s+nhận|duyệt\\s+đăng)|accepted'],
  ['published', 'ngày\\s+(?:đăng|xuất\\s+bản)(?:\\s+trực\\s+tuyến)?|published(?:\\s+online)?'],
];
// one pattern that finds every label, longest alternatives first so "ngày nhận chỉnh sửa" is not read as "ngày nhận"
const ANY_LABEL = new RegExp(`(${LABELS.map(([, p]) => `(?:${p})`).join('|')})\\s*[:：]`, 'gi');

const keyOfLabel = (text: string): DateKey | null => {
  const t = text.replace(/\s*[:：]$/, '').trim();
  for (const [key, pattern] of LABELS) if (new RegExp('^(?:' + pattern + ')$', 'i').test(t)) return key;
  return null;
};

const pad = (n: string | number) => String(n).padStart(2, '0');
const MONTHS: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };

const valid = (d: number, m: number, y: number): boolean => {
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
};

/**
 * The first date found in a text, written as dd-mm-yyyy, or null. Takes dd-mm-yyyy (any of - / .), yyyy-mm-dd, "6 tháng 10 năm 2025",
 * "6 October 2025" and "October 6, 2025"; a day and month that cannot be a date are left alone.
 */
export function findDate(text: string): string | null {
  const s = (text || '').trim();
  let m = s.match(/(?<!\d)(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?!\d)/);
  if (m && valid(+m[3], +m[2], +m[1])) return `${pad(m[3])}-${pad(m[2])}-${m[1]}`;
  m = s.match(/(?<!\d)(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})(?!\d)/);
  if (m && valid(+m[1], +m[2], +m[3])) return `${pad(m[1])}-${pad(m[2])}-${m[3]}`;
  m = s.match(/(?<!\d)(\d{1,2})\s+tháng\s+(\d{1,2})[,\s]+năm\s+(\d{4})/i);
  if (m && valid(+m[1], +m[2], +m[3])) return `${pad(m[1])}-${pad(m[2])}-${m[3]}`;
  m = s.match(/(?<!\d)(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]{3,9})\.?,?\s+(\d{4})/);
  if (m && MONTHS[m[2].slice(0, 3).toLowerCase()] && valid(+m[1], MONTHS[m[2].slice(0, 3).toLowerCase()], +m[3])) return `${pad(m[1])}-${pad(MONTHS[m[2].slice(0, 3).toLowerCase()])}-${m[3]}`;
  m = s.match(/([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})/);
  if (m && MONTHS[m[1].slice(0, 3).toLowerCase()] && valid(+m[2], MONTHS[m[1].slice(0, 3).toLowerCase()], +m[3])) return `${pad(m[2])}-${pad(MONTHS[m[1].slice(0, 3).toLowerCase()])}-${m[3]}`;
  return null;
}

/** Every labelled date in a line, however many the line holds: { received: '06-10-2025', revised: '02-10-2026', … }. */
export function datesInLine(line: string): EditorialDates {
  const out: EditorialDates = {};
  const found: Array<{ key: DateKey; start: number; end: number }> = [];
  ANY_LABEL.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = ANY_LABEL.exec(line)) !== null) {
    const key = keyOfLabel(m[1]);
    if (key) found.push({ key, start: m.index, end: m.index + m[0].length });
  }
  found.forEach((f, i) => {
    const raw = line.slice(f.end, i + 1 < found.length ? found[i + 1].start : undefined).replace(/[;,.\s]+$/, '').trim();
    if (!raw) return;
    out[f.key] = findDate(raw) ?? raw;
  });
  return out;
}

/**
 * Mends the dates of a paper: a field that holds several labelled dates is split among the fields they belong to, and a field
 * with one date written another way is put into dd-mm-yyyy. Returns the same object when nothing needed mending.
 */
const PLAIN = /^(0?[1-9]|[12]\d|3[01])[-/.](0?[1-9]|1[0-2])[-/.]\d{4}$/;
export function repairDates<T extends EditorialDates>(dates: T | undefined, reformat = true): T | undefined {
  if (!dates) return dates;
  const next: EditorialDates = { ...dates };
  let changed = false;
  (['received', 'revised', 'accepted', 'published'] as DateKey[]).forEach((key) => {
    const v = (dates[key] ?? '').trim();
    if (!v || PLAIN.test(v)) return;
    const inner = datesInLine(v);
    if (Object.keys(inner).length > 0) {
      // the text before the first label is this field's own date; each labelled date goes where its label says
      next[key] = findDate(v.split(ANY_LABEL)[0] ?? '') ?? '';
      (Object.keys(inner) as DateKey[]).forEach((k) => {
        const d = findDate(inner[k] ?? '');
        if (d && !PLAIN.test((next[k] ?? '').trim())) next[k] = d;
      });
      changed = true;
      return;
    }
    const d = findDate(v);
    if (reformat && d && d !== v) {
      next[key] = d;
      changed = true;
    }
  });
  return changed ? ({ ...dates, ...next } as T) : dates;
}
