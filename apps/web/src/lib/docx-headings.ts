/**
 * Which paragraphs of a Word file are headings, and of what level. The text pipeline only sees lines of text, so the
 * formatting that says "this is a heading" is read from the XML here:
 *   1. the paragraph's style is Heading 1/2/3 (or its outline level is set): that level;
 *   2. Word shows the heading as an automatic list number ("1. Giới thiệu", "2.1 Lý thuyết nền tảng"): the list level
 *      (0 -> h1, 1 -> h2, 2 -> h3), the number itself is not in the text;
 *   3. typed by hand, every run bold and italic (the journal template's sub-heading look): h2;
 *   4. typed by hand, every run bold, short, no final punctuation: h1 when written in capitals, else h2
 *      ("VẬT LIỆU VÀ PHƯƠNG PHÁP" / "Hóa chất").
 * Short headings ("Tổng quan", "Hóa chất") used to be lost, being too short to look like a sentence.
 */
const isOn = (run: string, tag: 'b' | 'i') =>
  new RegExp(`<w:${tag}[\\s/>]`, 'i').test(run) && !new RegExp(`<w:${tag}\\s+w:val="(?:0|false)"`, 'i').test(run);

/** styleId -> heading level (0..2) for the styles of the file that are headings, by name ("heading 2", "Tiêu đề 2") or outline level. */
export function headingStyleLevels(stylesXml: string | undefined): Map<string, number> {
  const out = new Map<string, number>();
  const add = (id: string, level: number) => out.set(id, Math.max(0, Math.min(level, 2)));
  // the usual ids, even when the file carries no styles part
  for (let n = 1; n <= 9; n++) add(`Heading${n}`, n - 1);
  if (!stylesXml) return out;
  for (const m of stylesXml.matchAll(/<w:style\b[^>]*w:styleId="([^"]+)"[^>]*>([\s\S]*?)<\/w:style>/gi)) {
    const [, id, body] = m;
    const name = body.match(/<w:name\s+w:val="([^"]+)"/i)?.[1] ?? '';
    const byName = name.match(/^(?:heading|tiêu đề|titre|überschrift|título)\s*(\d)$/i);
    const byOutline = body.match(/<w:outlineLvl\s+w:val="(\d)"/i);
    if (byName) add(id, Number(byName[1]) - 1);
    else if (byOutline) add(id, Number(byOutline[1]));
  }
  return out;
}

export function extractListHeadings(docXml: string, stylesXml?: string): Map<string, number> {
  const out = new Map<string, number>();
  const styleLevels = headingStyleLevels(stylesXml);
  const withoutTables = docXml.replace(/<w:tbl\b[\s\S]*?<\/w:tbl>/gi, '');
  for (const m of withoutTables.matchAll(/<w:p\b[\s>][\s\S]*?<\/w:p>/gi)) {
    const p = m[0];
    const lvl = p.match(/<w:numPr>[\s\S]*?<w:ilvl w:val="(\d+)"/i)?.[1];
    const runs = [...p.matchAll(/<w:r\b[\s>][\s\S]*?<\/w:r>/gi)].map((r) => r[0]).filter((r) => /<w:t\b/.test(r));
    if (!runs.length) continue;

    const styleId = p.match(/<w:pStyle\s+w:val="([^"]+)"/i)?.[1];
    const outline = p.match(/<w:outlineLvl\s+w:val="(\d)"/i)?.[1];
    const styled = outline !== undefined ? Math.min(Number(outline), 2) : styleId !== undefined ? styleLevels.get(styleId) : undefined;

    const allBold = runs.every((r) => isOn(r, 'b'));
    const numbered = lvl !== undefined && allBold;
    const handTyped = lvl === undefined && allBold && runs.every((r) => isOn(r, 'i'));
    const boldOnly = lvl === undefined && allBold && styled === undefined;
    if (styled === undefined && !numbered && !handTyped && !boldOnly) continue;

    const text = p.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    if (text.length < 3 || text.length > 90 || /[.;:,]$/.test(text) || !/^[\p{Lu}\d]/u.test(text)) continue;
    // Captions and source/notes lines stay text. "Nguồn dữ liệu" is a heading: only "Nguồn: …" is a source line.
    if ((handTyped || boldOnly || styled !== undefined) && (/^(hình|bảng|figure|table|phụ lục)\s*\d/i.test(text) || /^(nguồn|source|ghi chú|chú thích|notes?)\s*:/i.test(text))) continue;

    if (styled !== undefined) out.set(text, styled);
    else if (numbered) out.set(text, Math.min(Number(lvl), 2));
    else if (handTyped) out.set(text, 1);
    else {
      // bold only: written in capitals it is a section, otherwise a sub-section
      const letters = text.replace(/[^\p{L}]/gu, '');
      out.set(text, letters.length >= 4 && letters === letters.toUpperCase() ? 0 : 1);
    }
  }
  return out;
}

/**
 * A lone dash under a heading ("Kinh phí" / "-") is the journal's way of writing "none". It is the
 * content the file states, so it is kept instead of leaving an empty heading.
 */
export function isNoneMark(line: string, prev: { type: string; content?: string } | undefined): boolean {
  return /^[-–—]$/.test(line.trim()) && prev?.type === 'h1' && !prev.content;
}
