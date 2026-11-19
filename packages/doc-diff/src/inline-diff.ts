/**
 * Word-level diff of two strings: the pieces that stay, the ones that were added and the ones that were removed.
 * Used to mark the changes inside a paragraph (or title, abstract...) when two versions are compared.
 */
export type InlineSegmentType = 'same' | 'add' | 'del';

export interface InlineSegment {
  type: InlineSegmentType;
  text: string;
}

/** Words and the white space between them, so joining the tokens gives the text back exactly. */
const tokenize = (text: string): string[] => text.match(/\s+|[^\s]+/g) ?? [];

/** Cells of the dynamic-programming table above which the middle is simply reported as replaced. */
const MAX_CELLS = 4_000_000;

function push(out: InlineSegment[], type: InlineSegmentType, text: string) {
  if (!text) return;
  const last = out[out.length - 1];
  if (last && last.type === type) last.text += text;
  else out.push({ type, text });
}

export function diffInline(before: string, after: string): InlineSegment[] {
  if (before === after) return before ? [{ type: 'same', text: before }] : [];
  const a = tokenize(before);
  const b = tokenize(after);

  // common start and end are the bulk of most edits: trim them before the quadratic part
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--;
    endB--;
  }

  const out: InlineSegment[] = [];
  push(out, 'same', a.slice(0, start).join(''));

  const midA = a.slice(start, endA);
  const midB = b.slice(start, endB);

  if (midA.length === 0) push(out, 'add', midB.join(''));
  else if (midB.length === 0) push(out, 'del', midA.join(''));
  else if ((midA.length + 1) * (midB.length + 1) > MAX_CELLS) {
    push(out, 'del', midA.join(''));
    push(out, 'add', midB.join(''));
  } else {
    const n = midA.length;
    const m = midB.length;
    // lcs[i][j]: length of the longest common run of midA[i..] and midB[j..]
    const lcs: Uint32Array[] = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
    for (let i = n - 1; i >= 0; i--) {
      for (let j = m - 1; j >= 0; j--) {
        lcs[i][j] = midA[i] === midB[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
      }
    }
    let i = 0;
    let j = 0;
    while (i < n && j < m) {
      if (midA[i] === midB[j]) {
        push(out, 'same', midA[i]);
        i++;
        j++;
      } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
        push(out, 'del', midA[i++]);
      } else {
        push(out, 'add', midB[j++]);
      }
    }
    while (i < n) push(out, 'del', midA[i++]);
    while (j < m) push(out, 'add', midB[j++]);
  }

  push(out, 'same', a.slice(endA).join(''));
  return out;
}

/** Number of words in a text. */
export const countWords = (text: string | undefined | null): number => (text ? (text.trim().match(/\S+/g) ?? []).length : 0);
