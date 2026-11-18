import { describe, it, expect } from 'vitest';
import {
  resolveProfile,
  BASE_PROFILE,
  ALL_JOURNAL_IDS,
  ALL_ARTICLE_TYPES,
  JournalProfileSchema,
  ResolvedProfileSchema,
  getJournalProfile,
} from '../src';

describe('Task 2: 3-Tier Journal Profiles Inheritance', () => {
  describe('Resolving all 7 VNUHCM Journals', () => {
    const expectedJournals = [
      {
        id: 'std',
        color: '#000099',
        short: 'VNUHCM-STD',
        vi: 'Tạp chí Phát triển Khoa học và Công nghệ',
      },
      {
        id: 'hs',
        color: '#2B74B7',
        short: 'VNUHCM-HS',
        vi: 'Tạp chí Phát triển KH&CN - Khoa học Sức khỏe',
      },
      {
        id: 'ssh',
        color: '#0000FF',
        short: 'VNUHCM-SSH',
        vi: 'Tạp chí Phát triển KH&CN - Khoa học Xã hội và Nhân văn',
      },
      {
        id: 'ebl',
        color: '#8F0B97',
        short: 'VNUHCM-EBL',
        vi: 'Tạp chí Phát triển KH&CN - Kinh tế, Luật và Quản lý',
      },
      {
        id: 'et',
        color: '#000000',
        short: 'VNUHCM-ET',
        vi: 'Tạp chí Phát triển KH&CN - Kỹ thuật và Công nghệ',
      },
      {
        id: 'ees',
        color: '#0C712F',
        short: 'VNUHCM-EES',
        vi: 'Tạp chí Phát triển KH&CN - Môi trường & Khoa học Trái đất',
      },
      {
        id: 'arns',
        color: '#FF0000',
        short: 'VNUHCM-ARNS',
        vi: 'Tạp chí Phát triển KH&CN - Khoa học Tự nhiên',
      },
    ];

    it.each(expectedJournals)(
      'resolves journal "$id" with correct color $color and short name $short',
      ({ id, color, short, vi }) => {
        const resolved = resolveProfile(id);
        expect(resolved.id).toBe(id);
        expect(resolved.color).toBe(color);
        expect(resolved.names.short).toBe(short);
        expect(resolved.names.vi).toBe(vi);
        expect(resolved.styleMap).toEqual(BASE_PROFILE.styleMap);
        expect(resolved.frontMatter.abstract?.minWords).toBe(275);
        expect(resolved.citation.style).toBe('vancouver');
        expect(JournalProfileSchema.safeParse(resolved).success).toBe(true);
      }
    );

    it('resolves vnuhcm-hs cleanly as an alias to hs', () => {
      const resolved = resolveProfile('vnuhcm-hs');
      expect(resolved.id).toBe('hs');
      expect(resolved.color).toBe('#2B74B7');
      expect(resolved.names.short).toBe('VNUHCM-HS');
    });

    it('resolves case-insensitive aliases for all journals', () => {
      expect(resolveProfile('VNUHCM-STD').id).toBe('std');
      expect(resolveProfile('vnuhcm-stdj').id).toBe('std');
      expect(resolveProfile('VNUHCM-SSH').id).toBe('ssh');
      expect(resolveProfile('VNUHCM-EBL').id).toBe('ebl');
      expect(resolveProfile('VNUHCM-ET').id).toBe('et');
      expect(resolveProfile('VNUHCM-EES').id).toBe('ees');
      expect(resolveProfile('VNUHCM-ARNS').id).toBe('arns');
      expect(resolveProfile('vnuhcm-ns').id).toBe('arns');
    });

    it('throws helpful error when resolving an unknown journal', () => {
      expect(() => resolveProfile('unknown-journal')).toThrow(
        /Unknown journal profile: "unknown-journal"/
      );
    });
  });

  describe('Article Types Resolution (Tier 3)', () => {
    it('disables abstract for editorial, letter, and correction', () => {
      const editorial = resolveProfile('hs', 'editorial');
      expect(editorial.articleType).toBe('editorial');
      expect(editorial.frontMatter.abstract).toBeNull();
      expect(ResolvedProfileSchema.safeParse(editorial).success).toBe(true);

      const letter = resolveProfile('hs', 'letter');
      expect(letter.articleType).toBe('letter');
      expect(letter.frontMatter.abstract).toBeNull();

      const correction = resolveProfile('hs', 'correction');
      expect(correction.articleType).toBe('correction');
      expect(correction.frontMatter.abstract).toBeNull();
    });

    it('preserves abstract for research, review, commentary, methodology, case-report', () => {
      const types = ['research', 'review', 'commentary', 'methodology', 'case-report'];
      for (const t of types) {
        const resolved = resolveProfile('hs', t);
        expect(resolved.articleType).toBe(t);
        expect(resolved.frontMatter.abstract).not.toBeNull();
        expect(resolved.frontMatter.abstract?.minWords).toBe(275);
      }
    });

    it('resolves aliases research-article and review-article', () => {
      const res = resolveProfile('hs', 'research-article');
      expect(res.articleType).toBe('research');
      expect(res.frontMatter.abstract?.minWords).toBe(275);

      const rev = resolveProfile('hs', 'review-article');
      expect(rev.articleType).toBe('review');
    });

    it('throws error when resolving an unknown article type', () => {
      expect(() => resolveProfile('hs', 'invalid-type')).toThrow(
        /Unknown article type: "invalid-type"/
      );
    });
  });

  describe('Overrides & Array Semantics (Tier 4)', () => {
    it('deep merges nested objects without mutating source profiles', () => {
      const baseBefore = JSON.stringify(BASE_PROFILE);
      const custom = resolveProfile('hs', 'research', {
        layout: { columns: 1, columnGap: 10 },
      });

      expect(custom.layout.columns).toBe(1);
      expect(custom.layout.columnGap).toBe(10);
      expect(custom.layout.paperSize).toBe('A4');
      expect(JSON.stringify(BASE_PROFILE)).toBe(baseBefore);
    });

    it('replaces arrays entirely by default', () => {
      const custom = resolveProfile('hs', undefined, {
        languages: ['vi'],
        qc: { ruleset: ['custom-rule-only'] },
      });

      expect(custom.languages).toEqual(['vi']);
      expect(custom.qc.ruleset).toEqual(['custom-rule-only']);
    });

    it('appends to arrays when $append: true is used (object format)', () => {
      const custom = resolveProfile('hs', undefined, {
        qc: {
          ruleset: { $append: true, values: ['rule-custom-1', 'rule-custom-2'] },
        },
      });

      expect(custom.qc.ruleset).toContain('title-required');
      expect(custom.qc.ruleset).toContain('rule-custom-1');
      expect(custom.qc.ruleset).toContain('rule-custom-2');
      expect(custom.qc.ruleset.length).toBe(BASE_PROFILE.qc.ruleset.length + 2);
    });

    it('appends to arrays when $append: true is used on array object', () => {
      const extraRules = ['rule-custom-array'];
      (extraRules as unknown as { $append: boolean }).$append = true;

      const custom = resolveProfile('hs', undefined, {
        qc: { ruleset: extraRules },
      });

      expect(custom.qc.ruleset).toContain('rule-custom-array');
      expect(custom.qc.ruleset.length).toBe(BASE_PROFILE.qc.ruleset.length + 1);
    });

    it('explicit null clears and disables target field', () => {
      const cleared = resolveProfile('hs', undefined, {
        frontMatter: { abstract: null },
      });
      expect(cleared.frontMatter.abstract).toBeNull();
      expect(cleared.frontMatter.keywords).toBeDefined();
    });

    it('allows re-enabling a disabled field through overrides', () => {
      const reEnabled = resolveProfile('hs', 'editorial', {
        frontMatter: {
          abstract: { minWords: 150, maxWords: 300, structured: false },
        },
      });
      expect(reEnabled.frontMatter.abstract).toEqual({
        minWords: 150,
        maxWords: 300,
        structured: false,
      });
    });
  });

  describe('Matrix Verification: 7 Journals x 8 Article Types (56 combinations)', () => {
    const disabledAbstractTypes = new Set(['editorial', 'letter', 'correction']);

    for (const journalId of ALL_JOURNAL_IDS) {
      for (const articleType of ALL_ARTICLE_TYPES) {
        it(`resolves ${journalId} x ${articleType.id} cleanly`, () => {
          const profile = resolveProfile(journalId, articleType.id);

          expect(profile.id).toBe(journalId);
          expect(profile.articleType).toBe(articleType.id);
          expect(profile.color).toMatch(/^#[0-9a-fA-F]{6}$/);

          if (disabledAbstractTypes.has(articleType.id)) {
            expect(profile.frontMatter.abstract).toBeNull();
          } else {
            expect(profile.frontMatter.abstract).not.toBeNull();
            expect(profile.frontMatter.abstract?.minWords).toBeGreaterThan(0);
          }

          const parseResult = ResolvedProfileSchema.safeParse(profile);
          expect(parseResult.success).toBe(true);
        });
      }
    }
  });

  describe('Backward Compatibility with getJournalProfile', () => {
    it('retrieves classic VNUHCM-HS and newly resolved std/hs', () => {
      const hsClassic = getJournalProfile('VNUHCM-HS');
      expect(hsClassic.id).toBe('VNUHCM-HS');
      expect(hsClassic.color).toBe('#0070BA');

      const std = getJournalProfile('std');
      expect(std.id).toBe('std');
      expect(std.color).toBe('#000099');
    });
  });
});
