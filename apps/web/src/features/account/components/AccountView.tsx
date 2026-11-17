'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  User,
  Mail,
  ShieldCheck,
  CheckCircle2,
  Ban,
  Clock,
  Fingerprint,
  CalendarDays,
  History,
  KeyRound,
  LogOut,
  AlertCircle,
  RefreshCw,
  Copy,
  Check,
} from 'lucide-react';
import { authApi, type AccountProfile } from '@structpaper/api-client';
import { Shimmer } from '@/components/ui/Shimmer';
import { sileo } from '@/components/toast';
import { useAuthStore } from '@/lib/auth-store';
import { copyToClipboard, formatDateTime, GLOBAL_SCOPE_LABEL } from '@/features/permissions/utils';

const isTest = typeof process !== 'undefined' && process.env.NODE_ENV === 'test';

/** Same colours as the role columns of the permission matrix. */
const ROLE_STYLES: Record<string, string> = {
  SuperAdmin: 'text-purple-700 bg-purple-50 border-purple-200',
  JournalManager: 'text-indigo-700 bg-indigo-50 border-indigo-200',
  Editor: 'text-blue-700 bg-blue-50 border-blue-200',
  Reviewer: 'text-lime-700 bg-lime-50 border-lime-200',
  Author: 'text-amber-700 bg-amber-50 border-amber-200',
};
const DEFAULT_ROLE_STYLE = 'text-slate-700 bg-slate-100 border-slate-200';

const cardClass = 'bg-white rounded-[32px] border border-slate-200/80 shadow-sm';

function initialsOf(name: string): string {
  return (
    name
      .split(' ')
      .filter(Boolean)
      .slice(-2)
      .map((w) => w[0]?.toUpperCase())
      .join('') || 'SP'
  );
}

/** Fade/slide-in used by the other pages; disabled in tests. */
const enter = (delay = 0) =>
  isTest
    ? {}
    : {
        initial: { opacity: 0, y: 10 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.3, ease: 'easeOut' as const, delay },
      };

function StatusBadge({ status }: { status: string }) {
  if (status === 'ACTIVE') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-lime-50 text-lime-700 border border-lime-200">
        <CheckCircle2 className="w-3.5 h-3.5 text-lime-600" />
        <span>ACTIVE</span>
      </span>
    );
  }
  if (status === 'SUSPENDED') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
        <Ban className="w-3.5 h-3.5 text-rose-600" />
        <span>SUSPENDED</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
      <Clock className="w-3.5 h-3.5 text-amber-600" />
      <span>{status}</span>
    </span>
  );
}

function DetailTile({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="p-4 rounded-3xl bg-gray-200/50">
      <div className="flex items-center gap-1.5 text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
        {icon}
        <span>{label}</span>
      </div>
      <div className="mt-1.5 text-sm font-extrabold text-zinc-900 break-words">{children}</div>
    </div>
  );
}

/** Loading placeholder that mirrors the real layout (same shimmer as the other pages). */
function AccountShimmer() {
  return (
    <div data-testid="account-loading" className="space-y-6" role="status" aria-label="Đang tải thông tin tài khoản">
      <div className={`${cardClass} p-6 sm:p-8`}>
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
          <Shimmer className="w-24 h-24 rounded-3xl shrink-0" />
          <div className="flex-1 w-full space-y-3">
            <Shimmer className="h-7 w-56 rounded-lg mx-auto sm:mx-0" />
            <Shimmer className="h-3.5 w-64 rounded-md mx-auto sm:mx-0" />
            <div className="flex flex-wrap justify-center sm:justify-start gap-2 pt-1">
              <Shimmer className="h-6 w-20 rounded-full" />
              <Shimmer className="h-6 w-28 rounded-full" />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 pt-6 mt-6 border-t border-slate-100">
          {Array.from({ length: 4 }, (_, i) => (
            <Shimmer key={i} className="h-[74px] rounded-2xl" />
          ))}
        </div>
      </div>
      <div className={`${cardClass} p-6 sm:p-8`}>
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-2">
            <Shimmer className="h-4 w-40 rounded-md" />
            <Shimmer className="h-3 w-72 max-w-full rounded-md" />
          </div>
          <Shimmer className="h-10 w-32 rounded-2xl" />
        </div>
      </div>
    </div>
  );
}

export function AccountView() {
  const logoutFromStore = useAuthStore((s) => s.logout);
  const [confirming, setConfirming] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [idCopied, setIdCopied] = useState(false);
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Same query key as the session bootstrap (useAuth): the profile is fetched once and shared.
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: () => authApi.getAccount<AccountProfile>(),
    staleTime: 60_000,
  });

  useEffect(
    () => () => {
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
    },
    [],
  );

  const handleLogout = async () => {
    // Two-step confirmation: the first click arms the button, a second click within 4s logs out.
    if (!confirming) {
      setConfirming(true);
      confirmTimer.current = setTimeout(() => setConfirming(false), 4000);
      return;
    }
    if (confirmTimer.current) clearTimeout(confirmTimer.current);
    setLoggingOut(true);
    try {
      await authApi.logout();
    } catch {
      // The local session is cleared even if the server could not be reached.
    }
    logoutFromStore();
  };

  const handleCopyId = async (id: string) => {
    const ok = await copyToClipboard(id);
    setIdCopied(ok);
    if (ok) {
      sileo.success({ title: 'Đã sao chép mã người dùng' });
      setTimeout(() => setIdCopied(false), 2000);
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6 pb-16 px-1 sm:px-4 pt-2">
    
      {isLoading ? (
        <AccountShimmer />
      ) : isError || !data ? (
        <div data-testid="account-error" className={`${cardClass} p-10 text-center`}>
          <div className="inline-flex flex-col items-center gap-3 text-sm text-rose-700">
            <span className="inline-flex items-center gap-2 font-semibold">
              <AlertCircle className="w-4 h-4" />
              Không tải được thông tin tài khoản.
            </span>
            <button
              type="button"
              onClick={() => refetch()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold rounded-xl cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Thử lại
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Profile */}
          <motion.section {...enter(0)} className={`p-6 sm:p-8`} data-testid="account-profile">
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
              <div className="relative shrink-0">
                <div className="w-24 h-24 rounded-full bg-lime-500 text-white flex items-center justify-center font-extrabold text-3xl shadow-[inset_0_0_20px_rgba(255,255,255,0.35),0_8px_24px_rgba(0,0,0,0.12)] ring-4 ring-white">
                  {initialsOf(data.displayName || data.email.split('@')[0])}
                </div>
              </div>

              <div className="flex-1 min-w-0 text-center sm:text-left space-y-3">
                <div className="space-y-1">
                  <h2 className="text-2xl font-black text-zinc-900 tracking-tight break-words">
                    {data.displayName || data.email.split('@')[0]}
                  </h2>
                  <div className="inline-flex ml-1 items-center gap-1.5 text-xs text-slate-500">
                    <span className="break-all">{data.email}</span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                  {data.roles.length === 0 && (
                    <span className="text-xs text-slate-400 font-medium">Chưa có vai trò nào</span>
                  )}
                  {data.roles.map((role) => (
                    <span
                      key={`${role.roleName}-${role.scopeJournalId ?? 'global'}`}
                      data-testid="account-role"
                      title={role.scopeJournalName || GLOBAL_SCOPE_LABEL}
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-black border ${
                        ROLE_STYLES[role.roleName] ?? DEFAULT_ROLE_STYLE
                      }`}
                    >
                      <span>{role.roleName}</span>
                      <span className="font-semibold opacity-70 max-w-[180px] truncate">
                        · {role.scopeJournalName || 'Toàn hệ thống'}
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-1.5 pt-6 mt-6 border-t border-slate-100">
              <DetailTile icon={<Fingerprint className="w-3.5 h-3.5" />} label="Mã người dùng">
                <button
                  type="button"
                  onClick={() => handleCopyId(data.id)}
                  title="Sao chép mã người dùng"
                  className="inline-flex items-center gap-1.5 font-mono text-xs cursor-pointer hover:text-[#4d8f26] transition-colors"
                >
                  <span>{data.id.slice(0, 8)}…</span>
                  {idCopied ? <Check className="w-3.5 h-3.5 text-lime-600" /> : <Copy className="w-3.5 h-3.5 text-zinc-400" />}
                </button>
              </DetailTile>
              <DetailTile icon={<KeyRound className="w-3.5 h-3.5" />} label="Phiên bản quyền">
                <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs font-mono font-bold border border-slate-200">
                  v{data.permissionsVersion ?? 1}
                </span>
              </DetailTile>
              <DetailTile icon={<CalendarDays className="w-3.5 h-3.5" />} label="Tham gia từ">
                {data.createdAt ? formatDateTime(data.createdAt) : '—'}
              </DetailTile>
              <DetailTile icon={<History className="w-3.5 h-3.5" />} label="Cập nhật gần nhất">
                {data.updatedAt ? formatDateTime(data.updatedAt) : '—'}
              </DetailTile>
            </div>
          </motion.section>

          {/* Session */}
          <motion.section {...enter(0.08)} className={`p-6 sm:p-8`} data-testid="account-session">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
              <div className="flex items-start gap-4">
                <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-[#78C841] shrink-0">
                </div>
                <div>                  
                </div>
              </div>

              <motion.button
                type="button"
                data-testid="logout-button"
                onClick={handleLogout}
                disabled={loggingOut}
                whileHover={isTest || loggingOut ? undefined : { scale: 1.02 }}
                whileTap={isTest || loggingOut ? undefined : { scale: 0.98 }}
                className={`inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-bold rounded-2xl border shadow-sm cursor-pointer transition-colors shrink-0 disabled:opacity-60 ${
                  confirming
                    ? 'bg-rose-600 hover:bg-rose-700 text-white border-rose-700'
                    : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200'
                }`}
              >
                {loggingOut ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <LogOut className="w-4 h-4" strokeWidth={2.6} />
                )}
                <span>
                  {loggingOut ? 'Đang đăng xuất...' : confirming ? 'Bấm lần nữa để đăng xuất' : 'Đăng xuất'}
                </span>
              </motion.button>
            </div>
          </motion.section>
        </>
      )}
    </div>
  );
}
