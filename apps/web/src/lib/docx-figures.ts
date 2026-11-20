/**
 * Pair figure captions ("Hình N: …") with the picture that sits next to them in the Word XML.
 *
 * The old logic paired by order (image, then the next caption) and fell back to "image number N for
 * figure N". When a figure is a native Word drawing (no picture) or the caption comes *above* the
 * picture, that attached the wrong image to the wrong figure. Here every picture is matched to the
 * nearest caption by position in document.xml, each picture at most once.
 */

const CAPTION_RE = /^\s*(?:h\s*ình|hình|figure|fig\.?)\s*(\d+)\s*[:.]/i;
const BARE_CAPTION_RE = /^\s*(?:h\s*ình|hình|figure|fig\.?)\s*(\d+)\s+(\S)/i;
const REFERENCE_VERB = /^\s*(?:h\s*ình|hình|figure|fig\.?)\s*\d+\s+(?:cho thấy|chỉ ra|biểu thị|được|minh họa|mô tả|thể hiện|trình bày|shows|presents|illustrates|indicates)/i;

/**
 * The figure number a caption paragraph names: "Hình 2: …", "Hình 2. …" and the Word caption with no punctuation, "Hình 2 Bản đồ …"
 * (a capital letter follows the number, so "Hình 2 cho thấy …" in a sentence is not one). Accepts raw paragraph XML or plain text.
 */
export function figureCaptionNumber(rawText: string): number | undefined {
  const text = rawText.replace(/<w:instrText[^>]*>[\s\S]*?<\/w:instrText>/g, '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ');
  const punct = text.match(CAPTION_RE)?.[1];
  if (punct) return Number(punct);
  if (text.trim().length > 250 || REFERENCE_VERB.test(text)) return undefined;
  const bare = text.match(BARE_CAPTION_RE);
  return bare && bare[2] !== bare[2].toLowerCase() ? Number(bare[1]) : undefined;
}
const MAX_DISTANCE = 8000; // characters of XML between a caption paragraph and its picture

export function parseImageRelationships(relsXml: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const m of relsXml.matchAll(/<Relationship\b[^>]*>/gi)) {
    const tag = m[0];
    const id = tag.match(/\bId="([^"]+)"/)?.[1];
    const target = tag.match(/\bTarget="([^"]+)"/)?.[1];
    if (id && target && /\/media\//i.test(target.startsWith('/') ? target : `/${target}`)) {
      map.set(id, target.split('/').pop() as string);
    }
  }
  return map;
}

export interface FigurePairing {
  /** figure number -> media file name (e.g. 2 -> "image1.png"). */
  images: Map<number, string>;
  /** Every figure number whose caption paragraph was found in the XML. */
  captionNumbers: Set<number>;
}

/** figure number -> media file name. Empty when nothing can be paired. */
export function mapFiguresToImages(docXml: string, relsXml: string): Map<number, string> {
  return pairFiguresWithImages(docXml, relsXml).images;
}

export function pairFiguresWithImages(docXml: string, relsXml: string): FigurePairing {
  const rels = parseImageRelationships(relsXml);
  const images: { pos: number; name: string }[] = [];
  for (const m of docXml.matchAll(/<a:blip\b[^>]*\br:embed="([^"]+)"|<v:imagedata\b[^>]*\br:id="([^"]+)"/gi)) {
    const name = rels.get(m[1] || m[2]);
    if (name) images.push({ pos: m.index ?? 0, name });
  }

  const captions: { pos: number; num: number }[] = [];
  for (const p of docXml.matchAll(/<w:p\b[\s\S]*?<\/w:p>/gi)) {
    const num = figureCaptionNumber(p[0]);
    if (num) captions.push({ pos: p.index ?? 0, num });
  }

  const pairs: { d: number; c: number; i: number }[] = [];
  captions.forEach((c, ci) => images.forEach((img, ii) => pairs.push({ d: Math.abs(img.pos - c.pos), c: ci, i: ii })));
  pairs.sort((a, b) => a.d - b.d);

  const usedCaption = new Set<number>();
  const usedImage = new Set<number>();
  const result = new Map<number, string>();
  for (const { d, c, i } of pairs) {
    if (d > MAX_DISTANCE) break;
    if (usedCaption.has(c) || usedImage.has(i)) continue;
    usedCaption.add(c);
    usedImage.add(i);
    result.set(captions[c].num, images[i].name);
  }
  return { images: result, captionNumbers: new Set(captions.map((c) => c.num)) };
}

/**
 * Figures drawn with Word shapes (no picture file): figure number -> the `<w:drawing>` XML.
 * Matched to the nearest caption by distance from the drawing's start or end, each used at most once;
 * captions already paired with a picture (`taken`) are skipped.
 */
export function pairShapeDrawings(docXml: string, taken: Set<number>): Map<number, string> {
  const drawings: { start: number; end: number; xml: string }[] = [];
  for (const m of docXml.matchAll(/<w:drawing\b[\s\S]*?<\/w:drawing>/gi)) {
    if (/<wps:wsp\b/.test(m[0]) && !/<a:blip\b/.test(m[0])) {
      drawings.push({ start: m.index ?? 0, end: (m.index ?? 0) + m[0].length, xml: m[0] });
    }
  }
  if (!drawings.length) return new Map();

  const captions: { pos: number; num: number }[] = [];
  for (const p of docXml.matchAll(/<w:p\b[\s\S]*?<\/w:p>/gi)) {
    const num = figureCaptionNumber(p[0]);
    if (num && !taken.has(num)) captions.push({ pos: p.index ?? 0, num });
  }

  const pairs: { d: number; c: number; i: number }[] = [];
  captions.forEach((c, ci) =>
    drawings.forEach((dr, di) => pairs.push({ d: Math.min(Math.abs(dr.start - c.pos), Math.abs(dr.end - c.pos)), c: ci, i: di }))
  );
  pairs.sort((a, b) => a.d - b.d);
  const usedC = new Set<number>();
  const usedD = new Set<number>();
  const out = new Map<number, string>();
  for (const { d, c, i } of pairs) {
    if (d > MAX_DISTANCE) break;
    if (usedC.has(c) || usedD.has(i)) continue;
    usedC.add(c);
    usedD.add(i);
    out.set(captions[c].num, drawings[i].xml);
  }
  return out;
}
