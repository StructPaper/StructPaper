/**
 * Word files sometimes carry a TIFF picture (often named .jpg). Neither LaTeX nor a browser reads TIFF, so the picture is
 * converted to PNG when it is brought in. Handles what Word writes: uncompressed 8-bit grey / RGB / RGBA, in strips, either byte order.
 */

export function isTiff(bytes: Uint8Array): boolean {
  return bytes.byteLength > 8 && ((bytes[0] === 0x49 && bytes[1] === 0x49 && bytes[2] === 0x2a && bytes[3] === 0) || (bytes[0] === 0x4d && bytes[1] === 0x4d && bytes[2] === 0 && bytes[3] === 0x2a));
}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

async function deflate(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new CompressionStream('deflate'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** PNG bytes of an uncompressed TIFF, or null when it is another kind of TIFF. */
export async function tiffToPng(bytes: Uint8Array): Promise<Uint8Array | null> {
  if (!isTiff(bytes)) return null;
  const le = bytes[0] === 0x49;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const u16 = (o: number) => view.getUint16(o, le);
  const u32 = (o: number) => view.getUint32(o, le);
  try {
    const ifd = u32(4);
    const count = u16(ifd);
    const tags = new Map<number, number[]>();
    for (let i = 0; i < count; i++) {
      const e = ifd + 2 + i * 12;
      const tag = u16(e);
      const type = u16(e + 2);
      const n = u32(e + 4);
      const size = ({ 1: 1, 3: 2, 4: 4 } as Record<number, number>)[type];
      if (!size) continue;
      const base = size * n <= 4 ? e + 8 : u32(e + 8);
      const vals: number[] = [];
      for (let k = 0; k < n; k++) vals.push(size === 1 ? view.getUint8(base + k) : size === 2 ? u16(base + 2 * k) : u32(base + 4 * k));
      tags.set(tag, vals);
    }
    const width = tags.get(256)?.[0] ?? 0;
    const height = tags.get(257)?.[0] ?? 0;
    const bits = tags.get(258) ?? [8];
    const compression = tags.get(259)?.[0] ?? 1;
    const photometric = tags.get(262)?.[0] ?? 2;
    const spp = tags.get(277)?.[0] ?? 1;
    const offsets = tags.get(273) ?? [];
    const counts = tags.get(279) ?? [];
    if (!width || !height || compression !== 1 || bits.some((b) => b !== 8) || ![1, 3, 4].includes(spp) || photometric > 2) return null;
    if (width * height > 60_000_000) return null;

    const raw = new Uint8Array(width * height * spp);
    let pos = 0;
    offsets.forEach((off, i) => {
      const len = Math.min(counts[i] ?? raw.length, raw.length - pos);
      raw.set(bytes.subarray(off, off + len), pos);
      pos += len;
    });
    if (photometric === 0) for (let i = 0; i < raw.length; i++) raw[i] = 255 - raw[i]; // grey, 0 = white

    const stride = width * spp;
    const scan = new Uint8Array((stride + 1) * height);
    for (let y = 0; y < height; y++) scan.set(raw.subarray(y * stride, (y + 1) * stride), y * (stride + 1) + 1);

    const header = new Uint8Array(13);
    const hv = new DataView(header.buffer);
    hv.setUint32(0, width);
    hv.setUint32(4, height);
    header[8] = 8;
    header[9] = spp === 1 ? 0 : spp === 3 ? 2 : 6;
    const parts = [new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', header), chunk('IDAT', await deflate(scan)), chunk('IEND', new Uint8Array(0))];
    const out = new Uint8Array(parts.reduce((a, p) => a + p.length, 0));
    let o = 0;
    for (const p of parts) {
      out.set(p, o);
      o += p.length;
    }
    return out;
  } catch {
    return null;
  }
}
