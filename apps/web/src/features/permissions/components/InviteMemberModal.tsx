'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence, type Transition } from 'framer-motion';
import {
  Mail,
  UserPlus,
  Copy,
  Check,
  X,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { useInviteUser, useGetRoles, useListJournals } from '@structpaper/api-client';
import { ModalPortal } from '@/components/modals/ModalPortal';
import { sileo } from '@/components/toast';
import { Select, type SelectOption } from '@/components/ui/Select';
import { useInvalidateMembers } from '../hooks/useInvalidateMembers';
import {
  apiErrorMessage,
  copyToClipboard,
  formatDateTime,
  FALLBACK_ROLE_NAMES,
  GLOBAL_SCOPE_LABEL,
} from '../utils';

export interface InviteMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInviteSuccess?: (userSummary: any) => void;
}

/** Short description shown under each system role (roles themselves come from the API). */
export const ROLE_DESCRIPTIONS: Record<string, string> = {
  Author: 'Tạo và nộp bản thảo bài báo cá nhân',
  Reviewer: 'Đọc và phản biện bản thảo được phân công',
  Editor: 'Điều phối xuất bản và quản lý bài báo tạp chí',
  JournalManager: 'Toàn quyền cấu hình và điều hành tạp chí',
  SuperAdmin: 'Toàn quyền hệ thống không giới hạn (manage all)',
};

const GLOBAL_JOURNAL_OPTION = { id: '', name: `${GLOBAL_SCOPE_LABEL} - không giới hạn tạp chí` };

const isTest = typeof process !== 'undefined' && process.env.NODE_ENV === 'test';
const springTransition: Transition = isTest
  ? { duration: 0 }
  : { type: 'spring', stiffness: 120, damping: 18, mass: 0.8 };

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
  const [expiresAt, setExpiresAt] = useState<string | null>(null);

  // Our own error banner explains failures, so skip the generic network-error toast.
  const inviteMutation = useInviteUser({ request: { skipGlobalToast: true } });
  const rolesQuery = useGetRoles();
  const journalsQuery = useListJournals();
  const invalidateMembers = useInvalidateMembers();

  const roleNames: string[] =
    (rolesQuery.data ?? []).length > 0
      ? (rolesQuery.data as Array<{ name: string }>).map((r) => r.name)
      : [...FALLBACK_ROLE_NAMES];

  const journalOptions = [
    GLOBAL_JOURNAL_OPTION,
    ...(journalsQuery.data ?? []).map((j: any) => ({
      id: j.id as string,
      name: `${j.shortName || j.code || j.slug} - ${j.name}`,
    })),
  ];

  const handleCopyLink = async () => {
    if (!activationUrl) return;
    const ok = await copyToClipboard(activationUrl);
    setCopied(ok);
    if (ok) {
      sileo.success({ title: 'Đã sao chép link kích hoạt' });
      setTimeout(() => setCopied(false), 2000);
    } else {
      sileo.info({
        title: 'Chưa sao chép được tự động',
        description: 'Hãy bấm vào ô link rồi sao chép thủ công (Ctrl+C).',
      });
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
      const result: any = await inviteMutation.mutateAsync({
        data: {
          email: trimmedEmail,
          role,
          journalId: journalId || null,
          displayName: displayName.trim() || undefined,
        },
      });

      // Never invent a link: show exactly what the server issued, or fail loudly.
      if (!result?.activationUrl) {
        throw new Error('Máy chủ không trả về link kích hoạt.');
      }

      setActivationUrl(result.activationUrl);
      setExpiresAt(result.expiresAt ?? null);
      onInviteSuccess?.(result.user);
      await invalidateMembers();
    } catch (err) {
      setFormError(apiErrorMessage(err, 'Không thể tạo lời mời. Vui lòng thử lại.'));
    }
  };

  const handleResetAndClose = () => {
    setEmail('');
    setDisplayName('');
    setRole('Author');
    setJournalId('');
    setFormError(null);
    setActivationUrl(null);
    setExpiresAt(null);
    setCopied(false);
    onClose();
  };

  const roleSelectOptions: SelectOption<string>[] = roleNames.map((name) => ({
    value: name,
    label: name,
    description: ROLE_DESCRIPTIONS[name],
  }));

  const journalSelectOptions: SelectOption<string>[] = journalOptions.map((j) => ({
    value: j.id,
    label: j.name,
  }));

  return (
    <ModalPortal
      isOpen={isOpen}
      onClose={handleResetAndClose}
      backdropClassName="bg-black/40 backdrop-blur-sm"
      zIndex={10000}
    >
      <motion.div
        data-testid="invite-member-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        initial={isTest ? undefined : { opacity: 0, scale: 0.9, y: 20 }}
        animate={isTest ? undefined : { opacity: 1, scale: 1, y: 0 }}
        exit={
          isTest
            ? undefined
            : {
                opacity: 0,
                scale: 0.9,
                y: 20,
                transition: { duration: 0.22, ease: [0.32, 0, 0.67, 0] },
              }
        }
        transition={springTransition}
        className="max-w-lg w-full bg-[#F8F9FA] rounded-[36px] sm:rounded-[40px] shadow-2xl border border-white/20 overflow-hidden flex flex-col select-text"
      >
        {/* Header - Matching CreatePaperModal */}
        <div className="flex-shrink-0 px-7 sm:px-8 py-5 pb-0 flex items-center justify-between sticky top-0 z-10 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#78C841]/10 border border-[#78C841]/20 flex items-center justify-center text-[#78C841]">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 id="modal-title" className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                Mời thành viên mới
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Tạo link kích hoạt và phân quyền biên tập / phản biện
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleResetAndClose}
            className="w-11 h-11 rounded-full bg-gray-200/70 hover:bg-gray-200 text-gray-500 hover:text-gray-900 flex items-center justify-center transition-all cursor-pointer"
            aria-label="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="flex-1 min-h-0 flex flex-col p-6 sm:p-7 overflow-y-auto">
          {formError && (
            <div
              role="alert"
              data-testid="invite-form-error"
              className="mb-4 p-3.5 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-2.5 text-sm font-semibold text-red-700"
            >
              <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
              <span>{formError}</span>
            </div>
          )}

          <AnimatePresence mode="wait">
            {activationUrl ? (
              <motion.div
                key="invite-success-view"
                initial={isTest ? undefined : { opacity: 0, scale: 0.95 }}
                animate={isTest ? undefined : { opacity: 1, scale: 1 }}
                exit={isTest ? undefined : { opacity: 0, scale: 0.95 }}
                transition={springTransition}
                className="space-y-4"
              >
                {/* Celebration Card */}
                <div className="p-5 bg-lime-500/10 border border-lime-500/20 rounded-3xl flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-2xl bg-lime-500/20 flex items-center justify-center text-lime-600 shrink-0 mt-0.5">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-lime-900 mb-1">
                      Đã tạo lời mời thành công!
                    </h4>
                    <p className="text-xs text-lime-700/90 leading-relaxed">
                      Hệ thống chưa gửi email: hãy gửi link bên dưới cho người được mời. Link dùng được một lần
                      {expiresAt ? `, có hiệu lực đến ${formatDateTime(expiresAt)}` : ''} và chỉ hiển thị ở đây.
                      Nếu làm mất, hãy vào tab &ldquo;Lời mời tham gia&rdquo; để tạo link mới.
                    </p>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="activation-url-input" className="block text-xs font-bold text-slate-600 uppercase tracking-wider pl-1">
                    Link kích hoạt tài khoản
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      id="activation-url-input"
                      type="text"
                      readOnly
                      value={activationUrl}
                      onFocus={(e) => e.currentTarget.select()}
                      className="flex-1 px-4 py-3 text-xs font-mono bg-white border border-zinc-200 rounded-2xl text-zinc-800 select-all outline-none focus:ring-2 focus:ring-lime-300 focus:border-[#78C841] transition-all"
                    />
                    <button
                      type="button"
                      onClick={handleCopyLink}
                      className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-[#78C841] hover:bg-[#68B436] text-white text-xs font-bold rounded-2xl shadow-sm transition-all cursor-pointer shrink-0"
                    >
                      {copied ? (
                        <>
                          <Check className="w-4 h-4" />
                          <span>Đã sao chép!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4" />
                          <span>Sao chép link</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <div className="pt-3 flex justify-end border-t border-slate-200/60">
                  <button
                    type="button"
                    onClick={handleResetAndClose}
                    className="px-6 py-3 bg-[#1A1A1A] hover:bg-black text-white text-sm font-bold rounded-2xl shadow-sm transition-all cursor-pointer"
                  >
                    Hoàn tất
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.form
                key="invite-form-view"
                initial={isTest ? undefined : { opacity: 0, scale: 0.98 }}
                animate={isTest ? undefined : { opacity: 1, scale: 1 }}
                exit={isTest ? undefined : { opacity: 0, scale: 0.98 }}
                transition={springTransition}
                onSubmit={handleSubmit}
                className="space-y-4"
              >
                {/* Email */}
                <div className="space-y-1.5">
                  <label htmlFor="invite-email" className="block text-xs font-bold text-slate-600 uppercase tracking-wider pl-1">
                    Email học thuật / Định danh <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-3.5 w-4 h-4 text-slate-400 pointer-events-none" />
                    <input
                      id="invite-email"
                      type="email"
                      placeholder="nghiencuu@vnuhcm.edu.vn"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="w-full rounded-2xl bg-white border border-zinc-200 pl-11 pr-4 py-3 text-sm font-semibold text-zinc-900 outline-none focus:ring-2 focus:ring-lime-300 focus:border-[#78C841] transition-all"
                    />
                  </div>
                </div>

                {/* Display Name */}
                <div className="space-y-1.5">
                  <label htmlFor="invite-name" className="block text-xs font-bold text-slate-600 uppercase tracking-wider pl-1">
                    Họ và tên (Tùy chọn)
                  </label>
                  <input
                    id="invite-name"
                    type="text"
                    placeholder="TS. Nguyễn Văn A"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full rounded-2xl bg-white border border-zinc-200 px-4 py-3 text-sm font-semibold text-zinc-900 outline-none focus:ring-2 focus:ring-lime-300 focus:border-[#78C841] transition-all"
                  />
                </div>

                {/* Role Selection */}
                <div className="space-y-1.5">
                  <label htmlFor="invite-role" className="block text-xs font-bold text-slate-600 uppercase tracking-wider pl-1">
                    Vai trò / Phân quyền <span className="text-red-500">*</span>
                  </label>
                  <Select
                    options={roleSelectOptions}
                    value={role}
                    onChange={(val) => setRole(val)}
                    size="lg"
                    variant="clean"
                    fullWidth
                  />
                  {/* Hidden select for accessibility & form testing */}
                  <select
                    id="invite-role"
                    aria-label="Vai trò / Role"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="sr-only"
                    aria-hidden="true"
                    tabIndex={-1}
                  >
                    {roleNames.map((name) => (
                      <option key={name} value={name}>
                        {name}
                        {ROLE_DESCRIPTIONS[name] ? ` - ${ROLE_DESCRIPTIONS[name]}` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Scoped Journal (optional) */}
                <div className="space-y-1.5">
                  <label htmlFor="invite-journal" className="block text-xs font-bold text-slate-600 uppercase tracking-wider pl-1">
                    Phạm vi Tạp chí (Scoped Journal - Tùy chọn)
                  </label>
                  <Select
                    options={journalSelectOptions}
                    value={journalId}
                    onChange={(val) => setJournalId(val)}
                    size="lg"
                    variant="clean"
                    fullWidth
                  />
                  {/* Hidden select for accessibility & form testing */}
                  <select
                    id="invite-journal"
                    value={journalId}
                    onChange={(e) => setJournalId(e.target.value)}
                    className="sr-only"
                    aria-hidden="true"
                    tabIndex={-1}
                  >
                    {journalOptions.map((j) => (
                      <option key={j.id} value={j.id}>
                        {j.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-slate-500 pl-1">
                    Áp dụng phạm vi phân quyền Scoped RBAC/CASL. Nếu để trống, quyền sẽ có hiệu lực toàn hệ thống.
                  </p>
                </div>

                {/* Actions */}
                <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-200/60">
                  <button
                    type="button"
                    onClick={handleResetAndClose}
                    className="px-5 py-3 rounded-2xl text-sm font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 transition-all cursor-pointer"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={inviteMutation?.isPending}
                    className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-[#78C841] hover:bg-[#68B436] text-white text-sm font-bold rounded-2xl shadow-sm transition-all cursor-pointer disabled:opacity-50"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>{inviteMutation?.isPending ? 'Đang tạo...' : 'Tạo lời mời'}</span>
                  </button>
                </div>
              </motion.form>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </ModalPortal>
  );
};
