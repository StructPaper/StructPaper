import { describe, it, expect } from 'vitest';
import { generateSamplePaperForJournal } from '@/lib/templates/sample-template-paper';
import { generateFullJournalLatex } from '@/lib/latex-template';
import { templateFromProfile } from '@/lib/templates';
import { BASE_PROFILE } from '@structpaper/journal-profiles';

const profile = (over: Record<string, any> = {}): any => ({
  ...(BASE_PROFILE as any),
  id: 'new-j',
  names: { vi: 'Tạp chí mới', en: 'New Journal', short: 'NEW-J' },
  color: '#1E3A8A',
  publication: {},
  ...over,
});
const tex = (p: any) => generateFullJournalLatex(generateSamplePaperForJournal(p), undefined, { template: templateFromProfile(p) });

describe('the Template editor preview is typeset with the rules on screen', () => {
  it('a different brand colour gives different LaTeX (so the compile cache cannot answer for it)', () => {
    expect(tex(profile({ color: '#1E3A8A' }))).not.toBe(tex(profile({ color: '#B91C1C' })));
  });

  it('the colour is the one chosen', () => {
    expect(tex(profile({ color: '#B91C1C' }))).toContain('185, 28, 28');
  });

  it('the print details of the "Thông tin" tab reach the page: official name, cite abbreviation, DOI prefix', () => {
    const t = tex(profile({ publication: { officialNameEn: 'Journal of Brand New Things', officialAbbvEn: 'J. Brand New', doiPrefix: '10.99999/new-j' } }));
    expect(t).toContain('Journal of Brand New Things');
    expect(t).toContain('J. Brand New');
    expect(t).toContain('10.99999/new-j');
    expect(tex(profile())).not.toContain('Journal of Brand New Things');
  });
});
