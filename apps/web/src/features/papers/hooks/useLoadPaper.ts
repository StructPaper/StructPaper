'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useGetManuscript, isMockModeEnabled, type Manuscript } from '@structpaper/api-client';
import { loadPaperFromIndexedDb, savePaperToIndexedDb } from '@/lib/storage/paper-sync';
import { normalizeWorkflowStatus } from '../components/types';
import { useSessionReady } from '@/features/auth';
import type { CompletePaper } from '@/types/paper';

export function manuscriptToCompletePaper(ms: Manuscript): CompletePaper {
  const rawMeta = (ms.metadata || {}) as any;
  const doc = rawMeta?.doc || rawMeta;
  const meta = doc?.metadata || rawMeta;

  return {
    id: ms.id,
    displayName: ms.title,
    metadata: {
      title: ms.title,
      titleEn: meta.titleEn,
      articleType: meta.articleType || 'Bài báo nghiên cứu',
      journalId: ms.journalId || meta.journalId || 'VNUHCM-STD',
      journalName: meta.journalName || 'Tạp chí Khoa học ĐHQGHN',
      journalAbbv: meta.journalAbbv || 'VNU J. Sci.',
      authors: meta.authors || [],
      affiliations: meta.affiliations || [],
      corresponding: meta.corresponding || { name: '', email: '', affiliation: '' },
      abstract: ms.abstract || meta.abstract || '',
      abstractEn: meta.abstractEn,
      keywords: meta.keywords || [],
      keywordsEn: meta.keywordsEn,
      dates: meta.dates || {
        received: '',
        revised: '',
        accepted: '',
        published: '',
      },
      doi: meta.doi || '',
      volume: meta.volume || '',
      issue: meta.issue || '',
      year: meta.year || String(new Date().getFullYear()),
      firstPage: meta.firstPage || 1,
      lastPage: meta.lastPage || 10,
      ...meta,
    },
    sections: doc?.sections || rawMeta?.sections || [],
    references: doc?.references || rawMeta?.references || [],
    layoutSettings: doc?.layoutSettings || rawMeta?.layoutSettings,
    profilePin: (ms as any).profilePin,
    articleTypeCode: (ms as any).articleType ?? undefined,
    templateId: doc?.templateId || rawMeta?.templateId || 'vnuhcm-std',
    templateName: doc?.templateName || rawMeta?.templateName,
    status: normalizeWorkflowStatus(ms.status || (ms as any).workflowStatus),
    workflowStatus: normalizeWorkflowStatus(ms.status || (ms as any).workflowStatus),
    version: (ms as any).version ?? 1,
    createdAt: ms.createdAt,
    updatedAt: ms.updatedAt,
  };
}

export interface UseLoadPaperReturn {
  paper: CompletePaper | null;
  isLoading: boolean;
  isError: boolean;
  error: any;
  isOffline: boolean;
  refetch: () => Promise<void>;
}

export function useLoadPaper(paperId?: string | null): UseLoadPaperReturn {
  const [localPaper, setLocalPaper] = useState<CompletePaper | null>(null);
  const [localLoading, setLocalLoading] = useState<boolean>(true);
  const [localError, setLocalError] = useState<any>(null);

  const isMock = isMockModeEnabled();
  // after a reload the access token is gone until the session is restored: asking before that would be asking as a guest
  const sessionReady = useSessionReady();
  const validId = Boolean(paperId && paperId.trim().length > 0);

  // 1. Fetch from NestJS Backend
  const {
    data: serverData,
    isLoading: isServerLoading,
    isError: isServerError,
    error: serverError,
    refetch: refetchServer,
  } = useGetManuscript(paperId || '', {
    query: {
      enabled: validId && !isMock && sessionReady,
      retry: false,
    },
  });

  // 2. Fetch from IndexedDB on initial load or paperId change
  const loadLocal = useCallback(async () => {
    if (!paperId) {
      setLocalPaper(null);
      setLocalLoading(false);
      return;
    }
    setLocalLoading(true);
    setLocalError(null);
    try {
      const cached = await loadPaperFromIndexedDb(paperId);
      if (cached) {
        setLocalPaper(cached);
      }
    } catch (err) {
      console.warn('[useLoadPaper] Failed reading IndexedDB:', err);
      setLocalError(err);
    } finally {
      setLocalLoading(false);
    }
  }, [paperId]);

  useEffect(() => {
    loadLocal();
  }, [loadLocal]);

  // 3. Reconcile Server Data with Local Cache
  useEffect(() => {
    if (!serverData) return;

    if (localPaper) {
      // Reconcile: Update metadata & version from server while preserving full editor state
      const updated: CompletePaper = {
        ...localPaper,
        displayName: serverData.title,
        metadata: {
          ...localPaper.metadata,
          title: serverData.title,
          abstract: serverData.abstract || localPaper.metadata.abstract,
          journalId: serverData.journalId || localPaper.metadata.journalId,
        },
        status: normalizeWorkflowStatus(serverData.status || (localPaper as any).workflowStatus || localPaper.status),
        workflowStatus: normalizeWorkflowStatus(serverData.status || (localPaper as any).workflowStatus || localPaper.status),
        version: (serverData as any).version || (localPaper as any).version,
        // the profile versions the paper is pinned to are the server's to decide
        profilePin: (serverData as any).profilePin ?? localPaper.profilePin,
        articleTypeCode: (serverData as any).articleType ?? localPaper.articleTypeCode,
        updatedAt: serverData.updatedAt || localPaper.updatedAt,
      };
      setLocalPaper(updated);
      savePaperToIndexedDb(updated).catch(() => {});
    } else {
      // Construct fresh CompletePaper from server manuscript and cache it
      const transformed = manuscriptToCompletePaper(serverData);
      setLocalPaper(transformed);
      savePaperToIndexedDb(transformed).catch(() => {});
    }
  }, [serverData]);

  // Refetch action combining both local and remote
  const refetch = useCallback(async () => {
    await loadLocal();
    if (validId && !isMock) {
      await refetchServer();
    }
  }, [loadLocal, validId, isMock, refetchServer]);

  // Computed state
  const isOffline = Boolean(isServerError && localPaper);
  const isLoading = localLoading || (validId && !isMock && !localPaper && (isServerLoading || !sessionReady));
  const isError = Boolean(!localPaper && (localError || (validId && !isMock && isServerError)));
  const error = localError || serverError;

  return {
    paper: localPaper,
    isLoading,
    isError,
    error,
    isOffline,
    refetch,
  };
}
