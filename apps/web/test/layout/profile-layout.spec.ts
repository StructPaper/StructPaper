import { describe, it, expect, afterEach } from 'vitest';
import { registerRemoteProfiles, clearRemoteProfiles, BASE_PROFILE, JOURNAL_DEFINITIONS } from '@structpaper/journal-profiles';
import { DEFAULT_LAYOUT_SETTINGS } from '@/types/paper';
import { layoutFromProfile, layoutOverrides, effectiveLayout } from '@/lib/layout/profile-layout';
import {
  resolvePaperLayout,
  journalLayoutOf,
  rememberPinnedProfile,
  forgetPinnedProfiles,
  profileCacheKey,
} from '@/lib/layout/paper-profile';
import { articleTypeCodeFor } from '@/lib/layout/article-type-code';

afterEach(() => {
  clearRemoteProfiles();
  forgetPinnedProfiles();
});

const paper = (extra: Record<string, unknown> = {}) => ({ metadata: { journalId: 'VNUHCM-HS' }, ...extra }) as any;

describe('the page layout a journal asks for', () => {
  it('the base rules describe the page the app typesets today, so inheriting them changes no existing PDF', () => {
    expect(layoutFromProfile(BASE_PROFILE as any)).toEqual({ ...DEFAULT_LAYOUT_SETTINGS });
  });

  it('turns columns, paper, type size, gap and leading into the settings the typesetter knows', () => {
    const layout = layoutFromProfile({
      layout: { paperSize: 'A4', columns: 1, columnGap: 8.5 },
      typography: { fontSizes: { body: 10.4 }, leading: { body: 1.28 } },
    });
    expect(layout).toMatchObject({ paperSize: 'a4', columnLayout: '1-column', fontSize: '10pt', columnSep: '2pc', lineSpacing: '1.3' });
  });

  it('keeps the app defaults for whatever the rules do not say, and for an unknown paper size', () => {
    expect(layoutFromProfile({})).toEqual(DEFAULT_LAYOUT_SETTINGS);
    expect(layoutFromProfile(null)).toEqual(DEFAULT_LAYOUT_SETTINGS);
    expect(layoutFromProfile({ layout: { paperSize: 'tabloid' } }).paperSize).toBe(DEFAULT_LAYOUT_SETTINGS.paperSize);
  });
});

describe('what a paper stores about its layout', () => {
  const journal = layoutFromProfile({ layout: { columns: 2 }, typography: { fontSizes: { body: 9 } } });

  it('only what differs from the journal', () => {
    const chosen = { ...journal, columnLayout: '1-column' as const };
    expect(layoutOverrides(journal, chosen)).toEqual({ columnLayout: '1-column' });
    expect(layoutOverrides(journal, journal)).toEqual({});
  });

  it('the journal\'s layout with the paper\'s changes laid over it', () => {
    expect(effectiveLayout(journal, { fontSize: '11pt' })).toMatchObject({ fontSize: '11pt', columnLayout: '2-column' });
    expect(effectiveLayout(journal, undefined)).toEqual(journal);
  });

  it('a settings object saved in full by an older version is simply a complete set of overrides', () => {
    const old = { ...DEFAULT_LAYOUT_SETTINGS, columnLayout: '1-column' as const };
    expect(effectiveLayout(layoutFromProfile({ layout: { columns: 2 } }), old)).toEqual(old);
  });
});

describe('the layout of a paper follows its journal', () => {
  it('without anything registered, the built-in rules of its journal', () => {
    expect(resolvePaperLayout(paper())).toEqual(DEFAULT_LAYOUT_SETTINGS);
  });

  it('what the journal publishes later applies to papers that changed nothing, not to what they changed', () => {
    registerRemoteProfiles({ journals: { hs: { ...JOURNAL_DEFINITIONS.hs, layout: { columns: 1 } } } });
    expect(resolvePaperLayout(paper()).columnLayout).toBe('1-column');
    expect(resolvePaperLayout(paper({ layoutSettings: { columnLayout: '2-column' } })).columnLayout).toBe('2-column');
    expect(resolvePaperLayout(paper({ layoutSettings: { fontSize: '11pt' } }))).toMatchObject({ columnLayout: '1-column', fontSize: '11pt' });
  });

  it('a pinned paper keeps the rules of its version even after the journal published new ones', () => {
    const pin = { base: 1, journal: 1 };
    // the editor fetched version 1 (two columns) when the paper opened
    rememberPinnedProfile({ journal: 'VNUHCM-HS', pin }, { layout: { columns: 2 } } as any);
    registerRemoteProfiles({ journals: { hs: { ...JOURNAL_DEFINITIONS.hs, layout: { columns: 1 } } } });

    expect(resolvePaperLayout(paper({ profilePin: pin })).columnLayout).toBe('2-column');
    expect(resolvePaperLayout(paper({ profilePin: { base: 1, journal: 2 } })).columnLayout).toBe('1-column'); // not fetched: the latest
    expect(journalLayoutOf(paper({ profilePin: pin })).columnLayout).toBe('2-column');
  });

  it('keys a pinned profile by journal, type and the versions', () => {
    expect(profileCacheKey({ journal: 'VNUHCM-HS', articleType: 'research', pin: { base: 1, journal: 2, articleType: 3 } })).toBe('hs|research|1,2,3');
    expect(profileCacheKey({ journal: 'hs' })).toBe('hs||,,');
  });

  it('a paper that names no journal gets the app defaults', () => {
    expect(resolvePaperLayout({ metadata: {} } as any)).toEqual(DEFAULT_LAYOUT_SETTINGS);
  });
});

describe('the article type a free-text name stands for', () => {
  it('is found among the types of the journal, by Vietnamese or English name or by code', () => {
    registerRemoteProfiles({
      journals: {
        hs: {
          ...JOURNAL_DEFINITIONS.hs,
          articleTypes: [
            { id: 'research', label: { vi: 'Bài báo nghiên cứu', en: 'Research Article' }, requiredSections: [] },
            { id: 'case-report', label: { vi: 'Báo cáo ca lâm sàng', en: 'Case Report' }, requiredSections: [] },
          ],
        } as any,
      },
    });
    expect(articleTypeCodeFor('VNUHCM-HS', 'Báo cáo ca lâm sàng')).toBe('case-report');
    expect(articleTypeCodeFor('VNUHCM-HS', 'research article')).toBe('research');
    expect(articleTypeCodeFor('VNUHCM-HS', 'case-report')).toBe('case-report');
    expect(articleTypeCodeFor('VNUHCM-HS', 'Một loại bài tự đặt')).toBeUndefined();
    expect(articleTypeCodeFor(undefined, 'x')).toBeUndefined();
  });
});
