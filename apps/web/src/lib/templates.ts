import { getRemoteJournalTier, remoteJournalKeys, type JournalTierProfile } from '@structpaper/journal-profiles';
import { JournalTemplate } from '@/types/paper';

/**
 * What the app ships with, used where the server has not published anything (offline, first start).
 * Read journals through findJournalTemplate / getJournalTemplate / listJournalTemplates: they prefer what
 * the server published, so a journal an admin adds or edits is honoured by the parser and the PDF writer.
 *
 * Official VNUHCM Journal Profiles and Precise Brand Colors
 * Extracted and calibrated directly against the production publication sample PDFs in:
 * "Yêu cầu phần mềm, Template, các file mẫu của Tạp chí"
 */
export const JOURNAL_TEMPLATES: Record<string, JournalTemplate> = {
  'VNUHCM-HS': {
    id: 'VNUHCM-HS',
    name: 'Tạp chí Phát triển Khoa học & Công nghệ – Health Sciences',
    shortName: 'Sci. Tech. Dev. J. - Health Sci.',
    publisher: 'ĐHQG TP.HCM / VNU-HCM Press',
    color: '#2B74B7', // Official Journal Blue RGB(43, 116, 183) - Verified in HS 722.pdf
    accentColor: '#E65100', // Burnt orange accent
    issn: '2734-9276',
    eIssn: '2734-9276',
    headerText: 'Tạp chí Phát triển Khoa học và Công nghệ – Health Sciences',
    // As printed on the journal's own sample PDF (header line and 'Cite this article')
    officialNameEn: 'VNUHCM Journal of Health Sciences',
    officialAbbvEn: 'VNUHCM J. Health Sci.',
    doiPrefix: '10.32508/vnuhcmj-hs',
  },
  'VNUHCM-STD': {
    id: 'VNUHCM-STD',
    name: 'Tạp chí Phát triển Khoa học & Công nghệ – Tự nhiên & Đời sống',
    shortName: 'Sci. Tech. Dev. J.',
    publisher: 'ĐHQG TP.HCM / VNU-HCM Press',
    color: '#000099', // Official Deep Blue RGB(0, 0, 153) - Verified in 4581+PUBLISHED (1).pdf
    accentColor: '#00245F',
    issn: '1859-0128',
    eIssn: '2588-1469',
    headerText: 'Science & Technology Development Journal',
    // As printed on the journal's own sample PDF (header line and 'Cite this article')
    officialNameEn: 'VNUHCM Journal of Science and Technology Development',
    officialAbbvEn: 'VNUHCMJ. Sci. Technol. Dev.',
  },
  'VNUHCM-STDJ': {
    id: 'VNUHCM-STDJ',
    name: 'Tạp chí Phát triển Khoa học & Công nghệ – Tự nhiên & Đời sống',
    shortName: 'Sci. Tech. Dev. J.',
    publisher: 'ĐHQG TP.HCM / VNU-HCM Press',
    color: '#000099', // Official Deep Blue RGB(0, 0, 153)
    accentColor: '#00245F',
    issn: '1859-0128',
    eIssn: '2588-1469',
    headerText: 'Science & Technology Development Journal',
    // As printed on the journal's own sample PDF (header line and 'Cite this article')
    officialNameEn: 'VNUHCM Journal of Science and Technology Development',
    officialAbbvEn: 'VNUHCMJ. Sci. Technol. Dev.',
  },
  'VNUHCM-SSH': {
    id: 'VNUHCM-SSH',
    name: 'Tạp chí Phát triển Khoa học & Công nghệ – Khoa học Xã hội & Nhân văn',
    shortName: 'Sci. Tech. Dev. J. - Soc. Sci. Hum.',
    publisher: 'ĐHQG TP.HCM / VNU-HCM Press',
    color: '#0000FF', // Official Cobalt Royal Blue RGB(0, 0, 255) - Verified in 1102+PDF.pdf
    accentColor: '#00245F',
    issn: '2588-1043',
    headerText: 'Tạp chí Phát triển KH&CN – Khoa học Xã hội & Nhân văn',
    // As printed on the journal's own sample PDF (header line and 'Cite this article')
    officialNameEn: 'VNUHCM Journal of Social Sciences and Humanities',
    officialAbbvEn: 'VNUHCMJ. Soc. Sci. Humanit.',
  },
  'VNUHCM-EBL': {
    id: 'VNUHCM-EBL',
    name: 'Tạp chí Phát triển Khoa học & Công nghệ – Kinh tế, Luật & Quản lý',
    shortName: 'Sci. Tech. Dev. J. - Econ. Bus. Law',
    publisher: 'ĐHQG TP.HCM / VNU-HCM Press',
    color: '#8F0B97', // Official Magenta/Purple RGB(143, 11, 151) - Verified in EBL ID1750.pdf
    accentColor: '#BA68C8',
    issn: '2588-1108',
    headerText: 'Tạp chí Phát triển KH&CN – Kinh tế, Luật & Quản lý',
    // As printed in the reference PDF (EBL ID1750)
    officialNameEn: 'VNUHCM Journal of Economics, Business and Law',
    officialAbbvEn: 'VNUHCM J. Econ. Bus. Law',
    doiPrefix: '10.32508/vnuhcmj-ebl',
  },
  'VNUHCM-ET': {
    id: 'VNUHCM-ET',
    name: 'Tạp chí Phát triển Khoa học & Công nghệ – Kỹ thuật & Công nghệ',
    shortName: 'Sci. Tech. Dev. J. - Eng. Tech.',
    publisher: 'ĐHQG TP.HCM / VNU-HCM Press',
    color: '#000000', // The ET sample PDF (ET ID1563) has no brand colour: title, headings and rules are plain black
    accentColor: '#F8AB60',
    issn: '2588-1205',
    headerText: 'Tạp chí Phát triển KH&CN – Kỹ thuật & Công nghệ',
    // As printed on the journal's own sample PDF (header line and 'Cite this article')
    officialNameEn: 'VNUHCM Journal of Engineering and Technology',
    officialAbbvEn: 'VNUHCM J. Eng. Technol.',
  },
  'VNUHCM-EES': {
    id: 'VNUHCM-EES',
    name: 'Tạp chí Phát triển Khoa học & Công nghệ – Môi trường & Khoa học Trái đất',
    shortName: 'Sci. Tech. Dev. J. - Env. Earth Sci.',
    publisher: 'ĐHQG TP.HCM / VNU-HCM Press',
    color: '#0C712F', // Official Forest Green RGB(12, 113, 47) - Verified in EES+ID850+(1).pdf
    accentColor: '#00803F',
    issn: '2588-1329',
    headerText: 'Tạp chí Phát triển KH&CN – Môi trường & Khoa học Trái đất',
    // As printed on the journal's own sample PDF (header line and 'Cite this article')
    officialNameEn: 'VNUHCM Journal of Environment and Earth Sciences',
    officialAbbvEn: 'VNUHCM J. Environ. Earth Sci.',
    doiPrefix: '10.32508/vnuhcmj-ees',
  },
  'VNUHCM-ARNS': {
    id: 'VNUHCM-ARNS',
    name: 'Tạp chí Phát triển Khoa học & Công nghệ – Nghiên cứu Tự nhiên Nâng cao',
    shortName: 'Sci. Tech. Dev. J. - Nat. Sci.',
    publisher: 'ĐHQG TP.HCM / VNU-HCM Press',
    color: '#FF0000', // Official Natural Sciences Red RGB(255, 0, 0) - Verified in 1421 NS PDF.pdf
    accentColor: '#D32F2F',
    issn: '2588-140X',
    headerText: 'Tạp chí Phát triển KH&CN – Natural Sciences',
    // As printed on the journal's own sample PDF (header line and 'Cite this article')
    officialNameEn: 'VNUHCM Journal of Advanced Research and Natural Sciences',
    officialAbbvEn: 'VNUHCM J. Adv. Res. Nat. Sci.',
  },
};

/** "VNUHCM-HS" / "vnuhcm_hs" / "hs" -> "hs"; the old STDJ names mean the standard journal. */
export function journalKeyOf(journalId: string): string {
  const key = journalId.trim().toLowerCase().replace(/^vnuhcm[-_ ]/, '');
  return key === 'stdj' || key === 'jst' ? 'std' : key;
}

const builtInTemplate = (key: string): JournalTemplate | undefined =>
  JOURNAL_TEMPLATES[`VNUHCM-${key.toUpperCase()}`];

/** What the server published for the journal (name, code, colour and print details) as a template. */
function templateFromTier(key: string, tier: JournalTierProfile, fallback?: JournalTemplate): JournalTemplate {
  const p = tier.publication ?? {};
  const code = tier.names?.short || fallback?.id || `VNUHCM-${key.toUpperCase()}`;
  const color = tier.color || fallback?.color || '#000099';
  return {
    id: fallback?.id ?? code,
    name: p.name || tier.names?.vi || fallback?.name || code,
    shortName: p.shortName || fallback?.shortName || code,
    publisher: p.publisher || fallback?.publisher || 'ĐHQG TP.HCM / VNU-HCM Press',
    color,
    accentColor: p.accentColor || fallback?.accentColor || color,
    issn: p.issn ?? fallback?.issn,
    eIssn: p.eIssn ?? fallback?.eIssn,
    headerText: p.headerText || tier.names?.en || fallback?.headerText || code,
    officialNameEn: p.officialNameEn ?? fallback?.officialNameEn,
    officialAbbvEn: p.officialAbbvEn ?? fallback?.officialAbbvEn,
    doiPrefix: p.doiPrefix ?? fallback?.doiPrefix,
  };
}

/** The journal's template, or undefined for a journal nobody knows. The server's published rules win over the built-ins. */
export function findJournalTemplate(journalId?: string | null): JournalTemplate | undefined {
  if (!journalId) return undefined;
  const direct = JOURNAL_TEMPLATES[journalId];
  const key = journalKeyOf(journalId);
  const tier = getRemoteJournalTier(key);
  const builtIn = direct ?? builtInTemplate(key);
  if (tier) return templateFromTier(key, tier, builtIn);
  return builtIn;
}

export function getJournalTemplate(journalId?: string): JournalTemplate {
  return findJournalTemplate(journalId) ?? findJournalTemplate('VNUHCM-HS')!;
}

/** Every journal the app knows: the built-ins plus those the server published (a journal added by an admin). */
export function listJournalTemplates(): JournalTemplate[] {
  const builtIns = Object.values(JOURNAL_TEMPLATES).map((t) => findJournalTemplate(t.id)!);
  const known = new Set(Object.keys(JOURNAL_TEMPLATES).map(journalKeyOf));
  const added = remoteJournalKeys()
    .filter((key) => !known.has(key))
    .map((key) => findJournalTemplate(`VNUHCM-${key.toUpperCase()}`)!);
  return [...builtIns, ...added];
}
