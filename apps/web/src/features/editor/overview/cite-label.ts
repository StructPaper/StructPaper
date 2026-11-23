/**
 * How a citation of several references prints: natbib's `sort&compress`, which the PDF uses: "6", "6,7" (two in a row stay
 * a list), "6–8" (three or more in a row become a range), "1,3–5,9".
 */
export function citationLabel(nums: number[]): string {
  const sorted = [...new Set(nums.filter((n) => Number.isFinite(n)))].sort((a, b) => a - b);
  if (sorted.length === 0) return '?';
  const parts: string[] = [];
  let i = 0;
  while (i < sorted.length) {
    let j = i;
    while (j + 1 < sorted.length && sorted[j + 1] === sorted[j] + 1) j++;
    const len = j - i + 1;
    if (len >= 3) parts.push(`${sorted[i]}–${sorted[j]}`);
    else for (let k = i; k <= j; k++) parts.push(String(sorted[k]));
    i = j + 1;
  }
  return parts.join(',');
}

/** The reference numbers a citation node refers to ("6,7,8" or "ref-6,ref-7"). */
export function citationNumbers(targetId: string | undefined, label?: string): number[] {
  const src = targetId || label || '';
  return (src.match(/\d+/g) ?? []).map(Number);
}
