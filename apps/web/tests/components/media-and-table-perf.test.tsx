// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup, renderHook, waitFor } from '@testing-library/react';
import JSZip from 'jszip';

import {
  isEmbeddedOrObjectImageSrc,
  resolveLatexFigureFilename,
  imageSrcToBase64,
  extractPaperImagesAsync,
  appendFigureImagesToZip,
} from '@/lib/media/figure-image-utils';
import * as blobRegistry from '@/lib/media/blob-image-registry';
import { generateFullJournalLatex, generateLatexPackageZip } from '@/lib/latex-template';
import { generatePaperZip } from '@/lib/exporters';
import { useSectionMediaHandlers } from '@/features/editor/components/sections/useSectionMediaHandlers';
import { FigureSectionItem } from '@/features/editor/components/sections/FigureSectionItem';
import { TableSectionItem } from '@/features/editor/components/sections/TableSectionItem';
import {
  TablePreviewGrid,
  TABLE_PREVIEW_MAX_ROWS,
} from '@/features/editor/components/sections/TablePreviewGrid';
import { normalizePaperTable, type CompletePaper, type PaperFigure, type PaperSection, type PaperTable } from '@/types/paper';

const TINY_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
const TINY_PNG_DATA_URL = `data:image/png;base64,${TINY_PNG_BASE64}`;
const TINY_JPG_BASE64 = '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP///8A=';
const TINY_JPG_DATA_URL = `data:image/jpeg;base64,${TINY_JPG_BASE64}`;

function makeSamplePaper(sections: PaperSection[]): CompletePaper {
  return {
    id: 'paper-perf-test',
    metadata: {
      title: 'Nghiên cứu hiệu năng media',
      articleType: 'Bài báo nghiên cứu',
      journalId: 'VNUHCM-HS',
      journalName: 'Tạp chí Khoa học Sức khỏe',
      journalAbbv: 'STDJ-HS',
      authors: [{ id: 'a1', name: 'Nguyễn Văn A', affiliationIds: [1], isCorresponding: true }],
      affiliations: [{ id: 1, name: 'ĐHQG TP.HCM' }],
      corresponding: { name: 'Nguyễn Văn A', email: 'a@vnuhcm.edu.vn', affiliation: 'ĐHQG TP.HCM' },
      abstract: 'Tóm tắt.',
      keywords: ['hiệu năng'],
      dates: { received: '', revised: '', accepted: '', published: '' },
      doi: '',
      volume: '1',
      issue: '1',
      year: '2026',
      firstPage: 1,
      lastPage: 5,
    },
    sections,
    references: [],
  };
}

function makeTable(rowCount: number, withStructuredBodyRows = false): PaperTable {
  const headers = ['STT', 'Chỉ số', 'Giá trị'];
  const rows = Array.from({ length: rowCount }, (_, i) => [
    String(i + 1),
    `Chỉ số ${i + 1}`,
    `${(90 + (i % 10)).toFixed(1)}%`,
  ]);
  if (!withStructuredBodyRows) {
    return {
      id: 'tbl-1',
      num: 1,
      caption: `Bảng 1: Dữ liệu (${rowCount} hàng)`,
      headers,
      rows,
      isFullWidth: true,
    };
  }
  return {
    id: 'tbl-1',
    num: 1,
    caption: `Bảng 1: Dữ liệu có cấu trúc (${rowCount} hàng)`,
    headers,
    rows,
    bodyRows: rows.map((r) => r.map((text) => ({ text }))),
    isFullWidth: true,
  };
}

describe('Task 2: Shared Media Pipeline (blob:), Lazy Figures & Capped Table Previews', () => {
  const originalFetch = globalThis.fetch;
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;

  beforeEach(() => {
    vi.restoreAllMocks();
    blobRegistry.revokeAllTrackedSessionObjectUrls();
  });

  afterEach(() => {
    cleanup();
    globalThis.fetch = originalFetch;
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
    blobRegistry.revokeAllTrackedSessionObjectUrls();
  });

  describe('1. figure-image-utils & LaTeX / ZIP integration', () => {
    it('detects embedded data:image* and blob:* URLs cleanly', () => {
      expect(isEmbeddedOrObjectImageSrc(TINY_PNG_DATA_URL)).toBe(true);
      expect(isEmbeddedOrObjectImageSrc(TINY_JPG_DATA_URL)).toBe(true);
      expect(isEmbeddedOrObjectImageSrc('blob:http://localhost:3000/1234-5678')).toBe(true);
      expect(isEmbeddedOrObjectImageSrc('/images/chart.png')).toBe(false);
      expect(isEmbeddedOrObjectImageSrc('https://example.com/a.png')).toBe(false);
      expect(isEmbeddedOrObjectImageSrc('')).toBe(false);
      expect(isEmbeddedOrObjectImageSrc(undefined)).toBe(false);
    });

    it('resolves deterministic LaTeX figure filenames and strips raw blob: UUIDs', () => {
      const baseFig: Omit<PaperFigure, 'src'> = {
        id: 'f1',
        num: 2,
        caption: 'Sơ đồ',
      };

      expect(resolveLatexFigureFilename({ ...baseFig, src: TINY_JPG_DATA_URL }, 1)).toBe('fig2.jpg');
      expect(
        resolveLatexFigureFilename({ ...baseFig, src: 'data:image/jpg;base64,AAA' }, 1)
      ).toBe('fig2.jpg');
      expect(resolveLatexFigureFilename({ ...baseFig, src: TINY_PNG_DATA_URL }, 1)).toBe('fig2.png');

      const blobFilename = resolveLatexFigureFilename(
        { ...baseFig, src: 'blob:http://localhost:3000/550e8400-e29b-41d4-a716-446655440000' },
        1
      );
      expect(blobFilename).toBe('fig2.png');
      expect(blobFilename).not.toContain('550e8400');

      expect(
        resolveLatexFigureFilename({ ...baseFig, num: 0, src: 'https://cdn.test/plots/fig-a.png' }, 3)
      ).toBe('fig-a.png');
      expect(resolveLatexFigureFilename({ ...baseFig, num: 0, src: '' }, 4)).toBe('fig4.png');

      // Verify generateFullJournalLatex never leaks raw blob: UUID into \includegraphics
      const tex = generateFullJournalLatex(
        makeSamplePaper([
          {
            id: 'sec_fig',
            type: 'figure',
            content: 'Hình 1',
            figure: {
              id: 'fig1',
              num: 1,
              caption: 'Biểu đồ',
              src: 'blob:http://localhost:3000/99999999-aaaa-bbbb-cccc-111111111111',
            },
          },
        ])
      );
      expect(tex).toContain('\\includegraphics[width=1.00\\linewidth]{images/fig1.png}');
      expect(tex).not.toContain('99999999-aaaa-bbbb-cccc-111111111111');
    });

    it('converts data:image* and large blob:* responses into base64 in 32KB chunks without stack overflow', async () => {
      const jpgResult = await imageSrcToBase64(TINY_JPG_DATA_URL);
      expect(jpgResult).toEqual({ base64: TINY_JPG_BASE64, ext: 'jpg' });

      // Create an 80KB payload (> 64KB, larger than common spread stack limits)
      const largeBytes = new Uint8Array(80 * 1024);
      for (let i = 0; i < largeBytes.length; i++) {
        largeBytes[i] = i % 251;
      }

      globalThis.fetch = vi.fn(async (url: RequestInfo | URL) => {
        if (String(url) === 'blob:http://localhost/large-jpeg') {
          return {
            ok: true,
            blob: async () => new Blob([largeBytes], { type: 'image/jpeg' }),
          } as Response;
        }
        return { ok: false } as Response;
      }) as typeof fetch;

      const largeResult = await imageSrcToBase64('blob:http://localhost/large-jpeg');
      expect(largeResult).not.toBeNull();
      expect(largeResult?.ext).toBe('jpg');
      expect(largeResult?.base64).toBe(Buffer.from(largeBytes).toString('base64'));

      // Failing blob fetch returns null gracefully
      expect(await imageSrcToBase64('blob:http://localhost/missing')).toBeNull();
    });

    it('extractPaperImagesAsync produces full compiler key maps for mixed data: and blob: figures', async () => {
      const blobBytes = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]);
      globalThis.fetch = vi.fn(async () => ({
        ok: true,
        blob: async () => new Blob([blobBytes], { type: 'image/png' }),
      })) as unknown as typeof fetch;

      const paper = makeSamplePaper([
        {
          id: 's1',
          type: 'figure',
          content: 'Fig 1',
          figure: { id: 'f1', num: 1, caption: 'Jpeg fig', src: TINY_JPG_DATA_URL },
        },
        {
          id: 's2',
          type: 'paragraph',
          content: 'Paragraph',
        },
        {
          id: 's3',
          type: 'figure',
          content: 'Fig 2',
          figure: {
            id: 'f2',
            num: 2,
            caption: 'Blob fig',
            src: 'blob:http://localhost:3000/blob-fig-2',
          },
        },
      ]);

      const images = await extractPaperImagesAsync(paper);
      const expectedPngBase64 = Buffer.from(blobBytes).toString('base64');

      expect(images['fig1.jpg']).toBe(TINY_JPG_BASE64);
      expect(images['fig1.png']).toBeUndefined();
      expect(images['image1.jpg']).toBe(TINY_JPG_BASE64);

      expect(images['fig2.png']).toBe(expectedPngBase64);
      expect(images['fig2.jpg']).toBeUndefined();
      expect(images['image2.png']).toBe(expectedPngBase64);
      expect(images['image3.png']).toBe(expectedPngBase64);
      expect(images['fig3.png']).toBe(expectedPngBase64);
      expect(images['fig3.jpg']).toBeUndefined();
    });

    it('detects JPEG and PNG magic bytes on MIME-less blobs, validates ;base64 markers, and tracks blob MIME extensions', async () => {
      expect(await imageSrcToBase64('data:image/svg+xml,<svg/>')).toBeNull();
      expect(await imageSrcToBase64('data:image/png,plain-text')).toBeNull();

      const jpgMagicBytes = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
      const pngMagicBytes = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

      globalThis.fetch = vi.fn(async (url: RequestInfo | URL) => {
        const u = String(url);
        if (u.endsWith('mime-less-jpg')) {
          return {
            ok: true,
            blob: async () => new Blob([jpgMagicBytes]),
          } as Response;
        }
        return {
          ok: true,
          blob: async () => new Blob([pngMagicBytes], { type: 'application/octet-stream' }),
        } as Response;
      }) as typeof fetch;

      const jpgResolved = await imageSrcToBase64('blob:http://localhost/mime-less-jpg');
      expect(jpgResolved).toEqual({
        base64: Buffer.from(jpgMagicBytes).toString('base64'),
        ext: 'jpg',
      });

      const pngResolved = await imageSrcToBase64('blob:http://localhost/octet-png');
      expect(pngResolved).toEqual({
        base64: Buffer.from(pngMagicBytes).toString('base64'),
        ext: 'png',
      });

      const trackedJpgUrl = 'blob:http://localhost/tracked-jpeg-uuid';
      blobRegistry.setTrackedObjectUrlMime(trackedJpgUrl, 'image/jpeg');
      expect(
        resolveLatexFigureFilename(
          { id: 'f_tracked', num: 3, caption: 'Tracked JPG', src: trackedJpgUrl },
          3
        )
      ).toBe('fig3.jpg');

      const extracted = await extractPaperImagesAsync(
        makeSamplePaper([
          {
            id: 'sec_magic_jpg',
            type: 'figure',
            content: 'Fig 1',
            figure: {
              id: 'f_magic',
              num: 1,
              caption: 'Magic JPEG',
              src: 'blob:http://localhost/mime-less-jpg',
            },
          },
        ])
      );
      expect(extracted['fig1.jpg']).toBe(Buffer.from(jpgMagicBytes).toString('base64'));
      expect(extracted['fig1.png']).toBeUndefined();
    });

    it('appendFigureImagesToZip packs both data: and blob: figures and generates ZIP packages', async () => {
      const pngBytes = Uint8Array.from([1, 2, 3, 4, 5, 6]);
      globalThis.fetch = vi.fn(async () => ({
        ok: true,
        blob: async () => new Blob([pngBytes], { type: 'image/png' }),
      })) as unknown as typeof fetch;

      const sections: PaperSection[] = [
        {
          id: 's1',
          type: 'figure',
          content: 'F1',
          figure: { id: 'f1', num: 1, caption: 'JPG', src: TINY_JPG_DATA_URL },
        },
        {
          id: 's2',
          type: 'figure',
          content: 'F2',
          figure: { id: 'f2', num: 2, caption: 'BLOB', src: 'blob:http://localhost/fig-2' },
        },
      ];

      // 1. Without PNG fallback (exporters.ts style)
      const zip1 = new JSZip();
      const folder1 = zip1.folder('images');
      await appendFigureImagesToZip(folder1, sections);
      expect(zip1.file('images/fig1.jpg')).not.toBeNull();
      expect(zip1.file('images/fig1.png')).toBeNull();
      expect(zip1.file('images/fig2.png')).not.toBeNull();

      // 2. Even with includePngFallback option, JPEG must NEVER be written as .png
      const zip2 = new JSZip();
      const folder2 = zip2.folder('images');
      await appendFigureImagesToZip(folder2, sections, { includePngFallback: true });
      expect(zip2.file('images/fig1.jpg')).not.toBeNull();
      expect(zip2.file('images/fig1.png')).toBeNull();
      expect(zip2.file('images/fig2.png')).not.toBeNull();

      // Null imgFolder guard
      await expect(appendFigureImagesToZip(null, sections)).resolves.toEqual({
        0: 'images/fig1.jpg',
        1: 'images/fig2.png',
      });

      // End-to-end ZIP exports resolve cleanly with blob: images
      const paper = makeSamplePaper(sections);
      const latexZipBlob = await generateLatexPackageZip(paper);
      expect(latexZipBlob.size).toBeGreaterThan(0);
      const paperZipBlob = await generatePaperZip(paper);
      expect(paperZipBlob.size).toBeGreaterThan(0);
    });

    it('generatePaperZip rewrites blob: figure srcs in paper.html and paper.tex to packed paths without mutating paper state', async () => {
      const jpgMagicBytes = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0x11, 0x22, 0x33]);
      globalThis.fetch = vi.fn(async () => ({
        ok: true,
        blob: async () => new Blob([jpgMagicBytes]),
      })) as unknown as typeof fetch;

      const blobSrc = 'blob:http://localhost:3000/abc-123-mime-less-jpeg';
      const paper = makeSamplePaper([
        {
          id: 's_fig_zip',
          type: 'figure',
          content: 'Fig 1',
          figure: { id: 'f1', num: 1, caption: 'Ảnh thực nghiệm', src: blobSrc },
        },
      ]);

      const zipBlob = await generatePaperZip(paper);
      // Caller state remains unmutated
      expect(paper.sections[0].figure?.src).toBe(blobSrc);

      const loaded = await JSZip.loadAsync(zipBlob);
      const html = await loaded.file('paper-perf-test/paper.html')?.async('text');
      const tex = await loaded.file('paper-perf-test/paper.tex')?.async('text');
      const packedJpg = await loaded.file('paper-perf-test/images/fig1.jpg')?.async('uint8array');

      expect(html).toContain('src="images/fig1.jpg"');
      expect(html).not.toContain('blob:');
      expect(tex).toContain('images/fig1.jpg');
      expect(tex).not.toContain('blob:');
      expect(packedJpg).toEqual(jpgMagicBytes);
      expect(loaded.file('paper-perf-test/images/fig1.png')).toBeNull();
    });
  });

  describe('2. useSectionMediaHandlers blob: Object URL creation', () => {
    it('creates blob: Object URLs synchronously via URL.createObjectURL on upload, drop, and paste', async () => {
      let counter = 0;
      const createSpy = vi.fn(() => `blob:http://localhost/mock-${++counter}`);
      const revokeSpy = vi.fn();
      URL.createObjectURL = createSpy;
      URL.revokeObjectURL = revokeSpy;

      const cacheSpy = vi.spyOn(blobRegistry, 'cacheBlobAssetQuietly').mockResolvedValue(null);

      const sections: PaperSection[] = [
        {
          id: 'sec_fig_1',
          type: 'figure',
          content: 'Hình 1',
          figure: { id: 'fig_1', num: 1, caption: 'Hình 1', src: '' },
        },
      ];
      const onUpdateSection = vi.fn();

      const { result } = renderHook(() =>
        useSectionMediaHandlers(sections, onUpdateSection)
      );

      // 1. Upload via file input
      const uploadFile = new File([new Uint8Array([1, 2, 3])], 'upload.png', { type: 'image/png' });
      act(() => {
        result.current.handleFileInputChange(0, {
          target: { files: [uploadFile], value: 'upload.png' },
        } as unknown as React.ChangeEvent<HTMLInputElement>);
      });

      expect(createSpy).toHaveBeenCalledTimes(1);
      expect(onUpdateSection).toHaveBeenLastCalledWith(
        0,
        expect.objectContaining({
          figure: expect.objectContaining({
            src: 'blob:http://localhost/mock-1',
          }),
        })
      );

      // 2. Drop image file
      const dropFile = new File([new Uint8Array([4, 5, 6])], 'drop.jpg', { type: 'image/jpeg' });
      act(() => {
        result.current.handleDropFigureImage(0, {
          preventDefault: vi.fn(),
          dataTransfer: { files: [dropFile] },
        } as unknown as React.DragEvent);
      });

      expect(createSpy).toHaveBeenCalledTimes(2);
      expect(onUpdateSection).toHaveBeenLastCalledWith(
        0,
        expect.objectContaining({
          figure: expect.objectContaining({
            src: 'blob:http://localhost/mock-2',
          }),
        })
      );

      // 3. Paste image from clipboard
      const pasteFile = new File([new Uint8Array([7, 8, 9])], 'paste.png', { type: 'image/png' });
      act(() => {
        result.current.handlePasteFigureImage(0, {
          preventDefault: vi.fn(),
          clipboardData: {
            items: [
              {
                type: 'image/png',
                getAsFile: () => pasteFile,
              },
            ],
          },
        } as unknown as React.ClipboardEvent);
      });

      expect(createSpy).toHaveBeenCalledTimes(3);
      expect(onUpdateSection).toHaveBeenLastCalledWith(
        0,
        expect.objectContaining({
          figure: expect.objectContaining({
            src: 'blob:http://localhost/mock-3',
          }),
        })
      );

      // Verify none of the emitted src values used heavy data: base64 URIs
      for (const call of onUpdateSection.mock.calls) {
        const updatedSec = call[1] as PaperSection;
        expect(updatedSec.figure?.src.startsWith('blob:')).toBe(true);
        expect(updatedSec.figure?.src.startsWith('data:')).toBe(false);
      }

      // Registry tracking & cleanup
      expect(blobRegistry.getTrackedSessionObjectUrls()).toHaveLength(3);
      blobRegistry.revokeAllTrackedSessionObjectUrls();
      expect(revokeSpy).toHaveBeenCalledTimes(3);
      expect(blobRegistry.getTrackedSessionObjectUrls()).toHaveLength(0);
      expect(cacheSpy).toHaveBeenCalledTimes(3);
    });

    it('attaches assetId in background only when section still holds the same blobUrl', async () => {
      URL.createObjectURL = vi.fn(() => 'blob:http://localhost/mock-bg');
      vi.spyOn(blobRegistry, 'cacheBlobAssetQuietly').mockResolvedValue('sha256-hash-abc');

      const initialSections: PaperSection[] = [
        {
          id: 'sec_fig_1',
          type: 'figure',
          content: 'Hình 1',
          figure: { id: 'fig_1', num: 1, caption: 'Hình 1', src: '' },
        },
      ];
      const latestUpdateSpy = vi.fn();

      const { result, rerender } = renderHook(
        ({ secs }) => useSectionMediaHandlers(secs, (idx, updated) => {
          latestUpdateSpy(idx, updated);
          rerender({ secs: [updated] });
        }),
        { initialProps: { secs: initialSections } }
      );

      const file = new File([new Uint8Array([1, 2, 3])], 'fig.png', { type: 'image/png' });
      act(() => {
        result.current.handleFileInputChange(0, {
          target: { files: [file], value: 'fig.png' },
        } as unknown as React.ChangeEvent<HTMLInputElement>);
      });

      await waitFor(() => {
        expect(latestUpdateSpy).toHaveBeenLastCalledWith(
          0,
          expect.objectContaining({
            figure: expect.objectContaining({
              src: 'blob:http://localhost/mock-bg',
              assetId: 'sha256-hash-abc',
            }),
          })
        );
      });
    });

    it('cancels background assetId attachment when section is deleted while hashing and ignores non-image uploads', async () => {
      URL.createObjectURL = vi.fn(() => 'blob:http://localhost/deleted-sec-blob');
      let resolveHash!: (val: string | null) => void;
      vi.spyOn(blobRegistry, 'cacheBlobAssetQuietly').mockImplementation(
        () =>
          new Promise<string | null>((resolve) => {
            resolveHash = resolve;
          })
      );

      const initialSections: PaperSection[] = [
        {
          id: 'sec_fig_deleted',
          type: 'figure',
          content: 'Deleted fig',
          figure: { id: 'fig_deleted', num: 1, caption: 'Deleted', src: '' },
        },
        {
          id: 'sec_fig_other',
          type: 'figure',
          content: 'Other fig',
          figure: { id: 'fig_other', num: 2, caption: 'Other', src: 'blob:http://localhost/other' },
        },
      ];
      const onUpdateSection = vi.fn();

      const { result, rerender } = renderHook(
        ({ secs }) => useSectionMediaHandlers(secs, onUpdateSection),
        { initialProps: { secs: initialSections } }
      );

      // Non-image upload is ignored safely
      const textFile = new File(['hello'], 'notes.txt', { type: 'text/plain' });
      act(() => {
        result.current.handleFileInputChange(0, {
          target: { files: [textFile], value: 'notes.txt' },
        } as unknown as React.ChangeEvent<HTMLInputElement>);
      });
      expect(onUpdateSection).not.toHaveBeenCalled();

      // Upload image without explicit MIME (e.g. '') succeeds, then delete section before hash resolves
      const imgFile = new File([new Uint8Array([1, 2, 3])], 'image.bin', { type: '' });
      act(() => {
        result.current.handleFileInputChange(0, {
          target: { files: [imgFile], value: 'image.bin' },
        } as unknown as React.ChangeEvent<HTMLInputElement>);
      });
      expect(onUpdateSection).toHaveBeenCalledTimes(1);

      // Delete first section so sec_fig_other shifts to index 0
      rerender({ secs: [initialSections[1]] });

      await act(async () => {
        resolveHash('sha256-late-deleted');
        await Promise.resolve();
      });

      // Must NOT fall back to index 0 (sec_fig_other)
      expect(onUpdateSection).toHaveBeenCalledTimes(1);
    });

    it('computes distinct content SHA-256 hashes over raw blob bytes when crypto.subtle is unavailable', async () => {
      const origCrypto = globalThis.crypto;
      const origIndexedDbDescriptor = Object.getOwnPropertyDescriptor(window, 'indexedDB');
      const saveSpy = vi.fn(async () => {});
      const storage = await import('@structpaper/storage');
      const { computeSha256 } = await import('@structpaper/compiler-client');
      const repoProtoSpy = vi
        .spyOn(storage.IndexedDbAssetRepo.prototype, 'save')
        .mockImplementation(saveSpy);

      Object.defineProperty(globalThis, 'crypto', {
        value: {},
        configurable: true,
      });
      Object.defineProperty(window, 'indexedDB', {
        value: {},
        configurable: true,
      });

      try {
        const bytesA = Uint8Array.from([1, 2, 3, 4]);
        const bytesB = Uint8Array.from([9, 8, 7, 6]);
        const blobA = new Blob([bytesA], { type: 'image/png' });
        const blobB = new Blob([bytesB], { type: 'image/png' });
        const hashA = await blobRegistry.cacheBlobAssetQuietly(blobA);
        const hashB = await blobRegistry.cacheBlobAssetQuietly(blobB);

        expect(hashA).toBe(computeSha256(bytesA));
        expect(hashB).toBe(computeSha256(bytesB));
        expect(hashA).not.toBe(hashB);
        expect(repoProtoSpy).toHaveBeenCalledTimes(2);
      } finally {
        Object.defineProperty(globalThis, 'crypto', {
          value: origCrypto,
          configurable: true,
        });
        if (origIndexedDbDescriptor) {
          Object.defineProperty(window, 'indexedDB', origIndexedDbDescriptor);
        } else {
          delete (window as unknown as Record<string, unknown>).indexedDB;
        }
      }
    });
  });

  describe('3. FigureSectionItem lazy loading & one-shot assetId recovery', () => {
    it('renders loading="lazy" and decoding="async" on <img> and recovers once via assetId onError', async () => {
      const hydrateSpy = vi
        .spyOn(blobRegistry, 'hydrateFigureAssetById')
        .mockResolvedValue('blob:http://localhost/recovered-url');

      const sec: PaperSection = {
        id: 'sec_fig',
        type: 'figure',
        content: 'Hình 1',
        figure: {
          id: 'fig_1',
          num: 1,
          caption: 'Hình 1: Kiến trúc',
          src: 'blob:http://localhost/stale-url',
          assetId: 'sha256-asset-1',
        },
      };
      const onUpdateSection = vi.fn();

      render(
        <FigureSectionItem
          sec={sec}
          idx={0}
          setFileInputRef={vi.fn()}
          onUpdateSection={onUpdateSection}
          onOpenLightbox={vi.fn()}
          onDetachFigureSource={vi.fn()}
          onPasteFigureImage={vi.fn()}
          onDropFigureImage={vi.fn()}
          onFileInputChange={vi.fn()}
          onPasteImageFromClipboardButton={vi.fn()}
          onTriggerFileInput={vi.fn()}
        />
      );

      const img = screen.getByRole('img', { name: 'Hình 1: Kiến trúc' });
      expect(img.getAttribute('loading')).toBe('lazy');
      expect(img.getAttribute('decoding')).toBe('async');

      // Fire error twice — hydrate must only be invoked once (no infinite loop)
      fireEvent.error(img);
      fireEvent.error(img);

      await waitFor(() => {
        expect(hydrateSpy).toHaveBeenCalledTimes(1);
        expect(hydrateSpy).toHaveBeenCalledWith('sha256-asset-1');
        expect(onUpdateSection).toHaveBeenCalledWith(
          0,
          expect.objectContaining({
            figure: expect.objectContaining({
              src: 'blob:http://localhost/recovered-url',
            }),
          })
        );
      });
    });

    it('revokes stale hydrated blob URL immediately if figure src changes mid-flight', async () => {
      const revokeSpy = vi.fn();
      URL.createObjectURL = vi.fn(() => 'blob:http://localhost/hydrated-stale-midflight');
      URL.revokeObjectURL = revokeSpy;

      let resolveHydration!: (url: string | null) => void;
      vi.spyOn(blobRegistry, 'hydrateFigureAssetById').mockImplementation(
        () =>
          new Promise<string | null>((resolve) => {
            resolveHydration = resolve;
          })
      );

      const secA: PaperSection = {
        id: 'sec_fig',
        type: 'figure',
        content: 'Hình 1',
        figure: {
          id: 'fig_1',
          num: 1,
          caption: 'Hình stale',
          src: 'blob:http://localhost/errored-src-a',
          assetId: 'sha256-stale',
        },
      };
      const secB: PaperSection = {
        ...secA,
        figure: {
          ...secA.figure!,
          src: 'blob:http://localhost/newer-src-b',
        },
      };
      const onUpdateSection = vi.fn();

      const { rerender } = render(
        <FigureSectionItem
          sec={secA}
          idx={0}
          setFileInputRef={vi.fn()}
          onUpdateSection={onUpdateSection}
          onOpenLightbox={vi.fn()}
          onDetachFigureSource={vi.fn()}
          onPasteFigureImage={vi.fn()}
          onDropFigureImage={vi.fn()}
          onFileInputChange={vi.fn()}
          onPasteImageFromClipboardButton={vi.fn()}
          onTriggerFileInput={vi.fn()}
        />
      );

      fireEvent.error(screen.getByRole('img', { name: 'Hình stale' }));

      // Src changes while hydration is in-flight
      rerender(
        <FigureSectionItem
          sec={secB}
          idx={0}
          setFileInputRef={vi.fn()}
          onUpdateSection={onUpdateSection}
          onOpenLightbox={vi.fn()}
          onDetachFigureSource={vi.fn()}
          onPasteFigureImage={vi.fn()}
          onDropFigureImage={vi.fn()}
          onFileInputChange={vi.fn()}
          onPasteImageFromClipboardButton={vi.fn()}
          onTriggerFileInput={vi.fn()}
        />
      );

      const createdUrl = blobRegistry.createSessionImageObjectUrl(
        new Blob([Uint8Array.from([1, 2, 3])], { type: 'image/png' })
      );
      expect(createdUrl).toBe('blob:http://localhost/hydrated-stale-midflight');

      await act(async () => {
        resolveHydration(createdUrl);
        await Promise.resolve();
      });

      expect(revokeSpy).toHaveBeenCalledWith('blob:http://localhost/hydrated-stale-midflight');
      expect(blobRegistry.getTrackedSessionObjectUrls()).toHaveLength(0);
      expect(onUpdateSection).not.toHaveBeenCalled();
    });
  });

  describe('4. TableSectionItem & TablePreviewGrid row capping', () => {
    it('renders all rows and NO truncation banner when table has <= 10 rows', () => {
      const table = makeTable(10);
      const sec: PaperSection = {
        id: 'sec_tbl_10',
        type: 'table',
        content: table.caption,
        table,
      };

      const { container } = render(
        <TableSectionItem
          sec={sec}
          idx={0}
          onUpdateSection={vi.fn()}
          onOpenTableZoom={vi.fn()}
          onPasteTableData={vi.fn()}
          onPasteTableFromClipboardButton={vi.fn()}
        />
      );

      expect(container.querySelectorAll('tbody tr')).toHaveLength(10);
      expect(screen.queryByText(/Đang hiển thị/i)).toBeNull();
      expect(screen.queryByRole('button', { name: /Mở bảng tính/i })).toBeNull();
      expect(screen.getByText('10 hàng × 3 cột')).toBeDefined();
    });

    it('caps inline preview at 10 rows for a 25-row table, preserves 25-row footer count, and triggers onOpenSpreadsheet', () => {
      expect(TABLE_PREVIEW_MAX_ROWS).toBe(10);

      const table = makeTable(25);
      const sec: PaperSection = {
        id: 'sec_tbl_25',
        type: 'table',
        content: table.caption,
        table,
      };
      const onOpenTableZoom = vi.fn();

      const { container } = render(
        <TableSectionItem
          sec={sec}
          idx={2}
          onUpdateSection={vi.fn()}
          onOpenTableZoom={onOpenTableZoom}
          onPasteTableData={vi.fn()}
          onPasteTableFromClipboardButton={vi.fn()}
        />
      );

      // Only 10 rows rendered in DOM
      expect(container.querySelectorAll('tbody tr')).toHaveLength(10);

      // Truncation banner shows 10 / 25 and 15 remaining
      const banner = screen.getByText(/Đang hiển thị 10 \/ 25 hàng — còn 15 hàng nữa/);
      expect(banner).toBeDefined();

      // Card footer still reports full 25 rows
      expect(screen.getByText('25 hàng × 3 cột')).toBeDefined();

      // Clicking expand button triggers onOpenTableZoom (via onOpenSpreadsheet)
      const openBtn = screen.getByRole('button', { name: /Mở bảng tính \(25 hàng\)/ });
      fireEvent.click(openBtn);
      expect(onOpenTableZoom).toHaveBeenCalledTimes(1);
      expect(onOpenTableZoom).toHaveBeenCalledWith(2, table);
    });

    it('caps structured bodyRows tables at 10 rows in TablePreviewGrid and invokes onOpenSpreadsheet(idx)', () => {
      const table = makeTable(25, true);
      const normalized = normalizePaperTable(table);
      const onOpenSpreadsheet = vi.fn();

      const { container } = render(
        <TablePreviewGrid
          table={table}
          normalizedTable={normalized}
          idx={4}
          onOpenSpreadsheet={onOpenSpreadsheet}
        />
      );

      expect(container.querySelectorAll('tbody tr')).toHaveLength(10);
      expect(screen.getByText(/Đang hiển thị 10 \/ 25 hàng — còn 15 hàng nữa/)).toBeDefined();

      fireEvent.click(screen.getByRole('button', { name: /Mở bảng tính \(25 hàng\)/ }));
      expect(onOpenSpreadsheet).toHaveBeenCalledTimes(1);
      expect(onOpenSpreadsheet).toHaveBeenCalledWith(4);
    });

    it('guards safely when table.rows or table.headers are undefined', () => {
      const malformedTable = {
        id: 'tbl-malformed',
        num: 1,
        caption: 'Bảng thiếu rows',
        headers: ['Cột A', 'Cột B'],
        rows: undefined as unknown as string[][],
      } as PaperTable;

      render(
        <TableSectionItem
          sec={{
            id: 'sec_tbl_malformed',
            type: 'table',
            content: malformedTable.caption,
            table: malformedTable,
          }}
          idx={0}
          onUpdateSection={vi.fn()}
          onOpenTableZoom={vi.fn()}
          onPasteTableData={vi.fn()}
          onPasteTableFromClipboardButton={vi.fn()}
        />
      );

      expect(screen.getByText('0 hàng × 2 cột')).toBeDefined();
    });
  });
});
