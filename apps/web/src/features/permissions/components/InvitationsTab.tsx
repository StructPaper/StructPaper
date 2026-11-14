'use client';

import React, { useState } from 'react';
import {
  Mail,
  Copy,
  Check,
  RotateCw,
  Clock,
  Send,
  UserPlus,
  Shield,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';

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

const DEFAULT_INVITATIONS: PendingInvitation[] = [
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

export const InvitationsTab: React.FC<InvitationsTabProps> = ({
  invitations = DEFAULT_INVITATIONS,
  onOpenInviteModal,
  onResendInvite,
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const handleCopyLink = async (inv: PendingInvitation) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
    const link = `${origin}/activate?token=${inv.activationToken}`;

    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(link);
      }
      setCopiedId(inv.id);
      setToastMessage(`Đã sao chép link kích hoạt của ${inv.email}`);
      setTimeout(() => setCopiedId(null), 2000);
      setTimeout(() => setToastMessage(null), 4000);
    } catch {
      setCopiedId(inv.id);
      setToastMessage(`Đã sao chép link kích hoạt của ${inv.email}`);
      setTimeout(() => setCopiedId(null), 2000);
      setTimeout(() => setToastMessage(null), 4000);
    }
  };

  const handleResend = async (inv: PendingInvitation) => {
    setResendingId(inv.id);
    await new Promise((r) => setTimeout(r, 600));
    setResendingId(null);
    setToastMessage(`Đã gửi lại email kích hoạt tới ${inv.email}`);
    setTimeout(() => setToastMessage(null), 4000);
    if (onResendInvite) {
      onResendInvite(inv.id);
    }
  };

  return (
    <div className="space-y-5">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-xl flex items-center gap-3 text-sm text-indigo-800 shadow-sm animate-in fade-in">
          <Check className="w-5 h-5 text-indigo-600 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Bar */}
      <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">
            Danh sách lời mời chờ kích hoạt (Pending Invitations)
          </h3>
          <p className="text-xs text-slate-500">
            Các liên kết kích hoạt có hiệu lực trong 7 ngày kể từ thời điểm gửi.
          </p>
        </div>
        <button
          onClick={onOpenInviteModal}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg shadow-sm transition-colors cursor-pointer"
        >
          <UserPlus className="w-4 h-4" />
          <span>Mời thành viên mới</span>
        </button>
      </div>

      {/* Invitations Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50/75 border-b border-slate-200 text-xs uppercase font-semibold text-slate-500 tracking-wider">
              <tr>
                <th className="px-5 py-3.5">Thành viên được mời</th>
                <th className="px-4 py-3.5">Vai trò & Phạm vi</th>
                <th className="px-4 py-3.5">Trạng thái</th>
                <th className="px-4 py-3.5">Thời hạn kích hoạt</th>
                <th className="px-5 py-3.5 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {invitations.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-400 text-sm">
                    Hiện không có lời mời nào đang chờ kích hoạt.
                  </td>
                </tr>
              ) : (
                invitations.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700">
                          <Mail className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="font-medium text-slate-800">
                            {inv.displayName || 'Chưa cập nhật tên'}
                          </div>
                          <div className="text-xs text-slate-500 font-mono">{inv.email}</div>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-4">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-semibold text-xs text-indigo-700">
                          {inv.role}
                        </span>
                        <span className="text-[11px] text-slate-500">
                          {inv.scopeJournal || 'Toàn hệ thống'}
                        </span>
                      </div>
                    </td>

                    <td className="px-4 py-4">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                        <Clock className="w-3.5 h-3.5 text-amber-600" />
                        <span>Chờ kích hoạt (Pending)</span>
                      </span>
                    </td>

                    <td className="px-4 py-4 text-xs text-slate-600">
                      <div>Gửi: {inv.invitedAt}</div>
                      <div className="text-[11px] text-amber-700 font-medium">{inv.expiresAt}</div>
                    </td>

                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => handleCopyLink(inv)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-lg transition-colors cursor-pointer"
                          title="Sao chép liên kết kích hoạt"
                        >
                          {copiedId === inv.id ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                              <span className="text-emerald-700">Đã sao chép</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5 text-slate-500" />
                              <span>Sao chép link</span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleResend(inv)}
                          disabled={resendingId === inv.id}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-medium rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                          title="Gửi lại email kích hoạt"
                        >
                          <RotateCw
                            className={`w-3.5 h-3.5 text-indigo-600 ${
                              resendingId === inv.id ? 'animate-spin' : ''
                            }`}
                          />
                          <span>Gửi lại</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
