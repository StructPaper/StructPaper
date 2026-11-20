import { toAsciiName } from './latex-english-page';

/**
 * The English page prints the affiliation in English. When the author gave only the Vietnamese line, this gives a draft English
 * name (known institutions and the usual words: Khoa -> Faculty of, Trường Đại học -> University of, ...). Words it does not know
 * are printed without diacritics so the line is at least readable; the author can still type the exact English name.
 */
const WHOLE: [RegExp, string][] = [
  [/^(?:Trường\s+)?Đại học Quốc gia (?:Thành phố|TP\.?) Hồ Chí Minh$|^ĐHQG-?\s*HCM$/i, 'Vietnam National University Ho Chi Minh City'],
  [/^(?:Trường\s+)?Đại học Quốc gia Hà Nội$|^ĐHQGHN$/i, 'Vietnam National University, Hanoi'],
  [/^Trường Đại học Bách khoa$/i, 'Ho Chi Minh City University of Technology (HCMUT)'],
  [/^Trường Đại học Khoa học Tự nhiên$/i, 'University of Science'],
  [/^Trường Đại học Khoa học Xã hội và Nhân văn$/i, 'University of Social Sciences and Humanities'],
  [/^Trường Đại học Quốc tế$/i, 'International University'],
  [/^Trường Đại học Công nghệ Thông tin$/i, 'University of Information Technology'],
  [/^Trường Đại học Kinh tế - Luật$/i, 'University of Economics and Law'],
  [/^Trường Đại học An Giang$/i, 'An Giang University'],
  [/^Trường Đại học Nông Lâm$/i, 'University of Agriculture and Forestry'],
];

const WORDS: [RegExp, string][] = [
  [/Việt Nam/gi, 'Vietnam'],
  [/Thành phố Hồ Chí Minh|TP\.?\s*Hồ Chí Minh|TP\.?\s*HCM/gi, 'Ho Chi Minh City'],
  [/Hà Nội/gi, 'Hanoi'],
  [/Đà Nẵng/gi, 'Da Nang'],
  [/Cần Thơ/gi, 'Can Tho'],
];

const PREFIX: [RegExp, (rest: string) => string][] = [
  [/^Trường Đại học (.+)$/i, (r) => `University of ${noun(r)}`],
  [/^Đại học (.+)$/i, (r) => `${noun(r)} University`],
  [/^Học viện (.+)$/i, (r) => `Academy of ${noun(r)}`],
  [/^Viện (?:nghiên cứu )?(.+)$/i, (r) => `Institute of ${noun(r)}`],
  [/^Khoa (.+)$/i, (r) => `Faculty of ${noun(r)}`],
  [/^Bộ môn (.+)$/i, (r) => `Department of ${noun(r)}`],
  [/^Phòng (.+)$/i, (r) => `Office of ${noun(r)}`],
  [/^Trung tâm (.+)$/i, (r) => `${noun(r)} Center`],
  [/^Bệnh viện (.+)$/i, (r) => `${noun(r)} Hospital`],
  [/^Sở (.+)$/i, (r) => `Department of ${noun(r)}`],
  [/^Công ty (.+)$/i, (r) => `${noun(r)} Company`],
];

const SUBJECTS: [RegExp, string][] = [
  [/Công nghệ Thông tin/gi, 'Information Technology'],
  [/Khoa học và Kỹ thuật Máy tính/gi, 'Computer Science and Engineering'],
  [/Khoa học Máy tính/gi, 'Computer Science'],
  [/Kỹ thuật Xây dựng/gi, 'Civil Engineering'],
  [/Kỹ thuật Hóa học/gi, 'Chemical Engineering'],
  [/Kỹ thuật Điện - Điện tử|Điện - Điện tử/gi, 'Electrical and Electronics Engineering'],
  [/Kỹ thuật Môi trường|Môi trường/gi, 'Environment'],
  [/Công nghệ Sinh học/gi, 'Biotechnology'],
  [/Kỹ thuật Cơ khí|Cơ khí/gi, 'Mechanical Engineering'],
  [/Khoa học Tự nhiên/gi, 'Science'],
  [/Khoa học Xã hội và Nhân văn/gi, 'Social Sciences and Humanities'],
  [/Khoa học và Công nghệ/gi, 'Science and Technology'],
  [/Địa chất(?: và Dầu khí)?/gi, 'Geology and Petroleum Engineering'],
  [/Quản lý Công nghiệp/gi, 'Industrial Management'],
  [/Kinh tế/gi, 'Economics'],
  [/Y học|Y khoa/gi, 'Medicine'],
  [/Dược/gi, 'Pharmacy'],
  [/Nông nghiệp/gi, 'Agriculture'],
  [/Kỹ thuật/gi, 'Engineering'],
  [/Hóa học/gi, 'Chemistry'],
  [/Vật lý/gi, 'Physics'],
  [/Toán(?:\s*-\s*Tin học)?/gi, 'Mathematics'],
  [/Sinh học/gi, 'Biology'],
  [/Giáo dục/gi, 'Education'],
  [/Bách khoa/gi, 'Technology'],
];

function noun(vi: string): string {
  let s = vi.trim();
  for (const [re, en] of SUBJECTS) s = s.replace(re, en);
  for (const [re, en] of WORDS) s = s.replace(re, en);
  return toAsciiName(s);
}

export function hasVietnamese(s: string): boolean {
  return /[ăâđêôơưáàảãạấầẩẫậắằẳẵặéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]/i.test(s);
}

/** "Khoa Kỹ thuật Xây dựng, Trường Đại học Bách khoa, ĐHQG-HCM" -> "Faculty of Civil Engineering, Ho Chi Minh City University of Technology (HCMUT), Vietnam National University Ho Chi Minh City". */
export function affiliationToEnglish(vi: string): string {
  const text = (vi || '').trim();
  if (!text || !hasVietnamese(text) && !/ĐHQG|TP\.?\s*HCM/i.test(text)) return text;
  return text
    .split(/\s*,\s*/)
    .map((part) => {
      const whole = WHOLE.find(([re]) => re.test(part));
      if (whole) return whole[1];
      for (const [re, make] of PREFIX) {
        const m = part.match(re);
        if (m) return make(m[1]);
      }
      return noun(part);
    })
    .filter(Boolean)
    .join(', ');
}

/** The English name of an affiliation: the author's own when given, otherwise a translated draft. */
export function affiliationEnglish(aff: { name?: string; nameEn?: string }): string {
  const own = (aff.nameEn || '').trim();
  if (own && !hasVietnamese(own)) return own;
  return affiliationToEnglish(own || aff.name || '');
}
