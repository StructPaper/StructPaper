'use client';

import React, { useEffect, useState } from 'react';
import { Extension, Mark, Node, mergeAttributes } from '@tiptap/core';
import { NodeViewContent, NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import { Table, TableRow, TableCell, TableHeader, TableView } from '@tiptap/extension-table';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import type { EditorView } from '@tiptap/pm/view';
import { MathFormula } from '@/features/preview/components/MathText';
import { citationLabel, citationNumbers } from './cite-label';
import { useOverview } from './overview-context';
import { useXrefTargets } from '../xref-context';
import '../components/sections/markers.css';
import { refLabel } from '@/lib/cross-refs';
import { figureSpansBoth, tableLook, tablePlacement } from './overview-layout';
import { RowHeights, SourceNotes, type RowHeightOptions } from './overview-table-plugins';
import { BlockSelect } from './overview-select';
import { ListItems } from './overview-lists';
import { PageBreaks, type PageBreakOptions } from './overview-breaks';
import { NodeSelection, Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

const FRONT_LABELS = {
  vi: { abstract: 'TÓM TẮT', keywords: 'Từ khóa: ', abstractHint: 'Tóm tắt của bài báo…', keywordsHint: 'từ khóa, cách nhau bằng dấu phẩy', cite: 'Trích dẫn bài báo này: ' },
  en: { abstract: 'ABSTRACT', keywords: 'Keywords: ', abstractHint: 'Abstract…', keywordsHint: 'keywords, separated by commas', cite: 'Cite this article: ' },
} as const;

// ───────────────────────────── text blocks ─────────────────────────────

/** Section ids and the paragraph variant live on the blocks that carry text. */
const BlockAttrs = Extension.create({
  name: 'overviewBlockAttrs',
  addGlobalAttributes() {
    return [
      {
        types: ['paragraph', 'heading'],
        attributes: {
          sid: {
            default: null,
            parseHTML: (el: HTMLElement) => el.getAttribute('data-sid'),
            renderHTML: (a: Record<string, unknown>) => (a.sid ? { 'data-sid': String(a.sid) } : {}),
          },
        },
      },
      {
        types: ['paragraph'],
        attributes: {
          variant: {
            default: null,
            parseHTML: (el: HTMLElement) => el.getAttribute('data-variant'),
            renderHTML: (a: Record<string, unknown>) => (a.variant ? { 'data-variant': String(a.variant) } : {}),
          },
        },
      },
    ];
  },
});

/** A text block whose Enter key does nothing: a title, a caption or a reference is one line of the model. */
const textBlock = (name: string, tag: string, className: string, extra: Partial<Parameters<typeof Node.create>[0]> = {}) =>
  Node.create({
    name,
    group: 'block',
    content: 'inline*',
    defining: true,
    ...extra,
    parseHTML() {
      return [{ tag: `${tag}.${className}` }];
    },
    renderHTML({ HTMLAttributes }) {
      return [tag, mergeAttributes(HTMLAttributes, { class: className }), 0];
    },
  });

export const FrontTitle = textBlock('frontTitle', 'p', 'ov-front ov-front-title');
export const FigureCaption = textBlock('figureCaption', 'figcaption', 'ov-fig-caption', { group: undefined });
export const FigureSource = textBlock('figureSource', 'p', 'ov-fig-source', { group: undefined });
export const TableCaption = textBlock('tableCaption', 'p', 'ov-tab-caption', { group: undefined });
export const TableSource = textBlock('tableSource', 'p', 'ov-tab-source', { group: undefined });

export const FrontAbstract = Node.create({
  name: 'frontAbstract',
  group: 'block',
  content: 'inline*',
  defining: true,
  addAttributes() {
    return { lang: { default: 'vi' } };
  },
  parseHTML: () => [{ tag: 'p.ov-front-abstract' }],
  renderHTML({ node }) {
    const l = FRONT_LABELS[(node.attrs.lang as 'vi' | 'en') ?? 'vi'];
    return ['p', { class: 'ov-front ov-front-abstract', 'data-label': l.abstract, 'data-placeholder': l.abstractHint }, 0];
  },
});

export const FrontKeywords = Node.create({
  name: 'frontKeywords',
  group: 'block',
  content: 'text*',
  marks: '',
  defining: true,
  addAttributes() {
    return { lang: { default: 'vi' } };
  },
  parseHTML: () => [{ tag: 'p.ov-front-keywords' }],
  renderHTML({ node }) {
    const l = FRONT_LABELS[(node.attrs.lang as 'vi' | 'en') ?? 'vi'];
    return ['p', { class: 'ov-front ov-front-keywords', 'data-label': l.keywords, 'data-placeholder': l.keywordsHint }, 0];
  },
});

export const RefsTitle = Node.create({
  name: 'refsTitle',
  group: 'block',
  atom: true,
  selectable: false,
  parseHTML: () => [{ tag: 'h4.ov-refs-title' }],
  renderHTML: () => ['h4', { class: 'ov-refs-title ov-span-all-no' }, 'Tài liệu tham khảo'],
});

export const RefItem = Node.create({
  name: 'refItem',
  group: 'block',
  content: 'inline*',
  defining: true,
  addAttributes() {
    return { rid: { default: null } };
  },
  parseHTML: () => [{ tag: 'p.ov-ref' }],
  renderHTML({ node }) {
    return ['p', { class: 'ov-ref', 'data-num': String(node.attrs.rid ?? '') }, 0];
  },
});

/**
 * Enter inside these blocks would split one line of the model into two: it does nothing instead.
 * (The lines under a table are the exception: each is a block of its own, and Enter, or Shift+Enter, starts the next one.)
 */
export const SingleLineBlocks = Extension.create({
  name: 'singleLineBlocks',
  addKeyboardShortcuts() {
    const single = new Set(['frontTitle', 'frontKeywords', 'figureCaption', 'figureSource', 'tableCaption', 'refItem', 'frontAbstract']);
    const nameOf = (editor: { state: { selection: { $from: { parent: { type: { name: string } } } } } }) => editor.state.selection.$from.parent.type.name;
    return {
      Enter: ({ editor }) => single.has(nameOf(editor)),
      'Shift-Enter': ({ editor }) => (nameOf(editor) === 'tableSource' ? editor.commands.splitBlock() : single.has(nameOf(editor))),
    };
  },
});

/** Text colour (stored as <color=#rrggbb> in the paper's text). */
export const TextColor = Mark.create({
  name: 'textColor',
  addAttributes() {
    return { color: { default: null } };
  },
  parseHTML: () => [{ tag: 'span[data-color]', getAttrs: (el) => ({ color: (el as HTMLElement).getAttribute('data-color') }) }],
  renderHTML({ mark }) {
    return ['span', { 'data-color': mark.attrs.color, style: `color:${mark.attrs.color}` }, 0];
  },
});

// ───────────────────────────── inline: citations, references, formulas ─────────────────────────────

export const OvCite = Node.create({
  name: 'cite',
  group: 'inline',
  inline: true,
  atom: true,
  addAttributes() {
    return { id: { default: '' }, targetId: { default: '' }, label: { default: '' } };
  },
  parseHTML: () => [{ tag: 'span[data-type="cite"]' }],
  renderHTML({ node, HTMLAttributes }) {
    const text = citationLabel(citationNumbers(node.attrs.targetId, node.attrs.label));
    return ['span', mergeAttributes(HTMLAttributes, { class: 'ov-cite', 'data-type': 'cite' }), text];
  },
});

/** A reference to a table or a figure: its label ("Bảng 2") with the number the block has now, so that it stays right when blocks are moved. */
const XrefView: React.FC<NodeViewProps> = ({ node, selected }) => {
  const { targets, lang } = useXrefTargets();
  const kind = node.attrs.kind as string;
  let label = String(node.attrs.label ?? '');
  let missing = false;
  if (kind === 'table' || kind === 'figure') {
    const t = targets.find((x) => x.kind === kind && x.id === node.attrs.targetId);
    label = t ? refLabel(kind, t.order, lang) : refLabel(kind, 0, lang).replace(/ 0$/, ' ?');
    missing = !t;
  } else if (!label) label = `${kind} (${node.attrs.targetId})`;
  return (
    <NodeViewWrapper as="span" className={`ov-xref ${selected ? 'ov-xref-selected' : ''} ${missing ? 'ov-xref-missing' : ''}`} data-type="xref" title={missing ? 'Bảng hoặc hình này không còn trong bài' : 'Tham chiếu đến ' + label}>
      {label}
    </NodeViewWrapper>
  );
};

export const OvXref = Node.create({
  name: 'xref',
  group: 'inline',
  inline: true,
  atom: true,
  addAttributes() {
    return { targetId: { default: '' }, kind: { default: 'fig' }, label: { default: '' } };
  },
  parseHTML: () => [{ tag: 'span[data-type="xref"]' }],
  renderHTML({ node, HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { class: 'ov-xref', 'data-type': 'xref' }), node.attrs.label || `${node.attrs.kind} (${node.attrs.targetId})`];
  },
  addNodeView() {
    return ReactNodeViewRenderer(XrefView, { as: 'span' });
  },
});

const MathView: React.FC<NodeViewProps> = ({ node, editor, getPos }) => (
  <NodeViewWrapper
    as="span"
    className="ov-math cursor-pointer rounded hover:bg-blue-50"
    data-type="math"
    title="Bấm để sửa công thức"
    onClick={(e: React.MouseEvent) => {
      e.preventDefault();
      (editor.storage as unknown as { onEditMath?: (pos: number | undefined, latex: string) => void }).onEditMath?.(getPos(), String(node.attrs.latex ?? ''));
    }}
  >
    <MathFormula latex={String(node.attrs.latex ?? '')} />
  </NodeViewWrapper>
);

export const OvMath = Node.create({
  name: 'math',
  group: 'inline',
  inline: true,
  atom: true,
  addAttributes() {
    return { latex: { default: '' } };
  },
  parseHTML: () => [{ tag: 'span[data-type="math"]' }],
  renderHTML({ node, HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { 'data-type': 'math', class: 'ov-math' }), `$${node.attrs.latex}$`];
  },
  addNodeView() {
    return ReactNodeViewRenderer(MathView, { as: 'span' });
  },
});

/**
 * A footnote: one small number in the text (counted by the page as the PDF counts them); the note itself is written when the number is
 * selected. The paper keeps it as [[fn: content]] in the text, right where it is cited, and the PDF prints it at the foot of that page.
 */
const FootnoteView: React.FC<NodeViewProps> = ({ node, selected, updateAttributes }) => {
  const raw = String(node.attrs.raw ?? '');
  const [draft, setDraft] = useState(raw);
  useEffect(() => setDraft(raw), [raw]);
  return (
    <NodeViewWrapper as="span" className="ov-fn" data-type="footnote" title={raw.trim() || 'Chú thích chân trang (chọn để viết nội dung)'}>
      <sup className="ov-fn-mark" contentEditable={false} />
      {selected && (
        <span className="ov-fn-edit" contentEditable={false}>
          <textarea
            aria-label="Nội dung chú thích chân trang"
            rows={2}
            value={draft}
            placeholder="Nội dung chú thích, in ở cuối trang"
            onChange={(e) => {
              setDraft(e.target.value);
              updateAttributes({ raw: e.target.value });
            }}
          />
        </span>
      )}
    </NodeViewWrapper>
  );
};

/**
 * The notes of a block, written at its end (as the PDF prints them at the foot of the page): each with the letter of its mark in the
 * text. A click on a note selects its mark, which opens the box where it is written.
 */
export const FootnoteNotes = Extension.create({
  name: 'overviewFootnoteNotes',
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('overviewFootnoteNotes'),
        props: {
          decorations(state) {
            const decos: Decoration[] = [];
            state.doc.descendants((block, blockPos) => {
              if (!block.isTextblock) return true;
              const notes: Array<{ pos: number; raw: string }> = [];
              block.forEach((child, off) => {
                if (child.type.name === 'footnote') notes.push({ pos: blockPos + 1 + off, raw: String(child.attrs.raw ?? '') });
              });
              if (notes.length === 0) return false;
              decos.push(
                Decoration.widget(
                  blockPos + block.nodeSize - 1,
                  (view) => {
                    const box = document.createElement('span');
                    box.className = 'ov-notes';
                    box.contentEditable = 'false';
                    for (const n of notes) {
                      const row = document.createElement('span');
                      row.className = 'ov-note';
                      row.textContent = n.raw.trim() || '…';
                      row.addEventListener('mousedown', (e) => {
                        e.preventDefault();
                        view.dispatch(view.state.tr.setSelection(NodeSelection.create(view.state.doc, n.pos)));
                        view.focus();
                      });
                      box.append(row);
                    }
                    return box;
                  },
                  { side: 5, key: 'notes-' + blockPos + '-' + notes.map((n) => n.raw).join('\u0001') }
                )
              );
              return false;
            });
            return DecorationSet.create(state.doc, decos);
          },
        },
      }),
    ];
  },
});

export const OvFootnote = Node.create({
  name: 'footnote',
  group: 'inline',
  inline: true,
  atom: true,
  addAttributes() {
    return { raw: { default: '' } };
  },
  parseHTML: () => [{ tag: 'span[data-type="footnote"]' }],
  renderHTML: ({ node }) => ['span', { class: 'ov-fn', 'data-type': 'footnote', title: String(node.attrs.raw ?? '') }],
  addNodeView() {
    return ReactNodeViewRenderer(FootnoteView, { as: 'span' });
  },
});

// ───────────────────────────── front matter blocks the page only shows ─────────────────────────────

const AuthorsView: React.FC<NodeViewProps> = () => {
  const { paper, openTab } = useOverview();
  const authors = paper.metadata.authors ?? [];
  return (
    <NodeViewWrapper className="ov-front ov-authors" contentEditable={false}>
      {authors.length === 0 ? (
        <span className="text-neutral-400" style={{ fontWeight: 400 }}>
          Chưa có tác giả
        </span>
      ) : (
        authors.map((a, i) => (
          <React.Fragment key={a.id ?? i}>
            {i > 0 && ', '}
            {a.name}
            {a.affiliationIds?.length ? <sup>{a.affiliationIds.join(',')}</sup> : null}
            {a.isCorresponding ? <sup>*</sup> : null}
          </React.Fragment>
        ))
      )}
      <button type="button" className="ov-authors-edit" onClick={() => openTab('authors')}>
        Sửa tác giả
      </button>
    </NodeViewWrapper>
  );
};

export const FrontAuthors = Node.create({
  name: 'frontAuthors',
  group: 'block',
  atom: true,
  selectable: false,
  parseHTML: () => [{ tag: 'div.ov-authors' }],
  renderHTML: () => ['div', { class: 'ov-front ov-authors' }],
  addNodeView() {
    return ReactNodeViewRenderer(AuthorsView);
  },
});

const FrontCiteView: React.FC<NodeViewProps> = () => {
  const { citationText, lang } = useOverview();
  return (
    <NodeViewWrapper className="ov-front ov-cite-strip" contentEditable={false}>
      <b>{FRONT_LABELS[lang].cite}</b>
      {citationText || '…'}
    </NodeViewWrapper>
  );
};

export const FrontCite = Node.create({
  name: 'frontCite',
  group: 'block',
  atom: true,
  selectable: false,
  parseHTML: () => [{ tag: 'div.ov-cite-strip' }],
  renderHTML: () => ['div', { class: 'ov-front ov-cite-strip' }],
  addNodeView() {
    return ReactNodeViewRenderer(FrontCiteView);
  },
});

// ───────────────────────────── figures ─────────────────────────────

/** A corner handle on a figure: dragging it sets the width as a share of the column. */
const FigureHandle: React.FC<{ frame: React.RefObject<HTMLDivElement>; sid: string }> = ({ frame, sid }) => {
  const { actions } = useOverview();
  const onDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const box = frame.current;
    const img = box?.querySelector('img');
    if (!box || !img) return;
    const boxW = box.getBoundingClientRect().width;
    const startW = img.getBoundingClientRect().width;
    const startX = e.clientX;
    const pct = (ev: MouseEvent) => Math.max(20, Math.min(100, Math.round((((startW + (ev.clientX - startX)) / boxW) * 100) / 5) * 5));
    const move = (ev: MouseEvent) => {
      img.style.width = `${pct(ev)}%`;
    };
    const up = (ev: MouseEvent) => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
      img.style.width = '';
      actions.updateFigure(sid, { scalePercent: pct(ev) });
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };
  return <span className="ov-fig-handle" role="slider" aria-label="Kéo để đổi chiều rộng hình" aria-valuemin={20} aria-valuemax={100} onMouseDown={onDown} />;
};

const FigureView: React.FC<NodeViewProps> = ({ node }) => {
  const { paper, isOneColumn, lang } = useOverview();
  const frameRef = React.useRef<HTMLDivElement>(null);
  const sec = paper.sections.find((s) => s.id === node.attrs.sid);
  const fig = sec?.figure;
  const pendingSrc = !fig ? (node.attrs.src as string | null) : null;
  const spans = fig ? figureSpansBoth(fig, isOneColumn) : false;
  const width = Math.min(100, fig?.scalePercent ?? 100);
  return (
    <NodeViewWrapper data-sid={node.attrs.sid} data-appendix={fig?.appendix ? 'true' : undefined} className={`ov-figure ${spans ? 'ov-span-all' : ''}`} data-align={fig?.alignment ?? 'center'} style={{ ['--ov-app-label' as string]: lang === 'en' ? "'Appendix '" : "'Phụ lục '", ['--ov-fig-label' as string]: lang === 'en' ? "'Figure '" : "'Hình '" }}>
      <div ref={frameRef} className="ov-figure-frame" contentEditable={false}>
        {fig?.src || pendingSrc ? <img src={(fig?.src ?? pendingSrc) as string} alt="" style={{ width: `${width}%` }} draggable={false} /> : <div className="ov-figure-missing">Chưa có ảnh</div>}
        {fig && typeof node.attrs.sid === 'string' && <FigureHandle frame={frameRef} sid={node.attrs.sid} />}
      </div>
      <NodeViewContent />
    </NodeViewWrapper>
  );
};

export const FigureBlock = Node.create({
  name: 'figureBlock',
  group: 'block',
  content: 'figureCaption figureSource',
  isolating: true,
  addAttributes() {
    // `src` only rides on a figure the author has just added, until the paper has its section
    return { sid: { default: null }, src: { default: null } };
  },
  parseHTML: () => [{ tag: 'div.ov-figure' }],
  renderHTML: () => ['div', { class: 'ov-figure' }, 0],
  addNodeView() {
    return ReactNodeViewRenderer(FigureView);
  },
});

// ───────────────────────────── tables ─────────────────────────────

const TableBlockView: React.FC<NodeViewProps> = ({ node }) => {
  const { paper, isOneColumn, theme, lang } = useOverview();
  const sec = paper.sections.find((s) => s.id === node.attrs.sid);
  const table = sec?.table;
  const place = table ? tablePlacement(table, isOneColumn) : { spansBoth: false, rotated: false };
  const look = table ? tableLook(table, theme) : null;
  return (
    <NodeViewWrapper
      data-sid={node.attrs.sid}
      className={`ov-table-block ${place.spansBoth ? 'ov-span-all' : ''}`}
      data-appendix={table?.appendix ? 'true' : undefined}
      data-border={look?.border ?? 'journal'}
      data-fill={look?.fill ?? 'plain'}
      // how the lines under the table are set, when the author chose (otherwise the lines decide: a note is italic, a source upright)
      data-src-bold={table?.sourceStyle?.bold ? 'true' : undefined}
      data-src-italic={table?.sourceStyle?.italic === undefined ? undefined : String(table.sourceStyle.italic)}
      data-src-align={table?.sourceStyle?.align && table.sourceStyle.align !== 'left' ? table.sourceStyle.align : undefined}
      style={{ ...(look?.vars ?? {}), ['--ov-app-label' as string]: lang === 'en' ? "'Appendix '" : "'Phụ lục '", ['--ov-tab-label' as string]: lang === 'en' ? "'Table '" : "'Bảng '", ['--ov-tab-cont' as string]: lang === 'en' ? "' continued'" : "' (tiếp theo)'" }}
    >
      {place.rotated && (
        <span className="ov-table-flag" contentEditable={false}>
          xoay ngang trên PDF
        </span>
      )}
      <NodeViewContent />
    </NodeViewWrapper>
  );
};

export const TableBlock = Node.create({
  name: 'tableBlock',
  group: 'block',
  // what is printed under the table is one block per line (Enter starts a new line)
  content: 'tableCaption table tableSource+',
  isolating: true,
  addAttributes() {
    return { sid: { default: null } };
  },
  parseHTML: () => [{ tag: 'div.ov-table-block' }],
  renderHTML: () => ['div', { class: 'ov-table-block' }, 0],
  addNodeView() {
    return ReactNodeViewRenderer(TableBlockView);
  },
});

const cellAttributes = (parent: (() => Record<string, unknown>) | undefined) => ({
  ...(parent?.() ?? {}),
  align: {
    default: null,
    parseHTML: (el: HTMLElement) => el.style.textAlign || null,
    renderHTML: (a: Record<string, unknown>) => (a.align ? { style: `text-align:${a.align}` } : {}),
  },
  fill: {
    default: null,
    parseHTML: (el: HTMLElement) => el.getAttribute('data-fill'),
    renderHTML: (a: Record<string, unknown>) => (a.fill ? { 'data-fill': String(a.fill), style: `--ov-cell-fill:${a.fill}` } : {}),
  },
});

/**
 * The table as the page draws it: always as wide as its box. The editor writes a dragged column's width in px and, once every column
 * has one, sizes the table to their sum, which can be wider than the column of the sheet it stands in and run over the next one. Here the
 * widths only say how the box is shared (as percentages of it), so a table can never leave its box.
 */
export class OvTableView extends TableView {
  constructor(node: ProseMirrorNode, cellMinWidth: number, view?: EditorView, attrs: Record<string, unknown> = {}) {
    super(node, cellMinWidth, view, attrs);
    this.fillBox(node);
  }

  update(node: ProseMirrorNode) {
    const same = super.update(node);
    if (same) this.fillBox(node);
    return same;
  }

  private fillBox(node: ProseMirrorNode) {
    this.table.style.width = '100%';
    this.table.style.minWidth = '';
    const first = node.firstChild;
    if (!first) return;
    const widths: number[] = [];
    first.forEach((cell) => {
      const span = Number(cell.attrs.colspan) || 1;
      const cw = cell.attrs.colwidth as number[] | null | undefined;
      for (let k = 0; k < span; k++) widths.push((cw && cw[k]) || 0);
    });
    if (widths.length === 0) return;
    const cols = this.colgroup.children;
    const put = (shares: number[]) =>
      shares.forEach((share, i) => {
        const col = cols[i] as HTMLElement | undefined;
        if (!col) return;
        col.style.removeProperty('min-width');
        col.style.width = `${share * 100}%`;
      });
    // columns that all have a width share the box in those proportions
    if (widths.every((w) => w > 0)) {
      const total = widths.reduce((a, b) => a + b, 0);
      put(widths.map((w) => w / total));
      return;
    }
    // some have one (a column was just dragged): the others share what is left of the box, and nothing may need more than the box has
    const box = this.dom.clientWidth;
    if (box <= 0 || widths.every((w) => !(w > 0))) return;
    const free = widths.filter((w) => !(w > 0)).length;
    const fixed = widths.reduce((a, b) => a + b, 0);
    const room = box - free * this.cellMinWidth;
    const scale = fixed > room ? Math.max(0.1, room / fixed) : 1;
    const rest = Math.max(this.cellMinWidth, (box - fixed * scale) / free);
    put(widths.map((w) => (w > 0 ? w * scale : rest) / box));
  }
}

export const OvTableCell = TableCell.extend({
  addAttributes() {
    return cellAttributes(this.parent as never) as never;
  },
});
export const OvTableHeader = TableHeader.extend({
  addAttributes() {
    return cellAttributes(this.parent as never) as never;
  },
});

// ───────────────────────────── equations and the rest ─────────────────────────────

const EquationView: React.FC<NodeViewProps> = ({ node, selected, updateAttributes }) => {
  const { paper } = useOverview();
  const sec = paper.sections.find((s) => s.id === node.attrs.sid);
  const stored = sec?.equation?.latex ?? '';
  const latex = typeof node.attrs.latex === 'string' ? node.attrs.latex : stored;
  const [draft, setDraft] = useState(latex);
  useEffect(() => setDraft(latex), [latex]);
  return (
    <NodeViewWrapper data-sid={node.attrs.sid} className="ov-equation" data-numbered={sec?.equation?.numbered ? 'true' : 'false'}>
      <div contentEditable={false}>
        {latex.trim() ? <MathFormula latex={latex} display /> : <span className="ov-readonly-note">Công thức trống</span>}
        {selected && (
          <textarea
            aria-label="Mã LaTeX của công thức"
            rows={2}
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              updateAttributes({ latex: e.target.value });
            }}
          />
        )}
      </div>
    </NodeViewWrapper>
  );
};

export const EquationBlock = Node.create({
  name: 'equationBlock',
  group: 'block',
  atom: true,
  addAttributes() {
    return { sid: { default: null }, latex: { default: null } };
  },
  parseHTML: () => [{ tag: 'div.ov-equation' }],
  renderHTML: () => ['div', { class: 'ov-equation' }],
  addNodeView() {
    return ReactNodeViewRenderer(EquationView);
  },
});

const CitationBlockView: React.FC<NodeViewProps> = ({ node }) => {
  const { paper } = useOverview();
  const sec = paper.sections.find((s) => s.id === node.attrs.sid);
  return (
    <NodeViewWrapper className="ov-cite-strip ov-span-all" contentEditable={false}>
      {sec?.content}
    </NodeViewWrapper>
  );
};

export const CitationBlock = Node.create({
  name: 'citationBlock',
  group: 'block',
  atom: true,
  addAttributes() {
    return { sid: { default: null } };
  },
  parseHTML: () => [{ tag: 'div.ov-cite-strip.block' }],
  renderHTML: () => ['div', { class: 'ov-cite-strip block' }],
  addNodeView() {
    return ReactNodeViewRenderer(CitationBlockView);
  },
});

/** Every extension of the overview editor. */
/** The QR code and what is printed under it, in the column on the left of the first page, level with the top of the abstract. */
export interface FrontQrOptions {
  getQr: () => { svg: string; caption: string };
}
const qrKey = new PluginKey('overviewFrontQr');
export const FrontQr = Extension.create<FrontQrOptions>({
  name: 'overviewFrontQr',
  addOptions() {
    return { getQr: () => ({ svg: '', caption: '' }) };
  },
  addProseMirrorPlugins() {
    const opts = this.options;
    return [
      new Plugin({
        key: qrKey,
        props: {
          decorations(state) {
            let at = -1;
            state.doc.forEach((node, offset) => {
              if (at < 0 && node.type.name === 'frontAbstract') at = offset;
            });
            if (at < 0) return DecorationSet.empty;
            const { svg, caption } = opts.getQr();
            return DecorationSet.create(state.doc, [
              Decoration.widget(
                at,
                () => {
                  const el = document.createElement('div');
                  el.className = 'ov-qr-anchor';
                  el.contentEditable = 'false';
                  const lines = caption.split('|').map((l) => l.replace(/&/g, '&amp;').replace(/</g, '&lt;'));
                  el.innerHTML = '<div class="ov-qr">' + svg + '</div><div class="ov-qr-cap">' + lines.join('<br>') + '</div>';
                  return el;
                },
                { side: -1, key: 'front-qr-' + svg.length + caption }
              ),
            ]);
          },
        },
      }),
    ];
  },
});

export function overviewExtensions({ rows = {}, pages = {}, qr = {} }: { rows?: Partial<RowHeightOptions>; pages?: Partial<PageBreakOptions>; qr?: Partial<FrontQrOptions> } = {}) {
  return [
    StarterKit.configure({
      // the paper has one undo history for every tab (see useEditorHistory); a second one here would disagree with it
      undoRedo: false,
      heading: { levels: [1, 2, 3] },
      codeBlock: false,
      bulletList: false,
      orderedList: false,
      listItem: false,
      blockquote: false,
      horizontalRule: false,
      dropcursor: { color: '#78c841', width: 2 },
      strike: false,
      // the empty line StarterKit keeps after a last block that is not text would sit outside the printed sheets
      trailingNode: false,
    }),
    Subscript,
    Superscript,
    TextColor,
    BlockAttrs,
    SingleLineBlocks,
    FrontTitle,
    FrontAuthors,
    FrontAbstract,
    FrontKeywords,
    FrontCite,
    FigureBlock,
    FigureCaption,
    FigureSource,
    TableBlock,
    TableCaption,
    TableSource,
    EquationBlock,
    CitationBlock,
    RefsTitle,
    RefItem,
    OvCite,
    OvXref,
    OvMath,
    OvFootnote,
    FootnoteNotes,
    Table.configure({ resizable: true, cellMinWidth: 36, lastColumnResizable: false, handleWidth: 5, View: OvTableView }),
    RowHeights.configure(rows),
    SourceNotes,
    ListItems,
    BlockSelect,
    PageBreaks.configure(pages),
    FrontQr.configure(qr),
    TableRow,
    OvTableHeader,
    OvTableCell,
  ];
}
