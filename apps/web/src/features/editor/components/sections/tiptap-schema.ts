import { type JSONContent } from '@tiptap/core';
import type { Inline, InlineMark } from '@structpaper/doc-model';
import { parseCitationNumbers } from '@structpaper/doc-model';

export { CiteNode, XrefNode, MathNode } from './tiptap-nodes';

function marksEqual(a?: InlineMark[], b?: InlineMark[]): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((val, idx) => val === sortedB[idx]);
}

/**
 * Converts TipTap JSONContent doc into doc-model Inline[]
 */
export function tiptapDocToInlines(doc?: JSONContent | null): Inline[] {
  if (!doc || !doc.content || doc.content.length === 0) {
    return [{ t: 'text', v: '' }];
  }

  const rawInlines: Inline[] = [];

  for (let bIdx = 0; bIdx < doc.content.length; bIdx++) {
    const block = doc.content[bIdx];
    if (bIdx > 0) {
      rawInlines.push({ t: 'text', v: '\n\n' });
    }

    if (!block.content || block.content.length === 0) {
      continue;
    }

    for (const node of block.content) {
      if (node.type === 'text') {
        const marks: InlineMark[] = [];
        if (node.marks) {
          for (const m of node.marks) {
            if (m.type === 'bold') marks.push('b');
            else if (m.type === 'italic') marks.push('i');
            else if (m.type === 'superscript') marks.push('sup');
            else if (m.type === 'subscript') marks.push('sub');
            else if (m.type === 'code') marks.push('code');
          }
        }
        rawInlines.push({
          t: 'text',
          v: node.text || '',
          ...(marks.length > 0 ? { marks } : {}),
        });
      } else if (node.type === 'cite') {
        const targetId = node.attrs?.targetId || node.attrs?.id || '';
        const label = node.attrs?.label || '';
        let refIds: string[] = [];

        if (targetId) {
          refIds = targetId
            .split(',')
            .map((s: string) => s.trim())
            .filter(Boolean)
            .map((s: string) => (s.startsWith('ref-') ? s : `ref-${s}`));
        } else if (label) {
          const nums = parseCitationNumbers(label);
          refIds = nums.map((n) => `ref-${n}`);
        }

        if (refIds.length === 0) {
          refIds = ['ref-1'];
        }

        rawInlines.push({
          t: 'cite',
          refIds,
        });
      } else if (node.type === 'xref') {
        const rawKind = node.attrs?.kind || 'fig';
        let kind: 'figure' | 'table' | 'equation' | 'section' = 'figure';
        if (rawKind === 'tbl' || rawKind === 'table') kind = 'table';
        else if (rawKind === 'eq' || rawKind === 'equation') kind = 'equation';
        else if (rawKind === 'sec' || rawKind === 'section') kind = 'section';

        rawInlines.push({
          t: 'xref',
          target: node.attrs?.targetId || '',
          kind,
        });
      } else if (node.type === 'math') {
        rawInlines.push({
          t: 'math',
          latex: node.attrs?.latex || '',
        });
      }
    }
  }

  // Normalize adjacent text nodes with the exact same marks
  const normalized: Inline[] = [];
  for (const item of rawInlines) {
    if (normalized.length === 0) {
      normalized.push(item);
      continue;
    }

    const prev = normalized[normalized.length - 1];
    if (prev.t === 'text' && item.t === 'text' && marksEqual(prev.marks, item.marks)) {
      prev.v += item.v;
    } else {
      normalized.push(item);
    }
  }

  return normalized.length > 0 ? normalized : [{ t: 'text', v: '' }];
}

/**
 * Converts doc-model Inline[] into TipTap JSONContent doc
 */
export function inlinesToTiptapDoc(inlines?: Inline[]): JSONContent {
  if (!inlines || inlines.length === 0) {
    return {
      type: 'doc',
      content: [{ type: 'paragraph' }],
    };
  }

  const paragraphContent: JSONContent[] = [];

  for (const item of inlines) {
    switch (item.t) {
      case 'text': {
        if (!item.v) break;
        const marks: { type: string }[] = [];
        if (item.marks) {
          for (const m of item.marks) {
            if (m === 'b') marks.push({ type: 'bold' });
            else if (m === 'i') marks.push({ type: 'italic' });
            else if (m === 'sup') marks.push({ type: 'superscript' });
            else if (m === 'sub') marks.push({ type: 'subscript' });
            else if (m === 'code') marks.push({ type: 'code' });
          }
        }
        paragraphContent.push({
          type: 'text',
          text: item.v,
          ...(marks.length > 0 ? { marks } : {}),
        });
        break;
      }
      case 'cite': {
        const nums = item.refIds.map((id) => {
          const match = id.match(/\d+/);
          return match ? match[0] : id.replace(/^ref-/, '');
        });
        const label = `[${nums.join(', ')}]`;
        paragraphContent.push({
          type: 'cite',
          attrs: {
            id: item.refIds[0] || '',
            targetId: nums.join(','),
            label,
          },
        });
        break;
      }
      case 'xref': {
        const kindMap: Record<string, 'fig' | 'tbl' | 'eq'> = {
          figure: 'fig',
          table: 'tbl',
          equation: 'eq',
        };
        const shortKind = kindMap[item.kind] || 'fig';
        const labelPrefix =
          item.kind === 'figure' ? 'Hình' : item.kind === 'table' ? 'Bảng' : 'Công thức';
        paragraphContent.push({
          type: 'xref',
          attrs: {
            targetId: item.target,
            kind: shortKind,
            label: `${labelPrefix} (${item.target})`,
          },
        });
        break;
      }
      case 'math': {
        paragraphContent.push({
          type: 'math',
          attrs: {
            latex: item.latex,
          },
        });
        break;
      }
      case 'link': {
        for (const child of item.content) {
          if (child.t === 'text' && child.v) {
            paragraphContent.push({
              type: 'text',
              text: child.v,
              marks: [{ type: 'link', attrs: { href: item.href } }],
            });
          }
        }
        break;
      }
      default:
        break;
    }
  }

  return {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        ...(paragraphContent.length > 0 ? { content: paragraphContent } : {}),
      },
    ],
  };
}

/**
 * Extracts plain text formatted with Markdown markers (*italic*, [1], $math$)
 */
export function tiptapDocToPlainText(doc?: JSONContent | null): string {
  const inlines = tiptapDocToInlines(doc);
  let res = '';
  for (const item of inlines) {
    if (item.t === 'text') {
      let v = item.v;
      if (item.marks?.includes('i')) v = `*${v}*`;
      if (item.marks?.includes('b')) v = `**${v}**`;
      res += v;
    } else if (item.t === 'cite') {
      const nums = item.refIds.map((id) => {
        const match = id.match(/\d+/);
        return match ? match[0] : id.replace(/^ref-/, '');
      });
      res += `[${nums.join(', ')}]`;
    } else if (item.t === 'math') {
      res += `$${item.latex}$`;
    } else if (item.t === 'xref') {
      const prefix =
        item.kind === 'figure' ? 'Hình' : item.kind === 'table' ? 'Bảng' : 'Công thức';
      res += `${prefix} (${item.target})`;
    }
  }
  return res;
}
