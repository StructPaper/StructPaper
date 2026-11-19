// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import { DocumentDiffView } from '@/features/history/components/DocumentDiffView';

afterEach(cleanup);

/** A paper with something in every place the editor's tabs can put something. */
const full = (): any => ({
  metadata: {
    title: 'Tiêu đề bài',
    titleEn: 'Paper title',
    articleType: 'Bài báo nghiên cứu',
    articleTypeEn: 'Research Article',
    journalId: 'VNUHCM-HS',
    journalName: 'Tạp chí Sức khỏe',
    journalAbbv: 'Health Sci.',
    authors: [
      { id: 'a1', name: 'Nguyễn An', affiliationIds: [1, 2], isCorresponding: true, email: 'an@x.vn', orcid: '0000-0001' },
      { id: 'a2', name: 'Trần Bình', affiliationIds: [2] },
    ],
    affiliations: [
      { id: 1, name: 'Đại học A', nameEn: 'University A' },
      { id: 2, name: 'Viện B' },
    ],
    corresponding: { name: 'Nguyễn An', email: 'an@x.vn', affiliation: 'Đại học A' },
    abstract: 'Tóm tắt tiếng Việt.',
    abstractEn: 'English abstract.',
    keywords: ['một', 'hai'],
    keywordsEn: ['one', 'two'],
    dates: { received: '01/01/2026', revised: '02/02/2026', accepted: '03/03/2026', published: '' },
    publication: { volume: '12', issue: '3', firstPage: '100', lastPage: '110', doi: '10.1/abc', published: '04/04/2026', articleId: 'a-77' },
    year: '2026',
  },
  sections: [
    { id: 'h', type: 'h1', title: 'Giới thiệu', content: '' },
    { id: 'p', type: 'paragraph', content: 'Đoạn văn.' },
    { id: 'q', type: 'quote', content: 'Trích dẫn dài.' },
    { id: 'b', type: 'box', title: 'Hộp', content: 'Nội dung hộp.' },
    { id: 'e', type: 'equation', content: '', equation: { latex: 'E=mc^2', numbered: true, num: 1 } },
    { id: 'f', type: 'figure', content: '', figure: { id: 'f', num: 1, caption: 'Hình thử', src: 'x' } },
    { id: 't', type: 'table', content: '', table: { id: 't', num: 1, caption: 'Bảng thử', headers: ['A'], rows: [['1']] } },
    { id: 'c', type: 'citation', title: 'Trích dẫn bài báo này', content: 'Nguyen A (2026) Paper title.' },
  ],
  references: [{ id: 1, raw: 'Tài liệu một' }],
  layoutSettings: { columnLayout: '1-column', fontSize: '10pt' },
});

describe('what the history page shows of a version', () => {
  it('shows everything the editor tabs hold', () => {
    render(<DocumentDiffView doc={full()} showChanges={false} />);
    const view = screen.getByTestId('document-diff-view');

    // information about the article (metadata tab)
    const info = within(screen.getByTestId('doc-info'));
    for (const text of ['Bài báo nghiên cứu', 'Research Article', 'Tạp chí Sức khỏe', 'Health Sci.', '12', '100', '110', '10.1/abc', 'a-77', '01/01/2026', '02/02/2026', '03/03/2026', '04/04/2026']) {
      expect(info.getAllByText((_, el) => !!el && el.tagName === 'DD' && (el.textContent ?? '').includes(text)).length).toBeGreaterThan(0);
    }
    for (const label of ['Loại bài', 'Tạp chí', 'Tập', 'Số', 'Trang đầu', 'Trang cuối', 'DOI', 'Ngày nhận', 'Ngày sửa đổi', 'Ngày chấp nhận', 'Ngày xuất bản', 'Tác giả liên hệ']) {
      expect(info.getAllByText(label).length).toBeGreaterThan(0);
    }

    // authors tab: units, corresponding flag, e-mail and ORCID; affiliations with the English name
    const authors = screen.getByTestId('doc-authors').textContent ?? '';
    expect(authors).toContain('Nguyễn An');
    expect(authors).toContain('liên hệ');
    expect(authors).toContain('an@x.vn');
    expect(authors).toContain('ORCID 0000-0001');
    expect(screen.getByTestId('doc-affiliations').textContent).toContain('University A');

    // abstract tab, in both languages
    for (const text of ['Tóm tắt tiếng Việt.', 'English abstract.', 'một, hai', 'one, two', 'Paper title']) expect(view.textContent).toContain(text);

    // sections tab: every kind of block
    const body = screen.getByTestId('doc-body').textContent ?? '';
    for (const text of ['Giới thiệu', 'Đoạn văn.', 'Trích dẫn dài.', 'Hộp', 'Nội dung hộp.', 'E=mc^2', 'Hình thử', 'Bảng thử']) expect(body).toContain(text);

    // citation tab, references tab, and the paper's own layout settings
    expect(screen.getByTestId('doc-citation').textContent).toContain('Nguyen A (2026) Paper title.');
    expect(screen.getByTestId('doc-references').textContent).toContain('Tài liệu một');
    const layout = screen.getByTestId('doc-layout').textContent ?? '';
    expect(layout).toContain('Số cột');
    expect(layout).toContain('1-column');
    expect(layout).toContain('Cỡ chữ');
  });

  it('marks a change in any of those places', () => {
    const before = full();
    const after = full();
    after.metadata.articleTypeEn = 'Review Article';
    after.metadata.publication.volume = '13';
    after.metadata.dates.accepted = '05/05/2026';
    after.metadata.keywordsEn = ['one', 'three'];
    after.metadata.authors[1] = { ...after.metadata.authors[1], email: 'binh@x.vn' };
    after.sections.find((s: any) => s.type === 'citation').content = 'Nguyen A (2026) Changed.';
    after.layoutSettings = { columnLayout: '2-column', fontSize: '10pt' };
    render(<DocumentDiffView doc={after} compareTo={before} showChanges />);

    const info = screen.getByTestId('doc-info');
    expect(info.querySelectorAll('[data-change="modified"]').length).toBeGreaterThanOrEqual(3);
    expect(within(info).getAllByTestId('mark-add').length).toBeGreaterThan(0);
    expect(screen.getByTestId('doc-authors').textContent).toContain('Đã sửa: email');
    expect(screen.getByTestId('doc-citation').getAttribute('data-change')).toBe('modified');
    expect(screen.getByTestId('doc-layout').querySelector('[data-change="modified"]')?.textContent).toContain('Số cột');
    expect(screen.getByTestId('document-diff-view').textContent).toContain('three');
  });

  it('does not invent rows for an empty paper', () => {
    render(<DocumentDiffView doc={{ metadata: { title: 'Chỉ có tiêu đề', authors: [], affiliations: [] }, sections: [], references: [] }} showChanges={false} />);
    expect(screen.queryByTestId('doc-info')).toBeNull();
    expect(screen.queryByTestId('doc-citation')).toBeNull();
    expect(screen.queryByTestId('doc-layout')).toBeNull();
    expect(screen.getByText('Phiên bản này chưa có nội dung.')).toBeTruthy();
  });
});
