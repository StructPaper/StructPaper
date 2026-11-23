export type Id = string;

export type InlineMark = 'b' | 'i' | 'u' | 'sup' | 'sub' | 'code';

export interface TextInline {
  t: 'text';
  v: string;
  marks?: InlineMark[];
}

export interface CiteInline {
  t: 'cite';
  refIds: Id[];
}

export interface XrefInline {
  t: 'xref';
  target: Id;
  kind: 'figure' | 'table' | 'equation' | 'section';
}

export interface MathInline {
  t: 'math';
  latex: string;
}

// Forward reference to Block to allow recursive footnotes
import type { Block } from './block';

export interface FootnoteInline {
  t: 'footnote';
  blocks: Block[];
}

export interface LinkInline {
  t: 'link';
  href: string;
  content: Inline[];
}

export type Inline =
  | TextInline
  | CiteInline
  | XrefInline
  | MathInline
  | FootnoteInline
  | LinkInline;
