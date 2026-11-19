import { describe, it, expect } from 'vitest';
import { exportToLatex } from '@/lib/exporters';
import { createEmptyPaper } from '@/types/paper';
import { relabelPreamble, ENGLISH_LABELS } from '@/lib/page-labels';

const base: any = createEmptyPaper('VNUHCM-STD');
const paper: any = {
  ...base,
  metadata: {
    ...base.metadata,
    title: 'Tiêu đề tiếng Việt',
    titleEn: 'The English Title',
    abstract: 'Tóm tắt tiếng Việt của bài.',
    abstractEn: 'The English abstract of the paper.',
    keywords: ['từ khoá một'],
    keywordsEn: ['keyword one'],
    articleType: 'Bài báo nghiên cứu',
    articleTypeEn: 'Research Article',
  },
};

/** The first page (everything before the closing summary page) and the closing page. */
const split = (tex: string) => {
  const i = tex.lastIndexOf('\\clearpage\n\\makeatletter');
  return { first: tex.slice(0, i), closing: tex.slice(i) };
};

describe('primary language of the PDF', () => {
  it('Vietnamese (default): Vietnamese first page, English closing page', () => {
    const { first, closing } = split(exportToLatex(paper));

    expect(first).toContain('\\title{Tiêu đề tiếng Việt}');
    expect(first).toContain('\\def\\absname{TÓM TẮT }');
    expect(first).toContain('Từ khoá: ');
    expect(closing).toContain('\\title{The English Title}');
    expect(closing).toContain('\\def\\absname{ABSTRACT }');
    expect(closing).toContain('The English abstract');
  });

  it('English: English title, abstract, keywords, article type and labels up front; Vietnamese last', () => {
    const { first, closing } = split(exportToLatex(paper, undefined, { primaryLanguage: 'en' }));

    expect(first).toContain('\\title{The English Title}');
    expect(first).toContain('The English abstract of the paper.');
    expect(first).toContain('keyword one');
    expect(first).toContain('\\articletype{Research Article}');
    expect(first).toContain('\\def\\absname{ABSTRACT }');
    expect(first).toContain('Key words: ');
    expect(first).toContain('{References}');
    expect(first).not.toContain('Tiêu đề tiếng Việt');

    expect(closing).toContain('\\title{Tiêu đề tiếng Việt}');
    expect(closing).toContain('Tóm tắt tiếng Việt của bài.');
    expect(closing).toContain('\\articletype{Bài báo nghiên cứu}');
    expect(closing).toContain('\\def\\absname{TÓM TẮT }');
    expect(closing).toContain('Từ khoá: ');
  });

  it('English falls back to the Vietnamese text for whatever has no English version', () => {
    const noEnglish: any = { ...paper, metadata: { ...paper.metadata, titleEn: '', abstractEn: '', keywordsEn: [] } };
    const { first } = split(exportToLatex(noEnglish, undefined, { primaryLanguage: 'en' }));

    expect(first).toContain('\\title{Tiêu đề tiếng Việt}');
    expect(first).toContain('Tóm tắt tiếng Việt của bài.');
  });

  it('relabelPreamble rewrites every label macro and nothing else', () => {
    const source = '\\def\\absname{TÓM TẮT }\n\\def\\Received{Ngày nhận}\n\\def\\citetext{Trích dẫn bài báo này}\n\\usepackage{x}\n';
    const out = relabelPreamble(source, ENGLISH_LABELS);

    expect(out).toContain('\\def\\absname{ABSTRACT }');
    expect(out).toContain('\\def\\Received{Received}');
    expect(out).toContain('\\def\\citetext{Cite this article}');
    expect(out).toContain('\\usepackage{x}');
    expect(out).not.toContain('TÓM TẮT');
  });
});
