import { describe, it, expect } from 'vitest';
import { cleanDoi, splitReferenceDoi, enDashRanges, referenceLatex } from '@/lib/reference-format';

const id = (s: string) => s;

describe('DOIs', () => {
  it('cleans a DOI to its bare form', () => {
    expect(cleanDoi('https://doi.org/10.1136/bmj.j5855.')).toBe('10.1136/bmj.j5855');
    expect(cleanDoi('doi: 10.1039/b719469m')).toBe('10.1039/b719469m');
    expect(cleanDoi('not a doi')).toBeUndefined();
    expect(cleanDoi('')).toBeUndefined();
  });

  it('takes "Available from: ..." and "DOI: ..." off the end of a reference', () => {
    const body = 'Skamarock WC, Klemp JB, Dudhia J. A Description of the Advanced Research WRF Model. Boulder: NCAR; 2019.';
    expect(splitReferenceDoi(`${body} DOI: https://doi.org/10.5065/1dfh-6p97`)).toEqual({ raw: body.replace(/\.$/, '.'), doi: '10.5065/1dfh-6p97' });
    expect(splitReferenceDoi(`${body} Available from: https://doi.org/10.5065/1dfh-6p97.`).doi).toBe('10.5065/1dfh-6p97');
    expect(splitReferenceDoi(`${body} https://doi.org/10.5065/1dfh-6p97`).doi).toBe('10.5065/1dfh-6p97');
  });

  it('leaves a reference without a DOI, or that is only a DOI, alone', () => {
    expect(splitReferenceDoi('Tang SY, Bourne RA. Green Chem. 2008;10(3):268-9.')).toEqual({ raw: 'Tang SY, Bourne RA. Green Chem. 2008;10(3):268-9.' });
    expect(splitReferenceDoi('https://doi.org/10.1136/bmj.j5855')).toEqual({ raw: 'https://doi.org/10.1136/bmj.j5855' });
  });
});

describe('ranges get the en dash', () => {
  it.each([
    ['Green Chem. 2008;10(3):268-9.', 'Green Chem. 2008;10(3):268–9.'],
    ['giai đoạn 2016-2023', 'giai đoạn 2016–2023'],
    ['liều 10-20 mg', 'liều 10–20 mg'],
    ['trang 45 - 52', 'trang 45–52'],
  ])('%s', (a, b) => expect(enDashRanges(a)).toBe(b));

  it.each([
    'ngày 15-08-2025',
    'COVID-19',
    'ISSN 1859-0128',
    'mã 0901-234-567',
    'https://doi.org/10.1000/abc-123-456',
    'giá trị 0.5-1',
    'Fe3O4@SiO2-Cu',
  ])('leaves %s alone', (s) => expect(enDashRanges(s)).toBe(s));

  it('does not touch a formula', () => {
    expect(enDashRanges('$x_{1-2}$ và 3-4')).toBe('$x_{1-2}$ và 3–4');
  });
});

describe('a reference as LaTeX', () => {
  it('adds the DOI after "Available from:", as a link', () => {
    expect(referenceLatex({ raw: 'Tang SY. Green Chem. 2008;10(3):268-9.', doi: '10.1039/b719469m' }, id)).toBe(
      String.raw`Tang SY. Green Chem. 2008;10(3):268–9. Available from: \url{https://doi.org/10.1039/b719469m}.`,
    );
  });

  it('supplies the full stop when the text has none, and can print the link alone', () => {
    expect(referenceLatex({ raw: 'Tang SY. Green Chem. 2008;10(3):268-9', doi: '10.1039/b719469m' }, id, '')).toBe(String.raw`Tang SY. Green Chem. 2008;10(3):268–9. \url{https://doi.org/10.1039/b719469m}.`);
  });

  it('prints nothing more when there is no DOI or the text already has it', () => {
    expect(referenceLatex({ raw: 'Tang SY. 2008.' }, id)).toBe('Tang SY. 2008.');
    expect(referenceLatex({ raw: 'Tang SY. 2008. https://doi.org/10.1039/b719469m', doi: '10.1039/b719469m' }, id)).toContain('b719469m');
    expect(referenceLatex({ raw: 'Tang SY. 2008. https://doi.org/10.1039/b719469m', doi: '10.1039/b719469m' }, id)).not.toContain('Available');
  });
});
