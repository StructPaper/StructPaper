import type { ManuscriptRecord, WorkflowStatus } from '@structpaper/doc-model';
export type { WorkflowStatus };
import {
  ALL_JOURNAL_IDS,
  JOURNAL_DEFINITIONS,
  normalizeJournalId,
  type JournalId,
} from '@structpaper/journal-profiles';

export type FilterWorkflowStatus = 'all' | WorkflowStatus;
export type FilterJournal = 'all' | JournalId | string;
export type SortOption = 'newest' | 'title' | 'status';
export type ViewMode = 'grid' | 'table';

export interface WorkflowStatusConfig {
  label: string;
  chipBg: string;
  chipText: string;
  border: string;
  dotBg: string;
}

export const WORKFLOW_STATUS_CONFIG: Record<WorkflowStatus, WorkflowStatusConfig> = {
  draft: {
    label: 'Bản nháp',
    chipBg: 'bg-slate-100',
    chipText: 'text-slate-700',
    border: 'border-slate-200',
    dotBg: 'bg-slate-400',
  },
  'in-review': {
    label: 'Đang duyệt',
    chipBg: 'bg-amber-50',
    chipText: 'text-amber-800',
    border: 'border-amber-200',
    dotBg: 'bg-amber-500',
  },
  proofing: {
    label: 'Hiệu đính',
    chipBg: 'bg-sky-50',
    chipText: 'text-sky-800',
    border: 'border-sky-200',
    dotBg: 'bg-sky-500',
  },
  ready: {
    label: 'Sẵn sàng',
    chipBg: 'bg-[#D9F99D]/60',
    chipText: 'text-[#14532D]',
    border: 'border-[#B4E50D]/40',
    dotBg: 'bg-[#78C841]',
  },
  published: {
    label: 'Đã xuất bản',
    chipBg: 'bg-indigo-50',
    chipText: 'text-indigo-800',
    border: 'border-indigo-200',
    dotBg: 'bg-indigo-500',
  },
};

export function getWorkflowStatusConfig(status?: string): WorkflowStatusConfig {
  if (status && status in WORKFLOW_STATUS_CONFIG) {
    return WORKFLOW_STATUS_CONFIG[status as WorkflowStatus];
  }
  return WORKFLOW_STATUS_CONFIG.draft;
}

export const JOURNAL_COLOR_MAP: Record<string, string> = {
  std: '#000099',
  hs: '#2B74B7',
  ssh: '#0000FF',
  ebl: '#8F0B97',
  et: '#0F4761',
  ees: '#0C712F',
  arns: '#FF0000',
};

export function getJournalColor(journalId?: string, record?: ManuscriptRecord): string {
  // 1. Direct color from backend-joined journal
  const backendJournal = (record?.doc as any)?.journal || (record as any)?.remoteData?.journal;
  if (backendJournal?.color) {
    return backendJournal.color;
  }

  // 2. Fallback to journal profile definition
  if (!journalId) return JOURNAL_COLOR_MAP.std;
  const normalized = normalizeJournalId(journalId);
  if (normalized && JOURNAL_DEFINITIONS[normalized]?.color) {
    return JOURNAL_DEFINITIONS[normalized].color!;
  }
  return JOURNAL_COLOR_MAP[journalId.toLowerCase()] || JOURNAL_COLOR_MAP.std;
}

export function getJournalShortName(journalId?: string, record?: ManuscriptRecord): string {
  // 1. Direct code/shortName from backend-joined journal
  const backendJournal = (record?.doc as any)?.journal || (record as any)?.remoteData?.journal;
  if (backendJournal?.code) {
    return backendJournal.code;
  }
  if (backendJournal?.shortName) {
    return `VNUHCM-${backendJournal.shortName.toUpperCase()}`;
  }

  // 2. Metadata journal abbreviation
  const meta = (record?.doc?.meta as any) || (record as any)?.remoteData?.metadata;
  if (meta?.journalAbbv) {
    return meta.journalAbbv;
  }
  if (!journalId) return 'VNUHCM';

  // 3. Journal definition normalized slug
  const normalized = normalizeJournalId(journalId);
  if (normalized && JOURNAL_DEFINITIONS[normalized]?.names?.short) {
    return JOURNAL_DEFINITIONS[normalized].names.short;
  }

  // 4. Default fallback if journalId is not a raw UUID
  if (journalId.length > 20) {
    return 'VNUHCM';
  }
  return journalId.toUpperCase();
}

export function getManuscriptTitle(record: ManuscriptRecord): string {
  if (record.info.displayName && record.info.displayName.trim()) {
    return record.info.displayName.trim();
  }
  if (Array.isArray(record.doc.meta?.title)) {
    const extracted = record.doc.meta.title
      .map((item: any) => (typeof item === 'string' ? item : item.v || item.text || ''))
      .join('')
      .trim();
    if (extracted) return extracted;
  }
  return 'Chưa đặt tiêu đề';
}

export function getManuscriptAuthors(record: ManuscriptRecord): string {
  const authors = record.doc.meta?.authors;
  if (Array.isArray(authors) && authors.length > 0) {
    return authors.map((a: any) => a.name).join(', ');
  }
  return 'Chưa có tác giả';
}

export function formatRelativeTime(dateInput?: string | number | Date): string {
  if (!dateInput) return 'Vừa xong';
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return 'Vừa xong';

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 60) return 'Vừa xong';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} phút trước`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} giờ trước`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay === 1) return 'Hôm qua';
  if (diffDay < 7) return `${diffDay} ngày trước`;

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

export type PaperSyncStatus = 'synced' | 'local' | 'syncing';

export interface SyncBadgeConfig {
  status: PaperSyncStatus;
  label: string;
  icon: string;
  classes: string;
}

export function isUuid(id?: string): boolean {
  if (!id) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

export function getPaperSyncStatus(record: ManuscriptRecord): PaperSyncStatus {
  const syncState =
    (record as any).syncState ||
    (record as any).syncStatus ||
    (record.info as any)?.syncState ||
    (record.doc as any)?.syncState;

  if (syncState === 'syncing') return 'syncing';
  if (syncState === 'synced') return 'synced';
  if (syncState === 'local') return 'local';

  return isUuid(record.info?.id) ? 'synced' : 'local';
}

export const SYNC_STATUS_CONFIG: Record<PaperSyncStatus, SyncBadgeConfig> = {
  synced: {
    status: 'synced',
    label: '☁️ Đã đồng bộ',
    icon: '☁️',
    classes:
      'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
  },
  local: {
    status: 'local',
    label: '💻 Chỉ trên máy',
    icon: '💻',
    classes:
      'bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700',
  },
  syncing: {
    status: 'syncing',
    label: '⏳ Đang đồng bộ...',
    icon: '⏳',
    classes:
      'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800 animate-pulse',
  },
};

export function getSyncBadgeConfig(record: ManuscriptRecord): SyncBadgeConfig {
  const status = getPaperSyncStatus(record);
  return SYNC_STATUS_CONFIG[status];
}
