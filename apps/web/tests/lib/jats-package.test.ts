import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { createEmptyPaper, normalizeCompletePaper } from '@/types/paper';
import { buildJatsPackage, jatsReadinessWarnings } from '@/lib/jats-package';
import { figureHref, listJatsFigures } from '@/lib/jats-export';

// 1x1 transparent PNG
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

const paperOf = (pub: Record<string, string> = { volume: '', issue: '' }, journalId = 'VNUHCM-HS') => {
  const p = createEmptyPaper(journalId);
  p.metadata.title = 'Thử';
  (p.metadata as any).publication = { ...pub };
  p.sections = [
    { id: 'f1', type: 'figure', content: '', figure: { src: PNG, caption: 'Hình 1. Một', num: 1 } },
    { id: 'f2', type: 'figure', content: '', figure: { src: 'https://example.com/x.png', caption: 'Hai', num: 2 } },
    { id: 'f3', type: 'figure', content: '', figure: { src: PNG, caption: 'Ba' } },
  ] as any;
  return normalizeCompletePaper(p);
};

const open = async (paper: ReturnType<typeof paperOf>) => {
  const pkg = await buildJatsPackage(paper, 'Bai-thu');
  return { pkg, zip: await JSZip.loadAsync(pkg.blob) };
};

describe('XML package follows the platform convention', () => {
  it('numbers figures as the XML does (own number, else order)', () => {
    expect(listJatsFigures(paperOf()).map((f) => f.num)).toEqual([1, 2, 3]);
  });

  it('with volume, issue and article id: <id>.xml and images under articles/<journal>/v-/i-/a-', async () => {
    const paper = paperOf({ articleId: '1234', volume: '9', issue: '2' });
    const { pkg, zip } = await open(paper);
    expect(pkg.xmlName).toBe('1234.xml');
    expect(Object.keys(zip.files)).toContain('articles/hs/v-9/i-2/a-1234/img-1.png');
    expect(Object.keys(zip.files)).toContain('articles/hs/v-9/i-2/a-1234/img-3.png');
    const xml = await zip.file('1234.xml')!.async('string');
    expect(xml).toContain('https://static.vnuhcmjournal.com.vn/articles/hs/v-9/i-2/a-1234/img-1.png');
    // the address in the XML is the folder that was packed
    expect(figureHref(paper, 1, PNG, {})).toBe('https://static.vnuhcmjournal.com.vn/articles/hs/v-9/i-2/a-1234/img-1.png');
  });

  it('without them: images/ relative paths, a name from the document and warnings', async () => {
    const { pkg, zip } = await open(paperOf());
    expect(pkg.xmlName).toBe('Bai-thu.xml');
    expect(Object.keys(zip.files)).toContain('images/img-1.png');
    const xml = await zip.file('Bai-thu.xml')!.async('string');
    expect(xml).toContain('xlink:href="images/img-1.png"');
    expect(jatsReadinessWarnings(paperOf()).length).toBe(3);
  });

  it('a remote image is not packed and the editor is told', async () => {
    const { pkg, zip } = await open(paperOf({ articleId: '1', volume: '1', issue: '1' }));
    expect(Object.keys(zip.files).some((f) => f.includes('img-2.'))).toBe(false);
    expect(pkg.warnings.some((w) => w.startsWith('Hình 2'))).toBe(true);
  });
});
