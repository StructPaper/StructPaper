import { describe, it, expect, vi } from 'vitest';
import { analyzeSource, commitAnalysis, flushPendingSource, registerPendingSource, hasPendingSource } from '@/lib/documents/word-source';
import { IMPORTER_VERSION } from '@/lib/docx-importer-version';
import { applyMerge, suggestedSelection, slimForStorage } from '@/lib/import-merge/three-way';

const sec = (id: string, content: string) => ({ id, type: 'paragraph', content });
const paper = (id: string, sections: any[]): any => ({ id, metadata: { title: 'T', abstract: 'A', keywords: ['k'] }, sections, references: [] });
const TEXT = 'Nội dung đoạn văn đủ dài để so sánh được với nhau trong bài báo khoa học';

function fakeApi(over: Record<string, any> = {}) {
  return {
    getSourceFile: vi.fn().mockResolvedValue(new Blob([new Uint8Array([0x50, 0x4b])])),
    getSourceBaseline: vi.fn().mockResolvedValue(null),
    putSourceFile: vi.fn().mockResolvedValue({}),
    putSourceBaseline: vi.fn().mockResolvedValue({}),
    ...over,
  } as any;
}

describe('word source: read again on request', () => {
  it('reads the stored file with the current importer and compares three sides', async () => {
    const original = paper('p', [sec('s_1', TEXT), sec('s_2', TEXT + ' hai')]);
    const baseline = slimForStorage(original);
    const edited = paper('uuid', [sec('s_1', 'Tác giả sửa tay đoạn đầu hoàn toàn khác'), sec('s_2', TEXT + ' hai')]);
    const api = fakeApi({ getSourceBaseline: vi.fn().mockResolvedValue(baseline) });
    // the improved importer now reads the second paragraph differently
    const parse = vi.fn().mockResolvedValue(paper('x', [sec('s_1', TEXT), sec('s_2', TEXT + ' hai, đã cải tiến')]));

    const a = await analyzeSource(api, edited, parse, { stored: { fileName: 'a.docx' } as any });
    expect(api.getSourceFile).toHaveBeenCalledWith('uuid');
    expect(a.isNewFile).toBe(false);
    expect(a.plan.conservative).toBe(false);
    expect(a.plan.proposals.map((p) => [p.id, p.conflict, p.accept])).toEqual([['block:s_2', false, true]]);
    const merged = applyMerge(edited, a.plan, suggestedSelection(a.plan));
    expect(merged.sections![0].content).toBe('Tác giả sửa tay đoạn đầu hoàn toàn khác');
    expect(merged.sections![1].content).toContain('đã cải tiến');

    await commitAnalysis(api, 'uuid', a);
    expect(api.putSourceBaseline).toHaveBeenCalledWith('uuid', a.plan.newBaseline, IMPORTER_VERSION);
    expect(api.putSourceFile).not.toHaveBeenCalled(); // same file: only the first reading moves on
  });

  it('a replacement file is compared with the old reading and stored when applied', async () => {
    const original = paper('p', [sec('s_1', TEXT)]);
    const api = fakeApi({ getSourceBaseline: vi.fn().mockResolvedValue(slimForStorage(original)) });
    const file = new File([new Uint8Array([0x50, 0x4b, 3, 4])], 'moi.docx');
    const parse = vi.fn().mockResolvedValue(paper('x', [sec('s_1', TEXT + ' (sửa trong Word)')]));

    const a = await analyzeSource(api, paper('uuid', [sec('s_1', TEXT)]), parse, { file });
    expect(api.getSourceFile).not.toHaveBeenCalled();
    expect(a.isNewFile).toBe(true);
    await commitAnalysis(api, 'uuid', a);
    expect(api.putSourceFile).toHaveBeenCalledWith('uuid', expect.any(Blob), expect.objectContaining({ fileName: 'moi.docx', importerVersion: IMPORTER_VERSION }));
    expect(api.putSourceBaseline).toHaveBeenCalled();
  });

  it('an older paper with no first reading: nothing ticked', async () => {
    const api = fakeApi();
    const file = new File([new Uint8Array([0x50, 0x4b])], 'cu.docx');
    const parse = vi.fn().mockResolvedValue(paper('x', [sec('s_1', TEXT + ' khác')]));
    const a = await analyzeSource(api, paper('uuid', [sec('s_1', TEXT)]), parse, { file });
    expect(a.plan.conservative).toBe(true);
    expect(a.plan.proposals.length).toBeGreaterThan(0);
    expect(suggestedSelection(a.plan).size).toBe(0);
  });

  it('a file read at import goes up once the paper has a server id, and a failure never throws', async () => {
    const parsed = paper('paper_1', [sec('s_1', TEXT)]);
    registerPendingSource('paper_1', new Uint8Array([0x50, 0x4b, 3, 4]).buffer, 'goc.docx', parsed);
    expect(hasPendingSource('paper_1')).toBe(true);
    const bad = fakeApi({ putSourceFile: vi.fn().mockRejectedValue(new Error('offline')) });
    await expect(flushPendingSource('paper_1', 'uuid', bad)).resolves.toBe(false);
    expect(hasPendingSource('paper_1')).toBe(true); // kept for a retry
    const ok = fakeApi();
    await expect(flushPendingSource('paper_1', 'uuid', ok)).resolves.toBe(true);
    expect(ok.putSourceFile).toHaveBeenCalledWith('uuid', expect.any(Blob), expect.objectContaining({ fileName: 'goc.docx', sha256: expect.stringMatching(/^[0-9a-f]{64}$/), importerVersion: IMPORTER_VERSION }));
    expect(ok.putSourceBaseline).toHaveBeenCalledWith('uuid', expect.objectContaining({ sections: expect.any(Array) }), IMPORTER_VERSION);
    expect(hasPendingSource('paper_1')).toBe(false);
  });
});
