import { describe, it, expect } from 'vitest';
import { ManuscriptDuplicatesService, titleRoot } from '../../src/modules/manuscripts/application/manuscript-duplicates.service';

const row = (title: string, by: string, name: string | null, email = `${by}@uel.edu.vn`, at = '2026-10-21T08:00:00Z') => ({
  title,
  createdBy: by,
  displayName: name,
  email,
  createdAt: new Date(at),
});

const db = (rows: any[]) => ({
  select: () => ({
    from: () => ({ leftJoin: () => ({ where: () => ({ orderBy: () => ({ limit: async () => rows }) }) }) }),
  }),
});

describe('papers already uploaded with the same title', () => {
  const rows = [
    row('Ảnh hưởng của giấc ngủ', 'u-1', 'Nguyễn Văn A'),
    row('Ảnh hưởng của giấc ngủ (1)', 'u-2', null, 'tran.b@uel.edu.vn'),
    row('ẢNH HƯỞNG CỦA GIẤC NGỦ (2)', 'u-me', 'Tôi'),
    row('Ảnh hưởng của giấc ngủ đến trí nhớ', 'u-3', 'Người khác'), // a longer title is another paper
  ];

  it('lists every upload of the title, numbered copies and other letter case included', async () => {
    const found = await new ManuscriptDuplicatesService(db(rows)).findByTitle('Ảnh hưởng của giấc ngủ', 'u-me');

    expect(found.map((d) => d.uploaderName)).toEqual(['Nguyễn Văn A', 'tran.b', 'Tôi']);
    expect(found.map((d) => d.mine)).toEqual([false, false, true]);
  });

  it('matches a numbered title asked for as well', async () => {
    const found = await new ManuscriptDuplicatesService(db(rows)).findByTitle('Ảnh hưởng của giấc ngủ (1)');
    expect(found).toHaveLength(3);
  });

  it('shows names and dates only: nothing that opens or identifies the paper', async () => {
    const [first] = await new ManuscriptDuplicatesService(db(rows)).findByTitle('Ảnh hưởng của giấc ngủ');
    expect(Object.keys(first).sort()).toEqual(['mine', 'title', 'uploadedAt', 'uploaderName']);
  });

  it('falls back to the part of the email before "@", never the whole address', async () => {
    const found = await new ManuscriptDuplicatesService(db([row('X', 'u-9', '  ', 'someone@secret.org')])).findByTitle('X');
    expect(found[0].uploaderName).toBe('someone');
    expect(JSON.stringify(found)).not.toContain('secret.org');
  });

  it('nothing for an empty title', async () => {
    expect(await new ManuscriptDuplicatesService(db(rows)).findByTitle('  ')).toEqual([]);
  });

  it('titleRoot drops only a trailing "(n)"', () => {
    expect(titleRoot('Title (12)')).toBe('Title');
    expect(titleRoot('Title (a)')).toBe('Title (a)');
    expect(titleRoot('Title (1) more')).toBe('Title (1) more');
  });
});
