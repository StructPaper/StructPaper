import { z } from 'zod';
import type {
  Inline,
  InlineMark,
  TextInline,
  CiteInline,
  XrefInline,
  MathInline,
  FootnoteInline,
  LinkInline,
  Block,
  Cell,
  ParagraphBlock,
  ListBlock,
  QuoteBlock,
  BoxBlock,
  EquationBlock,
  FigurePanel,
  FigureLayout,
  FigureBlock,
  TableLayout,
  TableBlock,
  PageBreakBlock,
  Section,
  Reference,
  Author,
  Affiliation,
  Dates,
  FrontMatter,
  AssetMeta,
  BackMatterItem,
  Manuscript,
} from '../types';

export const InlineMarkSchema: z.ZodType<InlineMark> = z.enum([
  'b',
  'i',
  'u',
  'sup',
  'sub',
  'code',
]);

export const TextInlineSchema = z.object({
  t: z.literal('text'),
  v: z.string(),
  marks: z.array(InlineMarkSchema).optional(),
});

export const CiteInlineSchema = z.object({
  t: z.literal('cite'),
  refIds: z.array(z.string().min(1)),
});

export const XrefInlineSchema = z.object({
  t: z.literal('xref'),
  target: z.string().min(1),
  kind: z.enum(['figure', 'table', 'equation', 'section']),
});

export const MathInlineSchema = z.object({
  t: z.literal('math'),
  latex: z.string(),
});

export const FootnoteInlineSchema = z.object({
  t: z.literal('footnote'),
  blocks: z.lazy(() => z.array(BlockSchema)),
});

export const LinkInlineSchema = z.object({
  t: z.literal('link'),
  href: z.string(),
  content: z.lazy(() => z.array(InlineSchema)),
});

export const InlineSchema: z.ZodType<Inline> = z.discriminatedUnion('t', [
  TextInlineSchema,
  CiteInlineSchema,
  XrefInlineSchema,
  MathInlineSchema,
  FootnoteInlineSchema,
  LinkInlineSchema,
]);

export const CellSchema: z.ZodType<Cell> = z.object({
  content: z.array(InlineSchema),
  rowSpan: z.number().int().min(1),
  colSpan: z.number().int().min(1),
  align: z.enum(['l', 'c', 'r']).optional(),
  header: z.boolean().optional(),
});

export const ParagraphBlockSchema = z.object({
  type: z.literal('paragraph'),
  id: z.string().min(1),
  content: z.array(InlineSchema),
});

export const ListBlockSchema = z.object({
  type: z.literal('list'),
  id: z.string().min(1),
  ordered: z.boolean(),
  items: z.lazy(() => z.array(z.array(BlockSchema))),
});

export const QuoteBlockSchema = z.object({
  type: z.literal('quote'),
  id: z.string().min(1),
  content: z.lazy(() => z.array(BlockSchema)),
});

export const BoxBlockSchema = z.object({
  type: z.literal('box'),
  id: z.string().min(1),
  content: z.lazy(() => z.array(BlockSchema)),
});

export const EquationBlockSchema = z.object({
  type: z.literal('equation'),
  id: z.string().min(1),
  latex: z.string(),
  omml: z.string().optional(),
  numbered: z.boolean(),
  label: z.string().optional(),
  status: z.enum(['ok', 'fallback-image']),
});

export const FigurePanelSchema = z.object({
  id: z.string().min(1),
  assetId: z.string().min(1),
  label: z.string().optional(),
  caption: z.array(InlineSchema).optional(),
});

export const FigureLayoutSchema = z
  .object({
    columnSpan: z.enum(['1-column', '2-column']).optional(),
    alignment: z.enum(['left', 'center', 'right']).optional(),
    scalePercent: z.number().optional(),
  })
  .passthrough();

export const FigureBlockSchema = z.object({
  type: z.literal('figure'),
  id: z.string().min(1),
  assetId: z.string(),
  caption: z.array(InlineSchema),
  source: z.array(InlineSchema).optional(),
  panels: z.array(FigurePanelSchema).optional(),
  layout: FigureLayoutSchema,
});

export const TableLayoutSchema = z
  .object({
    columnSpan: z.enum(['1-column', '2-column']).optional(),
    alignment: z.enum(['left', 'center', 'right']).optional(),
  })
  .passthrough();

export const TableBlockSchema = z.object({
  type: z.literal('table'),
  id: z.string().min(1),
  caption: z.array(InlineSchema),
  grid: z.array(z.array(CellSchema)),
  headerRows: z.number().int().min(0),
  notes: z.array(InlineSchema).optional(),
  source: z.array(InlineSchema).optional(),
  layout: TableLayoutSchema,
});

export const PageBreakBlockSchema = z.object({
  type: z.literal('pageBreak'),
  id: z.string().min(1),
});

export const BlockSchema: z.ZodType<Block> = z.discriminatedUnion('type', [
  ParagraphBlockSchema,
  ListBlockSchema,
  QuoteBlockSchema,
  BoxBlockSchema,
  EquationBlockSchema,
  FigureBlockSchema,
  TableBlockSchema,
  PageBreakBlockSchema,
]);

export const SectionSchema: z.ZodType<Section> = z.object({
  id: z.string().min(1),
  level: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  title: z.array(InlineSchema),
  blocks: z.array(BlockSchema),
  children: z.lazy(() => z.array(SectionSchema)),
});

export const ReferenceSchema: z.ZodType<Reference> = z.object({
  id: z.string().min(1),
  raw: z.string(),
  csl: z.record(z.unknown()).optional(),
  doi: z.string().optional(),
  url: z.string().optional(),
  parse: z.enum(['ok', 'partial', 'failed']),
});

export const AuthorSchema: z.ZodType<Author> = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  affiliationIds: z.array(z.string().min(1)),
  email: z.string().optional(),
  isCorresponding: z.boolean().optional(),
  orcid: z.string().optional(),
});

export const AffiliationSchema: z.ZodType<Affiliation> = z.object({
  id: z.string().min(1),
  institution: z.string().min(1),
  department: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
});

export const DatesSchema: z.ZodType<Dates> = z.object({
  received: z.string().optional(),
  revised: z.string().optional(),
  accepted: z.string().optional(),
  published: z.string().optional(),
});

export const FrontMatterSchema: z.ZodType<FrontMatter> = z.object({
  title: z.array(InlineSchema),
  translations: z
    .object({
      en: z.array(InlineSchema).optional(),
    })
    .passthrough()
    .optional(),
  authors: z.array(AuthorSchema),
  affiliations: z.array(AffiliationSchema),
  abstract: z.array(z.array(InlineSchema)),
  keywords: z.array(z.string()),
  dates: DatesSchema,
  doi: z.string().optional(),
  volume: z.string().optional(),
  issue: z.string().optional(),
  pages: z.tuple([z.number(), z.number()]).optional(),
});

export const AssetMetaSchema: z.ZodType<AssetMeta> = z.object({
  id: z.string().min(1),
  sha256: z.string().min(1),
  mimeType: z.string().min(1),
  fileName: z.string().optional(),
  sizeBytes: z.number().int().nonnegative().optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  dpi: z.number().positive().optional(),
});

export const BackMatterItemSchema: z.ZodType<BackMatterItem> = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  title: z.array(InlineSchema).optional(),
  content: z.array(BlockSchema),
});

export const ProfilePinSchema = z.object({
  base: z.number().int().nonnegative(),
  journal: z.number().int().nonnegative(),
  articleType: z.number().int().nonnegative(),
  environmentId: z.string().optional(),
});

export const ManuscriptSchema: z.ZodType<Manuscript> = z.object({
  schemaVersion: z.literal(2),
  id: z.string().min(1),
  lang: z.enum(['vi', 'en']),
  journalId: z.string().min(1),
  articleType: z.string().min(1),
  meta: FrontMatterSchema,
  body: z.array(SectionSchema),
  back: z.array(z.union([BackMatterItemSchema, z.record(z.unknown())])),
  references: z.array(ReferenceSchema),
  assets: z.record(AssetMetaSchema),
  profilePin: ProfilePinSchema.optional(),
  layoutOverrides: z.record(z.unknown()).optional(),
  provenance: z.record(z.unknown()).optional(),
});
