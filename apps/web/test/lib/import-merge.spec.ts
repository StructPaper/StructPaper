import { describe, it, expect } from 'vitest';
import { alignBlocks, applyMerge, fingerprint, planMerge, slimForStorage, suggestedSelection, type PaperLike } from '@/lib/import-merge/three-way';

const p = (id: string, content: string, extra: Record<string, unknown> = {}) => ({ id, type: 'paragraph', content, ...extra });
const h = (id: string, title: string) => ({ id, type: 'h1', title, content: title });
const paper = (sections: any[], metadata: Record<string, unknown> = {}, extra: Record<string, unknown> = {}): PaperLike => ({
  metadata: { title: 'Tiêu đề', abstract: 'Tóm tắt gốc', keywords: ['a'], ...metadata },
  sections,
  references: [{ id: 1, raw: 'Ref 1' }],
  layoutSettings: { columnLayout: 'two' },
  ...extra,
});
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));

const LONG_A = 'Nghiên cứu này khảo sát ảnh hưởng của nhiệt độ lên tốc độ phản ứng trong dung dịch nước';
const LONG_B = 'Kết quả cho thấy tốc độ phản ứng tăng gấp đôi khi nhiệt độ tăng mười độ';
const LONG_C = 'Chúng tôi kết luận rằng mô hình phù hợp với số liệu thực nghiệm đã thu thập';

describe('alignBlocks', () => {
  it('pairs identical blocks even when ids shift', () => {
    const a = [h('s_1', 'Mở đầu'), p('s_2', LONG_A), p('s_3', LONG_B)];
    const b = [h('s_1', 'Mở đầu'), p('s_2', 'Đoạn chèn thêm rất khác biệt hoàn toàn'), p('s_3', LONG_A), p('s_4', LONG_B)];
    expect(alignBlocks(a, b)).toEqual([[0, 0], [1, 2], [2, 3]]);
  });

  it('pairs a paragraph whose words changed a little, and not two unrelated ones', () => {
    const a = [p('s_1', LONG_A)];
    expect(alignBlocks(a, [p('s_1', LONG_A.replace('nhiệt độ', 'áp suất'))])).toEqual([[0, 0]]);
    expect(alignBlocks(a, [p('s_1', LONG_C)])).toEqual([]);
  });
});

describe('planMerge', () => {
  const base = paper([h('s_1', 'Mở đầu'), p('s_2', LONG_A), p('s_3', LONG_B)]);

  it('has nothing to propose when the file reads the same', () => {
    const plan = planMerge(base, clone(base), clone(base));
    expect(plan.isEmpty).toBe(true);
  });

  it('proposes, ticked, what the file now says where the author changed nothing', () => {
    const theirs = paper([h('s_1', 'Mở đầu'), p('s_2', LONG_A.replace('nhiệt độ', 'áp suất')), p('s_3', LONG_B)]);
    const plan = planMerge(base, clone(base), theirs);
    expect(plan.proposals).toHaveLength(1);
    const [only] = plan.proposals;
    expect(only).toMatchObject({ id: 'block:s_2', kind: 'modified', conflict: false, accept: true });
    expect(only.inline.filter((x) => x.type === 'add').map((x) => x.text).join('')).toContain('suất');
    expect(only.inline.filter((x) => x.type === 'del').map((x) => x.text).join('')).toContain('nhiệt');
  });

  it('keeps the author hand edit: a conflict that is not ticked', () => {
    const ours = clone(base);
    ours.sections![1].content = 'Đoạn đã được tác giả viết lại bằng tay';
    const theirs = paper([h('s_1', 'Mở đầu'), p('s_2', LONG_A + ' (đã sửa trong Word)'), p('s_3', LONG_B)]);
    const plan = planMerge(base, ours, theirs);
    expect(plan.proposals).toHaveLength(1);
    expect(plan.proposals[0]).toMatchObject({ id: 'block:s_2', conflict: true, accept: false });
    // nothing ticked: applying the suggestion leaves the hand edit
    const kept = applyMerge(ours, plan, suggestedSelection(plan));
    expect(kept.sections![1].content).toBe('Đoạn đã được tác giả viết lại bằng tay');
    // ticking it takes the file's text
    const taken = applyMerge(ours, plan, new Set(['block:s_2']));
    expect(taken.sections![1].content).toBe(LONG_A + ' (đã sửa trong Word)');
  });

  it('does not propose what the author did and the file did not change', () => {
    const ours = clone(base);
    ours.sections![2].content = 'Tác giả sửa đoạn này';
    const plan = planMerge(base, ours, clone(base));
    expect(plan.isEmpty).toBe(true);
  });

  it('does not propose a block the author already made the same as the file', () => {
    const ours = clone(base);
    ours.sections![1].content = LONG_A + '!';
    const theirs = paper([h('s_1', 'Mở đầu'), p('s_2', LONG_A + '!'), p('s_3', LONG_B)]);
    expect(planMerge(base, ours, theirs).isEmpty).toBe(true);
  });

  it('adds new blocks of the file after their neighbour, ticked, with an id the paper does not use', () => {
    const ours = clone(base);
    ours.sections!.push(p('s_9', 'Đoạn tác giả tự thêm'));
    const theirs = paper([h('s_1', 'Mở đầu'), p('s_2', LONG_A), p('s_3', LONG_B), p('s_4', LONG_C)]);
    const plan = planMerge(base, ours, theirs);
    const add = plan.proposals.find((x) => x.kind === 'added')!;
    expect(add.accept).toBe(true);
    expect(['s_1', 's_2', 's_3', 's_9']).not.toContain(add.theirsBlock!.id);
    const merged = applyMerge(ours, plan, suggestedSelection(plan));
    expect(merged.sections!.map((s) => s.content ?? s.title)).toEqual(['Mở đầu', LONG_A, LONG_B, LONG_C, 'Đoạn tác giả tự thêm']);
    // the author's own block is never touched or proposed for removal
    expect(plan.proposals.find((x) => x.id === 'block:s_9')).toBeUndefined();
  });

  it('proposes removing a block the file dropped (ticked if untouched, conflict if edited)', () => {
    const theirs = paper([h('s_1', 'Mở đầu'), p('s_2', LONG_B)]);
    const clean = planMerge(base, clone(base), theirs);
    expect(clean.proposals).toHaveLength(1);
    expect(clean.proposals[0]).toMatchObject({ kind: 'removed', conflict: false, accept: true });
    expect(applyMerge(base, clean, suggestedSelection(clean)).sections!.map((s) => s.id)).toEqual(['s_1', 's_3']);

    const ours = clone(base);
    ours.sections![1].content = LONG_A + ' sửa tay';
    const hard = planMerge(base, ours, theirs);
    expect(hard.proposals[0]).toMatchObject({ kind: 'removed', conflict: true, accept: false });
    expect(applyMerge(ours, hard, suggestedSelection(hard)).sections).toHaveLength(3);
  });

  it('leaves a block the author deleted deleted', () => {
    const ours = clone(base);
    ours.sections!.splice(1, 1);
    const theirs = paper([h('s_1', 'Mở đầu'), p('s_2', LONG_A + ' đổi'), p('s_3', LONG_B)]);
    const plan = planMerge(base, ours, theirs);
    expect(plan.isEmpty).toBe(true);
  });

  it('never takes layout: block settings, table settings and the paper layout stay', () => {
    const table = (caption: string, extra: Record<string, unknown> = {}) => ({
      id: 's_4',
      type: 'table',
      content: '',
      table: { id: 'tab_1', num: 1, caption, headers: ['A', 'B'], rows: [['1', '2']], ...extra },
    });
    const b = paper([h('s_1', 'Mở đầu'), table('Bảng cũ')]);
    const ours = clone(b);
    Object.assign(ours.sections![1], { pageLayout: { startNewPage: true, columns: 1 }, pageBreakAfter: true });
    Object.assign(ours.sections![1].table, { isRotated: true, fontSize: '8pt', hasZebraStripes: true });
    (ours as any).layoutSettings = { columnLayout: 'single', fontSize: '11pt' };

    const theirs = paper([h('s_1', 'Mở đầu'), table('Bảng mới', { rows: [['1', '3']] })], {}, { layoutSettings: { columnLayout: 'two' } });
    const plan = planMerge(b, ours, theirs);
    // settings are not content: the table counts as untouched by the author, so the file's content is proposed ticked
    expect(plan.proposals).toHaveLength(1);
    expect(plan.proposals[0]).toMatchObject({ kind: 'modified', conflict: false, accept: true, fields: ['table'] });

    const merged = applyMerge(ours, plan, suggestedSelection(plan));
    const t = merged.sections![1];
    expect(t.table.caption).toBe('Bảng mới');
    expect(t.table.rows).toEqual([['1', '3']]);
    expect(t.table).toMatchObject({ id: 'tab_1', isRotated: true, fontSize: '8pt', hasZebraStripes: true });
    expect(t.pageLayout).toEqual({ startNewPage: true, columns: 1 });
    expect(t.pageBreakAfter).toBe(true);
    expect(merged.layoutSettings).toEqual({ columnLayout: 'single', fontSize: '11pt' });
  });

  it('a layout-only difference is not a content change', () => {
    const b = paper([p('s_1', LONG_A)]);
    const theirs = paper([p('s_1', LONG_A, { pageBreakAfter: true })]);
    expect(planMerge(b, clone(b), theirs).isEmpty).toBe(true);
  });

  it('compares pictures by content, not by data URL identity of the object', () => {
    const fig = (src: string, caption = 'Hình') => ({ id: 's_2', type: 'figure', content: '', figure: { id: 'fig_1', num: 1, caption, src, scalePercent: 100 } });
    const b = paper([fig('data:image/png;base64,AAAA')]);
    const ours = clone(b);
    ours.sections![0].figure.scalePercent = 60;
    const same = planMerge(slimForStorage(b), ours, paper([fig('data:image/png;base64,AAAA')]));
    expect(same.isEmpty).toBe(true);
    const swapped = planMerge(slimForStorage(b), ours, paper([fig('data:image/png;base64,BBBB')]));
    expect(swapped.proposals[0]).toMatchObject({ kind: 'modified', conflict: false, fields: ['figure'] });
    const merged = applyMerge(ours, swapped, suggestedSelection(swapped));
    expect(merged.sections![0].figure.src).toBe('data:image/png;base64,BBBB');
    expect(merged.sections![0].figure.scalePercent).toBe(60);
    expect(fingerprint('x')).toBe(fingerprint('x'));
  });

  it('metadata, authors and references are proposed as units; a hand edited one is a conflict', () => {
    const b = paper([p('s_1', LONG_A)], { authors: [{ id: 'a_1', name: 'An', affiliationIds: [1] }], affiliations: [{ id: 1, name: 'ĐH A' }] });
    const ours = clone(b);
    ours.metadata!.abstract = 'Tóm tắt tác giả sửa tay';
    const theirs = clone(b);
    theirs.metadata!.title = 'Tiêu đề mới từ Word';
    theirs.metadata!.abstract = 'Tóm tắt đổi trong Word';
    theirs.metadata!.authors = [{ id: 'a_1', name: 'An', affiliationIds: [1] }, { id: 'a_2', name: 'Bình', affiliationIds: [1] }];
    theirs.references = [{ id: 1, raw: 'Ref 1' }, { id: 2, raw: 'Ref 2' }];
    const plan = planMerge(b, ours, theirs);
    const by = Object.fromEntries(plan.proposals.map((x) => [x.id, x]));
    expect(by['field:title']).toMatchObject({ conflict: false, accept: true });
    expect(by['field:abstract']).toMatchObject({ conflict: true, accept: false });
    expect(by['authors']).toMatchObject({ conflict: false, accept: true });
    expect(by['references']).toMatchObject({ conflict: false, accept: true });

    const merged = applyMerge(ours, plan, suggestedSelection(plan));
    expect(merged.metadata!.title).toBe('Tiêu đề mới từ Word');
    expect(merged.metadata!.abstract).toBe('Tóm tắt tác giả sửa tay');
    expect((merged.metadata!.authors as any[]).map((a) => a.name)).toEqual(['An', 'Bình']);
    expect(merged.references).toHaveLength(2);
  });

  it('only applies what was accepted, and never touches ours itself', () => {
    const theirs = paper([h('s_1', 'Mở đầu mới'), p('s_2', LONG_A + ' đổi'), p('s_3', LONG_B)]);
    const ours = clone(base);
    const snapshot = clone(ours);
    const plan = planMerge(base, ours, theirs);
    expect(plan.proposals).toHaveLength(2);
    const merged = applyMerge(ours, plan, new Set(['block:s_2']));
    expect(merged.sections![0].title).toBe('Mở đầu');
    expect(merged.sections![1].content).toBe(LONG_A + ' đổi');
    expect(ours).toEqual(snapshot);
  });

  it('without a first reading nothing is ticked and everything is a conflict', () => {
    const ours = clone(base);
    ours.sections![1].content = 'Khác';
    const theirs = clone(base);
    const plan = planMerge(ours, ours, theirs, { conservative: true });
    expect(plan.conservative).toBe(true);
    expect(plan.proposals.length).toBeGreaterThan(0);
    expect(plan.proposals.every((x) => x.conflict && !x.accept)).toBe(true);
    expect(applyMerge(ours, plan, suggestedSelection(plan))).toEqual(ours);
  });

  it('the new first reading carries the ids the paper uses, so the next reading lines up', () => {
    const theirs = paper([h('t_1', 'Mở đầu'), p('t_2', LONG_A + ' đổi'), p('t_3', LONG_B)]);
    const ours = clone(base);
    const plan = planMerge(base, ours, theirs);
    expect(plan.newBaseline.sections!.map((s) => s.id)).toEqual(['s_1', 's_2', 's_3']);

    // accept, then read again with an even newer file: the accepted block counts as untouched
    const merged = applyMerge(ours, plan, suggestedSelection(plan));
    const again = paper([h('t_1', 'Mở đầu'), p('t_2', LONG_A + ' đổi lần nữa'), p('t_3', LONG_B)]);
    const plan2 = planMerge(plan.newBaseline, merged, again);
    expect(plan2.proposals).toHaveLength(1);
    expect(plan2.proposals[0]).toMatchObject({ id: 'block:s_2', conflict: false, accept: true });
  });

  describe('includeEdits: where the paper differs from a file that did not change', () => {
    const ours = () => {
      const o = clone(base);
      o.sections![1].content = 'Tác giả viết lại đoạn này bằng tay';
      o.metadata!.abstract = 'Tóm tắt sửa tay';
      o.sections!.splice(2, 1); // deleted the last block
      return o;
    };

    it('is not listed by default', () => {
      expect(planMerge(base, ours(), clone(base)).isEmpty).toBe(true);
    });

    it('is listed, never ticked, when asked; ticking takes the file back', () => {
      const o = ours();
      const plan = planMerge(base, o, clone(base), { includeEdits: true });
      expect(plan.includeEdits).toBe(true);
      const by = Object.fromEntries(plan.proposals.map((x) => [x.id, x]));
      expect(by['field:abstract']).toMatchObject({ conflict: true, accept: false, note: expect.stringContaining('file không đổi') });
      expect(by['block:s_2']).toMatchObject({ kind: 'modified', conflict: true, accept: false });
      const restored = plan.proposals.find((x) => x.kind === 'added')!;
      expect(restored).toMatchObject({ accept: false, note: expect.stringContaining('xóa') });
      expect(suggestedSelection(plan).size).toBe(0);

      const back = applyMerge(o, plan, new Set(plan.proposals.map((x) => x.id)));
      expect(back.metadata!.abstract).toBe('Tóm tắt gốc');
      expect(back.sections!.map((s) => s.content ?? s.title)).toEqual(['Mở đầu', LONG_A, LONG_B]);
    });

    it('is empty when the paper is exactly the file', () => {
      expect(planMerge(base, clone(base), clone(base), { includeEdits: true }).isEmpty).toBe(true);
    });
  });
});
