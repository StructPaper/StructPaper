import { describe, it, expect } from 'vitest';
import { BASE_PROFILE, resolveProfile, resolveFromTiers } from '@structpaper/journal-profiles';
import { diffFromBase, toTierConfig, sameRules, describeChange } from '@/features/journals/profile-diff';

const base = BASE_PROFILE as unknown as Record<string, unknown>;

describe('cutting a resolved profile down to a journal\'s own rules', () => {
  it('keeps only what differs from the base, recursively', () => {
    const diff = diffFromBase({ a: 1, nested: { x: 1, y: 2 }, list: [1, 2] }, { a: 1, nested: { x: 1, y: 3 }, list: [1, 2, 3] });
    expect(diff).toEqual({ nested: { y: 3 }, list: [1, 2, 3] });
  });

  it('drops identity (names, colour) and the article type; the id is kept', () => {
    const resolved = resolveProfile('hs', 'research') as unknown as Record<string, unknown>;
    const tier = toTierConfig(resolved, base, 'hs');
    expect(tier.id).toBe('hs');
    expect(tier).not.toHaveProperty('names');
    expect(tier).not.toHaveProperty('color');
    expect(tier).not.toHaveProperty('articleType');
  });

  it('round-trips: base + the stored rules gives back the same profile', () => {
    const resolved = resolveProfile('ebl') as unknown as Record<string, unknown>;
    const tier = toTierConfig(resolved, base, 'ebl');
    const again = resolveFromTiers({ base, journal: { ...tier, id: 'ebl', names: (resolved as any).names, color: (resolved as any).color } as any });
    expect(again).toEqual(resolved);
  });

  it('an edit shows up as the only difference', () => {
    const resolved = structuredClone(resolveProfile('std')) as any;
    const before = toTierConfig(resolved, base, 'std');
    resolved.layout.columns = 3;
    const after = toTierConfig(resolved, base, 'std');
    expect(sameRules(before, after)).toBe(false);
    expect(describeChange(before, after)).toBe('Sửa dàn trang');
  });

  it("keeps what a journal prints about itself in its rules, but not its ISSN (that is the journal's own field)", () => {
    const resolved = structuredClone(resolveProfile('hs')) as any;
    resolved.publication = { ...resolved.publication, issn: '2734-9276', headerText: 'Header' };
    const tier = toTierConfig(resolved, base, 'hs') as any;
    expect(tier.publication.headerText).toBe('Header');
    expect(tier.publication).not.toHaveProperty('issn');
  });

  it('does not see a difference where only the key order differs (the database re-sorts object keys)', () => {
    const base = { list: [{ id: 'a', label: { en: 'A', vi: 'Á' } }], layout: { columns: 2, margins: { top: 1, left: 2 } } };
    const sorted = { layout: { margins: { left: 2, top: 1 }, columns: 2 }, list: [{ label: { vi: 'Á', en: 'A' }, id: 'a' }] };
    expect(diffFromBase(base, sorted)).toEqual({});
  });

  it('compares rules regardless of key order', () => {
    expect(sameRules({ id: 'x', a: 1, b: { c: 1, d: 2 } }, { b: { d: 2, c: 1 }, a: 1, id: 'x' })).toBe(true);
  });

  it('names every area that changed, once', () => {
    const note = describeChange({ id: 'x', layout: { c: 1 }, citation: { s: 'a' } }, { id: 'x', layout: { c: 2 }, citation: { s: 'b' }, qc: {} });
    expect(note).toBe('Sửa dàn trang, trích dẫn, kiểm tra chất lượng');
  });
});
