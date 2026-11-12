import { describe, it, expect } from 'vitest';
import { createEmptyPaper, normalizeCompletePaper } from '@/types/paper';
import {
  ARTICLE_TYPE_PRESETS,
  articleTypeEnglish,
  articleTypeJats,
  articleTypeOptionsFor,
  findArticleTypePreset,
  suggestArticleTypeEn,
} from '@/lib/article-types';
import { exportToLatex } from '@/lib/latex-template';
import { exportToJatsXml } from '@/lib/jats-export';
import { migrateV1toV2, adaptV2toV1 } from '../../../../packages/doc-model/src/adapters';

describe('article types are suggestions, not a closed list', () => {
  it('knows its presets in Vietnamese and in English, case-insensitively', () => {
    expect(findArticleTypePreset('bài tổng quan')?.en).toBe('Review Article');
    expect(findArticleTypePreset('Case Report')?.vi).toBe('Báo cáo ca lâm sàng');
    expect(findArticleTypePreset('Một loại tự đặt')).toBeUndefined();
  });

  it('suggests an English name for a type it does not know from its words, else Research Article', () => {
    expect(suggestArticleTypeEn('Tổng quan hệ thống mở rộng')).toBe('Review Article');
    expect(suggestArticleTypeEn('Kỷ yếu hội thảo')).toBe('Research Article');
  });

  it('what the editor types wins over the suggestion', () => {
    expect(articleTypeEnglish({ articleType: 'Bài báo nghiên cứu' })).toBe('Research Article');
    expect(articleTypeEnglish({ articleType: 'Bài báo nghiên cứu', articleTypeEn: '  Original Study ' })).toBe('Original Study');
    expect(articleTypeEnglish({ articleType: 'Kỷ yếu', articleTypeEn: '' })).toBe('Research Article');
  });

  it('gives JATS a controlled value for known types and a slug of the English name for custom ones', () => {
    expect(articleTypeJats({ articleType: 'Bài tổng quan' })).toBe('review-article');
    expect(articleTypeJats({ articleType: 'Thư gửi tòa soạn' })).toBe('letter');
    expect(articleTypeJats({ articleType: 'Kỷ yếu', articleTypeEn: 'Conference Paper' })).toBe('conference-paper');
    expect(articleTypeJats({ articleType: 'x', articleTypeEn: 'Étude de cas!' })).toBe('etude-de-cas');
  });

  it('puts the types a journal normally uses first, and still offers all the others', () => {
    const hs = articleTypeOptionsFor('VNUHCM-HS').map((p) => p.vi);
    const std = articleTypeOptionsFor('VNUHCM-STD').map((p) => p.vi);
    expect(hs.slice(0, 2)).toEqual(['Bài báo nghiên cứu', 'Bài tổng quan']);
    expect(std.slice(0, 2)).toEqual(['Bài báo nghiên cứu', 'Bài nghiên cứu']);
    expect(new Set(hs).size).toBe(ARTICLE_TYPE_PRESETS.length);
    expect(std).toContain('Bài tổng quan'); // a non-HS journal is no longer locked to one type
  });
});

describe('the typed type reaches the outputs', () => {
  const paperOf = (vi: string, en?: string) => {
    const p = createEmptyPaper('VNUHCM-STD');
    p.metadata.title = 'Thử';
    p.metadata.titleEn = 'Trial';
    p.metadata.abstractEn = 'An abstract in English.';
    p.metadata.articleType = vi;
    if (en !== undefined) p.metadata.articleTypeEn = en;
    return normalizeCompletePaper(p);
  };

  it('PDF English page prints the typed English name', () => {
    expect(exportToLatex(paperOf('Kỷ yếu', 'Conference Paper'))).toContain(String.raw`\articletype{Conference Paper}`);
    expect(exportToLatex(paperOf('Bài tổng quan'))).toContain(String.raw`\articletype{Review Article}`);
  });

  it('XML carries a JATS article-type, not the Vietnamese label', () => {
    expect(exportToJatsXml(paperOf('Bài tổng quan'))).toContain('article-type="review-article"');
    expect(exportToJatsXml(paperOf('Kỷ yếu', 'Conference Paper'))).toContain('article-type="conference-paper"');
  });

  it('the English name survives saving and reloading (v1 -> v2 -> v1)', () => {
    const back = adaptV2toV1(migrateV1toV2(paperOf('Kỷ yếu', 'Conference Paper') as any));
    expect(back.metadata.articleType).toBe('Kỷ yếu');
    expect((back.metadata as any).articleTypeEn).toBe('Conference Paper');
  });
});
