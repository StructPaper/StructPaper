'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Download,
  ExternalLink,
  Minus,
  Plus,
  RectangleHorizontal,
  RectangleVertical,
  Search,
  X,
} from 'lucide-react';
import './pdf-viewer.css';
import { groupItemsIntoLines, type PdfLine, type PdfTextItem } from '@/lib/editor/pdf-section-map';
import { lineForClick, pageFill } from '@/lib/editor/pdf-click-target';

export interface PdfPickContext {
  lines: string[];
  center: number;
}

export interface PdfRotateContext {
  page: number;
  orientation: 'portrait' | 'landscape';
  lines: string[];
  prevLines: string[] | null;
  nextLines: string[] | null;
}

/** A page that a layout change left mostly empty. */
export interface PdfFillIssue {
  page: number;
  /** Share of the page height the text uses (0..1). */
  used: number;
  lines: string[];
  nextLines: string[];
}

interface PdfInteractiveViewerProps {
  url: string;
  /** A double click on content: the lines of that page and the index of the clicked line. */
  onPickText?: (ctx: PdfPickContext) => void;
  /** "Turn this page": the lines of the page and of the pages around it. */
  onRotatePage?: (ctx: PdfRotateContext) => void;
  onLoadError?: () => void;
  /** Offered for a mostly empty page before a layout change; the host decides whether it can fill it. */
  canFill?: (issue: PdfFillIssue) => boolean;
  onFillPage?: (issue: PdfFillIssue) => void;
  /** Put back the page-layout markers as they were before the last turn or fill. */
  onUndoTurn?: () => void;
}

interface PageSize {
  w: number;
  h: number;
}
interface PageText {
  items: PdfTextItem[];
  lines: PdfLine[];
}

/**
 * The compiled PDF in pdf.js's own viewer (text layer, links, zoom, find), so it behaves like a normal PDF preview:
 * a single click selects text or follows a link. Only a double click on content reaches the editor, and the toolbar
 * can turn the page being viewed.
 */
export const PdfInteractiveViewer: React.FC<PdfInteractiveViewerProps> = ({
  url,
  onPickText,
  onRotatePage,
  onLoadError,
  canFill,
  onFillPage,
  onUndoTurn,
}) => {
  const boxRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<HTMLDivElement>(null);
  const pdfViewerRef = useRef<any>(null);
  const busRef = useRef<any>(null);
  const docRef = useRef<any>(null);
  const textCache = useRef<Map<number, PageText>>(new Map());
  const place = useRef<{ page: number; frac: number; scale: string | number }>({ page: 1, frac: 0, scale: 'page-width' });
  const [shown, setShown] = useState(false);
  const [sizes, setSizes] = useState<PageSize[]>([]);
  const [current, setCurrent] = useState(1);
  const [zoom, setZoom] = useState(100);
  const [backTo, setBackTo] = useState<number | null>(null);
  const [issues, setIssues] = useState<PdfFillIssue[]>([]);
  const [dismissed, setDismissed] = useState<number[]>([]);
  const [findOpen, setFindOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [found, setFound] = useState<{ current: number; total: number } | null>(null);

  // a copy of the pane that is not on screen (width 0) loads nothing
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setShown(el.clientWidth > 0);
      // a fit-to-width view follows the pane when it is resized (a number the reader zoomed to stays)
      const v = pdfViewerRef.current;
      if (v && el.clientWidth > 0 && typeof place.current.scale === 'string') v.currentScaleValue = place.current.scale;
    });
    ro.observe(el);
    setShown(el.clientWidth > 0);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!shown) return;
    let dead = false;
    let doc: any = null;
    (async () => {
      try {
        const pdfjs: any = await import('pdfjs-dist');
        const lib: any = await import('pdfjs-dist/web/pdf_viewer');
        pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
        const data = await (await fetch(url)).arrayBuffer();
        doc = await pdfjs.getDocument({ data }).promise;
        const dims: PageSize[] = [];
        for (let n = 1; n <= doc.numPages; n++) {
          const v = (await doc.getPage(n)).getViewport({ scale: 1 });
          dims.push({ w: v.width, h: v.height });
        }
        if (dead || !boxRef.current || !viewerRef.current) return;
        const eventBus = new lib.EventBus();
        const linkService = new lib.PDFLinkService({ eventBus });
        const findController = new lib.PDFFindController({ eventBus, linkService });
        const pdfViewer = new lib.PDFViewer({ container: boxRef.current, viewer: viewerRef.current, eventBus, linkService, findController, textLayerMode: 1 });
        linkService.setViewer(pdfViewer);
        eventBus.on('pagesinit', () => {
          pdfViewer.currentScaleValue = place.current.scale;
          const view = pdfViewer.getPageView(place.current.page - 1);
          if (view && boxRef.current) boxRef.current.scrollTop = view.div.offsetTop + place.current.frac * view.div.offsetHeight;
        });
        eventBus.on('pagechanging', (e: any) => setCurrent(e.pageNumber));
        eventBus.on('scalechanging', (e: any) => {
          setZoom(Math.round(e.scale * 100));
          place.current.scale = pdfViewer.currentScaleValue;
        });
        const count = (e: any) => setFound(e.matchesCount && e.matchesCount.total ? { current: e.matchesCount.current, total: e.matchesCount.total } : null);
        eventBus.on('updatefindmatchescount', count);
        eventBus.on('updatefindcontrolstate', count);
        busRef.current = eventBus;
        pdfViewerRef.current = pdfViewer;
        docRef.current = doc;
        textCache.current.clear();
        setSizes(dims);
        pdfViewer.setDocument(doc);
        linkService.setDocument(doc, null);
      } catch (err) {
        console.error('PDF viewer could not open the file', err);
        if (!dead) onLoadError?.();
      }
    })();
    return () => {
      dead = true;
      const v = pdfViewerRef.current;
      const box = boxRef.current;
      if (v && box) {
        const view = v.getPageView(Math.max(0, v.currentPageNumber - 1));
        if (view) place.current = { ...place.current, page: v.currentPageNumber, frac: Math.max(0, (box.scrollTop - view.div.offsetTop) / Math.max(1, view.div.offsetHeight)) };
        v.setDocument(null);
      }
      pdfViewerRef.current = null;
      busRef.current = null;
      docRef.current = null;
      doc?.destroy?.();
      setFound(null);
      setBackTo(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, shown]);

  const loadText = useCallback(async (n: number): Promise<PageText | null> => {
    const cached = textCache.current.get(n);
    if (cached) return cached;
    const doc = docRef.current;
    if (!doc) return null;
    const content = await (await doc.getPage(n)).getTextContent();
    const items: PdfTextItem[] = content.items.map((it: any) => ({
      str: it.str,
      x: it.transform[4],
      y: it.transform[5],
      width: it.width,
      height: it.height || Math.abs(it.transform[3]) || 10,
    }));
    const entry = { items, lines: groupItemsIntoLines(items) };
    textCache.current.set(n, entry);
    return entry;
  }, []);

  // pages cut short by a layout change: little text, and the next page starts with a section that changes the layout
  useEffect(() => {
    if (!onFillPage || sizes.length < 3) {
      setIssues([]);
      return;
    }
    let dead = false;
    setDismissed([]);
    (async () => {
      const list: PdfFillIssue[] = [];
      for (let p = 1; p < sizes.length; p++) {
        const a = sizes[p - 1];
        const here = await loadText(p);
        const next = await loadText(p + 1);
        if (!here || !next) continue;
        const used = pageFill(here.items, a.w, a.h);
        if (used < 0.55) list.push({ page: p, used, lines: here.lines.map((l) => l.text), nextLines: next.lines.map((l) => l.text) });
      }
      if (!dead) setIssues(list.filter((i) => !canFill || canFill(i)));
    })();
    return () => {
      dead = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sizes, onFillPage, canFill]);

  /** Double click on content: find the PDF line under the pointer and hand it to the editor. */
  const handleDoubleClick = async (e: React.MouseEvent<HTMLDivElement>) => {
    const pdfViewer = pdfViewerRef.current;
    const pageEl = (e.target as HTMLElement).closest('.page') as HTMLElement | null;
    if (!pdfViewer || !pageEl || !onPickText) return;
    const n = Number(pageEl.dataset.pageNumber);
    const view = pdfViewer.getPageView(n - 1);
    if (!view?.viewport) return;
    const rect = view.div.getBoundingClientRect();
    const [px, py] = view.viewport.convertToPdfPoint(e.clientX - rect.left - view.div.clientLeft, e.clientY - rect.top - view.div.clientTop);
    const text = await loadText(n);
    if (!text || !text.lines.length) return;
    const li = lineForClick(text.items, text.lines, px, py);
    if (li < 0) return;
    const ln = text.lines[li];
    const used = text.items.slice(ln.from, ln.to + 1).filter((it) => it.str);
    const x1 = Math.min(...used.map((it) => it.x));
    const x2 = Math.max(...used.map((it) => it.x + it.width));
    const top = Math.max(...used.map((it) => it.y + it.height));
    const bottom = Math.min(...used.map((it) => it.y)) - 2;
    const [ax, ay, bx, by] = view.viewport.convertToViewportRectangle([x1, bottom, x2, top]);
    const mark = document.createElement('div');
    mark.setAttribute('data-testid', 'pdf-hit');
    Object.assign(mark.style, {
      position: 'absolute',
      left: `${Math.min(ax, bx) - 3}px`,
      top: `${Math.min(ay, by) - 2}px`,
      width: `${Math.abs(bx - ax) + 6}px`,
      height: `${Math.abs(by - ay) + 4}px`,
      background: 'rgba(120,200,65,0.28)',
      outline: '1.5px solid #78C841',
      borderRadius: '2px',
      pointerEvents: 'none',
      zIndex: '5',
    });
    view.div.appendChild(mark);
    setTimeout(() => mark.remove(), 1800);
    onPickText({ lines: text.lines.map((l) => l.text), center: li });
  };

  const turn = async (orientation: 'portrait' | 'landscape') => {
    const here = await loadText(current);
    const next = current < sizes.length ? await loadText(current + 1) : null;
    const prev = current > 1 ? await loadText(current - 1) : null;
    if (!here) return;
    onRotatePage?.({
      page: current,
      orientation,
      lines: here.lines.map((l) => l.text),
      prevLines: prev ? prev.lines.map((l) => l.text) : null,
      nextLines: next ? next.lines.map((l) => l.text) : null,
    });
  };

  const find = (again = false, previous = false) => {
    busRef.current?.dispatch('find', {
      source: window,
      type: again ? 'again' : '',
      query,
      caseSensitive: false,
      entireWord: false,
      highlightAll: true,
      findPrevious: previous,
      matchDiacritics: false,
    });
  };

  // an internal link (a citation to its reference) remembers where the reader was
  const rememberJump = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('a.internalLink')) setBackTo(boxRef.current?.scrollTop ?? 0);
  };

  const open = issues.filter((i) => !dismissed.includes(i.page));
  const edgePage = current === 1 || current === sizes.length;
  const landscape = !!sizes[current - 1] && sizes[current - 1].w > sizes[current - 1].h;
  const btn = 'p-1 rounded-lg hover:bg-zinc-100 cursor-pointer text-zinc-600';

  return (
    <div
      className="w-full h-full flex flex-col min-h-0"
      data-testid="pdf-viewer"
      tabIndex={-1}
      onKeyDown={(e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
          e.preventDefault();
          setFindOpen(true);
        }
      }}
    >
      <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-zinc-200 bg-white text-[11px] flex-shrink-0 flex-wrap">
        <label className="flex items-center gap-1 font-bold text-zinc-700" data-testid="pdf-page-indicator">
          Trang
          <input
            type="number"
            min={1}
            max={sizes.length || 1}
            value={current}
            aria-label="Số trang"
            onChange={(e) => {
              const n = Math.min(Math.max(1, Number(e.target.value) || 1), sizes.length || 1);
              if (pdfViewerRef.current) pdfViewerRef.current.currentPageNumber = n;
            }}
            className="w-10 px-1 py-0.5 rounded-md border border-zinc-200 text-center tabular-nums"
          />
          / {sizes.length || '…'}
        </label>
        <button type="button" aria-label="Thu nhỏ" onClick={() => pdfViewerRef.current?.decreaseScale()} className={btn}>
          <Minus className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          title="Vừa chiều rộng"
          onClick={() => {
            if (pdfViewerRef.current) pdfViewerRef.current.currentScaleValue = 'page-width';
          }}
          className="w-10 text-center tabular-nums text-zinc-500 hover:bg-zinc-100 rounded-lg cursor-pointer"
        >
          {zoom}%
        </button>
        <button type="button" aria-label="Phóng to" onClick={() => pdfViewerRef.current?.increaseScale()} className={btn}>
          <Plus className="w-3.5 h-3.5" />
        </button>
        <button type="button" aria-label="Tìm trong PDF" data-testid="pdf-find-toggle" onClick={() => setFindOpen((v) => !v)} className={btn}>
          <Search className="w-3.5 h-3.5" />
        </button>
        <a href={url} download="article.pdf" title="Tải PDF xuống" className={btn}>
          <Download className="w-3.5 h-3.5" />
        </a>
        <a href={url} target="_blank" rel="noreferrer" title="Mở PDF trong tab mới (trình xem gốc của trình duyệt, để in hoặc xem đánh dấu trang)" className={btn}>
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
        {backTo !== null && (
          <button
            type="button"
            data-testid="pdf-back"
            onClick={() => {
              boxRef.current?.scrollTo({ top: backTo, behavior: 'smooth' });
              setBackTo(null);
            }}
            className="px-2 py-1 rounded-lg font-bold flex items-center gap-1 text-sky-700 bg-sky-50 hover:bg-sky-100 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Quay lại
          </button>
        )}
        {onRotatePage && (
          <div className="ml-auto flex items-center gap-1" role="group" aria-label="Hướng giấy của trang đang xem">
            <span className="text-zinc-500 hidden sm:inline">Trang này:</span>
            {(['portrait', 'landscape'] as const).map((o) => {
              const on = (o === 'landscape') === landscape;
              const Icon = o === 'landscape' ? RectangleHorizontal : RectangleVertical;
              return (
                <button
                  key={o}
                  type="button"
                  data-testid={`pdf-turn-${o}`}
                  aria-pressed={on}
                  disabled={edgePage}
                  onClick={() => turn(o)}
                  title={edgePage ? 'Trang tiêu đề và trang tiếng Anh cuối bài luôn để dọc' : o === 'landscape' ? 'Xoay trang đang xem thành khổ ngang' : 'Đưa trang đang xem về khổ dọc'}
                  className={`px-2 py-1 rounded-lg font-bold flex items-center gap-1 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${on ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:bg-zinc-100'}`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {o === 'landscape' ? 'Ngang' : 'Dọc'}
                </button>
              );
            })}
            {onUndoTurn && (
              <button type="button" data-testid="pdf-undo-turn" onClick={onUndoTurn} title="Trả các dấu xoay trang về như trước lần xoay hoặc lấp gần nhất" className="px-2 py-1 rounded-lg font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 cursor-pointer">
                Hoàn tác
              </button>
            )}
          </div>
        )}
      </div>
      {findOpen && (
        <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-zinc-200 bg-zinc-50 text-[11px] flex-shrink-0" data-testid="pdf-find-bar">
          <input
            autoFocus
            value={query}
            placeholder="Tìm trong PDF"
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') find(!!found, e.shiftKey);
              if (e.key === 'Escape') setFindOpen(false);
            }}
            className="flex-1 min-w-0 px-2 py-1 rounded-md border border-zinc-200"
          />
          <span className="tabular-nums text-zinc-500 w-14 text-center">{found ? `${found.current}/${found.total}` : query ? '0' : ''}</span>
          <button type="button" aria-label="Kết quả trước" onClick={() => find(true, true)} className={btn}>
            <ChevronUp className="w-3.5 h-3.5" />
          </button>
          <button type="button" aria-label="Kết quả sau" onClick={() => find(!!found, false)} className={btn}>
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
          <button type="button" aria-label="Đóng tìm kiếm" onClick={() => setFindOpen(false)} className={btn}>
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
      {open.length > 0 && onFillPage && (
        <div data-testid="pdf-fill-notice" className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 border-b border-amber-200 text-[11px] text-amber-900 flex-shrink-0 flex-wrap">
          <span>
            Trang {open[0].page} còn trống khoảng {Math.round((1 - open[0].used) * 100)}% vì trang sau đổi bố cục (hướng giấy hoặc số cột).
          </span>
          <button type="button" data-testid="pdf-fill-page" onClick={() => onFillPage(open[0])} className="px-2 py-0.5 rounded-lg font-bold bg-amber-200 hover:bg-amber-300 cursor-pointer">
            Lấp bằng nội dung kế tiếp
          </button>
          <button type="button" data-testid="pdf-fill-dismiss" onClick={() => setDismissed((d) => [...d, open[0].page])} className="px-2 py-0.5 rounded-lg font-bold text-amber-800 hover:bg-amber-100 cursor-pointer">
            Bỏ qua
          </button>
        </div>
      )}
      <div className="relative flex-1 min-h-0">
        <div ref={boxRef} className="absolute inset-0 overflow-auto bg-zinc-200" onDoubleClick={handleDoubleClick} onClickCapture={rememberJump}>
          <div ref={viewerRef} className="pdfViewer" />
        </div>
      </div>
      {onPickText && (
        <p className="px-3 py-1 text-[10px] text-zinc-500 border-t border-zinc-200 bg-white flex-shrink-0" data-testid="pdf-hint">
          Nhấp đúp vào nội dung để mở mục tương ứng trong trình soạn.
        </p>
      )}
    </div>
  );
};
