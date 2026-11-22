import { Node } from '@tiptap/core';
import { renderLatexToHtml } from '@/features/preview/components/MathText';

/**
 * Custom TipTap Node: cite
 * Inline atom node storing { id, targetId, label }.
 * Renders a clickable blue citation badge matching StructPaper design.
 */
export const CiteNode = Node.create({
  name: 'cite',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      id: { default: '' },
      targetId: { default: '' },
      label: { default: '' },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-type="cite"]',
        getAttrs: (element) => {
          if (typeof element === 'string') return false;
          return {
            id: element.getAttribute('data-id') || '',
            targetId: element.getAttribute('data-target-id') || '',
            label: element.textContent || '',
          };
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes, node }) {
    return [
      'span',
      {
        ...HTMLAttributes,
        'data-type': 'cite',
        'data-id': node.attrs.id,
        'data-target-id': node.attrs.targetId,
        class:
          'inline-cite-badge text-blue-600 font-semibold cursor-pointer hover:underline inline-flex items-center mx-0.5 select-none bg-blue-50 px-1 py-0.5 rounded border border-blue-200/60 text-xs',
      },
      node.attrs.label || '[?]',
    ];
  },
});

/**
 * Custom TipTap Node: xref
 * Inline atom node storing { targetId, kind: 'fig' | 'tbl' | 'eq', label }.
 */
export const XrefNode = Node.create({
  name: 'xref',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      targetId: { default: '' },
      kind: { default: 'fig' },
      label: { default: '' },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-type="xref"]',
        getAttrs: (element) => {
          if (typeof element === 'string') return false;
          return {
            targetId: element.getAttribute('data-target-id') || '',
            kind: (element.getAttribute('data-kind') as 'fig' | 'tbl' | 'eq') || 'fig',
            label: element.textContent || '',
          };
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes, node }) {
    return [
      'span',
      {
        ...HTMLAttributes,
        'data-type': 'xref',
        'data-target-id': node.attrs.targetId,
        'data-kind': node.attrs.kind,
        class:
          'inline-xref-badge text-purple-600 font-medium bg-purple-50 px-1 py-0.5 rounded text-xs mx-0.5 border border-purple-200/60 select-none',
      },
      node.attrs.label || `${node.attrs.kind} (${node.attrs.targetId})`,
    ];
  },
});

/**
 * Custom TipTap Node: math
 * Inline atom node storing { latex }.
 */
export const MathNode = Node.create({
  name: 'math',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      latex: { default: '' },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-type="math"]',
        getAttrs: (element) => {
          if (typeof element === 'string') return false;
          return {
            latex:
              element.getAttribute('data-latex') ||
              element.textContent?.replace(/^\$|\$$/g, '') ||
              '',
          };
        },
      },
    ];
  },

  // The formula is drawn as a formula; a click on it opens it for editing (whoever holds the editor answers, see `onEditMath`).
  addNodeView() {
    return ({ node, editor, getPos }) => {
      const latex = String(node.attrs.latex ?? '');
      const dom = document.createElement('span');
      dom.setAttribute('data-type', 'math');
      dom.setAttribute('data-latex', latex);
      dom.contentEditable = 'false';
      dom.title = 'Bấm để sửa công thức';
      const { html, error } = renderLatexToHtml(latex, false);
      if (error || !html) {
        dom.className = 'inline-math font-mono text-red-600 text-xs mx-0.5 px-1 rounded bg-red-50 cursor-pointer';
        dom.textContent = '$' + latex + '$';
      } else {
        dom.className = 'inline-math mx-0.5 px-0.5 rounded cursor-pointer hover:bg-blue-50';
        dom.innerHTML = html;
      }
      dom.addEventListener('click', (e) => {
        e.preventDefault();
        const pos = typeof getPos === 'function' ? getPos() : undefined;
        (editor.storage as unknown as { onEditMath?: (pos: number | undefined, latex: string) => void }).onEditMath?.(pos, latex);
      });
      return { dom };
    };
  },

  renderHTML({ HTMLAttributes, node }) {
    return [
      'span',
      {
        ...HTMLAttributes,
        'data-type': 'math',
        'data-latex': node.attrs.latex,
        class:
          'inline-math font-mono bg-zinc-100 px-1 py-0.5 rounded text-zinc-800 text-xs mx-0.5 border border-zinc-200/60 select-none',
      },
      `$${node.attrs.latex}$`,
    ];
  },
});
