/** Everything the journal template prints around the content, in one language. */
export interface PageLabels {
  correspondence: string;
  history: string;
  received: string;
  revised: string;
  accepted: string;
  published: string;
  copyright: string;
  publisherShort: string;
  copyrightText: string;
  citeText: string;
  abstractName: string;
  keywords: string;
  figure: string;
  table: string;
  references: string;
}

export type PageLanguage = 'vi' | 'en';

export const ENGLISH_LABELS: PageLabels = {
  correspondence: 'Correspondence',
  history: 'History',
  received: 'Received',
  revised: 'Revised',
  accepted: 'Accepted',
  published: 'Published Online',
  copyright: 'Copyright',
  publisherShort: 'VNUHCM Journal',
  copyrightText: 'This is an open-access article distributed under the terms of the Creative Commons Attribution 4.0 International license.',
  citeText: 'Cite this article',
  abstractName: 'ABSTRACT ',
  keywords: 'Key words',
  figure: 'Figure',
  table: 'Table',
  references: 'References',
};

export const VIETNAMESE_LABELS: PageLabels = {
  correspondence: 'Liên hệ',
  history: 'Lịch sử',
  received: 'Ngày nhận',
  revised: 'Ngày sửa đổi',
  accepted: 'Ngày chấp nhận',
  published: 'Ngày đăng',
  copyright: 'Bản quyền',
  publisherShort: 'ĐHQG Tp.HCM',
  copyrightText: 'Đây là bài báo công bố mở được phát hành theo các điều khoản của the Creative Commons Attribution 4.0 International license.',
  citeText: 'Trích dẫn bài báo này',
  abstractName: 'TÓM TẮT ',
  keywords: 'Từ khoá',
  figure: 'Hình',
  table: 'Bảng',
  references: 'Tài liệu tham khảo',
};

export const labelsFor = (lang: PageLanguage): PageLabels => (lang === 'en' ? ENGLISH_LABELS : VIETNAMESE_LABELS);

/** TeX source of the label macros (same order and shape as the official template defines them). */
export function labelMacros(l: PageLabels): string {
  return [
    String.raw`\def\absname{${l.abstractName}}`,
    String.raw`\def\Correspondence{\normalfont\textbf{${l.correspondence}}}`,
    String.raw`\def\History{\normalfont\textbf{${l.history}}}`,
    String.raw`\def\Received{${l.received}}`,
    String.raw`\def\Revised{${l.revised}}`,
    String.raw`\def\Accepted{${l.accepted}}`,
    String.raw`\def\Published{${l.published}}`,
    String.raw`\def\Copyright{\normalfont\textbf{${l.copyright}}}`,
    String.raw`\def\publishershortname{${l.publisherShort}}`,
    String.raw`\def\copyrighttext{${l.copyrightText}}`,
    String.raw`\def\citetext{${l.citeText}}`,
  ].join('\n');
}

/**
 * Rewrites the label macros of the (Vietnamese) official preamble into another language.
 * The template defines each of them once, so this is how the first page switches language.
 */
export function relabelPreamble(preamble: string, l: PageLabels): string {
  const macro = (name: string, body: string): [RegExp, string] => [
    new RegExp(String.raw`\\def\\` + name + String.raw`\{[^\n]*\n`),
    String.raw`\def` + '\\' + name + '{' + body + '}\n',
  ];
  const rules: Array<[RegExp, string]> = [
    macro('absname', l.abstractName),
    macro('Correspondence', String.raw`\normalfont\textbf{${l.correspondence}}`),
    macro('History', String.raw`\normalfont\textbf{${l.history}}`),
    macro('Received', l.received),
    macro('Revised', l.revised),
    macro('Accepted', l.accepted),
    macro('Published', l.published),
    macro('Copyright', String.raw`\normalfont\textbf{${l.copyright}}`),
    macro('publishershortname', l.publisherShort),
    macro('copyrighttext', l.copyrightText),
    macro('citetext', l.citeText),
    macro('figurenm', String.raw`\sffamily\bfseries\color{titlecolor}${l.figure}`),
    macro('tablenm', String.raw`\sffamily\bfseries\color{titlecolor}${l.table}`),
  ];
  return rules.reduce((text, [pattern, replacement]) => text.replace(pattern, () => replacement), preamble);
}
