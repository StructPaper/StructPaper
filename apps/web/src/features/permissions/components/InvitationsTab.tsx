'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Copy,
  Check,
  Link2,
  Clock,
  Search,
  X,
  CheckCircle2,
  AlertCircle,
  Trash2,
  UserPlus,
  RefreshCw,
} from 'lucide-react';
import {
  useListInvitations,
  useResendInvite,
  useRevokeInvitation,
  type PendingInvitation,
  type UserRoleAssignmentView,
} from '@structpaper/api-client';
import { sileo } from '@/components/toast';
import { useInvalidateMembers } from '../hooks/useInvalidateMembers';
import {
  apiErrorMessage,
  copyToClipboard,
  describeExpiry,
  formatDateTime,
  GLOBAL_SCOPE_LABEL,
} from '../utils';

export type { PendingInvitation };

export interface InvitationsTabProps {
  /** Optional override of the data (tests / storybook). By default the list is loaded from the API. */
  invitations?: PendingInvitation[];
  onOpenInviteModal?: () => void;
}

interface GeneratedLink {
  invitationId: string;
  email: string;
  url: string;
  expiresAt: string;
  copied: boolean;
}

const isTest = typeof process !== 'undefined' && process.env.NODE_ENV === 'test';

function scopeLabel(roles: UserRoleAssignmentView[]): string {
  const first = roles[0];
  if (!first) return GLOBAL_SCOPE_LABEL;
  return first.scopeJournalName || GLOBAL_SCOPE_LABEL;
}

export const InvitationsTab: React.FC<InvitationsTabProps> = ({
  invitations: invitationsOverride,
  onOpenInviteModal,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmRevokeId, setConfirmRevokeId] = useState<string | null>(null);
  const [generated, setGeneratedLink] = useState<GeneratedLink | null>(null);

  const query = useListInvitations({ query: { enabled: invitationsOverride === undefined } });
  // Our own toasts describe the outcome, so skip the generic network-error toast.
  const resendMutation = useResendInvite({ request: { skipGlobalToast: true } });
  const revokeMutation = useRevokeInvitation({ request: { skipGlobalToast: true } });
  const invalidateMembers = useInvalidateMembers();

  const invitations: PendingInvitation[] = invitationsOverride ?? query.data ?? [];
  const isLoading = invitationsOverride === undefined && query.isLoading;
  const loadError = invitationsOverride === undefined && query.isError;

  const filteredInvitations = invitations.filter((inv) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      inv.email.toLowerCase().includes(q) ||
      (inv.displayName || '').toLowerCase().includes(q) ||
      inv.roles.some((r) => r.roleName.toLowerCase().includes(q))
    );
  });

  /**
   * Only a hash of each token is stored, so an existing link can never be shown again.
   * "Copy link" therefore issues a NEW link (the previous one stops working) and copies that.
   */
  const handleCreateAndCopyLink = async (inv: PendingInvitation) => {
    setBusyId(inv.id);
    try {
      const result: any = await resendMutation.mutateAsync({ id: inv.id });
      const url: string = result.activationUrl;
      const copied = await copyToClipboard(url);

      setGeneratedLink({
        invitationId: inv.id,
        email: inv.email,
        url,
        expiresAt: result.expiresAt,
        copied,
      });
      setConfirmRevokeId(null);

      sileo.success({
        title: copied ? 'Đã tạo link mới và sao chép' : 'Đã tạo link kích hoạt mới',
        description: copied
          ? `Gửi link cho ${inv.email}. Link cũ (nếu có) đã bị vô hiệu hóa.`
          : 'Trình duyệt không cho tự sao chép, hãy sao chép link ở khung bên dưới.',
      });
      await invalidateMembers();
    } catch (err) {
      sileo.error({
        title: 'Không tạo được link kích hoạt',
        description: apiErrorMessage(err, 'Vui lòng thử lại.'),
      });
    } finally {
      setBusyId(null);
    }
  };

  const handleManualCopy = async () => {
    if (!generated) return;
    const copied = await copyToClipboard(generated.url);
    setGeneratedLink({ ...generated, copied });
    if (copied) {
      sileo.success({ title: 'Đã sao chép link kích hoạt' });
    }
  };

  const handleRevoke = async (inv: PendingInvitation) => {
    if (confirmRevokeId !== inv.id) {
      setConfirmRevokeId(inv.id);
      return;
    }
    setBusyId(inv.id);
    try {
      await revokeMutation.mutateAsync({ id: inv.id });
      setConfirmRevokeId(null);
      if (generated?.invitationId === inv.id) setGeneratedLink(null);
      sileo.success({
        title: 'Đã thu hồi lời mời',
        description: `Link kích hoạt của ${inv.email} không còn hiệu lực.`,
      });
      await invalidateMembers();
    } catch (err) {
      sileo.error({
        title: 'Không thu hồi được lời mời',
        description: apiErrorMessage(err, 'Vui lòng thử lại.'),
      });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Search & Action Toolbar */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative group max-w-md w-full">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-3 z-10 pointer-events-none">
              <Search className="w-5 h-5 text-gray-400 group-hover:text-zinc-600 group-focus-within:text-[#78C841] transition-colors" />
              <div className="w-px h-4 bg-gray-200 group-hover:bg-zinc-300 transition-colors" />
            </div>
            <input
              type="text"
              role="searchbox"
              placeholder="Tìm theo email, tên hoặc vai trò..."
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
        </div>

        <div className="flex items-center justify-between text-xs text-slate-500 px-1">
          <div className="flex items-center gap-2 font-medium">
            <Clock className="w-4 h-4 text-amber-500 shrink-0" />
            <span>
              Link kích hoạt có hiệu lực 72 giờ. Mỗi lần tạo link mới sẽ vô hiệu hóa link trước đó.
            </span>
          </div>
          <div className="font-bold text-slate-700">{filteredInvitations.length} lời mời</div>
        </div>
      </div>

      {/* Freshly generated link (also the manual-copy fallback on plain-http pages) */}
      {generated && (
        <div
          data-testid="generated-link-panel"
          className="p-5 bg-lime-500/10 border border-lime-500/20 rounded-3xl space-y-3"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h4 className="text-sm font-bold text-lime-900">
                Link kích hoạt mới cho {generated.email}
              </h4>
              <p className="text-xs text-lime-700/90 mt-0.5">
                {generated.copied ? 'Đã sao chép vào clipboard. ' : ''}
                Hiệu lực đến {formatDateTime(generated.expiresAt)}. Hãy gửi link này cho người được mời;
                link chỉ hiển thị ở đây một lần.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setGeneratedLink(null)}
              className="w-8 h-8 rounded-full hover:bg-lime-500/20 text-lime-800 flex items-center justify-center cursor-pointer shrink-0"
              aria-label="Đóng"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              aria-label="Link kích hoạt"
              value={generated.url}
              onFocus={(e) => e.currentTarget.select()}
              className="flex-1 px-4 py-3 text-xs font-mono bg-white border border-zinc-200 rounded-2xl text-zinc-800 select-all outline-none focus:ring-2 focus:ring-lime-300 focus:border-[#78C841]"
            />
            <button
              type="button"
              onClick={handleManualCopy}
              className="inline-flex items-center gap-2 px-4 py-3 bg-[#78C841] hover:bg-[#68B436] text-white text-xs font-bold rounded-2xl shadow-sm cursor-pointer shrink-0"
            >
              {generated.copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              <span>{generated.copied ? 'Đã sao chép' : 'Sao chép'}</span>
            </button>
          </div>
        </div>
      )}

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
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-400 text-sm" data-testid="invitations-loading">
                    Đang tải danh sách lời mời...
                  </td>
                </tr>
              ) : loadError ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center" data-testid="invitations-error">
                    <div className="inline-flex flex-col items-center gap-3 text-sm text-rose-700">
                      <span className="inline-flex items-center gap-2 font-semibold">
                        <AlertCircle className="w-4 h-4" />
                        Không tải được danh sách lời mời.
                      </span>
                      <button
                        type="button"
                        onClick={() => query.refetch()}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold rounded-xl cursor-pointer"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        Thử lại
                      </button>
                    </div>
                  </td>
                </tr>
              ) : filteredInvitations.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-400 text-sm">
                    {searchQuery ? (
                      `Không tìm thấy lời mời nào phù hợp với "${searchQuery}".`
                    ) : (
                      <div className="inline-flex flex-col items-center gap-3">
                        <span>Hiện không có lời mời nào đang chờ kích hoạt.</span>
                        {onOpenInviteModal && (
                          <button
                            type="button"
                            onClick={onOpenInviteModal}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-[#78C841] hover:bg-[#68B436] text-white text-xs font-bold rounded-xl cursor-pointer"
                          >
                            <UserPlus className="w-3.5 h-3.5" />
                            Mời thành viên mới
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ) : (
                filteredInvitations.map((inv) => {
                  const expiry = describeExpiry(inv.expiresAt);
                  const busy = busyId === inv.id;
                  return (
                    <tr key={inv.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Invitee */}
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

                      {/* Role & Scope */}
                      <td className="py-4 px-6">
                        <div className="flex flex-col gap-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {inv.roles.length === 0 ? (
                              <span className="text-xs text-slate-400">Chưa có vai trò</span>
                            ) : (
                              inv.roles.map((r) => (
                                <span
                                  key={`${r.roleName}-${r.scopeJournalId ?? 'global'}`}
                                  className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-800 border border-slate-200/80"
                                >
                                  {r.roleName}
                                </span>
                              ))
                            )}
                          </div>
                          <span
                            className="text-xs font-semibold text-slate-600 truncate max-w-[220px]"
                            title={scopeLabel(inv.roles)}
                          >
                            {scopeLabel(inv.roles)}
                          </span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-4 px-6">
                        {expiry.expired ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                            <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                            <span>EXPIRED</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                            <span>PENDING</span>
                          </span>
                        )}
                      </td>

                      {/* Expiry */}
                      <td className="py-4 px-6 text-xs text-slate-600">
                        <div className="text-slate-400 text-[11px]">Gửi: {formatDateTime(inv.invitedAt)}</div>
                        <div
                          className={`text-xs font-semibold mt-0.5 ${
                            expiry.expired ? 'text-rose-700' : 'text-amber-700'
                          }`}
                        >
                          {formatDateTime(inv.expiresAt)} ({expiry.label})
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <motion.button
                            type="button"
                            onClick={() => handleCreateAndCopyLink(inv)}
                            disabled={busy}
                            data-testid={`copy-invite-link-${inv.id}`}
                            whileHover={isTest || busy ? undefined : { scale: 1.02 }}
                            whileTap={isTest || busy ? undefined : { scale: 0.98 }}
                            transition={isTest ? { duration: 0 } : undefined}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer shadow-sm border bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200/80 hover:border-zinc-300 disabled:opacity-50"
                            title="Tạo link kích hoạt mới (link cũ sẽ không dùng được nữa) và sao chép"
                          >
                            {busy ? (
                              <RefreshCw className="w-3.5 h-3.5 text-slate-500 animate-spin" />
                            ) : (
                              <Link2 className="w-3.5 h-3.5 text-slate-500" />
                            )}
                            <span>Tạo link mới & sao chép</span>
                          </motion.button>

                          <motion.button
                            type="button"
                            onClick={() => handleRevoke(inv)}
                            disabled={busy}
                            data-testid={`revoke-invite-${inv.id}`}
                            whileHover={isTest || busy ? undefined : { scale: 1.02 }}
                            whileTap={isTest || busy ? undefined : { scale: 0.98 }}
                            transition={isTest ? { duration: 0 } : undefined}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer shadow-sm border disabled:opacity-50 ${
                              confirmRevokeId === inv.id
                                ? 'bg-rose-600 hover:bg-rose-700 text-white border-rose-700'
                                : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200'
                            }`}
                            title="Thu hồi lời mời: tài khoản chưa kích hoạt sẽ bị xóa"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>{confirmRevokeId === inv.id ? 'Bấm lần nữa để thu hồi' : 'Thu hồi'}</span>
                          </motion.button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* End of List Indicator */}
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
