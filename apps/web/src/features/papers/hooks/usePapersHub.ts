'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  defaultDatabase,
  IndexedDbAssetRepo,
  exportBackup,
} from '@structpaper/storage';
import type {
  ManuscriptRecord,
  ManuscriptInfo,
  WorkflowStatus,
} from '@structpaper/doc-model';
import { adaptV2toV1 } from '@structpaper/doc-model';
import { normalizeJournalId } from '@structpaper/journal-profiles';
import { manuscriptApi, getAccessToken } from '@structpaper/api-client';
import { useAuthStore } from '@/lib/auth-store';
import { manuscriptToCompletePaper } from './useLoadPaper';
import { useStorage } from '@/context/StorageContext';
import { ALL_SAMPLE_PAPERS } from '@/lib/sample-papers';
import { SAMPLE_VNUHCM_RECORDS } from '@/lib/authoring/sample-records-seeder';
import { getAuthoringPapers } from '@/lib/authoring/paper-storage';
import { usePaper } from '@/context/PaperContext';
import type { CompletePaper } from '@/types/paper';
import { toast } from '@/components/toast';
import {
  FilterWorkflowStatus,
  FilterJournal,
  SortOption,
  ViewMode,
  getManuscriptTitle,
  getManuscriptAuthors,
  isUuid,
} from '../components/types';

function remoteManuscriptToRecord(item: any): ManuscriptRecord {
  const rawStatus = (item.status || 'draft').toLowerCase().replace('_', '-');
  const validStatuses: WorkflowStatus[] = ['draft', 'in-review', 'proofing', 'ready', 'published'];
  const workflowStatus: WorkflowStatus = validStatuses.includes(rawStatus as WorkflowStatus)
    ? (rawStatus as WorkflowStatus)
    : rawStatus === 'under-review' || rawStatus === 'submitted'
    ? 'in-review'
    : 'draft';

  const authors = Array.isArray(item.metadata?.authors)
    ? item.metadata.authors
    : typeof item.metadata?.authors === 'string'
    ? [{ name: item.metadata.authors }]
    : [];

  const rawMeta = item.metadata || {};
  const docMeta = rawMeta.doc?.metadata || rawMeta;
  const journalCode =
    item.journal?.code ||
    item.metadata?.journalAbbv ||
    rawMeta.journalId ||
    docMeta.journalId ||
    'VNUHCM-STD';

  return {
    info: {
      id: item.id,
      displayName: item.title || 'Bản thảo máy chủ',
      workflowStatus,
      pinned: false,
      archived: item.status === 'ARCHIVED',
      tags: item.metadata?.tags || [journalCode],
      createdAt: item.createdAt || new Date().toISOString(),
      updatedAt: item.updatedAt || item.createdAt || new Date().toISOString(),
      submissionId: item.metadata?.submissionId,
    },
    doc: {
      id: item.id,
      journalId: journalCode,
      journal: item.journal,
      meta: {
        title: [{ t: 'text', v: item.title || 'Bản thảo máy chủ' }],
        authors,
        abstract: item.abstract || item.metadata?.abstract || '',
      },
      sections: item.metadata?.sections || [],
      schemaVersion: 2,
    } as any,
    revision: item.version || item.currentServerRev || 1,
    syncState: 'synced',
    remoteData: item,
  } as any;
}

export function usePapersHub() {
  const router = useRouter();
  const { setPaper, setCurrentJournal } = usePaper();

  const storage = useStorage();
  const assetRepo = useMemo(() => new IndexedDbAssetRepo(defaultDatabase), []);

  // Papers State
  const [records, setRecords] = useState<ManuscriptRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Filter & View State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<FilterWorkflowStatus>('all');
  const [journalFilter, setJournalFilter] = useState<FilterJournal>('all');
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');

  // Menu & Modal State
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [editingPaper, setEditingPaper] = useState<ManuscriptRecord | null>(null);

  const isTestEnv = typeof process !== 'undefined' && process.env.NODE_ENV === 'test';

  const triggerFilterLoading = useCallback(() => {
    if (isTestEnv) return;
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
    }, 1500);
  }, [isTestEnv]);

  const handleSearchChange = useCallback((q: string) => {
    setSearchQuery(q);
    triggerFilterLoading();
  }, [triggerFilterLoading]);

  const handleStatusFilterChange = useCallback((st: FilterWorkflowStatus) => {
    setStatusFilter(st);
    triggerFilterLoading();
  }, [triggerFilterLoading]);

  const handleJournalFilterChange = useCallback((jf: FilterJournal) => {
    setJournalFilter(jf);
    triggerFilterLoading();
  }, [triggerFilterLoading]);

  const handleSortChange = useCallback((sb: SortOption) => {
    setSortBy(sb);
    triggerFilterLoading();
  }, [triggerFilterLoading]);

  // Load records from IndexedDb and remote server
  const syncingIdsRef = useRef<Set<string>>(new Set());

  const reconcileLocalDrafts = useCallback(
    async (currentRecords: ManuscriptRecord[]) => {
      const token = getAccessToken() || useAuthStore.getState()?.token;
      const isAuth = Boolean(token || useAuthStore.getState()?.isAuthenticated || useAuthStore.getState()?.user);
      const isOnline = typeof navigator !== 'undefined' ? (navigator.onLine ?? true) : true;
      if (!isAuth || !isOnline) return;

      const localDrafts = currentRecords.filter(
        (r) => !isUuid(r.info.id) || (r as any).syncState === 'local'
      );

      if (localDrafts.length === 0) return;

      for (const draft of localDrafts) {
        if (syncingIdsRef.current.has(draft.info.id)) continue;
        syncingIdsRef.current.add(draft.info.id);

        // Update state to show 'syncing'
        setRecords((prev) =>
          prev.map((p) =>
            p.info.id === draft.info.id ? { ...p, syncState: 'syncing' } : p
          )
        );

        try {
          const title = getManuscriptTitle(draft);
          const journalId = draft.doc.journalId || 'VNUHCM-STD';
          const metadata = {
            displayName: draft.info.displayName,
            tags: draft.info.tags,
            workflowStatus: draft.info.workflowStatus,
            submissionId: draft.info.submissionId,
            note: draft.info.note,
            authors: (draft.doc.meta as any)?.authors || [],
            sections: (draft.doc as any)?.sections,
          };

          const created = await manuscriptApi.create({
            title,
            journalId,
            metadata,
            abstract: (draft.doc.meta as any)?.abstract || null,
          });

          if (created?.id && isUuid(created.id)) {
            const oldId = draft.info.id;
            const newId = created.id;

            // 1. Remove old local record from storage
            try {
              await storage.delete(oldId);
            } catch (delErr) {
              console.warn('[usePapersHub] storage.delete oldId failed:', delErr);
            }

            // 2. Prepare new document and info
            const updatedDoc = {
              ...draft.doc,
              id: newId,
              syncState: 'synced',
            };
            const updatedInfo: Partial<ManuscriptInfo> = {
              ...draft.info,
              id: newId,
              updatedAt: (created as any).updatedAt || new Date().toISOString(),
            };

            // 3. Save new record into storage
            await storage.saveRecord(updatedDoc as any, updatedInfo);
            try {
              await (defaultDatabase.manuscripts as any).update(newId, { syncState: 'synced' });
            } catch {
              // ignore
            }

            // 4. Update state records
            setRecords((prev) =>
              prev.map((p) => {
                if (p.info.id === oldId) {
                  return {
                    ...p,
                    info: { ...p.info, id: newId },
                    doc: updatedDoc as any,
                    syncState: 'synced',
                  };
                }
                return p;
              })
            );
          } else {
            setRecords((prev) =>
              prev.map((p) =>
                p.info.id === draft.info.id ? { ...p, syncState: 'local' } : p
              )
            );
          }
        } catch (err) {
          console.warn('[usePapersHub] Auto-sync failed for draft:', draft.info.id, err);
          setRecords((prev) =>
            prev.map((p) =>
              p.info.id === draft.info.id ? { ...p, syncState: 'local' } : p
            )
          );
        } finally {
          syncingIdsRef.current.delete(draft.info.id);
        }
      }
    },
    [storage]
  );

  const loadRecords = useCallback(async () => {
    try {
      const allRecords = await storage.listRecords();
      setRecords(allRecords);
      setError(null);

      // Trigger background reconciliation for local-only drafts when local storage is active
      if (storage.isLocalAvailable) {
        const token = getAccessToken() || useAuthStore.getState()?.token;
        const isAuth = Boolean(token || useAuthStore.getState()?.isAuthenticated || useAuthStore.getState()?.user);
        const isOnline = typeof navigator !== 'undefined' ? (navigator.onLine ?? true) : true;
        if (isAuth && isOnline) {
          reconcileLocalDrafts(allRecords);
        }
      }
    } catch (err: any) {
      console.error('Failed to load manuscript records:', err);
      setError(err instanceof Error ? err : new Error(String(err)));
      setRecords([]);
    } finally {
      if (!isTestEnv) {
        await new Promise((resolve) => setTimeout(resolve, 600));
      }
      setIsLoading(false);
    }
  }, [storage, isTestEnv, reconcileLocalDrafts]);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  useEffect(() => {
    const handleOnline = () => {
      loadRecords();
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [loadRecords]);

  useEffect(() => {
    const unsub = useAuthStore.subscribe((state, prevState) => {
      if ((state.token || state.user) && (!prevState.token && !prevState.user)) {
        loadRecords();
      }
    });
    return () => unsub();
  }, [loadRecords]);

  // Handlers
  const handleOpenEditor = useCallback((id: string) => {
    const record = records.find((r) => r.info.id === id);
    const sample = ALL_SAMPLE_PAPERS.find(
      (s) => s.paper.id === id || s.paper.metadata?.doi?.includes(id) || s.id === id
    );

    if (record) {
      if ((record as any).remoteData) {
        try {
          const complete = manuscriptToCompletePaper((record as any).remoteData);
          setPaper(complete);
          if (record.doc.journalId) {
            const norm = record.doc.journalId.toUpperCase().startsWith('VNUHCM-')
              ? record.doc.journalId
              : `VNUHCM-${record.doc.journalId.toUpperCase()}`;
            setCurrentJournal(norm);
          }
          toast.success('Đã tải bài báo', 'Đang chuyển sang bộ soạn thảo StructPaper...');
          router.push(`/papers/${encodeURIComponent(id)}`);
          return;
        } catch (err) {
          console.warn('[usePapersHub] manuscriptToCompletePaper failed:', err);
        }
      }
      try {
        const v1 = adaptV2toV1(record.doc as any) as CompletePaper;
        if (!v1.id) v1.id = record.info.id;
        v1.displayName = record.info.displayName;
        (v1 as any).submissionId = record.info.submissionId;
        (v1 as any).workflowStatus = record.info.workflowStatus;
        (v1 as any).tags = record.info.tags;
        (v1 as any).note = record.info.note;
        if (record.info.displayName && v1.metadata && !v1.metadata.title) {
          v1.metadata.title = record.info.displayName;
        }
        setPaper(v1);
        if (record.doc.journalId) {
          const norm = record.doc.journalId.toUpperCase().startsWith('VNUHCM-')
            ? record.doc.journalId
            : `VNUHCM-${record.doc.journalId.toUpperCase()}`;
          setCurrentJournal(norm);
        }
      } catch (err) {
        console.error('Failed to adapt v2 doc to v1:', err);
        if (sample) {
          setPaper({
            ...sample.paper,
            displayName: sample.paper.displayName || sample.label,
          });
          if (sample.journalId) {
            setCurrentJournal(sample.journalId);
          }
        }
      }
    } else if (sample) {
      setPaper({
        ...sample.paper,
        displayName: sample.paper.displayName || sample.label,
      });
      if (sample.journalId) {
        setCurrentJournal(sample.journalId);
      }
    }

    toast.success('Đã tải bài báo', 'Đang chuyển sang bộ soạn thảo StructPaper...');
    router.push(`/papers/${encodeURIComponent(id)}`);
  }, [records, setPaper, setCurrentJournal, router]);

  const handleTogglePin = useCallback(async (id: string, currentPinned: boolean) => {
    try {
      await storage.updateInfo(id, { pinned: !currentPinned });
      toast.success(
        !currentPinned ? 'Đã ghim bài báo lên đầu' : 'Đã bỏ ghim bài báo',
        'Danh sách đã được cập nhật thứ tự ưu tiên.'
      );
      await loadRecords();
    } catch (err: any) {
      toast.error('Lỗi ghim bài báo', err?.message);
    }
  }, [storage, loadRecords]);

  const handleSaveQuickEdit = useCallback(async (
    id: string,
    patch: Partial<ManuscriptInfo>
  ) => {
    try {
      await storage.updateInfo(id, patch);
      toast.success(
        'Cập nhật thành công',
        'Thông tin bài báo đã được cập nhật trực tiếp vào cơ sở dữ liệu.'
      );
      await loadRecords();
    } catch (err: any) {
      toast.error('Lỗi cập nhật', err?.message);
    }
  }, [storage, loadRecords]);

  const handleDuplicate = useCallback(async (paper: ManuscriptRecord) => {
    try {
      const rawTitle = paper.info.displayName || getManuscriptTitle(paper);
      const title = `${rawTitle} (Bản sao)`;
      await storage.duplicate(paper);
      toast.success('Đã nhân bản bài báo', `Bản sao "${title}" đã được tạo.`);
      await loadRecords();
    } catch (err: any) {
      toast.error('Lỗi nhân bản bài báo', err?.message);
    }
  }, [storage, loadRecords]);

  const handleExportBackup = useCallback(async (paper: ManuscriptRecord) => {
    try {
      const blob = await exportBackup(paper.doc, assetRepo);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const safeTitle = (paper.info.submissionId || paper.info.displayName || 'paper')
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .slice(0, 30);
      link.download = `${safeTitle}.structpaper`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success(
        'Đã xuất bản sao lưu!',
        `Gói tệp "${link.download}" đã được tải về máy.`
      );
    } catch (err: any) {
      toast.error('Lỗi xuất bản sao lưu', err?.message);
    }
  }, [assetRepo]);

  const handleDelete = useCallback(async (id: string) => {
    try {
      await storage.delete(id);
      toast.info('Đã xóa bài báo', 'Bản thảo đã được gỡ bỏ khỏi kho lưu trữ.');
      await loadRecords();
    } catch (err: any) {
      toast.error('Lỗi xóa bài báo', err?.message);
    }
  }, [storage, loadRecords]);

  // Status Counts
  const countsByStatus = useMemo(() => {
    const counts: Partial<Record<FilterWorkflowStatus, number>> = {
      all: records.length,
      draft: 0,
      'in-review': 0,
      proofing: 0,
      ready: 0,
      published: 0,
    };
    for (const r of records) {
      const st = r.info.workflowStatus;
      if (st && typeof counts[st] === 'number') {
        counts[st] = (counts[st] || 0) + 1;
      }
    }
    return counts;
  }, [records]);

  // Filtered & Sorted Papers
  const filteredPapers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return records
      .filter((r) => {
        // Search query
        if (query) {
          const title = getManuscriptTitle(r).toLowerCase();
          const submissionId = (r.info.submissionId || '').toLowerCase();
          const authors = getManuscriptAuthors(r).toLowerCase();
          const tags = (r.info.tags || []).join(' ').toLowerCase();

          const matchesQuery =
            title.includes(query) ||
            submissionId.includes(query) ||
            authors.includes(query) ||
            tags.includes(query);

          if (!matchesQuery) return false;
        }

        // Status Filter
        if (statusFilter !== 'all' && r.info.workflowStatus !== statusFilter) {
          return false;
        }

        // Journal Filter
        if (journalFilter !== 'all') {
          const normCurrent = normalizeJournalId(r.doc.journalId);
          const normFilter = normalizeJournalId(journalFilter);
          if (normCurrent !== normFilter) return false;
        }

        return true;
      })
      .sort((a, b) => {
        // Always place pinned items at the top
        const aPinned = Boolean(a.info.pinned);
        const bPinned = Boolean(b.info.pinned);
        if (aPinned !== bPinned) return aPinned ? -1 : 1;

        if (sortBy === 'title') {
          return getManuscriptTitle(a).localeCompare(getManuscriptTitle(b));
        }
        if (sortBy === 'status') {
          return (a.info.workflowStatus || '').localeCompare(
            b.info.workflowStatus || ''
          );
        }
        // Default newest
        const timeA = new Date(a.info.updatedAt || a.info.createdAt).getTime();
        const timeB = new Date(b.info.updatedAt || b.info.createdAt).getTime();
        return timeB - timeA;
      });
  }, [records, searchQuery, statusFilter, journalFilter, sortBy]);

  return {
    records,
    filteredPapers,
    isLoading,
    error,
    searchQuery,
    statusFilter,
    journalFilter,
    sortBy,
    viewMode,
    activeMenuId,
    editingPaper,
    countsByStatus,
    setSearchQuery: handleSearchChange,
    setStatusFilter: handleStatusFilterChange,
    setJournalFilter: handleJournalFilterChange,
    setSortBy: handleSortChange,
    setViewMode,
    setActiveMenuId,
    setEditingPaper,
    loadRecords,
    reconcileLocalDrafts,
    handleOpenEditor,
    handleTogglePin,
    handleSaveQuickEdit,
    handleDuplicate,
    handleExportBackup,
    handleDelete,
  };
}
