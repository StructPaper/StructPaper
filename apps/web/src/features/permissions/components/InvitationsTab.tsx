'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Mail,
  Copy,
  Check,
  RotateCw,
  Clock,
  UserPlus,
  Search,
  X,
  CheckCircle2,
} from 'lucide-react';
import { sileo } from '@/components/toast';

export interface PendingInvitation {
  id: string;
  email: string;
  displayName?: string | null;
  role: string;
  scopeJournal?: string | null;
  invitedAt: string;
  expiresAt: string;
  activationToken: string;
  status: 'PENDING';
}

export interface InvitationsTabProps {
  invitations?: PendingInvitation[];
  onOpenInviteModal?: () => void;
  onResendInvite?: (id: string) => void;
}

export const DEFAULT_INVITATIONS: PendingInvitation[] = [
  {
    id: 'inv-1',
    email: 'collaborator.guest@vnu.edu.vn',
    displayName: 'Độc giả / Cộng tác viên ĐHQG',
    role: 'Guest',
    scopeJournal: 'Toàn hệ thống (Global)',
    invitedAt: '14/11/2026 09:30',
    expiresAt: '21/11/2026 09:30 (Còn 7 ngày)',
    activationToken: 'tok_guest_vnuhcm_78901',
    status: 'PENDING',
  },
  {
    id: 'inv-2',
    email: 'reviewer.le@hcmus.edu.vn',
    displayName: 'TS. Lê Hải Đăng',
    role: 'Reviewer',
    scopeJournal: 'VNUHCM-NAT - Tạp chí KHTN',
    invitedAt: '13/11/2026 14:15',
    expiresAt: '20/11/2026 14:15 (Còn 6 ngày)',
    activationToken: 'tok_rev_nat_45612',
    status: 'PENDING',
  },
  {
    id: 'inv-3',
    email: 'editor.tran@medvnu.edu.vn',
    displayName: 'ThS. Trần Thị Kim Cương',
    role: 'Editor',
    scopeJournal: 'VNUHCM-MED - Tạp chí Sức khỏe',
    invitedAt: '12/11/2026 10:00',
    expiresAt: '19/11/2026 10:00 (Còn 5 ngày)',
    activationToken: 'tok_ed_med_12389',
    status: 'PENDING',
  },
];

const isTest = typeof process !== 'undefined' && process.env.NODE_ENV === 'test';

export const InvitationsTab: React.FC<InvitationsTabProps> = ({
  invitations = DEFAULT_INVITATIONS,
  onOpenInviteModal,
  onResendInvite,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);

  const filteredInvitations = invitations.filter((inv) => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;
    const matchesEmail = inv.email.toLowerCase().includes(query);
    const matchesName = (inv.displayName || '').toLowerCase().includes(query);
    const matchesRole = inv.role.toLowerCase().includes(query);
    const matchesToken = inv.activationToken.toLowerCase().includes(query);
    return matchesEmail || matchesName || matchesRole || matchesToken;
  });

  const handleCopyLink = async (inv: PendingInvitation) => {
    const origin =
      typeof window !== 'undefined' && window.location?.origin
        ? window.location.origin
        : 'http://localhost:3000';
    const link = `${origin}/activate?token=${inv.activationToken}`;

    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(link);
      }
    } catch {
      // Ignore clipboard error in headless test environments
    }

    setCopiedId(inv.id);
    sileo.success({
      title: 'Đã sao chép link kích hoạt',
      description: `Liên kết kích hoạt của ${inv.email} đã được lưu vào clipboard.`,
    });

    setTimeout(() => {
      setCopiedId(null);
    }, 2000);
  };

  const handleResend = async (inv: PendingInvitation) => {
    setResendingId(inv.id);
    if (!isTest) {
      await new Promise((r) => setTimeout(r, 600));
    }
    setResendingId(null);

    sileo.info({
      title: 'Đã gửi lại lời mời',
      description: `Hệ thống đã gửi lại email kích hoạt tới ${inv.email}.`,
    });

    if (onResendInvite) {
      onResendInvite(inv.id);
    }
  };

  return (
    <div className="space-y-6">
      {/* Eatzy Search & Action Toolbar */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Eatzy Search Input */}
          <div className="relative group max-w-md w-full">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-3 z-10 pointer-events-none">
              <Search className="w-5 h-5 text-gray-400 group-hover:text-zinc-600 group-focus-within:text-[#78C841] transition-colors" />
              <div className="w-px h-4 bg-gray-200 group-hover:bg-zinc-300 transition-colors" />
            </div>
            <input
              type="text"
              role="searchbox"
              placeholder="Tìm theo email, tên hoặc token..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ boxShadow: 'inset 0 0 20px rgba(0, 0, 0, 0.09)' }}
              className="w-full bg-slate-50/40 backdrop-blur-sm border-2 border-white focus:border-[#78C841]/20 rounded-3xl py-3 pl-14 pr-12 text-sm font-bold text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-4 focus:ring-[#78C841]/5 transition-all shadow-eatzy-inner hover:shadow-eatzy-inner-hover"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 rounded-xl bg-zinc-200 hover:bg-zinc-300 flex items-center justify-center transition-all group/close cursor-pointer"
                title="Xóa tìm kiếm"
              >
                <X className="w-3.5 h-3.5 text-zinc-600 group-hover/close:rotate-90 transition-transform duration-300" />
              </button>
            )}
          </div>

          {/* Quick Invite Button */}
          <motion.button
            type="button"
            onClick={onOpenInviteModal}
            whileHover={isTest ? undefined : { scale: 1.02 }}
            whileTap={isTest ? undefined : { scale: 0.98 }}
            transition={isTest ? { duration: 0 } : undefined}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#78C841] hover:bg-[#68B436] text-white text-sm font-bold rounded-2xl shadow-sm transition-all cursor-pointer shrink-0 self-start sm:self-auto"
          >
            <UserPlus className="w-4 h-4" />
            <span>Mời thành viên mới</span>
          </motion.button>
        </div>

        {/* Subtitle / Expiry Status Notice */}
        <div className="flex items-center justify-between text-xs text-slate-500 px-1">
          <div className="flex items-center gap-2 font-medium">
            <Clock className="w-4 h-4 text-amber-500 shrink-0" />
            <span>Các liên kết kích hoạt có hiệu lực trong 7 ngày kể từ thời điểm gửi.</span>
          </div>
          <div className="font-bold text-slate-700">
            {filteredInvitations.length} lời mời
          </div>
        </div>
      </div>

      {/* Invitations Table Shell */}
      <div className="bg-white rounded-[32px] border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50/60 border-b border-slate-200 text-[11px] uppercase font-bold text-slate-400 tracking-wider py-4 px-6">
              <tr>
                <th className="py-4 px-6">Thành viên được mời</th>
                <th className="py-4 px-6">Vai trò & Phạm vi</th>
                <th className="py-4 px-6">Trạng thái</th>
                <th className="py-4 px-6">Thời hạn kích hoạt</th>
                <th className="py-4 px-6 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredInvitations.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-400 text-sm">
                    {searchQuery
                      ? `Không tìm thấy lời mời nào phù hợp với "${searchQuery}".`
                      : 'Hiện không có lời mời nào đang chờ kích hoạt.'}
                  </td>
                </tr>
              ) : (
                filteredInvitations.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/70 transition-colors">
                    {/* Invitee Column */}
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-amber-100 to-amber-200/70 ring-2 ring-white flex items-center justify-center font-bold text-amber-800 uppercase text-xs shadow-sm shrink-0">
                          {(inv.displayName || inv.email).charAt(0)}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900">
                            {inv.displayName || 'Chưa cập nhật tên'}
                          </div>
                          <div className="text-xs font-mono text-slate-400">{inv.email}</div>
                        </div>
                      </div>
                    </td>

                    {/* Role & Scope Column */}
                    <td className="py-4 px-6">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1.5">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-800 border border-slate-200/80">
                            {inv.role}
                          </span>
                        </div>
                        <span
                          className="text-xs font-semibold text-slate-600 truncate max-w-[220px]"
                          title={inv.scopeJournal || 'Toàn hệ thống (Global)'}
                        >
                          {inv.scopeJournal || 'Toàn hệ thống (Global)'}
                        </span>
                      </div>
                    </td>

                    {/* Status Column */}
                    <td className="py-4 px-6">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                        <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        <span>Chờ kích hoạt (Pending)</span>
                      </span>
                    </td>

                    {/* Expiry Column */}
                    <td className="py-4 px-6 text-xs text-slate-600">
                      <div className="text-slate-400 text-[11px]">Gửi: {inv.invitedAt}</div>
                      <div className="text-xs font-semibold text-amber-700 mt-0.5">
                        {inv.expiresAt}
                      </div>
                    </td>

                    {/* Actions Column */}
                    <td className="py-4 px-6 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {/* One-click Copy Link Button */}
                        <motion.button
                          type="button"
                          onClick={() => handleCopyLink(inv)}
                          data-testid={`copy-invite-link-${inv.id}`}
                          whileHover={isTest ? undefined : { scale: 1.02 }}
                          whileTap={isTest ? undefined : { scale: 0.98 }}
                          transition={isTest ? { duration: 0 } : undefined}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer shadow-sm border ${
                            copiedId === inv.id
                              ? 'bg-lime-50 text-lime-700 border-lime-200'
                              : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200/80 hover:border-zinc-300'
                          }`}
                          title="Sao chép liên kết kích hoạt"
                        >
                          {copiedId === inv.id ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-lime-600" />
                              <span className="text-lime-700">Đã sao chép</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5 text-slate-500" />
                              <span>Sao chép link</span>
                            </>
                          )}
                        </motion.button>

                        {/* Animated Resend Button in sky blue */}
                        <motion.button
                          type="button"
                          onClick={() => handleResend(inv)}
                          disabled={resendingId === inv.id}
                          data-testid={`resend-invite-${inv.id}`}
                          whileHover={isTest || resendingId === inv.id ? undefined : { scale: 1.02 }}
                          whileTap={isTest || resendingId === inv.id ? undefined : { scale: 0.98 }}
                          transition={isTest ? { duration: 0 } : undefined}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 text-xs font-bold rounded-xl transition-all cursor-pointer disabled:opacity-50 shadow-sm"
                          title="Gửi lại email kích hoạt"
                        >
                          <RotateCw
                            className={`w-3.5 h-3.5 text-sky-600 ${
                              resendingId === inv.id ? 'animate-spin' : ''
                            }`}
                          />
                          <span>Gửi lại</span>
                        </motion.button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Signature Eatzy End of List Indicator */}
      {filteredInvitations.length > 0 && (
        <div className="py-8 flex items-center justify-center gap-4 opacity-50 select-none">
          <div className="h-[1px] bg-gradient-to-r from-transparent via-zinc-300 to-transparent w-24" />
          <div className="flex flex-col items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-zinc-500" />
            <span className="text-[12px] font-bold text-zinc-500 uppercase tracking-wider">
              Bạn đã xem hết danh sách lời mời
            </span>
          </div>
          <div className="h-[1px] bg-gradient-to-r from-transparent via-zinc-300 to-transparent w-24" />
        </div>
      )}
    </div>
  );
};
