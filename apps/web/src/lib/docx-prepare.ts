import JSZip from 'jszip';

/**
 * What a Word file needs before it is read, and what the reader should be told about it afterwards:
 *  - a file that is not a .docx (an old binary .doc, an RTF) gets a clear message instead of an obscure zip error;
 *  - Track Changes: what was deleted is dropped, what was inserted is kept (as if every change had been accepted);
 *  - footnotes and endnotes become `[[fn: text]]` right where they are cited, so they stay with the sentence;
 *  - things that could not be carried over (comments, EMF/WMF pictures, embedded MathType equations) are counted so the import
 *    report can say so.
 */

/** The marker of a footnote inside a paragraph's text (also what an author can type to add one). */
export const FOOTNOTE_OPEN = '[[fn:';
export const FOOTNOTE_CLOSE = ']]';
export const FOOTNOTE_PATTERN = /\[\[fn:([\s\S]*?)\]\]/g;

export interface PreparedDocx {
  buffer: ArrayBuffer;
  /** Sentences for the import report (what was done, what could not be). */
  notes: string[];
  stats: { inserted: number; deleted: number; moved: number; comments: number; footnotes: number; vectorImages: number; embeddedEquations: number };
}

/**
 * Symbols inserted from Word's Insert > Symbol are written as <w:sym w:font="Symbol" w:char="F0A3"/>, not as text, so the text
 * reader skipped them ("≤ 10 người" became "10 người"). The Symbol font's codes (F020-F0FF) and the Unicode characters they stand for.
 */
const SYMBOL_FONT: Record<string, string> = {
  F020: ' ', F0A3: '≤', F0B3: '≥', F0B1: '±', F0B4: '×', F0B8: '÷', F0B9: '≠', F0BB: '≈', F0B0: '°', F0AE: '→', F0AC: '←', F0AB: '↔',
  F0DE: '⇒', F0DC: '⇐', F0DB: '⇔', F0A5: '∞', F0B7: '•', F0D6: '√', F0B5: '∝', F0B6: '∂', F0D1: '∇', F0CE: '∈', F0CF: '∉', F0C7: '∩',
  F0C8: '∪', F0CC: '⊂', F0CD: '⊆', F0A2: '′', F0B2: '″', F0D7: '⋅', F0A8: '♦', F0E5: '∑', F0D5: '∏', F0F2: '∫', F0AD: '↑', F0AF: '↓',
  F0DA: '∨', F0D9: '∧', F0D8: '¬', F0C5: '⊕', F0C4: '⊗', F0C6: '∅', F0BA: '≡', F0D0: '∠', F0BC: '…', F0A7: '♣',
  // lower case Greek letters (a = alpha ... w = omega) and upper case ones
  F061: 'α', F062: 'β', F063: 'χ', F064: 'δ', F065: 'ε', F066: 'φ', F067: 'γ', F068: 'η', F069: 'ι', F06A: 'ϕ', F06B: 'κ', F06C: 'λ',
  F06D: 'μ', F06E: 'ν', F06F: 'ο', F070: 'π', F071: 'θ', F072: 'ρ', F073: 'σ', F074: 'τ', F075: 'υ', F076: 'ϖ', F077: 'ω', F078: 'ξ',
  F079: 'ψ', F07A: 'ζ', F041: 'Α', F042: 'Β', F043: 'Χ', F044: 'Δ', F045: 'Ε', F046: 'Φ', F047: 'Γ', F048: 'Η', F049: 'Ι', F04B: 'Κ',
  F04C: 'Λ', F04D: 'Μ', F04E: 'Ν', F04F: 'Ο', F050: 'Π', F051: 'Θ', F052: 'Ρ', F053: 'Σ', F054: 'Τ', F055: 'Υ', F057: 'Ω', F058: 'Ξ',
  F059: 'Ψ', F05A: 'Ζ',
};

/** The text of the Symbol-font characters in a document's XML (unknown codes are left as they are). */
export function replaceSymbolFont(xml: string): { xml: string; replaced: number } {
  let replaced = 0;
  const next = xml.replace(/<w:sym\b[^>]*?w:font="Symbol"[^>]*?w:char="([0-9A-Fa-f]{4})"[^>]*?\/>/g, (whole, code: string) => {
    const ch = SYMBOL_FONT[code.toUpperCase()];
    if (!ch) return whole;
    replaced++;
    return `<w:t xml:space="preserve">${ch}</w:t>`;
  });
  return { xml: next, replaced };
}

const OLE_HEADER = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];

/** Throws a message in Vietnamese when the bytes are not a Word .docx (zip). */
export function assertWordDocx(buffer: ArrayBuffer): void {
  const bytes = new Uint8Array(buffer.slice(0, 8));
  if (OLE_HEADER.every((b, i) => bytes[i] === b)) {
    throw new Error('Đây là tệp Word cũ (.doc, Word 97-2003) nên chưa đọc được trực tiếp. Hãy mở bằng Word, chọn Lưu thành .docx rồi tải lên lại.');
  }
  const head = String.fromCharCode(...bytes.slice(0, 5));
  if (head === '{\\rtf') {
    throw new Error('Đây là tệp RTF nên chưa đọc được trực tiếp. Hãy mở bằng Word, chọn Lưu thành .docx rồi tải lên lại.');
  }
  if (!(bytes[0] === 0x50 && bytes[1] === 0x4b)) {
    throw new Error('Tệp không phải là tài liệu Word .docx hợp lệ (có thể bị hỏng hoặc sai định dạng).');
  }
}

const count = (xml: string, re: RegExp): number => (xml.match(re) ?? []).length;

/** The text of each footnote or endnote by id (separators and continuation notes are left out). */
function notesById(xml: string, tag: 'footnote' | 'endnote'): Map<string, string> {
  const out = new Map<string, string>();
  const re = new RegExp(`<w:${tag}\\b([^>]*)>([\\s\\S]*?)</w:${tag}>`, 'g');
  for (const m of xml.matchAll(re)) {
    const attrs = m[1];
    if (/w:type="(separator|continuationSeparator|continuationNotice)"/.test(attrs)) continue;
    const id = attrs.match(/w:id="(-?\d+)"/)?.[1];
    if (id === undefined) continue;
    const text = [...m[2].matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g)]
      .map((t) => t[1])
      .join('')
      .replace(/\s+/g, ' ')
      .trim()
      .split(FOOTNOTE_CLOSE)
      .join('] ]');
    if (text) out.set(id, text);
  }
  return out;
}

/** Replaces each footnote/endnote reference run by a marker run with the note's text. Returns the new XML and how many were placed. */
function placeNotes(xml: string, tag: 'footnote' | 'endnote', notes: Map<string, string>): { xml: string; placed: number } {
  if (notes.size === 0) return { xml, placed: 0 };
  let placed = 0;
  const run = new RegExp(`<w:r\\b[^>]*>(?:(?!</w:r>)[\\s\\S])*?<w:${tag}Reference\\b[^>]*?w:id="(-?\\d+)"[^>]*?/>(?:(?!</w:r>)[\\s\\S])*</w:r>`, 'g');
  const next = xml.replace(run, (whole, id: string) => {
    const note = notes.get(id);
    if (!note) return whole;
    placed++;
    return `<w:r><w:t xml:space="preserve">${FOOTNOTE_OPEN} ${note}${FOOTNOTE_CLOSE}</w:t></w:r>`;
  });
  return { xml: next, placed };
}

export async function prepareDocx(buffer: ArrayBuffer): Promise<PreparedDocx> {
  assertWordDocx(buffer);
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(buffer);
  } catch {
    throw new Error('Tệp .docx bị hỏng hoặc không đọc được. Hãy mở bằng Word và lưu lại rồi thử lại.');
  }
  const stats = { inserted: 0, deleted: 0, moved: 0, comments: 0, footnotes: 0, vectorImages: 0, embeddedEquations: 0 };
  const docFile = zip.file('word/document.xml');
  if (!docFile) return { buffer, notes: [], stats };

  let xml = await docFile.async('text');
  const original = xml;

  // ---- Track Changes: keep insertions, drop deletions and the old place of moved text
  stats.inserted = count(xml, /<w:ins\b[^>]*[^/]>/g) + count(xml, /<w:moveTo\b[^>]*[^/]>/g);
  stats.deleted = count(xml, /<w:del\b[^>]*[^/]>/g);
  stats.moved = count(xml, /<w:moveFrom\b[^>]*[^/]>/g);
  if (stats.inserted + stats.deleted + stats.moved > 0) {
    xml = xml
      // the marks that only say "this paragraph mark was inserted/deleted" carry no text
      .replace(/<w:(?:ins|del|moveFrom|moveTo)\b[^>]*\/>/g, '')
      .replace(/<w:del\b[^>]*>[\s\S]*?<\/w:del>/g, '')
      .replace(/<w:moveFrom\b[^>]*>[\s\S]*?<\/w:moveFrom>/g, '')
      .replace(/<\/?w:(?:ins|moveTo)\b[^>]*>/g, '');
  }

  // ---- symbols inserted from Word's Symbol font become the characters they are
  xml = replaceSymbolFont(xml).xml;

  // ---- footnotes and endnotes: placed at the sentence that cites them
  for (const [tag, part] of [['footnote', 'word/footnotes.xml'], ['endnote', 'word/endnotes.xml']] as const) {
    const file = zip.file(part);
    if (!file) continue;
    const notes = notesById(await file.async('text'), tag);
    const result = placeNotes(xml, tag, notes);
    xml = result.xml;
    stats.footnotes += result.placed;
  }

  // ---- what cannot be carried over
  const commentsFile = zip.file('word/comments.xml');
  if (commentsFile) stats.comments = count(await commentsFile.async('text'), /<w:comment\b/g);
  stats.vectorImages = Object.keys(zip.files).filter((n) => /^word\/media\/[^/]+\.(emf|wmf)$/i.test(n)).length;
  stats.embeddedEquations = count(original, /<w:object\b[\s\S]*?ProgID="Equation/g);

  const notes: string[] = [];
  const changes = stats.inserted + stats.deleted + stats.moved;
  if (changes > 0) {
    notes.push(`Bài có ${changes} thay đổi đang theo dõi (Track Changes): đã giữ bản như khi chấp nhận tất cả (${stats.inserted} chỗ chèn được giữ, ${stats.deleted + stats.moved} chỗ xóa hoặc chuyển đi bị bỏ). Hãy kiểm tra lại với bản Word nếu cần.`);
  }
  if (stats.footnotes > 0) {
    notes.push(`Đã nhập ${stats.footnotes} chú thích (footnote/endnote). Chúng nằm trong văn bản dạng [[fn: nội dung]] và được in ở cuối trang trong PDF.`);
  }
  if (stats.comments > 0) notes.push(`Bài có ${stats.comments} bình luận trong Word; bình luận không được nhập, chỉ lấy nội dung bài.`);
  if (stats.vectorImages > 0) notes.push(`Có ${stats.vectorImages} hình dạng EMF/WMF (thường là hình vector hoặc công thức MathType) chưa hiển thị được. Hãy thay bằng ảnh PNG/SVG, hoặc nhập lại công thức ở khối Công thức.`);
  if (stats.embeddedEquations > 0) notes.push(`Có ${stats.embeddedEquations} công thức MathType nhúng dạng đối tượng chưa chuyển được sang LaTeX. Hãy nhập lại ở khối Công thức (trong Word, chọn công thức rồi Chuyển sang Equation sẽ nhập được tự động).`);

  if (xml === original) return { buffer, notes, stats };
  zip.file('word/document.xml', xml);
  return { buffer: await zip.generateAsync({ type: 'arraybuffer' }), notes, stats };
}
