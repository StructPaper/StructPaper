import type { RevisionSummary } from '@structpaper/api-client';

/** Automatic versions closer together than this, by the same person, are one session of work. */
export const SESSION_GAP_MS = 30 * 60_000;

export type HistoryRow =
  | { type: 'item'; revision: RevisionSummary }
  /** A run of automatic versions in one working session: shown as one line that opens. */
  | { type: 'session'; id: string; revisions: RevisionSummary[]; from: string; to: string };

export interface DayGroup {
  /** yyyy-mm-dd in the viewer's time zone. */
  key: string;
  /** "Hôm nay", "Hôm qua", "12 tháng 11, 2026" */
  label: string;
  rows: HistoryRow[];
}

const KIND_LABEL: Record<string, string> = {
  auto: 'Phiên bản tự động',
  named: 'Phiên bản có tên',
  'pre-risk': 'Bản lưu trước thao tác rủi ro',
  'profile-upgrade': 'Bản lưu trước khi nâng cấp quy tắc',
  restore: 'Khôi phục',
  import: 'Nhập từ tệp',
};

/** What to call a version in the list: its name, else what kind it is. */
export const revisionTitle = (r: Pick<RevisionSummary, 'name' | 'kind'>): string => r.name || KIND_LABEL[r.kind] || 'Phiên bản';
export const kindLabel = (kind: string): string => KIND_LABEL[kind] ?? kind;

const pad = (n: number) => String(n).padStart(2, '0');
const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export function dayLabel(date: Date, now: Date = new Date()): string {
  const today = dayKey(now);
  const yesterday = dayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));
  const key = dayKey(date);
  if (key === today) return 'Hôm nay';
  if (key === yesterday) return 'Hôm qua';
  return `${date.getDate()} tháng ${date.getMonth() + 1}, ${date.getFullYear()}`;
}

/**
 * The list the way a person reads it: by day (newest first), and inside a day the automatic versions of one working
 * session folded into one line. Named versions, safety copies and restores always stand on their own line.
 * `revisions` must be newest first, as the server sends them.
 */
export function groupRevisions(revisions: RevisionSummary[], now: Date = new Date()): DayGroup[] {
  const groups: DayGroup[] = [];
  const sameAuthor = (a: RevisionSummary, b: RevisionSummary) => (a.author?.id ?? '') === (b.author?.id ?? '');

  for (const rev of revisions) {
    const date = new Date(rev.createdAt);
    const key = dayKey(date);
    let group = groups[groups.length - 1];
    if (!group || group.key !== key) {
      group = { key, label: dayLabel(date, now), rows: [] };
      groups.push(group);
    }

    if (rev.kind === 'auto') {
      const last = group.rows[group.rows.length - 1];
      const prev =
        last?.type === 'session' ? last.revisions[last.revisions.length - 1] : last?.type === 'item' && last.revision.kind === 'auto' ? last.revision : null;
      if (last && prev && sameAuthor(prev, rev) && new Date(prev.createdAt).getTime() - date.getTime() <= SESSION_GAP_MS) {
        if (last.type === 'session') {
          last.revisions.push(rev);
          last.from = rev.createdAt;
        } else {
          group.rows[group.rows.length - 1] = {
            type: 'session',
            id: `s-${last.revision.id}`,
            revisions: [last.revision, rev],
            from: rev.createdAt,
            to: last.revision.createdAt,
          };
        }
        continue;
      }
    }
    group.rows.push({ type: 'item', revision: rev });
  }
  return groups;
}

/** "14:05" */
export const timeLabel = (iso: string): string => {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export interface StatChip {
  text: string;
  tone: 'add' | 'del' | 'mod' | 'neutral';
}

/** What a version changed, as short chips for the list: "+3 khối", "−1 khối", "2 sửa", "+120 từ". */
export function statChips(stats: RevisionSummary['stats']): StatChip[] {
  const chips: StatChip[] = [];
  if (stats.blocksAdded) chips.push({ text: `+${stats.blocksAdded} khối`, tone: 'add' });
  if (stats.blocksRemoved) chips.push({ text: `−${stats.blocksRemoved} khối`, tone: 'del' });
  if (stats.blocksModified) chips.push({ text: `${stats.blocksModified} sửa`, tone: 'mod' });
  if (stats.blocksMoved) chips.push({ text: `${stats.blocksMoved} di chuyển`, tone: 'neutral' });
  if (stats.wordsDelta) chips.push({ text: `${stats.wordsDelta > 0 ? '+' : '−'}${Math.abs(stats.wordsDelta)} từ`, tone: stats.wordsDelta > 0 ? 'add' : 'del' });
  if (stats.fieldsChanged) chips.push({ text: `${stats.fieldsChanged} thông tin`, tone: 'mod' });
  if (stats.refsDelta) chips.push({ text: `${stats.refsDelta > 0 ? '+' : '−'}${Math.abs(stats.refsDelta)} TLTK`, tone: stats.refsDelta > 0 ? 'add' : 'del' });
  if (stats.layoutChanged) chips.push({ text: 'dàn trang', tone: 'neutral' });
  return chips;
}
