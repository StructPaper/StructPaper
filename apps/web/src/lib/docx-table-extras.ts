import type { PaperSection } from '@/types/paper';

/** Helpers used while importing tables from Word (kept apart from the large docx-parser). */

const FOOTER_RE = /^[(\[]?\s*(Chú thích|Ghi chú|Notes?|Nguồn|Source)\s*:\s*\S/i;

/**
 * "Chú thích: …" and "Nguồn: …" lines that follow a table belong to the table
 * (they are printed under it), not to the running text. Returns true when consumed.
 */
export function attachTableFooterLine(sections: PaperSection[], line: string): boolean {
  const last = sections[sections.length - 1];
  const text = line.trim();
  if (!last || last.type !== 'table' || !last.table || !FOOTER_RE.test(text)) return false;
  let clean = text.replace(/^\[\s*([\s\S]*?)\s*\]$/, '$1'); // "[Nguồn: …]" -> "Nguồn: …"
  if (clean.startsWith('(')) {
    // "(Nguồn: …)" wrapped in parentheses: drop the wrapper only when it is unbalanced
    clean = clean.slice(1).trim();
    const opens = (clean.match(/\(/g) || []).length;
    const closes = (clean.match(/\)/g) || []).length;
    if (closes > opens) clean = clean.replace(/\)\s*$/, '');
  }
  last.table = { ...last.table, source: last.table.source ? `${last.table.source}\n${clean}` : clean };
  return true;
}

/**
 * Insert a table the text pass could not place (its caption sits inside the table) in numeric order:
 * after the closest earlier-numbered table, or before the first later-numbered one.
 */
export function placeLeftoverTable(sections: PaperSection[], section: PaperSection): void {
  const num = section.table?.num ?? 0;
  let afterIdx = -1;
  let beforeIdx = -1;
  sections.forEach((s, i) => {
    if (s.type !== 'table' || !s.table) return;
    if (s.table.num < num && i > afterIdx) afterIdx = i;
    if (s.table.num > num && beforeIdx === -1) beforeIdx = i;
  });
  // Printed journals put a table right after the paragraph that first cites it ("... (Bảng 2)"), not
  // right after the previous table. Look for that paragraph after the previous table.
  const cites = new RegExp(String.raw`(?:bảng|table)\s*${num}(?!\d)`, 'i');
  const from = afterIdx >= 0 ? afterIdx + 1 : 0;
  const limit = beforeIdx === -1 ? sections.length : beforeIdx;
  for (let i = from; num > 0 && i < limit; i++) {
    const s = sections[i];
    if (s.type === 'paragraph' && cites.test((s.content || '').replace(/<[^>]+>/g, ''))) {
      // A long table takes its own page(s): the journal lets the text run on and puts it just before the
      // next numbered table (otherwise the page break strands the figure/text floats before it).
      const tb = section.table;
      const isLong = !!tb && (tb.rows.length > 20 || (tb.headers.length >= 6 && tb.rows.length >= 12)) && beforeIdx > i;
      sections.splice(isLong ? beforeIdx : i + 1, 0, section);
      return;
    }
  }
  if (afterIdx >= 0 && (beforeIdx === -1 || afterIdx < beforeIdx)) sections.splice(afterIdx + 1, 0, section);
  else if (beforeIdx >= 0) sections.splice(beforeIdx, 0, section);
  else sections.push(section);
}

/**
 * Which tables sit in a landscape section of the Word file? A section ends at its <w:sectPr>,
 * so a table belongs to the first sectPr that follows it.
 */
export function landscapeResolver(docXml: string): (position: number) => boolean {
  const sections = [...docXml.matchAll(/<w:sectPr\b[\s\S]*?<\/w:sectPr>/gi)].map((m) => {
    const size = m[0].match(/<w:pgSz\b[^>]*>/i)?.[0] || '';
    const w = Number(size.match(/w:w="(\d+)"/)?.[1] || 0);
    const h = Number(size.match(/w:h="(\d+)"/)?.[1] || 0);
    return { end: m.index ?? 0, landscape: /w:orient="landscape"/i.test(size) || (w > 0 && w > h) };
  });
  return (position) => sections.find((s) => s.end > position)?.landscape ?? false;
}

/**
 * Layout defaults for imported tables: landscape section -> rotated; otherwise narrow tables
 * (<= 4 columns) go in one column and wide ones span both columns. The user can change both.
 */
/**
 * One column or both? Read off the journals' PDFs: a table with more than four columns, in a landscape section, or whose rows hold
 * a lot of text (about 110 characters or more per row, like the research summaries) is set across both columns; a short table of
 * numbers stays in one column.
 */
export function wantsFullWidth(t: { headers?: string[]; rows?: string[][] }, landscape: boolean, cols: number): boolean {
  if (landscape || cols > 4) return true;
  const rowLength = (r: string[]) => r.reduce((n, c) => n + String(c ?? '').length, 0);
  const lengths = (t.rows || []).map(rowLength).sort((a, b) => a - b);
  if (lengths.length === 0) return false;
  const typical = lengths[Math.floor(lengths.length / 2)];
  return typical >= 110;
}

export function applyTableLayoutHints(sections: PaperSection[], landscapeById: Record<string, boolean>): void {
  for (const s of sections) {
    const t = s.table;
    if (s.type !== 'table' || !t) continue;
    const landscape = landscapeById[t.id] === true;
    const cols = Math.max(t.headers?.length ?? 0, ...(t.rows || []).map((r) => r.length), 1);
    if (landscape && t.isRotated === undefined) t.isRotated = true;
    // the journals print the body of a table on the pale blue tint; a Word table that explicitly had stripes keeps them
    if (t.bodyFill === undefined && t.hasZebraStripes === undefined) t.bodyFill = 'shaded';
    if (t.columnSpan === undefined) {
      t.columnSpan = wantsFullWidth(t, landscape, cols) ? '2-column' : '1-column';
      t.isFullWidth = t.columnSpan === '2-column';
    }
  }
}

/** "Bảng 2: Mô hình đo lường" -> "Mô hình đo lường" (the label is printed by the template). */
export function stripCaptionLabel(caption: string): string {
  const label = /^\s*(?:b\s*ảng|bảng|table|hình|figure|fig\.?|phụ\s*lục)/i;
  // "Bảng 6 Kết quả…" (number, no colon) and "Bảng 6: Kết quả…" both lose the label; a bare "Bảng: …" too
  const text = (caption || '')
    .replace(new RegExp(`${label.source}\\s*\\d+\\s*[:.\\-–]?\\s+(?=\\S)`, 'i'), '')
    .replace(new RegExp(`${label.source}\\s*\\d*\\s*[:.\\-–]\\s*`, 'i'), '')
    .trim();
  return text || caption;
}

const ABBREV_LABEL_RE =
  /viết\s*tắt|abbreviation|ý\s*nghĩa|meaning|giải\s*thích|definition|tiếng\s*anh|english|thuật\s*ngữ|term/i;

/**
 * "DANH MỤC TỪ VIẾT TẮT" is a table in Word (abbreviation | English | meaning). The printed journal
 * lists it as lines "AI (Artificial Intelligence): Trí tuệ nhân tạo" under the heading, so it is
 * inserted as paragraphs there (it was dropped entirely before).
 */
export function placeAbbreviationTable(sections: PaperSection[], headers: string[], rows: string[][]): true {
  const isLabelRow = (r: string[]) => r.every((c) => !c.trim() || /^Cột \d+$/.test(c.trim()) || ABBREV_LABEL_RE.test(c));
  const all = [...(isLabelRow(headers) ? [] : [headers]), ...rows]
    .map((r) => r.map((c) => (c || '').replace(/\s+/g, ' ').trim()))
    .filter((r) => r[0]);
  const paras: PaperSection[] = all.map((r, k) => ({
    id: `s_abbr_${k + 1}`,
    type: 'paragraph',
    content:
      r.length >= 3 && r[1]
        ? `${r[0]} (${r[1]}): ${r.slice(2).filter(Boolean).join('; ')}`
        : `${r[0]}: ${r.slice(1).filter(Boolean).join('; ')}`,
  }));
  if (!paras.length) return true;
  const h = sections.findIndex((s) => /^h[123]$/.test(s.type) && /viết\s*tắt|abbreviation/i.test(s.title || ''));
  if (h >= 0) {
    sections.splice(h + 1, 0, ...paras);
  } else {
    sections.push({ id: 's_abbr_h', type: 'h1', title: 'DANH MỤC TỪ VIẾT TẮT', content: '' }, ...paras);
  }
  return true;
}
