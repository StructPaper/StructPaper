'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { EditorContent, useEditor } from '@tiptap/react';
import type { CompletePaper } from '@/types/paper';
import { resolvePaperLayout } from '@/lib/layout/paper-profile';
import { resolveTheme } from '@/lib/theme-config';
import { PANEL_ATTR } from '@/lib/history/focus';
import { cleanWordPasteHtml } from '../components/sections/clean-word-paste';
import { OverviewContext, type OverviewCtx } from './overview-context';
import { overviewExtensions } from './overview-extensions';
import { docToPaper, paperToDoc, type OverviewLang } from './overview-doc';
import { OverviewToolbar } from './OverviewToolbar';
import { OverviewContextMenu, type InlineKind } from './OverviewMenu';
import { ReferencePickerPopover, MathInputPopover, XrefDialog, FootnoteDialog } from '../components/sections/tiptap-popovers';
import { crossRefTargets } from '@/lib/cross-refs';
import { currentBlock, selectAtPoint } from './overview-commands';
import { insertBlock, insertTableFromRows, rowsFromClipboard } from './overview-insert';
import type { BrandColor } from './overview-ui';
import type { OverviewActions } from './overview-actions';
import { replaceTableIn, applyFigureLookIn, applyTableLookIn, setColWeightsIn, setRowHeightIn, updateFigureIn, updateSectionIn, updateTableIn } from './overview-section-ops';
import { OverviewSlashMenu } from './OverviewSlashMenu';
import { BlockFrames } from './BlockFrames';
import { XrefProvider } from '../xref-context';
import { tablePlacement } from './overview-layout';
import { usePdfLines } from './usePdfLines';
import { pageAtPosition, planBreaks, setBreaks } from './overview-breaks';
import { FirstPageChrome, pageMeta, qrSvg } from './PageChrome';
import { fitPages, fitTails, type PageMeta } from './overview-pages';
import { goToPdfPage } from '@/lib/editor/pdf-nav';
import { clearSlashText, filterInsertItems, readImageFile, replaceEmptyLine, slashQuery, type InsertItem } from './overview-insert';
import './overview.css';

/** What the page hands back to the paper when the author changes something (only the parts that changed). */
export type OverviewPatch = Partial<Pick<CompletePaper, 'sections' | 'references' | 'metadata'>>;

export interface PaperOverviewProps {
  paper: CompletePaper;
  lang: OverviewLang;
  citationText: string;
  onChange: (patch: OverviewPatch) => void;
  openTab: (tab: string) => void;
  /** Applied to the sections the page hands back (the paper numbers its equations there). */
  normalizeSections?: (sections: CompletePaper['sections']) => CompletePaper['sections'];
  /** The compiled PDF: the page each block was printed on is worked out from it. */
  compiledPdfUrl?: string | null;
  /** A block the PDF preview pointed at (a click on its text): the page scrolls to it. */
  focusRequest?: { id: string; n: number } | null;
  /** Gives the editor to the caller (tests, and anything that wants to drive the page). */
  editorRef?: React.MutableRefObject<import('@tiptap/react').Editor | null>;
  readOnly?: boolean;
}

/** The parts of the paper the page is drawn from: when none of them changed, the page is not redrawn. */
const metaSig = (p: CompletePaper) => {
  const m = p.metadata;
  return JSON.stringify([m.title, m.titleEn, m.abstract, m.abstractEn, m.keywords, m.keywordsEn]);
};

const PAGE_PX = (612.72 * 96) / 72; // the sheet's width on screen at 100 %


export const PaperOverview: React.FC<PaperOverviewProps> = ({ paper, lang, citationText, onChange, openTab, normalizeSections, compiledPdfUrl = null, focusRequest = null, editorRef, readOnly = false }) => {
  const layout = useMemo(() => resolvePaperLayout(paper), [paper]);
  const theme = useMemo(() => resolveTheme({ theme: layout.theme }), [layout.theme]);
  const isOneColumn = layout.columnLayout === '1-column';
  const keepNumbers = theme.keepSectionNumbers;

  const paperRef = useRef(paper);
  paperRef.current = paper;
  const optsRef = useRef({ lang, keepNumbers, isOneColumn });
  optsRef.current = { lang, keepNumbers, isOneColumn };
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const normalizeRef = useRef(normalizeSections);
  normalizeRef.current = normalizeSections;

  // what this page last gave to the paper, so that it is not drawn again when that same change comes back as a new paper
  const emitted = useRef<{ sections: unknown; references: unknown; meta: string } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const actionsRef = useRef<OverviewActions | null>(null);
  const metaRef = useRef<PageMeta>(pageMeta(paper, lang, citationText, theme.titleColor, 'alternating', false, true));
  const qrRef = useRef({ svg: '', caption: '' });
  const pdfLines = usePdfLines(compiledPdfUrl, true);
  const linesRef = useRef(pdfLines);
  linesRef.current = pdfLines;
  const isOneColumnRef = useRef(isOneColumn);
  isOneColumnRef.current = isOneColumn;
  // the page and the preview follow each other: the cursor moving into a block turns the preview to the page it was printed on
  const [syncPdf, setSyncPdf] = useState(true);
  useEffect(() => {
    try {
      setSyncPdf(localStorage.getItem('structpaper_overview_sync_pdf') !== 'off');
    } catch {
      // keep the default
    }
  }, []);
  const toggleSync = useCallback(() => {
    setSyncPdf((v) => {
      try {
        localStorage.setItem('structpaper_overview_sync_pdf', v ? 'off' : 'on');
      } catch {
        // ignore
      }
      return !v;
    });
  }, []);
  const syncRef = useRef(syncPdf);
  syncRef.current = syncPdf;
  const lastBlock = useRef<{ sid: string | null; page: number | null }>({ sid: null, page: null });
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const followCursor = useCallback((ed: { state: import('@tiptap/pm/state').EditorState }) => {
    if (!syncRef.current) return;
    // the page is the one the cursor is on, from where the breaks of the PDF fall in the document
    const page = pageAtPosition(ed.state, ed.state.selection.from);
    if (page === lastBlock.current.page) return;
    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(() => {
      if (page !== lastBlock.current.page) {
        lastBlock.current.page = page;
        goToPdfPage(page);
      }
    }, 280);
  }, []);
  const zoomRef = useRef(1);
  const recomputeRef = useRef<() => void>(() => {});
  // the "/" menu: opens when a "/" starts an empty line, is moved with the arrow keys and closed with Escape
  const [slash, setSlash] = useState<{ x: number; y: number; query: string } | null>(null);
  const [slashIndex, setSlashIndex] = useState(0);
  const slashRef = useRef(slash);
  slashRef.current = slash;
  const slashIndexRef = useRef(0);
  slashIndexRef.current = slashIndex;
  const slashItems = useMemo(() => (slash ? filterInsertItems(slash.query) : []), [slash]);
  const slashItemsRef = useRef<InsertItem[]>([]);
  slashItemsRef.current = slashItems;
  const pickSlashRef = useRef<(item: InsertItem) => void>(() => {});
  const updateSlashRef = useRef<(ed: NonNullable<ReturnType<typeof useEditor>>) => void>(() => {});
  const slashFileRef = useRef<HTMLInputElement>(null);
  const editorHolder = useRef<import('@tiptap/react').Editor | null>(null);

  const extensions = useMemo(
    () =>
      overviewExtensions({
        rows: {
          getGeometry: (sid) => {
            const t = paperRef.current.sections.find((s) => s.id === sid)?.table;
            return t ? { rowHeights: t.rowHeights, headerHeight: t.headerHeight } : undefined;
          },
          onRowHeight: (sid, kind, index, pt) => actionsRef.current?.setRowHeight(sid, kind, index, pt),
          getZoom: () => zoomRef.current,
        },
        pages: {
          getMeta: () => metaRef.current,
          isOneColumn: () => isOneColumnRef.current,
          isFullWidthTable: (sid) => {
            const t = paperRef.current.sections.find((s) => s.id === sid)?.table;
            return !!t && (isOneColumnRef.current || tablePlacement(t, false).spansBoth);
          },
        },
        qr: { getQr: () => qrRef.current },
      }),
    []
  );
  const editor = useEditor({
    immediatelyRender: false,
    extensions,
    content: paperToDoc(paper, { lang, keepNumbers, isOneColumn }),
    editable: !readOnly,
    editorProps: {
      attributes: { class: 'ProseMirror', lang, spellcheck: 'false', 'aria-label': 'Bài báo, xem tổng thể' },
      transformPastedHTML: (html) => cleanWordPasteHtml(html),
      // cells copied from Excel or Word outside a table become a new table of the paper
      handlePaste: (view, event) => {
        const data = event.clipboardData;
        if (!data) return false;
        const { $from } = view.state.selection;
        for (let d = $from.depth; d > 0; d--) if ($from.node(d).type.name === 'table') return false;
        const rows = rowsFromClipboard(data.getData('text/html'), data.getData('text/plain'));
        if (!rows || !editorHolder.current) return false;
        event.preventDefault();
        return insertTableFromRows(editorHolder.current, rows);
      },
      handleKeyDown: (_view, event) => {
        if (!slashRef.current) return false;
        const items = slashItemsRef.current;
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          if (items.length > 0) setSlashIndex((i) => (i + (event.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length);
          return true;
        }
        if (event.key === 'Enter') {
          const item = items[Math.min(slashIndexRef.current, items.length - 1)];
          if (item) pickSlashRef.current(item);
          else setSlash(null);
          return true;
        }
        if (event.key === 'Escape') {
          setSlash(null);
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor: ed }) => {
      schedule();
      updateSlashRef.current(ed);
    },
    onSelectionUpdate: ({ editor: ed }) => {
      updateSlashRef.current(ed);
      followCursor(ed as never);
    },
    onBlur: () => {
      flush();
      setSlash(null);
    },
  });

  updateSlashRef.current = (ed) => {
    const q = readOnly ? null : slashQuery(ed);
    if (q === null) {
      if (slashRef.current) setSlash(null);
      return;
    }
    const c = ed.view.coordsAtPos(ed.state.selection.from);
    setSlash((prev) => (prev && prev.query === q && prev.x === c.left && prev.y === c.bottom + 4 ? prev : { x: c.left, y: c.bottom + 4, query: q }));
    if (!slashRef.current || slashRef.current.query !== q) setSlashIndex(0);
  };
  pickSlashRef.current = (item) => {
    if (!editor) return;
    setSlash(null);
    clearSlashText(editor);
    if (item.kind === 'figure') slashFileRef.current?.click();
    else replaceEmptyLine(editor, item.kind);
  };

  editorHolder.current = editor;
  if (editorRef) editorRef.current = editor;

  const flush = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    if (!editor || editor.isDestroyed) return;
    const prev = paperRef.current;
    const created: Array<{ index: number; id: string }> = [];
    const next = docToPaper(editor.getJSON(), prev, { ...optsRef.current, created });
    // blocks the author added carry the id of their new section from now on (so they are not added again next time)
    if (created.length > 0) {
      const tr = editor.state.tr;
      editor.state.doc.forEach((node, offset, index) => {
        const c = created.find((x) => x.index === index);
        if (c) tr.setNodeAttribute(offset, 'sid', c.id);
      });
      tr.setMeta('addToHistory', false).setMeta('preventUpdate', true);
      editor.view.dispatch(tr);
    }
    if (next === prev) return;
    const patch: OverviewPatch = {};
    if (next.sections !== prev.sections) patch.sections = normalizeRef.current ? normalizeRef.current(next.sections) : next.sections;
    if (next.references !== prev.references) patch.references = next.references;
    if (next.metadata !== prev.metadata) patch.metadata = next.metadata;
    emitted.current = { sections: patch.sections ?? prev.sections, references: next.references, meta: metaSig(next) };
    onChangeRef.current(patch);
  }, [editor]);

  const schedule = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, 120);
  }, [flush]);

  // a change the page did not make (undo, another tab, a new import): draw the page again
  const drawn = useRef({ sections: paper.sections, references: paper.references, meta: metaSig(paper), lang, keepNumbers });
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    const sig = metaSig(paper);
    const last = drawn.current;
    const sameAsDrawn = last.sections === paper.sections && last.references === paper.references && last.meta === sig && last.lang === lang && last.keepNumbers === keepNumbers;
    const sameAsEmitted = emitted.current && emitted.current.sections === paper.sections && emitted.current.references === paper.references && emitted.current.meta === sig && last.lang === lang && last.keepNumbers === keepNumbers;
    if (sameAsDrawn) return;
    if (sameAsEmitted) {
      drawn.current = { sections: paper.sections, references: paper.references, meta: sig, lang, keepNumbers };
      return;
    }
    drawn.current = { sections: paper.sections, references: paper.references, meta: sig, lang, keepNumbers };
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    editor.commands.setContent(paperToDoc(paper, { lang, keepNumbers, isOneColumn }), { emitUpdate: false });
    // the breaks were positions in the text that is gone: find them again in the new one
    recomputeRef.current();
  }, [editor, paper, lang, keepNumbers, isOneColumn]);

  useEffect(() => {
    editor?.setEditable(!readOnly);
  }, [editor, readOnly]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  // fit the page to the pane (the author can zoom from the toolbar)
  const scrollRef = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState(1);
  const [manual, setManual] = useState<number | null>(null);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setFit(Math.max(0.45, Math.min(1.6, (el.clientWidth - 40) / PAGE_PX))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const zoom = manual ?? fit;

  // where the PDF breaks its pages and columns is found in the words of the paper: again when a new PDF has been read
  const recomputeBreaks = useCallback(() => {
    if (!editor || editor.isDestroyed) return;
    const read = linesRef.current;
    editor.view.dispatch(setBreaks(editor.state.tr, read ? planBreaks(editor.state.doc, read.lines) : null));
  }, [editor]);
  recomputeRef.current = recomputeBreaks;
  useEffect(() => {
    recomputeBreaks();
  }, [recomputeBreaks, pdfLines, lang, isOneColumn]);

  // a click on text in the PDF preview: show that block
  useEffect(() => {
    if (!focusRequest || !editor || editor.isDestroyed) return;
    const root = scrollRef.current;
    const el = root?.querySelector<HTMLElement>(`[data-sid="${CSS.escape(focusRequest.id)}"]`);
    if (!el) return;
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    el.classList.remove('ov-flash');
    void el.offsetWidth;
    el.classList.add('ov-flash');
    try {
      editor.commands.setTextSelection(editor.view.posAtDOM(el, 0) + 1);
    } catch {
      // an atom block has no text to put the cursor in
    }
    const t = setTimeout(() => el.classList.remove('ov-flash'), 1500);
    return () => clearTimeout(t);
  }, [focusRequest, editor]);
  zoomRef.current = zoom;

  // changes the page makes to the paper without going through the text (the look of a table, the layout of a figure)
  const commitSections = useCallback(
    (fn: (sections: CompletePaper['sections']) => CompletePaper['sections']) => {
      flush();
      const base = paperRef.current;
      let sections = fn(base.sections);
      if (sections === base.sections) return;
      if (normalizeRef.current) sections = normalizeRef.current(sections);
      paperRef.current = { ...base, sections };
      emitted.current = { sections, references: base.references, meta: metaSig(base) };
      onChangeRef.current({ sections });
    },
    [flush]
  );
  const actions = useMemo<OverviewActions>(
    () => ({
      updateSection: (sid, patch) => commitSections((x) => updateSectionIn(x, sid, patch)),
      replaceTable: (sid, table) => {
        commitSections((x) => replaceTableIn(x, sid, table));
        // the cells changed in the model, not on the page: the page is drawn again from the model
        emitted.current = null;
      },
      updateTable: (sid, patch) => commitSections((x) => updateTableIn(x, sid, patch)),
      updateFigure: (sid, patch) => commitSections((x) => updateFigureIn(x, sid, patch)),
      applyTableLookToAll: (fromSid) => commitSections((x) => applyTableLookIn(x, fromSid)),
      applyFigureLookToAll: (fromSid) => commitSections((x) => applyFigureLookIn(x, fromSid)),
      setRowHeight: (sid, kind, index, pt) => commitSections((x) => setRowHeightIn(x, sid, kind, index, pt)),
      setColWeights: (sid, weights) => commitSections((x) => setColWeightsIn(x, sid, weights)),
      resetTableSize: (sid) => {
        commitSections((x) => updateTableIn(x, sid, { colWeights: undefined, rowHeights: undefined, headerHeight: undefined }));
        // the dragged widths are on the page too, not only in the paper: the page is drawn again from the paper
        emitted.current = null;
      },
    }),
    [commitSections]
  );

  actionsRef.current = actions;

  // saved row heights are drawn by a decoration, which is worked out again when the heights change
  const geometrySig = useMemo(() => JSON.stringify(paper.sections.map((s) => (s.table ? [s.id, s.table.rowHeights, s.table.headerHeight] : null))), [paper.sections]);
  useEffect(() => {
    if (editor && !editor.isDestroyed) editor.view.dispatch(editor.state.tr);
  }, [editor, geometrySig]);

  // what is printed around the text: the head, the foot with the page number, the QR code
  const numbering = layout.pageNumbering;
  const side = numbering?.position?.split('-')[1];
  const meta = useMemo(
    () => pageMeta(paper, lang, citationText, theme.titleColor, side === 'left' || side === 'center' || side === 'right' ? side : 'alternating', !!numbering?.suppressOnFirstPage, numbering?.enabled !== false),
    [paper.metadata, lang, citationText, theme.titleColor, side, numbering?.suppressOnFirstPage, numbering?.enabled]
  );
  metaRef.current = meta;
  const qrSig = `${paper.metadata.publication?.doi ?? paper.metadata.doi}|${lang}`;
  qrRef.current = useMemo(
    () => ({ svg: qrSvg(paper), caption: lang === 'en' ? 'Use your smartphone to scan this|QR code and download this article' : 'Use your smartphone to scan this|QR code and download this article' }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [qrSig]
  );
  const metaSigStr = `${meta.header}|${meta.cite}|${meta.numberPosition}|${meta.showNumbers}|${meta.skipFirstNumber}|${meta.titleColor}|${qrSig}`;
  useEffect(() => {
    if (editor && !editor.isDestroyed) editor.view.dispatch(editor.state.tr);
  }, [editor, metaSigStr]);

  // every printed sheet is padded to the size of a real one, now and whenever the text changes its height
  const sheetRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const pm = sheetRef.current?.querySelector<HTMLElement>('.ProseMirror');
    if (!pm) return;
    let raf = 0;
    // the fitting itself can change the size of the page (a sheet padded, a tail laid); that must not set it off again for ever
    let runs: number[] = [];
    const run = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const now = Date.now();
        runs = runs.filter((t) => now - t < 1000);
        if (runs.length >= 6) return;
        runs.push(now);
        fitTails(pm);
        fitPages(pm);
      });
    };
    run();
    const mo = typeof MutationObserver !== 'undefined' ? new MutationObserver(run) : null;
    mo?.observe(pm, { childList: true, subtree: true, characterData: true });
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(run) : null;
    ro?.observe(pm);
    return () => {
      cancelAnimationFrame(raf);
      mo?.disconnect();
      ro?.disconnect();
    };
  }, [editor, pdfLines, isOneColumn, meta, layout.fontSize]);

  // the picture picker: for a figure to insert after the block the cursor is in, or to put in place of a figure's picture
  const imgRef = useRef<HTMLInputElement>(null);
  const imgMode = useRef<'insert' | 'replace'>('insert');
  const pickImage = useCallback((mode: 'insert' | 'replace') => {
    imgMode.current = mode;
    imgRef.current?.click();
  }, []);
  const onImageChosen = async (file: File | undefined) => {
    if (!file || !editor) return;
    const src = await readImageFile(file);
    if (imgMode.current === 'replace') {
      const b = currentBlock(editor);
      if (b?.sid) actionsRef.current?.updateFigure(b.sid, { src, assetId: undefined });
    } else insertBlock(editor, 'figure', src);
  };

  // what the author puts into the line of text at the cursor: a formula, a citation, a reference to a table or figure, a footnote
  const [inlineDialog, setInlineDialog] = useState<InlineKind | null>(null);
  const [refSearch, setRefSearch] = useState('');
  const [mathLatex, setMathLatex] = useState('');
  const xrefTargets = useMemo(() => crossRefTargets(paper), [paper]);
  const mathPos = useRef<number | null>(null);
  // a click on a formula in the text opens it to be changed
  useEffect(() => {
    if (!editor) return;
    (editor.storage as unknown as Record<string, unknown>).onEditMath = (pos: number | undefined, text: string) => {
      mathPos.current = typeof pos === 'number' ? pos : null;
      setMathLatex(text);
      setInlineDialog('math');
    };
  }, [editor]);
  const closeInline = useCallback(() => {
    mathPos.current = null;
    setInlineDialog(null);
    setRefSearch('');
    setMathLatex('');
    editor?.commands.focus();
  }, [editor]);
  const openInline = useCallback((kind: InlineKind) => {
    mathPos.current = null;
    setRefSearch('');
    setMathLatex('');
    setInlineDialog(kind);
  }, []);
  const putInline = (content: Record<string, unknown>) => {
    setInlineDialog(null);
    setRefSearch('');
    setMathLatex('');
    editor?.chain().focus().insertContent(content).run();
  };

  // the right mouse button on the page
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const closeMenu = useCallback(() => setMenu(null), []);
  const onContextMenu = (e: React.MouseEvent) => {
    if (readOnly || !editor) return;
    e.preventDefault();
    selectAtPoint(editor, e.clientX, e.clientY);
    setMenu({ x: e.clientX, y: e.clientY });
  };

  // colours of this paper's own settings, offered next to the journal's
  const paperColors = useMemo<BrandColor[]>(() => [{ label: 'Màu tiêu đề', hex: theme.titleColor }, { label: 'Màu dải tiêu đề bảng', hex: theme.tableHeaderColor }, { label: 'Màu hàng xen kẽ', hex: theme.tableZebraColor }], [theme]);

  const ctx = useMemo<OverviewCtx>(() => ({ paper, lang, theme, isOneColumn, citationText, openTab, actions }), [paper, lang, theme, isOneColumn, citationText, openTab, actions]);

  // the gap between two sheets shows what is behind the page: its colour is the one of the panel the page is in
  const [gapBg, setGapBg] = useState('#f4f4f5');
  useEffect(() => {
    let node: HTMLElement | null = scrollRef.current?.parentElement ?? null;
    while (node) {
      const c = getComputedStyle(node).backgroundColor;
      const m = /rgba?\(([^)]+)\)/.exec(c);
      const parts = m ? m[1].split(',').map((x) => parseFloat(x)) : [];
      if (parts.length >= 3 && (parts[3] ?? 1) > 0.98) {
        setGapBg(c);
        return;
      }
      node = node.parentElement;
    }
    setGapBg('#ffffff');
  }, []);

  const cssVars = {
    '--ov-gap-bg': gapBg,
    '--ov-title': theme.titleColor,
    '--ov-head': theme.tableHeaderColor,
    '--ov-blue': theme.tableZebraColor,
    '--ov-font-size': `${layout.fontSize ?? '9pt'}`,
    '--ov-col-gap': layout.columnSep ?? '1pc',
  } as React.CSSProperties;

  return (
    <XrefProvider paper={paper} lang={lang}>
    <OverviewContext.Provider value={ctx}>
      <div className="h-full flex flex-col min-h-0 gap-2" {...{ [PANEL_ATTR]: 'sections' }} data-testid="paper-overview">
        <OverviewToolbar editor={editor} paper={paper} actions={actions} syncPdf={syncPdf} onToggleSync={toggleSync} hasPdf={!!compiledPdfUrl} paperColors={paperColors} pickImage={pickImage} zoom={zoom} onZoom={(z) => setManual(z)} onFit={() => setManual(null)} isFit={manual === null} readOnly={readOnly} />
        <AnimatePresence>{slash && <OverviewSlashMenu key="slash" items={slashItems} index={Math.min(slashIndex, Math.max(0, slashItems.length - 1))} x={slash.x} y={slash.y} onPick={(it) => pickSlashRef.current(it)} onHover={setSlashIndex} />}</AnimatePresence>
        <AnimatePresence>{menu && editor && <OverviewContextMenu key="menu" x={menu.x} y={menu.y} editor={editor} paper={paper} actions={actions} pickImage={pickImage} openInline={openInline} onClose={closeMenu} />}</AnimatePresence>
        <ReferencePickerPopover isOpen={inlineDialog === 'cite'} search={refSearch} onSearchChange={setRefSearch} references={paper.references} onSelectReference={(id) => putInline({ type: 'cite', attrs: { id: `ref-${id}`, targetId: String(id), label: `[${id}]` } })} onClose={closeInline} />
        <MathInputPopover isOpen={inlineDialog === 'math'} latex={mathLatex} onLatexChange={setMathLatex} onSubmit={() => {
          if (!mathLatex.trim()) return;
          const at = mathPos.current;
          mathPos.current = null;
          if (at !== null && editor) {
            setInlineDialog(null);
            setMathLatex('');
            editor.chain().focus().command(({ tr }) => {
              tr.setNodeMarkup(at, undefined, { latex: mathLatex.trim() });
              return true;
            }).run();
          } else putInline({ type: 'math', attrs: { latex: mathLatex.trim() } });
        }} onClose={closeInline} />
        <XrefDialog open={inlineDialog === 'xref'} targets={xrefTargets} lang={lang} onSelect={(t) => putInline({ type: 'xref', attrs: { targetId: t.id, kind: t.kind, label: '' } })} onClose={closeInline} />
        <FootnoteDialog open={inlineDialog === 'note'} onSubmit={(text) => putInline({ type: 'footnote', attrs: { raw: ' ' + text.replace(/\s*\n\s*/g, ' ').replace(/\]\]/g, ']') } })} onClose={closeInline} />
        <input ref={imgRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ''; void onImageChosen(file); }} />
        <input
          ref={slashFileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (file && editor) replaceEmptyLine(editor, 'figure', await readImageFile(file));
          }}
        />
        <div ref={scrollRef} className="ov-root flex-1 min-h-0" style={cssVars} data-lang={lang}>
          <BlockFrames editor={editor} root={scrollRef} zoom={zoom} />
          <div ref={sheetRef} onContextMenu={onContextMenu} className="ov-page" data-columns={isOneColumn ? '1' : '2'} data-paged="true" style={{ zoom }} lang={lang}>
            <FirstPageChrome paper={paper} lang={lang} articleType={paper.metadata.articleType} />
            <EditorContent editor={editor} />
          </div>
        </div>
      </div>
    </OverviewContext.Provider>
    </XrefProvider>
  );
};
