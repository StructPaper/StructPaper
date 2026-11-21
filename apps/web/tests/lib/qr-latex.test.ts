import { describe, it, expect } from 'vitest';
import { doiToUrl, qrToLatex, qrBlockFor } from '@/lib/qr-latex';
import { createEmptyPaper } from '@/types/paper';
import { generateFullJournalLatex } from '@/lib/latex-template';

describe('QR from DOI', () => {
  it('only real DOIs give a link', () => {
    expect(doiToUrl('?')).toBeNull();
    expect(doiToUrl('')).toBeNull();
    expect(doiToUrl('abc')).toBeNull();
    expect(doiToUrl('10.32508/vnuhcmj-ebl.v10i3.1750')).toBe('https://doi.org/10.32508/vnuhcmj-ebl.v10i3.1750');
    expect(doiToUrl('https://doi.org/10.32508/x.1')).toBe('https://doi.org/10.32508/x.1');
  });

  it('draws with TeX rules only (no image, no package)', () => {
    const tex = qrToLatex('https://doi.org/10.32508/x.1');
    expect(tex).toContain(String.raw`\vrule`);
    expect(tex).not.toContain('includegraphics');
    // no DOI yet: the code of the standard samples, which scans to the journal's site
    expect(qrBlockFor('?')).toBe(qrBlockFor('http://www.scienceandtechnology.com.vn/'));
    expect(qrBlockFor('?')).toContain('\\vrule');
  });

  it('title block carries the sample code with no DOI, and the DOI code once one is entered', () => {
    const p = createEmptyPaper();
    p.metadata.title = 'T';
    const before = generateFullJournalLatex(p);
    expect(before).toContain(String.raw`\vrule width`);
    expect(before).toContain(qrBlockFor('?'));
    p.metadata.publication = { doi: '10.32508/vnuhcmj-ebl.v10i3.1750' } as never;
    const after = generateFullJournalLatex(p);
    expect(after).toContain(String.raw`\vrule width`);
    expect(after).not.toContain(qrBlockFor('?'));
  });

  it('prints the press logo over the centre and the journal artwork, never a demo QR image', () => {
    expect(qrBlockFor('10.32508/vnuhcmj-ees.v10i1.850')).toContain('logo-vnuhcmpress-color.png');
    expect(qrToLatex('https://doi.org/x')).not.toContain('includegraphics');
    const p = createEmptyPaper();
    p.metadata.title = 'T';
    p.metadata.titleEn = 'English title';
    p.metadata.abstractEn = 'English abstract';
    p.metadata.publication = { doi: '10.32508/vnuhcmj-ees.v10i1.850', firstPage: '1237' } as never;
    const full = generateFullJournalLatex(p);
    expect(full).not.toMatch(/qr-code|article-qr/);
    expect(full).toContain('check-update.jpeg');
    expect(full).toContain(String.raw`\setcounter{page}{1237}`);
  });
});
