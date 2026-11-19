import {
  JournalProfile,
  resolveProfile,
  ALL_JOURNAL_IDS,
  JournalId,
  JOURNAL_DEFINITIONS,
} from '@structpaper/journal-profiles';
import { CompletePaper } from '@/types/paper';
import { saveAuthoringPaper } from '@/lib/authoring/paper-storage';

export type JournalStatus = 'published' | 'draft' | 'validated' | 'archived';

export interface ManagedJournalProfile {
  id: string;
  status: JournalStatus;
  isCustom?: boolean;
  profile: JournalProfile;
  updatedAt?: string;
}

export const STORAGE_KEY_JOURNALS = 'structpaper_managed_journals';

export const VNUHCM_COLOR_PALETTE = [
  { id: 'std', name: 'ĐHQG Khoa học & Công nghệ', hex: '#000099' },
  { id: 'hs', name: 'Khoa học Sức khỏe', hex: '#2B74B7' },
  { id: 'ssh', name: 'KH Xã hội & Nhân văn', hex: '#0000FF' },
  { id: 'ebl', name: 'Kinh tế, Luật & Quản lý', hex: '#8F0B97' },
  { id: 'et', name: 'Kỹ thuật & Công nghệ', hex: '#000000' },
  { id: 'ees', name: 'Trái đất & Môi trường', hex: '#0C712F' },
  { id: 'arns', name: 'Khoa học Tự nhiên', hex: '#FF0000' },
];

/**
 * Creates the standard 7 VNUHCM default managed profiles
 */
export function getDefaultVnuhcmJournals(): ManagedJournalProfile[] {
  return ALL_JOURNAL_IDS.map((jid) => {
    const resolved = resolveProfile(jid);
    const status: JournalStatus = jid === 'arns' ? 'draft' : 'published';
    return {
      id: jid,
      status,
      isCustom: false,
      profile: resolved,
      updatedAt: new Date().toISOString(),
    };
  });
}

/**
 * Retrieves all managed journals from localStorage with fallback to 7 built-ins
 */
export function getManagedJournals(): ManagedJournalProfile[] {
  if (typeof window === 'undefined') {
    return getDefaultVnuhcmJournals();
  }
  try {
    const stored = localStorage.getItem(STORAGE_KEY_JOURNALS);
    if (!stored) {
      const defaults = getDefaultVnuhcmJournals();
      localStorage.setItem(STORAGE_KEY_JOURNALS, JSON.stringify(defaults));
      return defaults;
    }
    const parsed = JSON.parse(stored) as ManagedJournalProfile[];
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
    return getDefaultVnuhcmJournals();
  } catch (err) {
    console.warn('Failed to parse managed journals from localStorage:', err);
    return getDefaultVnuhcmJournals();
  }
}

/**
 * Retrieves a single managed journal by id
 */
export function getManagedJournalById(id: string): ManagedJournalProfile | null {
  const all = getManagedJournals();
  const match = all.find((j) => j.id.toLowerCase() === id.trim().toLowerCase());
  if (match) return match;

  // Try resolving directly from journal-profiles if known ID
  try {
    const resolved = resolveProfile(id);
    return {
      id,
      status: 'published',
      isCustom: false,
      profile: resolved,
      updatedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

/**
 * Persists a managed journal to localStorage
 */
export function saveManagedJournal(managed: ManagedJournalProfile): void {
  if (typeof window === 'undefined') return;
  try {
    const list = getManagedJournals();
    const idx = list.findIndex((j) => j.id.toLowerCase() === managed.id.toLowerCase());
    const updated: ManagedJournalProfile = {
      ...managed,
      updatedAt: new Date().toISOString(),
    };
    let nextList: ManagedJournalProfile[];
    if (idx >= 0) {
      nextList = [...list];
      nextList[idx] = updated;
    } else {
      nextList = [updated, ...list];
    }
    localStorage.setItem(STORAGE_KEY_JOURNALS, JSON.stringify(nextList));
  } catch (err) {
    console.error('Failed to save managed journal:', err);
  }
}

/**
 * Resets a journal profile back to its standard base definition
 */
export function resetJournalToBase(id: string): ManagedJournalProfile {
  const cleanProfile = resolveProfile(id);
  const resetItem: ManagedJournalProfile = {
    id,
    status: id === 'arns' ? 'draft' : 'published',
    isCustom: false,
    profile: cleanProfile,
    updatedAt: new Date().toISOString(),
  };
  saveManagedJournal(resetItem);
  return resetItem;
}

/**
 * Creates a new CompletePaper from a journal profile and stores it
 */
export function createNewPaperFromJournal(managed: ManagedJournalProfile): CompletePaper {
  const now = new Date();
  const year = now.getFullYear().toString();
  const p = managed.profile;

  const displayLabel = `Bản thảo bài báo mới - ${p.names?.short || p.names?.vi || ''}`;
  const newPaper: CompletePaper = {
    id: `paper_${Date.now()}`,
    displayName: displayLabel,
    templateId: p.id,
    templateName: p.names?.vi || p.names?.en || 'Mẫu Tạp chí',
    status: 'draft',
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    metadata: {
      title: displayLabel,
      articleType: p.articleTypes?.[0]?.label?.vi || 'Bài báo nghiên cứu',
      journalId: p.id,
      journalName: p.names?.vi || 'Tạp chí ĐHQG-HCM',
      journalAbbv: p.names?.short || 'STDJ',
      authors: [
        {
          id: `auth_${Date.now()}_1`,
          name: 'Tác giả chính',
          email: 'author@vnuhcm.edu.vn',
          affiliationIds: [1],
          isCorresponding: true,
        },
      ],
      affiliations: [
        {
          id: 1,
          name: 'Đại học Quốc gia Thành phố Hồ Chí Minh',
        },
      ],
      corresponding: {
        name: 'Tác giả chính',
        email: 'author@vnuhcm.edu.vn',
        affiliation: 'Đại học Quốc gia Thành phố Hồ Chí Minh',
      },
      abstract:
        'Nhập tóm tắt nghiên cứu khoa học tại đây. Nêu rõ bối cảnh, phương pháp thực nghiệm, kết quả thu được và đóng góp chính của bài báo.',
      keywords: ['Bài báo khoa học', p.names?.short || 'ĐHQG-HCM', 'Thực nghiệm'],
      dates: {
        received: `${String(now.getDate()).padStart(2, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}-${year}`,
        revised: '',
        accepted: '',
        published: '',
      },
      doi: `https://doi.org/10.32508/${p.id}.${year}.001`,
      volume: '1',
      issue: '1',
      year,
      firstPage: 1,
      lastPage: 10,
    },
    sections: [
      {
        id: `sec_${Date.now()}_1`,
        type: 'h1',
        title: '1. GIỚI THIỆU',
        content: '',
      },
      {
        id: `sec_${Date.now()}_2`,
        type: 'paragraph',
        content: 'Đặt vấn đề và tổng quan các nghiên cứu liên quan. Giới thiệu mục tiêu nghiên cứu và cấu trúc bài báo.',
      },
      {
        id: `sec_${Date.now()}_3`,
        type: 'h1',
        title: '2. PHƯƠNG PHÁP NGHIÊN CỨU',
        content: '',
      },
      {
        id: `sec_${Date.now()}_4`,
        type: 'paragraph',
        content: 'Mô tả chi tiết phương pháp, dữ liệu, thiết kế nghiên cứu hoặc mô hình toán học/thực nghiệm áp dụng.',
      },
      {
        id: `sec_${Date.now()}_5`,
        type: 'h1',
        title: '3. KẾT QUẢ VÀ THẢO LUẬN',
        content: '',
      },
      {
        id: `sec_${Date.now()}_6`,
        type: 'paragraph',
        content: 'Trình bày kết quả nghiên cứu định lượng, phân tích so sánh với các công trình trước đây.',
      },
      {
        id: `sec_${Date.now()}_7`,
        type: 'h1',
        title: '4. KẾT LUẬN',
        content: '',
      },
      {
        id: `sec_${Date.now()}_8`,
        type: 'paragraph',
        content: 'Tóm tắt các đóng góp khoa học chính và đề xuất hướng phát triển tiếp theo.',
      },
    ],
    references: [
      {
        id: 1,
        raw: 'Nguyen, V. A., & Tran, H. (2025). Advanced Structural Extraction and Typesetting for Scientific Papers. Journal of Science & Technology, 12(3), 45-58.',
        authors: 'Nguyen, V. A., Tran, H.',
        title: 'Advanced Structural Extraction and Typesetting for Scientific Papers',
        year: '2025',
        isCited: true,
        citationCount: 1,
      },
    ],
  };

  saveAuthoringPaper(newPaper);
  return newPaper;
}
