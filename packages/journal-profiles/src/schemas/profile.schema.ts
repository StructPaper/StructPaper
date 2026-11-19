import { z } from 'zod';

export const JournalProfileNamesSchema = z.object({
  vi: z.string().min(1),
  en: z.string().min(1),
  short: z.string().min(1),
});

export const JournalArticleTypeSchema = z.object({
  id: z.string().min(1),
  label: z.record(z.string()),
  requiredSections: z.array(z.string()),
});

export const JournalAbstractConfigSchema = z.object({
  minWords: z.number().int().nonnegative(),
  maxWords: z.number().int().positive(),
  structured: z.boolean(),
});

export const JournalKeywordsConfigSchema = z.object({
  min: z.number().int().nonnegative(),
  max: z.number().int().positive(),
  separator: z.enum([';', ',']),
});

export const JournalFrontMatterConfigSchema = z.object({
  abstract: JournalAbstractConfigSchema.nullable(),
  keywords: JournalKeywordsConfigSchema,
  dateFormat: z.string().min(1),
  doiPattern: z.string().min(1),
});

export const JournalCitationConfigSchema = z.object({
  style: z.string().min(1),
  inText: z.enum(['bracket', 'superscript']),
  rangeDash: z.string().min(1),
});

export const JournalLayoutMarginsSchema = z.object({
  top: z.number(),
  bottom: z.number(),
  left: z.number(),
  right: z.number(),
  unit: z.enum(['mm', 'pt', 'in']).optional(),
});

export const JournalLayoutConfigSchema = z
  .object({
    paperSize: z.string().min(1),
    columns: z.number().int().positive(),
    margins: JournalLayoutMarginsSchema,
    columnGap: z.number().optional(),
    headerHeight: z.number().optional(),
    footerHeight: z.number().optional(),
  })
  .passthrough();

export const JournalTypographyConfigSchema = z
  .object({
    fontFamilies: z.record(z.string()),
    fontSizes: z.record(z.number()),
    leading: z.record(z.number()).optional(),
    widowOrphan: z
      .object({
        widows: z.number(),
        orphans: z.number(),
      })
      .optional(),
  })
  .passthrough();

export const JournalLatexConfigSchema = z
  .object({
    cls: z.string().min(1),
    engine: z.enum(['xelatex', 'lualatex']),
    fonts: z.record(z.unknown()),
  })
  .passthrough();

export const JournalQcConfigSchema = z.object({
  ruleset: z.array(z.string()),
  weights: z.record(z.number()),
});

export const JournalPublicationSchema = z
  .object({
    name: z.string().optional(),
    shortName: z.string().optional(),
    publisher: z.string().optional(),
    accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
    issn: z.string().optional(),
    eIssn: z.string().optional(),
    headerText: z.string().optional(),
    officialNameEn: z.string().optional(),
    officialAbbvEn: z.string().optional(),
    doiPrefix: z.string().optional(),
  })
  .passthrough();

export const JournalProfileSchema = z
  .object({
    id: z.string().min(1),
    version: z.string().min(1),
    names: JournalProfileNamesSchema,
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    languages: z.array(z.enum(['vi', 'en'])).min(1),
    articleTypes: z.array(JournalArticleTypeSchema).min(1),
    frontMatter: JournalFrontMatterConfigSchema,
    citation: JournalCitationConfigSchema,
    styleMap: z.record(z.string()),
    layout: JournalLayoutConfigSchema,
    typography: JournalTypographyConfigSchema,
    latex: JournalLatexConfigSchema,
    qc: JournalQcConfigSchema,
    publication: JournalPublicationSchema.optional(),
  })
  .passthrough();

export const ResolvedProfileSchema = JournalProfileSchema.extend({
  articleType: z.string().optional(),
}).passthrough();
