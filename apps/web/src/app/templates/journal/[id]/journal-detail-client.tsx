'use client';

import React, { useEffect, useState } from 'react';
import {
  getManagedJournalById,
  ManagedJournalProfile,
} from '@/lib/templates/journal-storage';
import { JournalDetailEditor } from '@/features/templates';
import { resolveProfile } from '@structpaper/journal-profiles';
import Link from 'next/link';
import { ArrowLeft, AlertCircle } from 'lucide-react';

export default function JournalDetailClient({ id }: { id: string }) {
  const isNew = id === 'new';

  const [managed, setManaged] = useState<ManagedJournalProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    if (isNew) {
      // Create fresh blank profile derived from standard base
      try {
        const baseResolved = resolveProfile('std');
        setManaged({
          id: `journal-${Date.now().toString().slice(-4)}`,
          status: 'draft',
          isCustom: true,
          profile: {
            ...baseResolved,
            id: `new-journal-${Date.now().toString().slice(-4)}`,
            names: {
              vi: 'Tạp chí Khoa học Mới',
              en: 'New Academic Scientific Journal',
              short: 'NEW-J',
            },
            color: '#1e3a8a',
          },
          updatedAt: new Date().toISOString(),
        });
      } catch (e) {
        console.error('Failed to init new journal:', e);
      } finally {
        setLoading(false);
      }
      return;
    }

    const found = getManagedJournalById(id);
    setManaged(found);
    setLoading(false);
  }, [id, isNew]);

  if (loading) {
    return (
      <div className="h-64 flex items-center justify-center text-slate-400 text-xs font-bold animate-pulse">
        Đang nạp hồ sơ quy định tạp chí...
      </div>
    );
  }

  if (!managed) {
    return (
      <div className="max-w-xl mx-auto my-12 bg-white rounded-3xl p-8 border border-slate-200/90 text-center shadow-xs space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h3 className="font-extrabold text-base text-slate-900">
          Không tìm thấy hồ sơ tạp chí
        </h3>
        <p className="text-xs text-slate-500">
          Mã định danh tạp chí &quot;{id}&quot; không tồn tại trong hệ thống quy chuẩn của StructPaper.
        </p>
        <Link
          href="/templates"
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-all"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Quay lại danh sách tạp chí</span>
        </Link>
      </div>
    );
  }

  return <JournalDetailEditor initialManaged={managed} isNew={isNew} />;
}
