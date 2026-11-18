import { describe, it, expect, afterEach } from 'vitest';
import {
  resolveProfile,
  resolveFromTiers,
  registerRemoteProfiles,
  clearRemoteProfiles,
  BASE_PROFILE,
  JOURNAL_DEFINITIONS,
} from '../src';

afterEach(() => clearRemoteProfiles());

describe('resolveFromTiers', () => {
  it('gives the same result as resolveProfile for the built-in tiers', () => {
    const merged = resolveFromTiers({ base: BASE_PROFILE as any, journal: JOURNAL_DEFINITIONS.hs });
    expect(merged).toEqual(resolveProfile('hs'));
  });

  it('keeps the journal id and lets later tiers win', () => {
    const merged = resolveFromTiers({
      base: BASE_PROFILE as any,
      journal: JOURNAL_DEFINITIONS.hs,
      articleType: { id: 'letter', frontMatter: { abstract: null } },
      overrides: { color: '#123456' },
    });
    expect(merged.id).toBe('hs');
    expect(merged.articleType).toBe('letter');
    expect(merged.frontMatter.abstract).toBeNull();
    expect(merged.color).toBe('#123456');
  });
});

describe('profiles the server published', () => {
  it('win over the built-in journal rules', () => {
    registerRemoteProfiles({ journals: { hs: { ...JOURNAL_DEFINITIONS.hs, color: '#abcdef' } } });
    expect(resolveProfile('hs').color).toBe('#abcdef');
    expect(resolveProfile('vnuhcm-hs').color).toBe('#abcdef');
    expect(resolveProfile('et').color).toBe(JOURNAL_DEFINITIONS.et.color); // others untouched
  });

  it('let a journal the code does not know be resolved', () => {
    expect(() => resolveProfile('new-journal')).toThrow(/Unknown journal profile/);
    registerRemoteProfiles({ journals: { 'new-journal': { id: 'new-journal', color: '#112233' } } });
    const p = resolveProfile('vnuhcm-new-journal');
    expect(p.id).toBe('new-journal');
    expect(p.color).toBe('#112233');
    expect(p.layout.columns).toBe((BASE_PROFILE as any).layout.columns); // base rules still apply
  });

  it('a published base replaces the built-in base for every journal', () => {
    registerRemoteProfiles({ base: { ...(BASE_PROFILE as any), citation: { ...(BASE_PROFILE as any).citation, style: 'apa' } }, journals: {} });
    expect(resolveProfile('std').citation.style).toBe('apa');
  });

  it('clearing goes back to the built-ins', () => {
    registerRemoteProfiles({ journals: { hs: { ...JOURNAL_DEFINITIONS.hs, color: '#abcdef' } } });
    clearRemoteProfiles();
    expect(resolveProfile('hs').color).toBe(JOURNAL_DEFINITIONS.hs.color);
  });
});
