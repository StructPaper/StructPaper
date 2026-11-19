import { describe, it, expect } from 'vitest';
import { groupRevisions, statChips, revisionTitle, dayLabel, SESSION_GAP_MS } from '@/features/history/lib/group-revisions';

const NOW = new Date(2026, 10, 19, 15, 0, 0);
const at = (day: number, h: number, m: number) => new Date(2026, 10, day, h, m).toISOString();
const rev = (id: string, kind: string, when: string, author = 'u1', extra: Record<string, any> = {}): any => ({
  id,
  manuscriptId: 'm',
  kind,
  name: null,
  description: null,
  pinned: kind === 'named',
  createdAt: when,
  author: { id: author, displayName: author },
  stats: { blocksAdded: 0, blocksRemoved: 0, blocksModified: 0, blocksMoved: 0, wordsDelta: 0, refsDelta: 0, fieldsChanged: 0, itemsChanged: 0, layoutChanged: false },
  sizeBytes: 1,
  ...extra,
});

describe('grouping the history', () => {
  it('groups by day, newest first, with friendly labels', () => {
    const groups = groupRevisions([rev('a', 'auto', at(19, 14, 0)), rev('b', 'auto', at(18, 10, 0)), rev('c', 'auto', at(10, 9, 0))], NOW);
    expect(groups.map((g) => g.label)).toEqual(['Hôm nay', 'Hôm qua', '10 tháng 11, 2026']);
    expect(dayLabel(new Date(2026, 10, 19), NOW)).toBe('Hôm nay');
  });

  it('folds automatic versions of one working session into one line', () => {
    const groups = groupRevisions([rev('a', 'auto', at(19, 14, 40)), rev('b', 'auto', at(19, 14, 20)), rev('c', 'auto', at(19, 14, 0))], NOW);
    expect(groups[0].rows).toHaveLength(1);
    const row = groups[0].rows[0];
    expect(row.type).toBe('session');
    if (row.type === 'session') {
      expect(row.revisions.map((r) => r.id)).toEqual(['a', 'b', 'c']);
      expect(new Date(row.to).getTime() - new Date(row.from).getTime()).toBe(40 * 60_000);
    }
  });

  it('a long pause, another author, or a day change starts a new session', () => {
    const gap = SESSION_GAP_MS / 60_000 + 5;
    const groups = groupRevisions([rev('a', 'auto', at(19, 14, 0)), rev('b', 'auto', at(19, 14 - Math.ceil(gap / 60), 0)), rev('c', 'auto', at(19, 13, 59), 'u2')], NOW);
    expect(groups[0].rows.every((r) => r.type === 'item')).toBe(true);
  });

  it('named versions, safety copies and restores always stand alone', () => {
    const groups = groupRevisions([rev('a', 'auto', at(19, 14, 30)), rev('n', 'named', at(19, 14, 20), 'u1', { name: 'Gửi' }), rev('b', 'auto', at(19, 14, 10)), rev('p', 'pre-risk', at(19, 14, 5)), rev('r', 'restore', at(19, 14, 1))], NOW);
    expect(groups[0].rows.map((r) => r.type)).toEqual(['item', 'item', 'item', 'item', 'item']);
  });

  it('names a version by its name or its kind', () => {
    expect(revisionTitle({ name: 'Gửi lần 1', kind: 'named' })).toBe('Gửi lần 1');
    expect(revisionTitle({ name: null, kind: 'pre-risk' })).toBe('Bản lưu trước thao tác rủi ro');
  });

  it('shows what a version changed as short chips', () => {
    const chips = statChips({ blocksAdded: 3, blocksRemoved: 1, blocksModified: 2, blocksMoved: 0, wordsDelta: -40, refsDelta: 2, fieldsChanged: 1, itemsChanged: 0, layoutChanged: true });
    expect(chips.map((c) => c.text)).toEqual(['+3 khối', '−1 khối', '2 sửa', '−40 từ', '1 thông tin', '+2 TLTK', 'dàn trang']);
    expect(statChips({ blocksAdded: 0, blocksRemoved: 0, blocksModified: 0, blocksMoved: 0, wordsDelta: 0, refsDelta: 0, fieldsChanged: 0, itemsChanged: 0, layoutChanged: false })).toEqual([]);
  });
});
