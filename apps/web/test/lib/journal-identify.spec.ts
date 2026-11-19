import { describe, it, expect } from 'vitest';
import { identifyJournal } from '@/lib/journal-identify';
import { detectJournalFromContent } from '@/lib/docx-parser';
import { managedJournalFor, autoBatchJournal } from '@/lib/batch-import/journals';

describe('identifyJournal: explicit identifiers only', () => {
  it('reads the DOI prefix of the journal', () => {
    expect(identifyJournal('DOI: 10.32508/vnuhcmj-hs.v10i3.722')).toBe('VNUHCM-HS');
    expect(identifyJournal('https://doi.org/10.32508/vnuhcmj-ebl.v9i1.1')).toBe('VNUHCM-EBL');
    expect(identifyJournal('10.32508/stdj.v27i2.4581')).toBe('VNUHCM-STD');
  });

  it('reads a printed journal name or abbreviation', () => {
    expect(identifyJournal('VNUHCM Journal of Health Sciences, 2026, 10(3)')).toBe('VNUHCM-HS');
    expect(identifyJournal('Cite this article: VNUHCM J. Econ. Bus. Law 2026')).toBe('VNUHCM-EBL');
    expect(identifyJournal('Tạp chí Phát triển Khoa học và Công nghệ – Health Sciences')).toBe('VNUHCM-HS');
  });

  it('reads an ISSN that only one journal owns', () => {
    expect(identifyJournal('ISSN 2734-9276')).toBe('VNUHCM-HS');
  });

  it('a subject word or a short code inside another word decides nothing', () => {
    expect(identifyJournal('Các yếu tố tác động đến kinh tế và luật')).toBeNull();
    expect(identifyJournal('Kỹ thuật xây dựng; engineering of structures')).toBeNull();
    expect(identifyJournal('This hsv thing', 'this-paper.docx')).toBeNull();
    expect(identifyJournal('')).toBeNull();
  });

  it('never guesses between two journals', () => {
    expect(identifyJournal('10.32508/vnuhcmj-hs and 10.32508/vnuhcmj-ebl')).toBeNull();
  });
});

describe('journal of an imported manuscript', () => {
  it('uses what the file states, else the generic journal (the template step decides the rest)', () => {
    expect(detectJournalFromContent('VNUHCM Journal of Health Sciences').journalId).toBe('VNUHCM-HS');
    expect(detectJournalFromContent('Bài viết về kinh tế học', 'hs-notes.docx').journalId).toBe('VNUHCM-STDJ');
  });

  it('maps template ids to the managed journals, STDJ being the same as STD', () => {
    expect(managedJournalFor('VNUHCM-HS')?.id).toBe('hs');
    expect(managedJournalFor('VNUHCM-STDJ')?.id).toBe(managedJournalFor('VNUHCM-STD')?.id);
    expect(managedJournalFor(undefined)).toBeNull();
    expect(managedJournalFor('VNUHCM-NOPE')).toBeNull();
  });

  it('automatic batch import: the stated journal, else the fallback', () => {
    const fallback = { journalId: 'VNUHCM-X', journalName: 'X', journalAbbv: 'X' };
    expect(autoBatchJournal('VNUHCM-HS', fallback).journalId).toBe('VNUHCM-HS');
    expect(autoBatchJournal('VNUHCM-STDJ', fallback).journalId).not.toBe('VNUHCM-X'); // STDJ is a real journal here
    expect(autoBatchJournal(undefined, fallback)).toBe(fallback);
  });
});
