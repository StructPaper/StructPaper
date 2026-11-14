import React from 'react';
import { ElementType } from '@/types/template-builder';
import { ElementRendererProps } from './types';
import {
  ArticleHeaderBadgeRenderer,
  ArticleTitleRenderer,
  AuthorBlockRenderer,
  AffiliationListRenderer,
  CitationStripRenderer,
  MetadataGridRenderer,
  AbstractBoxRenderer,
  KeywordsGroupRenderer,
} from './FrontmatterRenderers';
import {
  HeadingRenderer,
  BodyTextRenderer,
  CalloutBoxRenderer,
} from './BodyRenderers';
import {
  FigureBoxRenderer,
  TableBoxRenderer,
  EquationBoxRenderer,
  CodeAlgorithmRenderer,
} from './FloatRenderers';
import {
  AbbreviationsListRenderer,
  ConflictOfInterestRenderer,
  AuthorContributionRenderer,
  AcknowledgementBoxRenderer,
  ReferencesBlockRenderer,
  BiographyBoxRenderer,
} from './BackmatterRenderers';
import {
  LinkBoxRenderer,
  DividerLineRenderer,
  CustomBlockRenderer,
  CustomCompositeRenderer,
  CustomFieldRenderer,
  DefaultRenderer,
} from './CustomRenderers';

export * from './types';
export * from './FrontmatterRenderers';
export * from './BodyRenderers';
export * from './FloatRenderers';
export * from './BackmatterRenderers';
export * from './CustomRenderers';

/**
 * Element Renderer Registry
 * Pluggable Strategy Pattern mapping each semantic ElementType to its dedicated, modular renderer.
 * Enables zero-risk extensibility when adding new academic element types without bloating monolithic files.
 */
export const ELEMENT_RENDERER_REGISTRY: Record<
  ElementType,
  React.FC<ElementRendererProps>
> = {
  // Frontmatter
  'article-header-badge': ArticleHeaderBadgeRenderer,
  'article-title': ArticleTitleRenderer,
  'author-block': AuthorBlockRenderer,
  'affiliation-list': AffiliationListRenderer,
  'citation-strip': CitationStripRenderer,
  'metadata-grid': MetadataGridRenderer,
  'abstract-box': AbstractBoxRenderer,
  'keywords-group': KeywordsGroupRenderer,

  // Body
  heading: HeadingRenderer,
  'body-text': BodyTextRenderer,
  'callout-box': CalloutBoxRenderer,

  // Floats
  'figure-box': FigureBoxRenderer,
  'table-box': TableBoxRenderer,
  'equation-box': EquationBoxRenderer,
  'code-algorithm': CodeAlgorithmRenderer,

  // Backmatter
  'abbreviations-list': AbbreviationsListRenderer,
  'conflict-of-interest': ConflictOfInterestRenderer,
  'author-contribution': AuthorContributionRenderer,
  'acknowledgement-box': AcknowledgementBoxRenderer,
  'references-block': ReferencesBlockRenderer,
  'biography-box': BiographyBoxRenderer,

  // Custom & Utilities
  'link-box': LinkBoxRenderer,
  'divider-line': DividerLineRenderer,
  'custom-block': CustomBlockRenderer,
  'custom-composite': CustomCompositeRenderer,
  'custom-field': CustomFieldRenderer,
};

/**
 * Fallback renderer when an unrecognized or dynamically created element type is encountered.
 */
export const FallbackElementRenderer = DefaultRenderer;
