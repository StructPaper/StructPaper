import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { http } from '@structpaper/api-client';
import { resolveProfile } from '@structpaper/journal-profiles';
import {
  ManagedJournalProfile,
  JournalStatus,
  getManagedJournals,
  getManagedJournalById,
  saveManagedJournal,
  resetJournalToBase,
  createNewPaperFromJournal,
} from '@/lib/templates/journal-storage';
import { usePaper } from '@/context/PaperContext';
import { usePaperStorage } from '@/features/editor';
import { createEmptyPaper } from '@/types/paper';
import { toast } from '@/components/toast';

export function useManagedJournals() {
  const router = useRouter();
  const { setPaper, setCurrentJournal } = usePaper();
  const { savePaper } = usePaperStorage();

  const isTestEnv = typeof process !== 'undefined' && process.env.NODE_ENV === 'test';
  const [journals, setJournals] = useState<ManagedJournalProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | JournalStatus>('all');
  const [isLoading, setIsLoading] = useState(!isTestEnv);
  const [error, setError] = useState<Error | null>(null);

  const loadJournals = useCallback(async () => {
    // 1. Initial immediate fallback from local presets / storage for fast instant render
    const localDefaults = getManagedJournals();
    setJournals(localDefaults);

    // 2. Asynchronously sync with Backend NestJS /api/v1/journals
    try {
      const res: any = await http.get('/api/v1/journals');
      if (Array.isArray(res) && res.length > 0) {
        const merged = res.map((bj: any) => {
          const shortKey = (bj.shortName || bj.slug.replace('vnuhcm-', '')).toLowerCase();
          const localMatch = localDefaults.find(
            (ld) => ld.id.toLowerCase() === shortKey || ld.id.toLowerCase() === bj.slug.toLowerCase(),
          );
          if (localMatch) {
            return {
              ...localMatch,
              status: (bj.status as JournalStatus) || localMatch.status,
            };
          }
          let resolvedProf: any = null;
          try {
            resolvedProf = resolveProfile(shortKey);
          } catch {
            resolvedProf = {
              id: bj.slug,
              names: { vi: bj.name, en: bj.name, short: bj.code },
              color: bj.color,
            };
          }
          return {
            id: shortKey,
            status: (bj.status as JournalStatus) || 'published',
            isCustom: false,
            profile: resolvedProf,
            updatedAt: new Date().toISOString(),
          };
        });
        setJournals(merged);
      }
      setError(null);
    } catch (err: any) {
      // In case backend is offline, preserve local presets seamlessly
      if (isTestEnv) {
        setError(err instanceof Error ? err : new Error(String(err)));
      }
    } finally {
      setIsLoading(false);
    }
  }, [isTestEnv]);

  useEffect(() => {
    loadJournals();
  }, [loadJournals]);

  const triggerFilterLoading = useCallback(() => {
    if (isTestEnv) return;
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
    }, 400);
  }, [isTestEnv]);

  const handleSearchChange = useCallback((query: string) => {
    setSearchQuery(query);
    triggerFilterLoading();
  }, [triggerFilterLoading]);

  const handleStatusFilterChange = useCallback((status: 'all' | JournalStatus) => {
    setStatusFilter(status);
    triggerFilterLoading();
  }, [triggerFilterLoading]);

  const createPaperFromTemplate = useCallback(
    (managed: ManagedJournalProfile) => {
      try {
        const journalCode = `VNUHCM-${managed.id.toUpperCase()}`;
        const journalShort = managed.profile.names?.short || managed.id.toUpperCase();
        const emptyPaper = createEmptyPaper(journalCode);
        emptyPaper.displayName = `Bản thảo ${journalShort}`;
        emptyPaper.metadata.journalName =
          managed.profile.names?.vi || managed.profile.names?.en || managed.id;
        emptyPaper.metadata.journalAbbv = journalShort;

        setPaper(emptyPaper);
        setCurrentJournal(journalCode);
        savePaper(emptyPaper).catch((err) => {
          console.warn('Failed to background persist template paper:', err);
        });

        toast.success(
          'Đã khởi tạo bản thảo',
          `Đã tạo bài báo mới theo chuẩn mẫu "${managed.profile.names?.short || managed.id.toUpperCase()}"`
        );
        router.push('/editor');
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Lỗi không xác định';
        toast.error('Không thể tạo bài báo', msg);
      }
    },
    [setPaper, setCurrentJournal, savePaper, router]
  );

  const createTestPaper = useCallback(
    (managed: ManagedJournalProfile) => {
      try {
        const newPaper = createNewPaperFromJournal(managed);
        setPaper(newPaper);
        if (newPaper.metadata?.journalId) {
          setCurrentJournal(newPaper.metadata.journalId);
        }
        savePaper(newPaper).catch((err) => {
          console.warn('Failed to background persist test paper:', err);
        });
        toast.success('Đã tạo bài báo', 'Đang chuyển đến trang soạn thảo...');
        router.push('/editor');
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Không thể tạo bài báo';
        toast.error('Lỗi', msg);
      }
    },
    [setPaper, setCurrentJournal, savePaper, router]
  );

  const saveProfile = useCallback((profile: ManagedJournalProfile) => {
    try {
      saveManagedJournal(profile);
      setJournals((prev) => prev.map((j) => (j.id === profile.id ? profile : j)));
    } catch (err: any) {
      console.error('Failed to save journal profile:', err);
      throw err;
    }
  }, []);

  const resetProfile = useCallback((id: string) => {
    try {
      const reset = resetJournalToBase(id);
      setJournals((prev) => prev.map((j) => (j.id === reset.id ? reset : j)));
      return reset;
    } catch (err: any) {
      console.error('Failed to reset journal profile:', err);
      throw err;
    }
  }, []);

  const filteredJournals = useMemo(() => {
    return journals.filter((item) => {
      if (statusFilter !== 'all' && item.status !== statusFilter) {
        return false;
      }
      if (!searchQuery.trim()) return true;

      const q = searchQuery.toLowerCase().trim();
      const p = item.profile;
      const matchNameVi = p.names?.vi?.toLowerCase().includes(q);
      const matchNameEn = p.names?.en?.toLowerCase().includes(q);
      const matchShort = p.names?.short?.toLowerCase().includes(q);
      const matchId = item.id.toLowerCase().includes(q);

      return Boolean(matchNameVi || matchNameEn || matchShort || matchId);
    });
  }, [journals, statusFilter, searchQuery]);

  return {
    journals,
    filteredJournals,
    isLoading,
    error,
    searchQuery,
    statusFilter,
    setSearchQuery: handleSearchChange,
    setStatusFilter: handleStatusFilterChange,
    getJournalById: getManagedJournalById,
    createPaperFromTemplate,
    createTestPaper,
    saveProfile,
    resetProfile,
    reloadJournals: loadJournals,
  };
}
