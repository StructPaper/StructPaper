'use client';

import React from 'react';
import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { CROSS_REF, kindOfMarker, refLabel, type RefTarget } from '@/lib/cross-refs';
import { useXrefTargets } from '../../xref-context';
import './markers.css';

/**
 * What a footnote ("[[fn: …]]") and a reference to a table or figure ("[[tbl:ID]]") look like in the form: a small label, not the
 * marker the paper keeps them as. In the text being edited the marker's own characters are hidden (the text is still there, and
 * the label is drawn over it); in the text at rest the marker is replaced by the label.
 */
const MARKER = /\[\[fn:([\s\S]*?)\]\]|\[\[(tbl|fig):([^\]\s]+)\]\]/g;

export function labelOfRef(m: 'tbl' | 'fig', id: string, targets: RefTarget[], lang: 'vi' | 'en'): string {
  const kind = kindOfMarker(m);
  const t = targets.find((x) => x.kind === kind && x.id === id);
  return t ? refLabel(kind, t.order, lang) : `${kind === 'table' ? (lang === 'en' ? 'Table' : 'Bảng') : lang === 'en' ? 'Figure' : 'Hình'} ?`;
}

/** The text with its markers drawn as labels. */
export const MarkerText: React.FC<{ text: string }> = ({ text }) => {
  const { targets, lang } = useXrefTargets();
  if (!text.includes('[[')) return <>{text}</>;
  const out: React.ReactNode[] = [];
  let last = 0;
  let k = 0;
  for (const m of text.matchAll(MARKER)) {
    const at = m.index ?? 0;
    if (at > last) out.push(text.slice(last, at));
    if (m[2]) out.push(<span key={k++} className="marker-chip marker-xref-chip">{labelOfRef(m[2] as 'tbl' | 'fig', m[3], targets, lang)}</span>);
    else out.push(<sup key={k++} className="marker-fn-mark" title={m[1].trim()} />);
    last = at + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return <>{out}</>;
};

/** The notes of a text, one under the other, each with the letter of its mark. */
export const MarkerNotes: React.FC<{ text: string }> = ({ text }) => {
  const notes = [...text.matchAll(/\[\[fn:([\s\S]*?)\]\]/g)].map((m) => m[1].trim());
  if (notes.length === 0) return null;
  return (
    <div className="marker-notes" data-testid="marker-notes">
      {notes.map((n, i) => (
        <div key={i} className="marker-note">
          {n || '…'}
        </div>
      ))}
    </div>
  );
};

const key = new PluginKey('paragraphMarkers');

/** The labels over the markers in the editor. */
export const MarkerChips = Extension.create<{ getContext: () => { targets: RefTarget[]; lang: 'vi' | 'en' } }>({
  name: 'markerChips',
  addOptions() {
    return { getContext: () => ({ targets: [], lang: 'vi' }) };
  },
  addProseMirrorPlugins() {
    const opts = this.options;
    return [
      new Plugin({
        key,
        props: {
          decorations(state) {
            const { targets, lang } = opts.getContext();
            const decos: Decoration[] = [];
            state.doc.descendants((node, pos) => {
              if (!node.isText || !node.text || !node.text.includes('[[')) return;
              for (const m of node.text.matchAll(MARKER)) {
                const from = pos + (m.index ?? 0);
                const to = from + m[0].length;
                if (m[2]) {
                  decos.push(Decoration.inline(from, to, { class: 'marker-edit marker-xref-edit', 'data-label': labelOfRef(m[2] as 'tbl' | 'fig', m[3], targets, lang) }));
                } else {
                  decos.push(Decoration.inline(from, to, { class: 'marker-edit marker-fn-edit' }));
                  decos.push(Decoration.inline(from, from + 5, { class: 'marker-fn-open' }));
                  decos.push(Decoration.inline(to - 2, to, { class: 'marker-hide' }));
                }
              }
            });
            return DecorationSet.create(state.doc, decos);
          },
        },
      }),
    ];
  },
});

export { CROSS_REF };
