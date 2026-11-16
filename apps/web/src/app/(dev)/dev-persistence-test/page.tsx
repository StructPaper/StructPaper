'use client';

import React, { useState, useEffect, useRef } from 'react';
import type { Manuscript } from '@structpaper/doc-model';
import {
  StructPaperDatabase,
  IndexedDbManuscriptRepo,
  IndexedDbAssetRepo,
  AutosaveEngine,
  extractTitle,
  type AutosaveStatus,
} from '@structpaper/storage';
import {
  createManuscriptStore,
  CommandBus,
  registerBaseCommands,
  type ManuscriptStore,
} from '@structpaper/editor-core';

declare global {
  interface Window {
    __STRUCTPAPER_TEST__?: {
      db: StructPaperDatabase;
      manuscriptRepo: IndexedDbManuscriptRepo;
      assetRepo: IndexedDbAssetRepo;
      bus: CommandBus;
      store: ManuscriptStore;
      engine: AutosaveEngine;
      seedManuscript: (customDoc?: Partial<Manuscript>) => Promise<Manuscript>;
      updateTitle: (newTitle: string) => void;
      storeAsset: (hash: string, blob: Blob, meta?: Record<string, unknown>) => Promise<void>;
      getAsset: (hash: string) => Promise<Blob | null>;
      reloadFromDb: (id: string) => Promise<Manuscript | null>;
      clearDatabase: () => Promise<void>;
    };
  }
}

function createDefaultMockManuscript(
  id = 'doc_e2e_persistent_01',
  title = 'Nghiên cứu cấu trúc dữ liệu Y sinh v2'
): Manuscript {
  return {
    schemaVersion: 2,
    id,
    lang: 'vi',
    journalId: 'vnuhcm-hs',
    articleType: 'Research Article',
    meta: {
      title: [{ t: 'text', v: title }],
      authors: [
        {
          id: 'auth_1',
          name: 'Nguyễn Văn A',
          affiliationIds: ['aff_1'],
          email: 'nva@vnuhcm.edu.vn',
          isCorresponding: true,
        },
      ],
      affiliations: [
        {
          id: 'aff_1',
          institution: 'Đại học Bách Khoa TP.HCM',
        },
      ],
      abstract: [
        [{ t: 'text', v: 'Tóm tắt bài báo nghiên cứu công nghệ khoa học StructPaper.' }],
      ],
      keywords: ['AI', 'IndexedDB', 'Dexie', 'E2E'],
      dates: { received: '2026-11-04' },
    },
    body: [
      {
        id: 'sec_1',
        level: 1,
        title: [{ t: 'text', v: '1. Mở đầu' }],
        blocks: [
          {
            type: 'paragraph',
            id: 'p_1',
            content: [{ t: 'text', v: 'Nội dung đoạn văn kiểm thử độ bền bỉ dữ liệu F5.' }],
          },
        ],
        children: [],
      },
    ],
    back: [],
    references: [],
    assets: {},
  };
}

export default function DevPersistenceTestPage() {
  const [isReady, setIsReady] = useState(false);
  const [docId, setDocId] = useState<string>('');
  const [titleText, setTitleText] = useState<string>('');
  const [rev, setRev] = useState<number>(0);
  const [savedRev, setSavedRev] = useState<number>(0);
  const [isDirty, setIsDirty] = useState<boolean>(false);
  const [autosaveStatus, setAutosaveStatus] = useState<AutosaveStatus>('idle');
  const [assetStatus, setAssetStatus] = useState<string>('idle');
  const [revisionCount, setRevisionCount] = useState<number>(0);

  const dbRef = useRef<StructPaperDatabase | null>(null);
  const repoRef = useRef<IndexedDbManuscriptRepo | null>(null);
  const assetRepoRef = useRef<IndexedDbAssetRepo | null>(null);
  const busRef = useRef<CommandBus | null>(null);
  const storeRef = useRef<ManuscriptStore | null>(null);
  const engineRef = useRef<AutosaveEngine | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const db = new StructPaperDatabase('StructPaperDB');
    const repo = new IndexedDbManuscriptRepo(db);
    const assetRepo = new IndexedDbAssetRepo(db);

    const store = createManuscriptStore();
    const bus = new CommandBus({ store });
    registerBaseCommands(bus);

    const engine = new AutosaveEngine({
      repo,
      debounceMs: 1000,
      onStatusChange: (status) => {
        setAutosaveStatus(status);
        if (status === 'saved' && dbRef.current) {
          const currentDocId = storeRef.current?.getState().manuscript?.id;
          if (currentDocId) {
            dbRef.current.revisions
              .where('manuscriptId')
              .equals(currentDocId)
              .count()
              .then(setRevisionCount)
              .catch(console.error);
          }
        }
      },
    });

    engine.attach(bus, store);

    dbRef.current = db;
    repoRef.current = repo;
    assetRepoRef.current = assetRepo;
    busRef.current = bus;
    storeRef.current = store;
    engineRef.current = engine;

    // Sync store state to React
    const unsubscribeStore = store.subscribe((state) => {
      setRev(state.rev);
      setSavedRev(state.savedRev);
      setIsDirty(state.isDirty);
      if (state.manuscript) {
        setDocId(state.manuscript.id);
        setTitleText(extractTitle(state.manuscript));
      }
    });

    // Helper functions for testing & page reload check
    const seedManuscript = async (customDoc?: Partial<Manuscript>): Promise<Manuscript> => {
      const doc = {
        ...createDefaultMockManuscript(),
        ...customDoc,
      } as Manuscript;

      await repo.save(doc);
      store.getState().setManuscript(doc);
      setDocId(doc.id);
      setTitleText(extractTitle(doc));
      try {
        localStorage.setItem('structpaper_active_doc_id', doc.id);
      } catch {}

      const count = await db.revisions.where('manuscriptId').equals(doc.id).count();
      setRevisionCount(count);
      return doc;
    };

    const updateTitle = (newTitle: string) => {
      bus.dispatch({
        type: 'metadata/updateTitle',
        payload: { title: [{ t: 'text', v: newTitle }] },
      });
    };

    const storeAsset = async (
      hash: string,
      blob: Blob,
      meta?: Record<string, unknown>
    ): Promise<void> => {
      await assetRepo.save(hash, blob, meta);
      setAssetStatus(`stored_${hash.slice(0, 8)}`);
    };

    const getAsset = async (hash: string): Promise<Blob | null> => {
      return assetRepo.getByHash(hash);
    };

    const reloadFromDb = async (id: string): Promise<Manuscript | null> => {
      const doc = await repo.getById(id);
      if (doc) {
        store.getState().setManuscript(doc);
        setDocId(doc.id);
        setTitleText(extractTitle(doc));
        const count = await db.revisions.where('manuscriptId').equals(doc.id).count();
        setRevisionCount(count);
      }
      return doc;
    };

    const clearDatabase = async (): Promise<void> => {
      await Promise.all([
        db.manuscripts.clear(),
        db.revisions.clear(),
        db.assets.clear(),
        db.assetRefs.clear(),
      ]);
      store.getState().reset();
      setDocId('');
      setTitleText('');
      setRev(0);
      setSavedRev(0);
      setIsDirty(false);
      setRevisionCount(0);
      setAssetStatus('idle');
      try {
        localStorage.removeItem('structpaper_active_doc_id');
      } catch {}
    };

    // Expose on window for Playwright test runner
    window.__STRUCTPAPER_TEST__ = {
      db,
      manuscriptRepo: repo,
      assetRepo,
      bus,
      store,
      engine,
      seedManuscript,
      updateTitle,
      storeAsset,
      getAsset,
      reloadFromDb,
      clearDatabase,
    };

    // Auto-restore document if active ID was previously persisted in localStorage or URL query
    const searchParams = new URLSearchParams(window.location.search);
    const targetId =
      searchParams.get('id') ||
      (typeof localStorage !== 'undefined'
        ? localStorage.getItem('structpaper_active_doc_id')
        : null);

    if (targetId) {
      repo
        .getById(targetId)
        .then((existingDoc) => {
          if (existingDoc) {
            store.getState().setManuscript(existingDoc);
            setDocId(existingDoc.id);
            setTitleText(extractTitle(existingDoc));
            const docRev =
              typeof (existingDoc as { rev?: unknown }).rev === 'number'
                ? ((existingDoc as { rev?: number }).rev ?? 1)
                : 1;
            setRev(docRev);
            setSavedRev(docRev);
            db.revisions
              .where('manuscriptId')
              .equals(existingDoc.id)
              .count()
              .then(setRevisionCount);
          }
          setIsReady(true);
        })
        .catch(() => setIsReady(true));
    } else {
      setIsReady(true);
    }

    return () => {
      unsubscribeStore();
      engine.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main
      data-testid="persistence-test-page"
      className="p-8 max-w-2xl mx-auto space-y-6 font-sans text-slate-800"
    >
      <header className="border-b pb-4">
        <h1 data-testid="page-title" className="text-2xl font-bold">
          StructPaper E2E Data Persistence Test Harness
        </h1>
        <p className="text-sm text-slate-500">
          Verifying Dexie IndexedDB persistence and zero data loss on F5 reload.
        </p>
        <div data-testid="ready-indicator" className="mt-2 text-xs font-mono">
          {isReady ? 'READY' : 'INITIALIZING'}
        </div>
      </header>

      <section className="bg-slate-50 p-4 rounded-lg border space-y-3">
        <h2 className="font-semibold text-lg">Document Status</h2>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <span className="font-semibold">Document ID:</span>{' '}
            <span data-testid="doc-id" className="font-mono">
              {docId || 'none'}
            </span>
          </div>
          <div>
            <span className="font-semibold">Autosave Status:</span>{' '}
            <span
              data-testid="autosave-status"
              className="px-2 py-0.5 rounded font-mono text-xs bg-blue-100 text-blue-800"
            >
              {autosaveStatus}
            </span>
          </div>
          <div>
            <span className="font-semibold">Store rev:</span>{' '}
            <span data-testid="store-rev" className="font-mono">
              {rev}
            </span>
          </div>
          <div>
            <span className="font-semibold">Saved rev:</span>{' '}
            <span data-testid="store-saved-rev" className="font-mono">
              {savedRev}
            </span>
          </div>
          <div>
            <span className="font-semibold">Dirty:</span>{' '}
            <span data-testid="store-is-dirty" className="font-mono">
              {isDirty ? 'true' : 'false'}
            </span>
          </div>
          <div>
            <span className="font-semibold">Revisions in DB:</span>{' '}
            <span data-testid="loaded-revision-count" className="font-mono">
              {revisionCount}
            </span>
          </div>
        </div>

        <div className="pt-2">
          <label className="block text-sm font-semibold mb-1">
            Manuscript Title:
          </label>
          <div
            data-testid="store-title"
            className="p-2 bg-white border rounded text-base font-medium mb-2"
          >
            {titleText || '(No Title)'}
          </div>
          <input
            data-testid="input-title"
            type="text"
            className="w-full p-2 border rounded font-normal"
            placeholder="Edit title to trigger autosave..."
            value={titleText}
            onChange={(e) => {
              const val = e.target.value;
              setTitleText(val);
              busRef.current?.dispatch({
                type: 'metadata/updateTitle',
                payload: { title: [{ t: 'text', v: val }] },
              });
            }}
          />
        </div>
      </section>

      <section className="bg-slate-50 p-4 rounded-lg border space-y-3">
        <h2 className="font-semibold text-lg">Actions</h2>
        <div className="flex flex-wrap gap-2">
          <button
            data-testid="btn-seed"
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-medium"
            onClick={() => {
              window.__STRUCTPAPER_TEST__?.seedManuscript();
            }}
          >
            Seed Sample Manuscript
          </button>

          <button
            data-testid="btn-update-title"
            className="px-4 py-2 bg-amber-600 text-white rounded hover:bg-amber-700 text-sm font-medium"
            onClick={() => {
              const updated = `Updated Title at ${Date.now()}`;
              window.__STRUCTPAPER_TEST__?.updateTitle(updated);
            }}
          >
            Update Title via Command
          </button>

          <button
            data-testid="btn-save-asset"
            className="px-4 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700 text-sm font-medium"
            onClick={async () => {
              const hash = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
              const blob = new Blob(['PNG_SAMPLE_BINARY_BYTES'], {
                type: 'image/png',
              });
              await window.__STRUCTPAPER_TEST__?.storeAsset(hash, blob, {
                mimeType: 'image/png',
                sizeBytes: blob.size,
              });
            }}
          >
            Store Sample Asset
          </button>

          <button
            data-testid="btn-clear-db"
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-sm font-medium"
            onClick={() => {
              window.__STRUCTPAPER_TEST__?.clearDatabase();
            }}
          >
            Clear Database
          </button>
        </div>

        <div className="text-xs text-slate-600">
          Asset Status:{' '}
          <span data-testid="asset-status" className="font-mono">
            {assetStatus}
          </span>
        </div>
      </section>
    </main>
  );
}
