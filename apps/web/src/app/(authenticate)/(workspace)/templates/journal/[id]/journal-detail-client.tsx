'use client';

import React, { useEffect, useState } from 'react';
import { ManagedJournalProfile } from '@/lib/templates/journal-storage';
import { JournalDetailEditor } from '@/features/templates';
import { useJournalEditorData } from '@/features/journals';
import { BASE_PROFILE } from '@structpaper/journal-profiles';
import Link from 'next/link';
import { ArrowLeft, AlertCircle, WifiOff } from 'lucide-react';

/** A blank profile for the "new journal" page: the rules every journal shares, and nothing of another journal's own. */
function newJournalDraft(): ManagedJournalProfile | null {
  try {
    const suffix = Date.now().toString().slice(-4);
    return {
      id: `journal-${suffix}`,
      status: 'draft',
      isCustom: true,
      profile: {
        ...structuredClone(BASE_PROFILE),
        id: `new-journal-${suffix}`,
        names: {
          vi: 'Tạp chí Khoa học Mới',
          en: 'New Academic Scientific Journal',
          short: 'NEW-J',
        },
        color: '#1e3a8a',
        publication: { publisher: 'ĐHQG TP.HCM / VNU-HCM Press' },
      },
      updatedAt: new Date().toISOString(),
    };
  } catch (e) {
    console.error('Failed to init new journal:', e);
    return null;
  }
}

export default function JournalDetailClient({ id }: { id: string }) {
  const isNew = id === 'new';

  const [draft, setDraft] = useState<ManagedJournalProfile | null>(null);
  useEffect(() => {
    if (isNew) setDraft(newJournalDraft());
  }, [isNew]);

  // The journal as the server holds it: name, code, colour, status and its resolved layout rules.
  const { managed: served, serverVersion, isLoading, notFound, isOffline } = useJournalEditorData(id, !isNew);
  const managed = isNew ? draft : served;

  if (isLoading || (isNew && !draft)) {
    return (
      <div className="h-64 flex items-center justify-center text-slate-400 text-xs font-bold animate-pulse">
        Đang nạp hồ sơ quy định tạp chí...
      </div>
    );
  }

  if (!managed || notFound) {
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

  return (
    <>
      {isOffline && (
        <div className="mx-3 mt-2 flex items-center gap-2 rounded-2xl bg-amber-50 border border-amber-200 px-4 py-2 text-xs font-bold text-amber-800" role="status">
          <WifiOff className="w-4 h-4 shrink-0" />
          <span>Không kết nối được máy chủ: đang xem bản lưu trên máy này, chưa thể lưu thay đổi.</span>
        </div>
      )}
      <JournalDetailEditor key={managed.id} initialManaged={managed} isNew={isNew} serverVersion={serverVersion} />
    </>
  );
}
