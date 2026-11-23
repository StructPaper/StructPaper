import type JSZip from 'jszip';
import type { CompletePaper, PaperFigure, PaperSection } from '@/types/paper';
import {
  getTrackedObjectUrlExt,
  mimeToImageExt,
  readBlobAsArrayBuffer,
} from './blob-image-registry';
import { isTiff, tiffToPng } from './tiff';

const BASE64_CHUNK_SIZE = 0x8000; // 32KB slices prevent call stack overflow on large images

/**
 * Inspects image magic bytes for JPEG (FF D8 FF) and PNG (89 50 4E 47) headers.
 */
function detectImageExtFromBytes(bytes: Uint8Array): 'jpg' | 'png' | null {
  if (bytes.byteLength >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'jpg';
  }
  if (
    bytes.byteLength >= 4 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return 'png';
  }
  return null;
}

/**
 * Checks whether a figure source is an inline data:image URI or a browser blob: Object URL.
 */
export function isEmbeddedOrObjectImageSrc(src?: string): boolean {
  if (!src || typeof src !== 'string') return false;
  const normalized = src.trim().toLowerCase();
  return normalized.startsWith('data:image') || normalized.startsWith('blob:');
}

/**
 * Resolves a deterministic LaTeX filename for a figure without leaking raw blob: UUID URLs.
 */
export function resolveLatexFigureFilename(figure: PaperFigure, fallbackNum: number): string {
  const figNum = figure.num || fallbackNum;
  const defaultName = `fig${figNum}.png`;
  const src = figure.src?.trim();
  if (!src) return defaultName;

  const lowerSrc = src.toLowerCase();
  if (lowerSrc.startsWith('data:image')) {
    const isJpg =
      lowerSrc.startsWith('data:image/jpeg') ||
      lowerSrc.startsWith('data:image/jpg');
    return `fig${figNum}.${isJpg ? 'jpg' : 'png'}`;
  }

  if (lowerSrc.startsWith('blob:')) {
    const trackedExt = getTrackedObjectUrlExt(src);
    return trackedExt ? `fig${figNum}.${trackedExt}` : defaultName;
  }

  const basename = src.split('/').pop();
  return basename || defaultName;
}

function bytesToBase64(bytes: Uint8Array): string {
  if (bytes.byteLength === 0) return '';

  if (typeof btoa === 'function') {
    const chunks: string[] = [];
    for (let i = 0; i < bytes.length; i += BASE64_CHUNK_SIZE) {
      const slice = bytes.subarray(i, i + BASE64_CHUNK_SIZE);
      let chunkStr = '';
      for (let j = 0; j < slice.length; j++) {
        chunkStr += String.fromCharCode(slice[j]);
      }
      chunks.push(chunkStr);
    }
    return btoa(chunks.join(''));
  }

  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }

  return '';
}

/** A TIFF (whatever its name or declared type) becomes a PNG; null when it cannot be converted. Other pictures are returned as they are. */
async function convertIfTiff(base64: string, ext: 'jpg' | 'png'): Promise<{ base64: string; ext: 'jpg' | 'png' } | null> {
  let head: Uint8Array;
  try {
    const bin = atob(base64.slice(0, 16));
    head = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  } catch {
    return { base64, ext };
  }
  if (!isTiff(head)) return { base64, ext };
  const bin = atob(base64);
  const png = await tiffToPng(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
  return png ? { base64: bytesToBase64(png), ext: 'png' } : null;
}

/**
 * Converts a data:image* URI or blob:* Object URL into raw base64 payload + extension.
 */
export async function imageSrcToBase64(
  src: string
): Promise<{ base64: string; ext: 'jpg' | 'png' } | null> {
  if (!src || typeof src !== 'string') return null;
  const trimmed = src.trim();
  if (!trimmed) return null;

  const lower = trimmed.toLowerCase();
  if (lower.startsWith('data:image')) {
    const commaIdx = trimmed.indexOf(',');
    if (commaIdx === -1) return null;
    const header = lower.slice(0, commaIdx);
    const params = header.split(';').slice(1).map((part) => part.trim());
    if (!params.includes('base64')) return null;
    const base64 = trimmed.slice(commaIdx + 1).trim();
    if (!base64) return null;
    const isJpg = header.includes('image/jpeg') || header.includes('image/jpg');
    return convertIfTiff(base64, isJpg ? 'jpg' : 'png');
  }

  if (lower.startsWith('blob:')) {
    try {
      const res = await fetch(trimmed);
      if (!res || res.ok === false) return null;
      const blob = await res.blob();
      if (!blob) return null;
      const buffer = await readBlobAsArrayBuffer(blob);
      const bytes = new Uint8Array(buffer);
      const base64 = bytesToBase64(bytes);
      if (!base64) return null;

      const rawMime = (blob.type || res.headers?.get?.('content-type') || '')
        .split(';')[0]
        ?.trim()
        .toLowerCase() || '';
      let ext = mimeToImageExt(rawMime);
      if (!ext && (!rawMime || rawMime === 'application/octet-stream')) {
        ext = detectImageExtFromBytes(bytes);
      }
      if (!ext) {
        ext = getTrackedObjectUrlExt(trimmed) ?? detectImageExtFromBytes(bytes) ?? 'png';
      }
      return convertIfTiff(base64, ext);
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Concurrently extracts all embedded data:image* and blob:* figure assets into compiler key maps.
 */
export async function extractPaperImagesAsync(
  paper: CompletePaper
): Promise<Record<string, string>> {
  const images: Record<string, string> = {};
  const sections = paper?.sections || [];
  let figIdx = 1;

  const figureEntries: Array<{ idx: number; num: number; src: string }> = [];
  sections.forEach((sec, idx) => {
    if (sec.type === 'figure' && sec.figure?.src) {
      const num = sec.figure.num || figIdx++;
      figureEntries.push({ idx, num, src: sec.figure.src });
    }
  });

  const resolvedEntries = await Promise.all(
    figureEntries.map(async (entry) => ({
      ...entry,
      resolved: await imageSrcToBase64(entry.src),
    }))
  );

  // every figure number of the paper, with or without a picture: a position-based alias must never take the name of a figure
  // that has none (it would then show somebody else's picture under its caption)
  const claimed = new Set<number>(figureEntries.map((e) => e.num));
  sections.forEach((sec) => {
    if (sec.type === 'figure' && sec.figure?.num) claimed.add(sec.figure.num);
  });
  for (const { idx, num, resolved } of resolvedEntries) {
    if (!resolved) continue;
    const { base64, ext } = resolved;
    images[`fig${num}.${ext}`] = base64;
    images[`image${num}.${ext}`] = base64;
    if (!claimed.has(idx + 1) || idx + 1 === num) {
      images[`image${idx + 1}.${ext}`] = base64;
      images[`fig${idx + 1}.${ext}`] = base64;
    }
  }

  return images;
}

/**
 * Concurrently resolves figure images, appends them into a JSZip images folder,
 * and returns a map of section index to packed relative paths (e.g. `images/fig1.jpg`).
 */
export async function appendFigureImagesToZip(
  imgFolder: JSZip | null,
  sections: PaperSection[],
  _options?: { includePngFallback?: boolean }
): Promise<Record<number, string>> {
  const packedPaths: Record<number, string> = {};
  if (!Array.isArray(sections) || sections.length === 0) return packedPaths;

  await Promise.all(
    sections.map(async (sec, idx) => {
      if (sec.type !== 'figure' || !sec.figure?.src) return;
      const resolved = await imageSrcToBase64(sec.figure.src);
      if (!resolved) return;

      const num = sec.figure.num || idx + 1;
      const filename = `fig${num}.${resolved.ext}`;
      packedPaths[idx] = `images/${filename}`;
      if (imgFolder) {
        imgFolder.file(filename, resolved.base64, { base64: true });
      }
    })
  );

  return packedPaths;
}

/**
 * Returns a non-mutating shallow clone of `paper` with resolved `blob:` figure `src` URLs
 * rewritten to their packed relative paths (e.g. `images/fig1.jpg`) for on-disk ZIP exports.
 */
export function rewriteBlobFigureSrcsForArchive(
  paper: CompletePaper,
  packedPaths: Record<number, string>
): CompletePaper {
  if (!Array.isArray(paper.sections) || paper.sections.length === 0) return paper;
  let changed = false;
  const nextSections = paper.sections.map((sec, idx) => {
    const packedPath = packedPaths[idx];
    if (
      packedPath &&
      sec.type === 'figure' &&
      sec.figure?.src &&
      sec.figure.src.trim().toLowerCase().startsWith('blob:')
    ) {
      changed = true;
      return {
        ...sec,
        figure: {
          ...sec.figure,
          src: packedPath,
        },
      };
    }
    return sec;
  });
  return changed ? { ...paper, sections: nextSections } : paper;
}
