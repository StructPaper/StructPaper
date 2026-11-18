import { JournalTierProfile } from '../types';

export const ALL_JOURNAL_IDS = [
  'std',
  'hs',
  'ssh',
  'ebl',
  'et',
  'ees',
  'arns',
] as const;

export type JournalId = (typeof ALL_JOURNAL_IDS)[number];

export const JOURNAL_DEFINITIONS: Record<JournalId, JournalTierProfile> = {
  std: {
    id: 'std',
    names: {
      vi: 'Tạp chí Phát triển Khoa học và Công nghệ',
      en: 'Science and Technology Development Journal',
      short: 'VNUHCM-STD',
    },
    color: '#000099', // Official Deep Blue RGB(0, 0, 153) - Verified in 4581+PUBLISHED (1).pdf
    frontMatter: {
      doiPattern: '^10\\.32508/vnuhcm-std\\.\\d+$',
    },
    latex: {
      cls: 'structpaper-std.cls',
    },
    publication: {
      name: 'Tạp chí Phát triển Khoa học & Công nghệ – Tự nhiên & Đời sống',
      shortName: 'Sci. Tech. Dev. J.',
      publisher: 'ĐHQG TP.HCM / VNU-HCM Press',
      accentColor: '#00245F',
      eIssn: '2588-1469',
      headerText: 'Science & Technology Development Journal',
      officialNameEn: 'VNUHCM Journal of Science and Technology Development',
      officialAbbvEn: 'VNUHCMJ. Sci. Technol. Dev.',
    },
  },
  hs: {
    id: 'hs',
    names: {
      vi: 'Tạp chí Phát triển KH&CN - Khoa học Sức khỏe',
      en: 'Science & Technology Development Journal - Health Sciences',
      short: 'VNUHCM-HS',
    },
    color: '#2B74B7', // Official Journal Blue RGB(43, 116, 183) - Verified in HS 722.pdf
    frontMatter: {
      doiPattern: '^10\\.32508/vnuhcm-hs\\.\\d+$',
    },
    latex: {
      cls: 'structpaper-hs.cls',
    },
    publication: {
      name: 'Tạp chí Phát triển Khoa học & Công nghệ – Health Sciences',
      shortName: 'Sci. Tech. Dev. J. - Health Sci.',
      publisher: 'ĐHQG TP.HCM / VNU-HCM Press',
      accentColor: '#E65100',
      eIssn: '2734-9276',
      headerText: 'Tạp chí Phát triển Khoa học và Công nghệ – Health Sciences',
      officialNameEn: 'VNUHCM Journal of Health Sciences',
      officialAbbvEn: 'VNUHCM J. Health Sci.',
      doiPrefix: '10.32508/vnuhcmj-hs',
    },
  },
  ssh: {
    id: 'ssh',
    names: {
      vi: 'Tạp chí Phát triển KH&CN - Khoa học Xã hội và Nhân văn',
      en: 'Science & Technology Development Journal - Social Sciences and Humanities',
      short: 'VNUHCM-SSH',
    },
    color: '#0000FF', // Official Cobalt Royal Blue RGB(0, 0, 255) - Verified in 1102+PDF.pdf
    frontMatter: {
      doiPattern: '^10\\.32508/vnuhcm-ssh\\.\\d+$',
    },
    latex: {
      cls: 'structpaper-ssh.cls',
    },
    publication: {
      name: 'Tạp chí Phát triển Khoa học & Công nghệ – Khoa học Xã hội & Nhân văn',
      shortName: 'Sci. Tech. Dev. J. - Soc. Sci. Hum.',
      publisher: 'ĐHQG TP.HCM / VNU-HCM Press',
      accentColor: '#00245F',
      headerText: 'Tạp chí Phát triển KH&CN – Khoa học Xã hội & Nhân văn',
      officialNameEn: 'VNUHCM Journal of Social Sciences and Humanities',
      officialAbbvEn: 'VNUHCMJ. Soc. Sci. Humanit.',
    },
  },
  ebl: {
    id: 'ebl',
    names: {
      vi: 'Tạp chí Phát triển KH&CN - Kinh tế, Luật và Quản lý',
      en: 'Science & Technology Development Journal - Economics, Business and Law',
      short: 'VNUHCM-EBL',
    },
    color: '#8F0B97', // Official Magenta/Purple RGB(143, 11, 151) - Verified in EBL ID1750.pdf
    frontMatter: {
      doiPattern: '^10\\.32508/vnuhcm-ebl\\.\\d+$',
    },
    latex: {
      cls: 'structpaper-ebl.cls',
    },
    publication: {
      name: 'Tạp chí Phát triển Khoa học & Công nghệ – Kinh tế, Luật & Quản lý',
      shortName: 'Sci. Tech. Dev. J. - Econ. Bus. Law',
      publisher: 'ĐHQG TP.HCM / VNU-HCM Press',
      accentColor: '#BA68C8',
      headerText: 'Tạp chí Phát triển KH&CN – Kinh tế, Luật & Quản lý',
      officialNameEn: 'VNUHCM Journal of Economics, Business and Law',
      officialAbbvEn: 'VNUHCM J. Econ. Bus. Law',
      doiPrefix: '10.32508/vnuhcmj-ebl',
    },
  },
  et: {
    id: 'et',
    names: {
      vi: 'Tạp chí Phát triển KH&CN - Kỹ thuật và Công nghệ',
      en: 'Science & Technology Development Journal - Engineering and Technology',
      short: 'VNUHCM-ET',
    },
    color: '#000000', // The ET sample PDF (ET ID1563) has no brand colour: title, headings and rules are plain black
    frontMatter: {
      doiPattern: '^10\\.32508/vnuhcm-et\\.\\d+$',
    },
    latex: {
      cls: 'structpaper-et.cls',
    },
    publication: {
      name: 'Tạp chí Phát triển Khoa học & Công nghệ – Kỹ thuật & Công nghệ',
      shortName: 'Sci. Tech. Dev. J. - Eng. Tech.',
      publisher: 'ĐHQG TP.HCM / VNU-HCM Press',
      accentColor: '#F8AB60',
      headerText: 'Tạp chí Phát triển KH&CN – Kỹ thuật & Công nghệ',
      officialNameEn: 'VNUHCM Journal of Engineering and Technology',
      officialAbbvEn: 'VNUHCM J. Eng. Technol.',
    },
  },
  ees: {
    id: 'ees',
    names: {
      vi: 'Tạp chí Phát triển KH&CN - Môi trường & Khoa học Trái đất',
      en: 'Science & Technology Development Journal - Environment and Earth Sciences',
      short: 'VNUHCM-EES',
    },
    color: '#0C712F', // Official Forest Green RGB(12, 113, 47) - Verified in EES+ID850+(1).pdf
    frontMatter: {
      doiPattern: '^10\\.32508/vnuhcm-ees\\.\\d+$',
    },
    latex: {
      cls: 'structpaper-ees.cls',
    },
    publication: {
      name: 'Tạp chí Phát triển Khoa học & Công nghệ – Môi trường & Khoa học Trái đất',
      shortName: 'Sci. Tech. Dev. J. - Env. Earth Sci.',
      publisher: 'ĐHQG TP.HCM / VNU-HCM Press',
      accentColor: '#00803F',
      headerText: 'Tạp chí Phát triển KH&CN – Môi trường & Khoa học Trái đất',
      officialNameEn: 'VNUHCM Journal of Environment and Earth Sciences',
      officialAbbvEn: 'VNUHCM J. Environ. Earth Sci.',
      doiPrefix: '10.32508/vnuhcmj-ees',
    },
  },
  arns: {
    id: 'arns',
    names: {
      vi: 'Tạp chí Phát triển KH&CN - Khoa học Tự nhiên',
      en: 'Science & Technology Development Journal - Advanced Research in Natural Sciences',
      short: 'VNUHCM-ARNS',
    },
    color: '#FF0000', // Official Natural Sciences Red RGB(255, 0, 0) - Verified in 1421 NS PDF.pdf
    frontMatter: {
      doiPattern: '^10\\.32508/vnuhcm-arns\\.\\d+$',
    },
    latex: {
      cls: 'structpaper-arns.cls',
    },
    publication: {
      name: 'Tạp chí Phát triển Khoa học & Công nghệ – Nghiên cứu Tự nhiên Nâng cao',
      shortName: 'Sci. Tech. Dev. J. - Nat. Sci.',
      publisher: 'ĐHQG TP.HCM / VNU-HCM Press',
      accentColor: '#D32F2F',
      headerText: 'Tạp chí Phát triển KH&CN – Natural Sciences',
      officialNameEn: 'VNUHCM Journal of Advanced Research and Natural Sciences',
      officialAbbvEn: 'VNUHCM J. Adv. Res. Nat. Sci.',
    },
  },
};

export const JOURNAL_ALIASES: Record<string, JournalId> = {
  // std
  std: 'std',
  'vnuhcm-std': 'std',
  'vnuhcm_std': 'std',
  'vnuhcm std': 'std',
  'vnuhcm-stdj': 'std',
  'vnuhcm_stdj': 'std',
  'vnuhcm stdj': 'std',
  stdj: 'std',

  // hs
  hs: 'hs',
  'vnuhcm-hs': 'hs',
  'vnuhcm_hs': 'hs',
  'vnuhcm hs': 'hs',

  // ssh
  ssh: 'ssh',
  'vnuhcm-ssh': 'ssh',
  'vnuhcm_ssh': 'ssh',
  'vnuhcm ssh': 'ssh',

  // ebl
  ebl: 'ebl',
  'vnuhcm-ebl': 'ebl',
  'vnuhcm_ebl': 'ebl',
  'vnuhcm ebl': 'ebl',

  // et
  et: 'et',
  'vnuhcm-et': 'et',
  'vnuhcm_et': 'et',
  'vnuhcm et': 'et',

  // ees
  ees: 'ees',
  'vnuhcm-ees': 'ees',
  'vnuhcm_ees': 'ees',
  'vnuhcm ees': 'ees',

  // arns
  arns: 'arns',
  'vnuhcm-arns': 'arns',
  'vnuhcm_arns': 'arns',
  'vnuhcm arns': 'arns',
  'vnuhcm-ns': 'arns',
  ns: 'arns',
};

export function normalizeJournalId(rawId: string): JournalId | undefined {
  const normalized = rawId.trim().toLowerCase();
  return JOURNAL_ALIASES[normalized];
}
