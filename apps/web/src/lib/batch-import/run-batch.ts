import type { CompletePaper } from '@/types/paper';
import { getUniquePaperTitle } from '@/lib/storage/paper-naming';
import { abortError, createLimiter, isAbortError } from './limiter';
import { autoBatchJournal } from './journals';
import type { BatchItem, BatchOptions } from './types';

/** More files than this in one go would make the list and the server crawl; the dialog tells the user. */
export const MAX_BATCH_FILES = 100;

export const initialItems = (files: File[]): BatchItem[] =>
  files.map((f, i) => ({ key: `${i}:${f.name}`, fileName: f.name, size: f.size, stage: 'queued', errors: 0, warnings: 0 }));

const baseName = (fileName: string) => fileName.replace(/\.docx?$/i, '').trim();
const message = (e: unknown, fallback: string) => (e instanceof Error && e.message ? e.message : fallback);

/** Settles with `p`, or rejects with an AbortError as soon as the signal aborts (a stuck step can still be cancelled). */
export function raceAbort<T>(p: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return p;
  if (signal.aborted) return Promise.reject(abortError());
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(abortError());
    signal.addEventListener('abort', onAbort, { once: true });
    p.then(resolve, reject).finally(() => signal.removeEventListener('abort', onAbort));
  });
}

/** Fire-and-forget that can neither throw synchronously nor leave a rejected promise behind. */
const quietly = (fn: (() => Promise<unknown> | undefined) | undefined): Promise<boolean> =>
  fn ? Promise.resolve().then(fn).then(() => true, () => false) : Promise.resolve(false);

/**
 * Import several Word files at once: every file goes through read -> save -> typeset on its own,
 * files overlap (a few are read at a time, a few are typeset at a time), and one bad file never stops
 * the others. Resolves with the final state of every item; `onUpdate` fires after each change.
 *
 * Memory: once a paper is saved it is dropped and read back from storage when its turn to be typeset
 * comes (when `deps.load` exists), so files waiting for a typesetting slot do not hold their pictures.
 */
export async function runBatchImport(opts: BatchOptions): Promise<BatchItem[]> {
  const { files, deps, signal } = opts;
  const parseLimiter = createLimiter(opts.parseLimit ?? 2);
  const compileLimiter = createLimiter(opts.compileLimit ?? 3);
  const items = initialItems(files);
  const emit = () => opts.onUpdate?.(items.map((it) => ({ ...it })));
  const patch = (i: number, p: Partial<BatchItem>) => {
    items[i] = { ...items[i], ...p };
    emit();
  };
  emit();

  // Typeset the saved paper; the outcome is recorded while the slot is still held, and nothing throws.
  const typeset = (i: number, held: CompletePaper | null, id: string, title: string, pushed: Promise<boolean>) =>
    compileLimiter
      .run(async () => {
        patch(i, { stage: 'compiling' });
        try {
          const paper = held ?? (await deps.load?.(id)) ?? null;
          if (!paper) throw new Error('Không nạp lại được bài báo đã lưu');
          const pdf = await deps.compile(paper, signal ?? new AbortController().signal);
          patch(i, { stage: 'done', pdf, compileError: undefined });
          // the PDF can only be filed on the server once the paper itself is there
          void pushed.then((ok) => ok && quietly(() => deps.archive?.(paper, pdf.blob, `${title.slice(0, 200)}.pdf`)));
        } catch (e) {
          patch(i, { stage: 'done', compileError: isAbortError(e) ? 'Đã hủy biên dịch PDF' : message(e, 'Biên dịch PDF thất bại') });
        }
      }, signal)
      .catch(() => patch(i, { stage: 'done', compileError: 'Đã hủy biên dịch PDF' })); // cancelled while waiting for a slot

  // Titles in use, extended as this run names its papers (no await between check and add, so two
  // files with the same title can never get the same name).
  let reserved: string[] = [];
  try {
    reserved = [...(await deps.existingTitles())];
  } catch {
    /* naming still works against this run's own titles */
  }
  const stamp = Date.now();

  await Promise.all(
    files.map(async (file, i) => {
      if (signal?.aborted) return patch(i, { stage: 'cancelled' });
      const picked = opts.journals?.[i]; // undefined: no entry (use `journal`); null: automatic
      let journal = picked ?? opts.journal;
      let paper: CompletePaper | null;
      try {
        const parsed = await parseLimiter.run(async () => {
          patch(i, { stage: 'parsing' }); // only once it really starts; until then the file is 'queued'
          const result = await raceAbort(deps.parse(file), signal);
          // leave 'parsing' while still holding the slot, so the next file's 'parsing' never overlaps it
          patch(i, { stage: 'saving' });
          return result;
        }, signal);
        if (signal?.aborted) throw abortError(); // cancelled while this file was being read: do not create it
        if (picked === null) journal = autoBatchJournal(parsed.metadata?.journalId, opts.journal, opts.catalog);
        const wanted = parsed.metadata?.title?.trim() || baseName(file.name);
        let duplicates: Array<{ title: string; uploaderName: string; mine: boolean }> = [];
        try {
          duplicates = (await deps.findDuplicates?.(wanted)) ?? [];
        } catch {
          /* informative only: naming still works against this run and this device */
        }
        const title = getUniquePaperTitle(wanted, [...reserved, ...duplicates.map((d) => d.title)]);
        reserved.push(title);
        if (duplicates.length > 0) patch(i, { duplicateOf: duplicates.map((d) => (d.mine ? 'Bạn' : d.uploaderName)) });
        paper = {
          ...parsed,
          id: `paper_${stamp}_${i}`, // parsers number papers by the clock; files parsed together must not collide
          metadata: {
            ...parsed.metadata,
            title,
            journalId: journal.journalId,
            journalName: journal.journalName,
            journalAbbv: journal.journalAbbv,
          },
        };
        (paper as any).displayName = title;
      } catch (e) {
        if (isAbortError(e)) return patch(i, { stage: 'cancelled' });
        return patch(i, { stage: 'error', error: message(e, 'Không đọc được tệp Word') });
      }

      let checks = { errors: 0, warnings: 0 };
      try {
        checks = deps.check(paper);
      } catch {
        /* the checks are informative; never block creating the paper */
      }
      const id = paper.id;
      const title = paper.metadata.title;
      patch(i, { stage: 'saving', paperId: id, title, journalAbbv: journal.journalAbbv, ...checks });
      try {
        if (!(await raceAbort(deps.save(paper), signal))) throw new Error('Không lưu được bài báo');
      } catch (e) {
        if (isAbortError(e)) return patch(i, { stage: 'cancelled', paperId: undefined, title: undefined });
        return patch(i, { stage: 'error', error: message(e, 'Không lưu được bài báo') });
      }
      const savedId = paper.id; // saving may have given the paper its server id: that is the one to open and reload
      if (savedId !== id) patch(i, { paperId: savedId });
      const pushed = quietly(() => deps.push?.(paper!));
      const held = deps.load ? null : paper;
      paper = null; // drop our reference: a paper waiting for a typesetting slot costs no memory

      if (signal?.aborted) return patch(i, { stage: 'done', compileError: 'Đã hủy biên dịch PDF' });
      patch(i, { stage: 'waiting' });
      await typeset(i, held, savedId, title, pushed);
    })
  );
  return items.map((it) => ({ ...it }));
}

type RetryOptions = Omit<BatchOptions, 'files' | 'onUpdate'> & { onUpdate?: (items: BatchItem[]) => void };

/** PDF only, for papers that were created but have no PDF (it failed or was cancelled). */
async function recompile(prev: BatchItem[], idx: number[], opts: RetryOptions, merged: BatchItem[], publish: () => void): Promise<void> {
  const { deps, signal } = opts;
  const limiter = createLimiter(opts.compileLimit ?? 3);
  const patch = (i: number, p: Partial<BatchItem>) => {
    merged[i] = { ...merged[i], ...p };
    publish();
  };
  idx.forEach((i) => patch(i, { stage: 'waiting', compileError: undefined }));
  await Promise.all(
    idx.map((i) =>
      limiter
        .run(async () => {
          patch(i, { stage: 'compiling' });
          try {
            const paper = await deps.load?.(prev[i].paperId!);
            if (!paper) throw new Error('Không nạp lại được bài báo đã lưu');
            const pdf = await deps.compile(paper, signal ?? new AbortController().signal);
            patch(i, { stage: 'done', pdf, compileError: undefined });
          } catch (e) {
            patch(i, { stage: 'done', compileError: isAbortError(e) ? 'Đã hủy biên dịch PDF' : message(e, 'Biên dịch PDF thất bại') });
          }
        }, signal)
        .catch(() => patch(i, { stage: 'done', compileError: 'Đã hủy biên dịch PDF' }))
    )
  );
}

/**
 * Run the problem items again: files that were not created (error / cancelled) go through the whole
 * pipeline, papers that exist but have no PDF are only typeset again. Finished items are untouched.
 */
export async function retryFailed(prev: BatchItem[], files: File[], opts: RetryOptions): Promise<BatchItem[]> {
  const full = prev.map((it, i) => (it.stage === 'error' || it.stage === 'cancelled' ? i : -1)).filter((i) => i >= 0);
  const pdfOnly = prev.map((it, i) => (it.stage === 'done' && !it.pdf && it.paperId ? i : -1)).filter((i) => i >= 0);
  if (full.length === 0 && pdfOnly.length === 0) return prev;
  const merged = prev.map((it) => ({ ...it }));
  const publish = () => opts.onUpdate?.(merged.map((x) => ({ ...x })));

  const redo = full.length
    ? runBatchImport({
        ...opts,
        journals: opts.journals && full.map((i) => opts.journals![i]), // each retried file keeps ITS template
        files: full.map((i) => files[i]),
        onUpdate: (sub) => {
          sub.forEach((it, k) => (merged[full[k]] = { ...it, key: prev[full[k]].key }));
          publish();
        },
      }).then((result) => result.forEach((it, k) => (merged[full[k]] = { ...it, key: prev[full[k]].key })))
    : Promise.resolve();
  await Promise.all([redo, pdfOnly.length ? recompile(prev, pdfOnly, opts, merged, publish) : Promise.resolve()]);
  return merged.map((x) => ({ ...x }));
}
