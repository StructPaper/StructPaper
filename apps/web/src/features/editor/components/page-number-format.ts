// Sample page-number formatting used by the layout drawer preview.

export function toRoman(num: number): string {
  const map: Record<string, number> = {
    M: 1000, CM: 900, D: 500, CD: 400, C: 100, XC: 90, L: 50, XL: 40, X: 10, IX: 9, V: 5, IV: 4, I: 1
  };
  let str = '';
  let n = Math.max(1, Math.min(3999, Math.floor(num)));
  for (const k of Object.keys(map)) {
    const q = Math.floor(n / map[k]);
    n -= q * map[k];
    str += k.repeat(q);
  }
  return str || 'I';
}

export function formatSamplePage(num: number, format: string, prefix = '', total = 10): string {
  const pfx = prefix ? `${prefix} ` : '';
  switch (format) {
    case 'roman-lower':
      return `${pfx}${toRoman(num).toLowerCase()}`;
    case 'roman-upper':
      return `${pfx}${toRoman(num)}`;
    case 'alpha-lower':
      return `${pfx}${String.fromCharCode(96 + ((num - 1) % 26) + 1)}`;
    case 'alpha-upper':
      return `${pfx}${String.fromCharCode(64 + ((num - 1) % 26) + 1)}`;
    case 'page-x-of-y':
      return `${pfx}${num} / ${total}`;
    case 'hyphen':
      return `- ${num} -`;
    case 'arabic':
    default:
      return `${pfx}${num}`;
  }
}
