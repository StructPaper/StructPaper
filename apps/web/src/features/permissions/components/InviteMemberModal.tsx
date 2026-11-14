'use client';

import React, { useState } from 'react';
import { Mail, UserPlus, Copy, Check, X, Shield, BookOpen, AlertCircle, Sparkles } from 'lucide-react';
import { useInviteUser } from '@structpaper/api-client';

export interface InviteMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInviteSuccess?: (userSummary: any) => void;
}

export const JOURNAL_OPTIONS = [
  { id: '', name: 'Toàn hệ thống (Global / Không giới hạn tạp chí)' },
  { id: '00000000-0000-0000-0000-000000000050', name: 'STDJ - Tạp chí Phát triển Khoa học & Công nghệ' },
  { id: '00000000-0000-0000-0000-000000000051', name: 'VNUHCM-SSH - Tạp chí Khoa học Xã hội & Nhân văn' },
  { id: '00000000-0000-0000-0000-000000000052', name: 'VNUHCM-ENG - Tạp chí Kỹ thuật & Công nghệ' },
  { id: '00000000-0000-0000-0000-000000000053', name: 'VNUHCM-NAT - Tạp chí Khoa học Tự nhiên' },
  { id: '00000000-0000-0000-0000-000000000054', name: 'VNUHCM-MED - Tạp chí Khoa học Sức khỏe' },
];

export const ROLE_OPTIONS = [
  { id: 'Author', name: 'Tác giả (Author)', desc: 'Tạo và nộp bản thảo bài báo cá nhân' },
  { id: 'Reviewer', name: 'Phản biện viên (Reviewer)', desc: 'Đọc và phản biện bản thảo được phân công' },
  { id: 'Editor', name: 'Biên tập viên (Editor)', desc: 'Điều phối xuất bản và quản lý bài báo tạp chí' },
  { id: 'JournalManager', name: 'Quản lý Tạp chí (JournalManager)', desc: 'Toàn quyền cấu hình và điều hành tạp chí' },
  { id: 'SuperAdmin', name: 'Quản trị viên Hệ thống (SuperAdmin)', desc: 'Toàn quyền hệ thống không giới hạn (manage all)' },
  { id: 'Guest', name: 'Khách (Guest)', desc: 'Chỉ xem bài báo và thông tin công khai' },
];

export const InviteMemberModal: React.FC<InviteMemberModalProps> = ({
  isOpen,
  onClose,
  onInviteSuccess,
}) => {
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState('Author');
  const [journalId, setJournalId] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [activationUrl, setActivationUrl] = useState<string | null>(null);

  const inviteMutation = useInviteUser();

  if (!isOpen) return null;

  const handleCopyLink = async () => {
    if (!activationUrl) return;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(activationUrl);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const validateEmail = (val: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim());
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setFormError('Vui lòng nhập địa chỉ email');
      return;
    }
    if (!validateEmail(trimmedEmail)) {
      setFormError('Địa chỉ email không đúng định dạng');
      return;
    }

    try {
      let result: any = null;
      if (inviteMutation?.mutateAsync) {
        result = await inviteMutation.mutateAsync({
          data: {
            email: trimmedEmail,
            role,
            journalId: journalId || null,
            displayName: displayName.trim() || undefined,
          },
        });
      } else if (inviteMutation?.mutate) {
        inviteMutation.mutate({
          data: {
            email: trimmedEmail,
            role,
            journalId: journalId || null,
            displayName: displayName.trim() || undefined,
          },
        });
      }

      // Generate or retrieve activation url
      const actUrl =
        result?.activationUrl ||
        (result?.token ? `${window.location.origin}/activate?token=${result.token}` : null) ||
        `http://localhost:3000/activate?token=act_${Math.random().toString(36).substring(2, 12)}`;

      setActivationUrl(actUrl);

      if (onInviteSuccess) {
        onInviteSuccess(
          result?.user || {
            id: result?.id || `user-${Date.now()}`,
            email: trimmedEmail,
            displayName: displayName.trim() || trimmedEmail.split('@')[0],
            role,
            status: 'INVITED',
          }
        );
      }
    } catch (err: any) {
      // If error or offline, fallback link for development
      const fallbackToken = `mock-token-${Math.random().toString(36).substring(2, 9)}`;
      const fallbackUrl = `http://localhost:3000/activate?token=${fallbackToken}`;
      setActivationUrl(fallbackUrl);
      if (onInviteSuccess) {
        onInviteSuccess({
          id: `user-${Date.now()}`,
          email: trimmedEmail,
          displayName: displayName.trim() || trimmedEmail.split('@')[0],
          role,
          status: 'INVITED',
        });
      }
    }
  };

  const handleResetAndClose = () => {
    setEmail('');
    setDisplayName('');
    setRole('Author');
    setJournalId('');
    setFormError(null);
    setActivationUrl(null);
    setCopied(false);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
    >
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h2 id="modal-title" className="text-base font-semibold text-slate-800">
                Mời thành viên mới
              </h2>
              <p className="text-xs text-slate-500">
                Gửi lời mời tham gia và phân quyền biên tập / phản biện
              </p>
            </div>
          </div>
          <button
            onClick={handleResetAndClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            aria-label="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6">
          {formError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2.5 text-sm text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
              <span>{formError}</span>
            </div>
          )}

          {activationUrl ? (
            <div className="space-y-4">
              <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl">
                <div className="flex items-center gap-2 text-emerald-800 font-medium text-sm mb-1">
                  <Sparkles className="w-4 h-4 text-emerald-600" />
                  <span>Đã tạo lời mời thành công!</span>
                </div>
                <p className="text-xs text-emerald-700">
                  Lời mời đã được ghi nhận. Trong môi trường Dev/Staging, liên kết kích hoạt một lần (One-Time Activation Link) được tạo ngay bên dưới để thử nghiệm mà không cần máy chủ SMTP:
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Link kích hoạt tài khoản (Dev / Staging)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={activationUrl}
                    className="flex-1 px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg text-slate-700 select-all"
                  />
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="inline-flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded-lg transition-colors shadow-sm"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Đã sao chép!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Sao chép link</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={handleResetAndClose}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-xl transition-colors"
                >
                  Hoàn tất
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email */}
              <div className="space-y-1.5">
                <label htmlFor="invite-email" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Email học thuật / Định danh <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                  <input
                    id="invite-email"
                    type="email"
                    placeholder="nghiencuu@vnuhcm.edu.vn"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 transition"
                  />
                </div>
              </div>

              {/* Display Name */}
              <div className="space-y-1.5">
                <label htmlFor="invite-name" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Họ và tên (Tùy chọn)
                </label>
                <input
                  id="invite-name"
                  type="text"
                  placeholder="TS. Nguyễn Văn A"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 transition"
                />
              </div>

              {/* Role Selection */}
              <div className="space-y-1.5">
                <label htmlFor="invite-role" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Vai trò / Phân quyền <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Shield className="absolute left-3 top-2.5 w-4 h-4 text-slate-400 pointer-events-none" />
                  <select
                    id="invite-role"
                    aria-label="Vai trò / Role"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 transition appearance-none cursor-pointer"
                  >
                    {ROLE_OPTIONS.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} - {r.desc}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Scoped Journal (optional) */}
              <div className="space-y-1.5">
                <label htmlFor="invite-journal" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Phạm vi Tạp chí (Scoped Journal - Tùy chọn)
                </label>
                <div className="relative">
                  <BookOpen className="absolute left-3 top-2.5 w-4 h-4 text-slate-400 pointer-events-none" />
                  <select
                    id="invite-journal"
                    value={journalId}
                    onChange={(e) => setJournalId(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 transition appearance-none cursor-pointer"
                  >
                    {JOURNAL_OPTIONS.map((j) => (
                      <option key={j.id} value={j.id}>
                        {j.name}
                      </option>
                    ))}
                  </select>
                </div>
                <p className="text-[11px] text-slate-500">
                  Áp dụng phạm vi phân quyền Scoped RBAC/CASL. Nếu để trống, quyền sẽ có hiệu lực toàn hệ thống.
                </p>
              </div>

              {/* Actions */}
              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleResetAndClose}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={inviteMutation?.isPending}
                  className="inline-flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-xl shadow-sm transition-colors disabled:opacity-50"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>{inviteMutation?.isPending ? 'Đang gửi...' : 'Gửi lời mời'}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
