import { describe, it, expect, afterEach } from 'vitest';
import { registerRemoteProfiles, clearRemoteProfiles, JOURNAL_DEFINITIONS } from '@structpaper/journal-profiles';
import { findJournalTemplate, getJournalTemplate, listJournalTemplates, journalKeyOf, JOURNAL_TEMPLATES } from '@/lib/templates';
import { identifyJournal } from '@/lib/journal-identify';
import { detectJournalFromContent } from '@/lib/docx-parser';
import { generateFullJournalLatex } from '@/lib/latex-template';
import { createEmptyPaper } from '@/types/paper';

const AGR = {
  id: 'agr',
  names: { vi: 'Tạp chí Phát triển KH&CN - Nông nghiệp', en: 'Science & Technology Development Journal - Agriculture', short: 'VNUHCM-AGR' },
  color: '#228B22',
  publication: {
    name: 'Tạp chí Phát triển KH&CN – Nông nghiệp',
    shortName: 'Sci. Tech. Dev. J. - Agric.',
    headerText: 'Tạp chí Phát triển KH&CN – Nông nghiệp',
    officialNameEn: 'VNUHCM Journal of Agriculture',
    officialAbbvEn: 'VNUHCM J. Agric.',
    doiPrefix: '10.32508/vnuhcmj-agr',
    issn: '2588-9999',
    eIssn: '2588-9998',
  },
};

afterEach(() => clearRemoteProfiles());

describe('journal templates follow what the server published', () => {
  it('know nothing of a journal the server has not published (the old fallback to HS stays)', () => {
    expect(findJournalTemplate('VNUHCM-AGR')).toBeUndefined();
    expect(getJournalTemplate('VNUHCM-AGR').id).toBe('VNUHCM-HS');
  });

  it('build the template of a journal an admin added from its published identity and print details', () => {
    registerRemoteProfiles({ journals: { agr: AGR as any } });
    expect(findJournalTemplate('VNUHCM-AGR')).toMatchObject({
      id: 'VNUHCM-AGR',
      name: 'Tạp chí Phát triển KH&CN – Nông nghiệp',
      shortName: 'Sci. Tech. Dev. J. - Agric.',
      color: '#228B22',
      accentColor: '#228B22',
      issn: '2588-9999',
      eIssn: '2588-9998',
      officialNameEn: 'VNUHCM Journal of Agriculture',
      doiPrefix: '10.32508/vnuhcmj-agr',
    });
    for (const ref of ['agr', 'AGR', 'vnuhcm-agr', 'VNUHCM_AGR']) expect(findJournalTemplate(ref)?.id).toBe('VNUHCM-AGR');
  });

  it('let a published colour or header win over the built-in one, keeping the rest', () => {
    registerRemoteProfiles({ journals: { hs: { ...JOURNAL_DEFINITIONS.hs, color: '#123456', publication: { headerText: 'Mới' } } } });
    const hs = getJournalTemplate('VNUHCM-HS');
    expect(hs.color).toBe('#123456');
    expect(hs.headerText).toBe('Mới');
    expect(hs.officialNameEn).toBe(JOURNAL_TEMPLATES['VNUHCM-HS'].officialNameEn); // untouched fields stay
    expect(hs.id).toBe('VNUHCM-HS');
  });

  it('list the built-ins plus the added journals, once each', () => {
    const before = listJournalTemplates().length;
    registerRemoteProfiles({ journals: { agr: AGR as any, hs: JOURNAL_DEFINITIONS.hs } });
    const list = listJournalTemplates();
    expect(list).toHaveLength(before + 1);
    expect(list.filter((t) => t.id === 'VNUHCM-AGR')).toHaveLength(1);
  });

  it('read STD, STDJ, JST as the one standard journal', () => {
    expect(['stdj', 'VNUHCM-STDJ', 'jst', 'std'].map(journalKeyOf)).toEqual(['std', 'std', 'std', 'std']);
  });

  it('let the parser recognise the new journal by its DOI prefix, its ISSN or its printed name', () => {
    expect(identifyJournal('Full text. doi: 10.32508/vnuhcmj-agr.v9i1.1')).toBeNull();
    registerRemoteProfiles({ journals: { agr: AGR as any } });
    expect(identifyJournal('Full text. doi: 10.32508/vnuhcmj-agr.v9i1.1')).toBe('VNUHCM-AGR');
    expect(identifyJournal('Published in VNUHCM Journal of Agriculture, vol 9')).toBe('VNUHCM-AGR');
    expect(identifyJournal('ISSN 2588-9999')).toBe('VNUHCM-AGR');
    expect(detectJournalFromContent('doi 10.32508/vnuhcmj-agr.v1').journalName).toBe('Tạp chí Phát triển KH&CN – Nông nghiệp');
  });

  it('are what the PDF writer prints: header name, abbreviation and colour of the new journal', () => {
    registerRemoteProfiles({ journals: { agr: AGR as any } });
    const tex = generateFullJournalLatex(createEmptyPaper('VNUHCM-AGR'));
    expect(tex).toContain('VNUHCM Journal of Agriculture');
    expect(tex).toContain('VNUHCM J. Agric.');
    expect(tex).not.toContain('VNUHCM Journal of Health Sciences');
    expect(tex).toContain('\\definecolor{titlecolor}{RGB}{34, 139, 34}'); // the journal's colour #228B22
  });
});
