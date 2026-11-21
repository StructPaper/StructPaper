import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CompletePaper } from '@/types/paper';
import { toast } from '@/components/toast';
import { useEditorSession } from '@/context/EditorSessionContext';
import { isUuid } from '@/features/papers/components/types';
import { DocumentApi, type SourceInfo } from '@/lib/documents/document-api';
import { analyzeSource, commitAnalysis, replanAnalysis, type Analysis } from '@/lib/documents/word-source';
import { IMPORTER_VERSION } from '@/lib/docx-importer-version';
import { applyMerge, type PaperLike } from '@/lib/import-merge/three-way';

const messageOf = (e: unknown) => (e instanceof Error && e.message ? e.message : 'Đã có lỗi xảy ra');

/**
 * The Word file of the open paper, for the "?" dialog of the title bar. Nothing here runs by itself: the stored file is only read
 * again when the author asks ("Phân tích lại" / a replacement file), and the paper only changes with the proposals the author
 * accepts in the comparison screen.
 */
export function useWordSourceSession(
  paper: CompletePaper,
  setPaper: (updater: (prev: CompletePaper) => CompletePaper) => void,
  markDirty: () => void,
) {
  const { setWordSource } = useEditorSession();
  const api = useMemo(() => new DocumentApi(), []);
  const paperId = paper.id;
  const serverPaper = isUuid(paperId);

  const [info, setInfo] = useState<SourceInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<'idle' | 'analyzing' | 'applying' | 'replanning'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [review, setReview] = useState<Analysis | null>(null);

  const paperRef = useRef(paper);
  paperRef.current = paper;
  const infoRef = useRef(info);
  infoRef.current = info;

  const refresh = useCallback(async () => {
    if (!serverPaper) return;
    setLoading(true);
    try {
      setInfo(await api.getSourceInfo(paperId));
      setError(null);
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setLoading(false);
    }
  }, [api, paperId, serverPaper]);

  useEffect(() => {
    setInfo(null);
    setReview(null);
    setError(null);
    void refresh();
  }, [refresh]);

  const run = useCallback(
    async (file?: File) => {
      // a new file is something the author compares on purpose: show every place where the paper differs from it
      const includeEdits = !!file;
      setBusy('analyzing');
      setError(null);
      try {
        const { parseDocxFile } = await import('@/lib/docx-parser');
        const analysis = await analyzeSource(api, paperRef.current, parseDocxFile, { file, stored: infoRef.current, includeEdits });
        setReview(analysis);
      } catch (e) {
        const msg = messageOf(e);
        setError(msg);
        toast.error('Không thể phân tích file Word', msg);
      } finally {
        setBusy('idle');
      }
    },
    [api],
  );

  const apply = useCallback(
    async (accepted: ReadonlySet<string>) => {
      const analysis = review;
      if (!analysis) return;
      setBusy('applying');
      try {
        if (accepted.size > 0) {
          setPaper((prev) => applyMerge(prev as unknown as PaperLike, analysis.plan, accepted) as unknown as CompletePaper);
          markDirty();
        }
        await commitAnalysis(api, paperRef.current.id, analysis);
        setReview(null);
        await refresh();
        toast.success('Đã cập nhật bài báo', accepted.size > 0 ? `Đã áp dụng ${accepted.size} thay đổi từ file Word.` : 'Không áp dụng thay đổi nào; bài báo giữ nguyên.');
      } catch (e) {
        toast.error('Không thể lưu kết quả', messageOf(e));
      } finally {
        setBusy('idle');
      }
    },
    [api, markDirty, refresh, review, setPaper],
  );

  const cancelReview = useCallback(() => setReview(null), []);
  const showEdits = useCallback(async (on: boolean) => {
    // the comparison is heavy on a long paper: let the spinner paint before it starts
    setBusy('replanning');
    await new Promise((resolve) => setTimeout(resolve, 40));
    try {
      setReview((prev) => (prev ? replanAnalysis(prev, on) : prev));
    } finally {
      setBusy('idle');
    }
  }, []);
  const download = useCallback(async () => {
    try {
      const blob = await api.getSourceFile(paperRef.current.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = infoRef.current?.fileName || 'document.docx';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (e) {
      toast.error('Không thể tải file Word', messageOf(e));
    }
  }, [api]);
  const reanalyze = useCallback(() => void run(), [run]);
  const replaceWith = useCallback((file: File) => void run(file), [run]);

  const state = useMemo(
    () =>
      serverPaper
        ? { paperId, loading, info, currentImporterVersion: IMPORTER_VERSION, busy, error, review, reanalyze, replaceWith, apply, cancelReview, showEdits, download }
        : null,
    [serverPaper, paperId, loading, info, busy, error, review, reanalyze, replaceWith, apply, cancelReview, showEdits, download],
  );

  useEffect(() => {
    setWordSource(state);
    return () => setWordSource(null);
  }, [state, setWordSource]);
}
