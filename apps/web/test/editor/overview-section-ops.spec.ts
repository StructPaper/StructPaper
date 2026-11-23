import { describe, it, expect } from 'vitest';
import type { PaperSection } from '@/types/paper';
import { applyFigureLookIn, applyTableLookIn, setColWeightsIn, setRowHeightIn, updateTableIn } from '@/features/editor/overview/overview-section-ops';

const table = (id: string, extra: object = {}): PaperSection => ({
  id,
  type: 'table',
  content: '',
  table: { id: `t-${id}`, num: 1, caption: id, headers: ['A', 'B'], rows: [['1', '2'], ['3', '4'], ['5', '6']], ...extra },
});
const figure = (id: string, extra: object = {}): PaperSection => ({ id, type: 'figure', content: '', figure: { id: `f-${id}`, num: 1, caption: id, src: 'x', ...extra } });

describe('what the overview page does to the sections', () => {
  it('changes one table and leaves the other sections as they are', () => {
    const s = [table('a'), table('b')];
    const out = updateTableIn(s, 'a', { borderStyle: 'grid' });
    expect(out[0].table!.borderStyle).toBe('grid');
    expect(out[1]).toBe(s[1]);
  });

  it('copies a table look to every other table, replacing what they had', () => {
    const s = [table('a', { borderStyle: 'grid', borderColor: '#112233', fontSize: '9pt', caption: 'keep' }), table('b', { borderStyle: 'none', headerFill: '#FF0000' }), figure('f')];
    const out = applyTableLookIn(s, 'a');
    expect(out[1].table).toMatchObject({ borderStyle: 'grid', borderColor: '#112233', fontSize: '9pt', caption: 'b' });
    expect(out[1].table!.headerFill).toBeUndefined(); // a's look had none, so b's own is gone: the looks match
    expect(out[0]).toBe(s[0]);
    expect(out[2]).toBe(s[2]);
  });

  it('copies a figure layout to every other figure', () => {
    const s = [figure('a', { scalePercent: 70, alignment: 'left', columnSpan: '1-column', caption: 'keep' }), figure('b', { scalePercent: 100, hasBorder: false })];
    const out = applyFigureLookIn(s, 'a');
    expect(out[1].figure).toMatchObject({ scalePercent: 70, alignment: 'left', columnSpan: '1-column', caption: 'b', src: 'x' });
  });

  it('sets, changes and clears the least height of a row', () => {
    let s = [table('a')];
    s = setRowHeightIn(s, 'a', 'body', 1, 24);
    expect(s[0].table!.rowHeights).toEqual([null, 24, null]);
    s = setRowHeightIn(s, 'a', 'body', 0, 18);
    expect(s[0].table!.rowHeights).toEqual([18, 24, null]);
    const same = setRowHeightIn(s, 'a', 'body', 0, 18);
    expect(same).toBe(s); // nothing changed: nothing is saved
    s = setRowHeightIn(s, 'a', 'body', 0, null);
    s = setRowHeightIn(s, 'a', 'body', 1, null);
    expect(s[0].table!.rowHeights).toBeUndefined();
    s = setRowHeightIn(s, 'a', 'head', 0, 20);
    expect(s[0].table!.headerHeight).toBe(20);
    s = setRowHeightIn(s, 'a', 'head', 0, null);
    expect(s[0].table!.headerHeight).toBeUndefined();
  });

  it('sets column shares', () => {
    const out = setColWeightsIn([table('a')], 'a', [0.3, 0.7]);
    expect(out[0].table!.colWeights).toEqual([0.3, 0.7]);
  });
});
