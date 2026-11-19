import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import type { CompletePaper } from '@/types/paper';
import { parseDocxFile } from '@/lib/docx-parser';
import { detectPrimaryLanguage, findVietnameseBackMatter, foldVietnamese } from '@/lib/docx-language';

const DIR = path.resolve(__dirname, '../../../../fixtures/golden/templates');
const load = async (name: string): Promise<CompletePaper> => {
  const buf = fs.readFileSync(path.join(DIR, name));
  return parseDocxFile(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer, name);
};

describe('English journal template sample: the first page is English, the closing page Vietnamese', () => {
  let paper: CompletePaper;
  beforeAll(async () => {
    paper = await load('Bài mẫu template tiếng Anh.docx');
  }, 60_000);

  it('puts the English text in the English slots and the closing Vietnamese page in the Vietnamese ones', () => {
    const m: any = paper.metadata;
    expect(m.titleEn).toMatch(/^The impact of digital social responsibility/);
    expect(m.title).toMatch(/^Ảnh hưởng của trách nhiệm xã hội kỹ thuật số/);
    expect(m.abstractEn).toMatch(/^In the context of robust digital transformation/);
    expect(m.abstract).toMatch(/^Trong bối cảnh chuyển đổi số/);
    expect(m.keywordsEn).toContain('brand equity');
    expect(m.keywords).toContain('tài sản thương hiệu');
  });

  it('keeps each abstract free of the other page (keywords and author lines are not glued on)', () => {
    const m: any = paper.metadata;
    expect(m.abstract).not.toMatch(/Từ khóa|Thông tin tác giả|@/);
    expect(m.abstractEn).not.toMatch(/Keywords:|Digital social responsibility, brand equity/);
  });

  it('maps "Research Article" to the Vietnamese type and keeps the English name', () => {
    const m: any = paper.metadata;
    expect(m.articleType).toBe('Bài báo nghiên cứu');
    expect(m.articleTypeEn).toBe('Research Article');
  });

  it('takes the Vietnamese author name and institution from the closing page, the English one stays as nameEn', () => {
    const m: any = paper.metadata;
    expect(m.authors[0].name).toBe('Trương Quang Huy');
    expect(m.affiliations[0].name).toMatch(/^Trường Đại học Kinh tế - Luật/);
    expect(m.affiliations[0].nameEn).toMatch(/^University of Economics and Law/);
  });

  it('does not leave the closing page behind as body text or as a reference', () => {
    const last = paper.references.at(-1)?.raw ?? '';
    expect(last).toMatch(/^Steiger/);
    const text = paper.sections.map((s) => `${s.title ?? ''} ${s.content ?? ''}`).join('\n');
    expect(text).not.toMatch(/Thông tin tác giả|Phần ngôn ngữ thứ/);
  });
});

describe('Vietnamese journal template sample keeps working', () => {
  it('Vietnamese stays primary, the English closing page fills the English slots', async () => {
    const m: any = (await load('Bài mẫu template tiếng Việt.docx')).metadata;
    expect(m.title).toMatch(/^Các yếu tố tác động/);
    expect(m.titleEn).toMatch(/^FACTORS AFFECTING/);
    expect(m.abstract).toMatch(/^Bài viết nhằm/);
    expect(m.abstractEn).toMatch(/^This study identifies/);
    expect(m.articleTypeEn).toBeUndefined();
  }, 60_000);
});

describe('detectPrimaryLanguage', () => {
  it('reads the labels of the template', () => {
    expect(detectPrimaryLanguage(['Article type: Research Article', 'Some title', 'Received: 01-01-2026', 'Abstract', 'Keywords: a'])).toBe('en');
    expect(detectPrimaryLanguage(['Loại bài báo: Bài nghiên cứu', 'Tiêu đề', 'Ngày nhận bài: 01-01-2026', 'Tóm tắt', 'Từ khóa: a'])).toBe('vi');
  });

  it('labels in the closing page (after the references) do not count', () => {
    const lines = ['Loại bài báo: Bài nghiên cứu', 'Tiêu đề', 'Tóm tắt', 'Từ khóa: a', 'Giới thiệu', 'Tài liệu tham khảo', 'x', 'Abstract', 'Keywords: b', 'Received: 1'];
    expect(detectPrimaryLanguage(lines)).toBe('vi');
  });

  it('falls back to the letters: no Vietnamese marks means English, anything else Vietnamese', () => {
    expect(detectPrimaryLanguage(['The effect of sleep on memory', 'John Smith, Jane Doe'])).toBe('en');
    expect(detectPrimaryLanguage(['Ảnh hưởng của giấc ngủ đến trí nhớ', 'Nguyễn Văn A'])).toBe('vi');
    expect(detectPrimaryLanguage([])).toBe('vi');
  });
});

describe('Vietnamese closing page', () => {
  it('needs the explicit marker; "thứ 2" and "thứ hai" both count', () => {
    const body = ['Tài liệu tham khảo', 'ref 1'];
    const page = ['Tiêu đề tiếng Việt', 'TÓM TẮT', 'Nội dung tóm tắt.', 'Từ khóa: một, hai', 'Thông tin tác giả: Nguyễn Văn A, Trường Đại học X, Hà Nội', 'Email: a@x.org'];
    expect(findVietnameseBackMatter([...body, ...page])).toBeNull();
    for (const marker of ['Phần ngôn ngữ thứ 2', 'Phần ngôn ngữ thứ hai']) {
      const found = findVietnameseBackMatter([...body, marker, ...page]);
      expect(found).toMatchObject({ title: 'Tiêu đề tiếng Việt', abstract: 'Nội dung tóm tắt.', keywords: ['một', 'hai'], email: 'a@x.org' });
      expect(found!.authorNames).toEqual(['Nguyễn Văn A']);
      expect(found!.institution).toBe('Trường Đại học X, Hà Nội');
    }
  });

  it('foldVietnamese matches a name with and without marks', () => {
    expect(foldVietnamese('Trương Quang Huy')).toBe(foldVietnamese('Truong Quang Huy'));
  });
});
