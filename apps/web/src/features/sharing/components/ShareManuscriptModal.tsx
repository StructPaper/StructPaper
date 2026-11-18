'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence, type Transition } from 'framer-motion';
import { X, Search, UserPlus, Globe2, Lock, AlertCircle, Loader2, Crown, Link2, Check } from 'lucide-react';
import type { GeneralAccess, ManuscriptMemberDetail } from '@structpaper/api-client';
import { ModalPortal } from '@/components/modals/ModalPortal';
import { sileo } from '@/components/toast';
import { Select, type SelectOption } from '@/components/ui/Select';
import { Shimmer } from '@/components/ui/Shimmer';
import { useManuscriptSharing, usePeopleSearch } from '../hooks/useManuscriptSharing';
import { useCopyManuscriptLink } from '../hooks/useCopyManuscriptLink';
import { GENERAL_ACCESS_OPTIONS, SHARE_ROLE_OPTIONS, type ShareRole } from '../labels';

export interface ShareManuscriptModalProps {
  isOpen: boolean;
  onClose: () => void;
  manuscriptId: string;
  /** Shown under the heading so people know which paper they are sharing. */
  manuscriptTitle?: string;
}

const isTest = typeof process !== 'undefined' && process.env.NODE_ENV === 'test';
const spring: Transition = isTest ? { duration: 0 } : { type: 'spring', stiffness: 120, damping: 18, mass: 0.8 };
const listTransition: Transition = isTest ? { duration: 0 } : { duration: 0.22, ease: 'easeOut' };

const roleSelectOptions: SelectOption<ShareRole>[] = SHARE_ROLE_OPTIONS.map((r) => ({
  value: r.value,
  label: r.label,
  description: r.description,
}));

const generalSelectOptions: SelectOption<GeneralAccess>[] = GENERAL_ACCESS_OPTIONS.map((o) => ({
  value: o.value,
  label: o.label,
  description: o.description,
}));

const initials = (name?: string | null, email?: string | null) =>
  (name || email || '?').trim().slice(0, 1).toUpperCase();

function Avatar({ name, email, owner }: { name?: string | null; email?: string | null; owner?: boolean }) {
  return (
    <span
      className={`w-9 h-9 rounded-full shrink-0 flex items-center justify-center text-xs font-black ${
        owner ? 'bg-amber-100 text-amber-700' : 'bg-lime-100 text-lime-800'
      }`}
    >
      {owner ? <Crown className="w-4 h-4" /> : initials(name, email)}
    </span>
  );
}

/**
 * Google-Docs style sharing for one manuscript: add people by email with a role,
 * change or remove their access, and choose what everybody else in the system may do.
 * The dialog body (and so its queries) only exists while the modal is open.
 */
export const ShareManuscriptModal: React.FC<ShareManuscriptModalProps> = (props) => (
  <ModalPortal isOpen={props.isOpen} onClose={props.onClose} backdropClassName="bg-black/40 backdrop-blur-sm" zIndex={10000}>
    <ShareDialog {...props} />
  </ModalPortal>
);

const ShareDialog: React.FC<ShareManuscriptModalProps> = ({
  isOpen,
  onClose,
  manuscriptId,
  manuscriptTitle,
}) => {
  const [search, setSearch] = useState('');
  const [newRole, setNewRole] = useState<ShareRole>('COAUTHOR');
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const sharing = useManuscriptSharing(manuscriptId, isOpen);
  const { results, isSearching } = usePeopleSearch(search);
  const { copy: copyLink, copied } = useCopyManuscriptLink(manuscriptId);

  const memberIds = new Set(sharing.members.map((m) => m.userId));
  const candidates = results.filter((p) => !memberIds.has(p.id));
  const showResults = search.trim().length >= 2;

  const run = async (key: string, action: () => Promise<void>, success?: string) => {
    setError(null);
    setPendingId(key);
    try {
      await action();
      if (success) sileo.success({ title: success });
    } catch (err) {
      setError(sharing.errorMessage(err));
    } finally {
      setPendingId(null);
    }
  };

  const handleClose = () => {
    setSearch('');
    setError(null);
    onClose();
  };

  const owner = sharing.members.find((m) => m.role === 'OWNER');
  const others = sharing.members.filter((m) => m.role !== 'OWNER');

  const renderMember = (m: ManuscriptMemberDetail) => (
    <motion.li
      key={m.userId}
      layout={!isTest}
      initial={isTest ? false : { opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={isTest ? undefined : { opacity: 0, x: 16 }}
      transition={listTransition}
      data-testid={`share-member-${m.userId}`}
      className="flex items-center gap-3 py-2"
    >
      <Avatar name={m.displayName} email={m.email} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-slate-900 truncate">{m.displayName || m.email}</p>
        {m.displayName && <p className="text-xs text-slate-500 truncate">{m.email}</p>}
      </div>
      <div className="w-40 shrink-0">
        <Select
          options={roleSelectOptions}
          value={m.role as ShareRole}
          onChange={(role) => run(m.userId, () => sharing.addOrChangeRole(m.userId, role))}
          size="sm"
          variant="clean"
          fullWidth
          disabled={pendingId === m.userId}
        />
      </div>
      <button
        type="button"
        aria-label={`Gỡ quyền của ${m.displayName || m.email}`}
        data-testid={`share-remove-${m.userId}`}
        disabled={pendingId === m.userId}
        onClick={() => run(m.userId, () => sharing.removeMember(m.userId), 'Đã gỡ quyền truy cập')}
        className="w-8 h-8 rounded-full text-slate-400 hover:text-red-600 hover:bg-red-50 flex items-center justify-center transition-colors cursor-pointer disabled:opacity-40"
      >
        {pendingId === m.userId ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
      </button>
    </motion.li>
  );

  return (
    <>
      <motion.div
        data-testid="share-manuscript-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-modal-title"
        initial={isTest ? undefined : { opacity: 0, scale: 0.9, y: 20 }}
        animate={isTest ? undefined : { opacity: 1, scale: 1, y: 0 }}
        exit={isTest ? undefined : { opacity: 0, scale: 0.9, y: 20, transition: { duration: 0.22, ease: [0.32, 0, 0.67, 0] } }}
        transition={spring}
        className="max-w-xl w-full bg-[#F8F9FA] rounded-[36px] sm:rounded-[40px] shadow-2xl border border-white/20 overflow-hidden flex flex-col select-text"
      >
        <div className="flex-shrink-0 px-7 sm:px-8 py-5 pb-0 flex items-center justify-between">
          <div className="min-w-0 ml-2">
            <h3 id="share-modal-title" className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
              Chia sẻ bản thảo
            </h3>
            {manuscriptTitle && <p className="text-xs text-slate-500 truncate max-w-[22rem]">{manuscriptTitle}</p>}
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Đóng"
            className="w-11 h-11 rounded-full bg-gray-200/70 hover:bg-gray-200 text-gray-500 hover:text-gray-900 flex items-center justify-center transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 sm:p-7 space-y-5 overflow-y-auto max-h-[70vh]">
          <AnimatePresence initial={false}>
            {error && (
              <motion.div
                key="share-error"
                role="alert"
                data-testid="share-error"
                initial={isTest ? false : { opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={isTest ? undefined : { opacity: 0, height: 0 }}
                transition={listTransition}
                className="overflow-hidden"
              >
                <div className="p-3.5 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-2.5 text-sm font-semibold text-red-700">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                  <span>{error}</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Add people */}
          <section className="space-y-2">
            <label htmlFor="share-search" className="block text-sm font-bold text-slate-600 pl-1">
              Thêm người bằng email
            </label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-3.5 w-4 h-4 text-slate-400 pointer-events-none" />
                <input
                  id="share-search"
                  type="text"
                  inputMode="email"
                  autoComplete="off"
                  placeholder="nhập email thành viên…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-2xl bg-white border border-zinc-200 pl-11 pr-4 py-3 text-sm font-semibold text-zinc-900 outline-none focus:ring-2 focus:ring-lime-300 focus:border-[#78C841] transition-all"
                />
              </div>
              <div className="w-40 shrink-0">
                <Select options={roleSelectOptions} value={newRole} onChange={setNewRole} size="lg" variant="clean" fullWidth />
              </div>
            </div>

            <AnimatePresence initial={false}>
              {showResults && (
                <motion.ul
                  key="share-results"
                  data-testid="share-results"
                  initial={isTest ? false : { opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={isTest ? undefined : { opacity: 0, height: 0 }}
                  transition={listTransition}
                  className="overflow-hidden bg-white border border-zinc-200 rounded-2xl divide-y divide-zinc-100"
                >
                  {candidates.map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        data-testid={`share-candidate-${p.id}`}
                        disabled={pendingId === p.id}
                        onClick={() =>
                          run(
                            p.id,
                            async () => {
                              await sharing.addOrChangeRole(p.id, newRole);
                              setSearch('');
                            },
                            'Đã thêm người vào bản thảo',
                          )
                        }
                        className="w-full px-3.5 py-2.5 flex items-center gap-3 text-left hover:bg-lime-50 transition-colors cursor-pointer disabled:opacity-50"
                      >
                        <Avatar name={p.displayName} email={p.email} />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-bold text-slate-900 truncate">{p.displayName || p.email}</span>
                          {p.displayName && <span className="block text-xs text-slate-500 truncate">{p.email}</span>}
                        </span>
                        {pendingId === p.id ? (
                          <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                        ) : (
                          <UserPlus className="w-4 h-4 text-[#78C841]" />
                        )}
                      </button>
                    </li>
                  ))}
                  {candidates.length === 0 && (
                    <li className="px-4 py-3 text-xs font-semibold text-slate-500 flex items-center gap-2">
                      {isSearching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                      {isSearching ? 'Đang tìm…' : 'Không tìm thấy thành viên phù hợp (hoặc đã có quyền truy cập).'}
                    </li>
                  )}
                </motion.ul>
              )}
            </AnimatePresence>
          </section>

          {/* People with access */}
          <section className="space-y-1">
            <h4 className="text-sm font-bold text-slate-600 pl-1">Những người có quyền truy cập</h4>
            {sharing.isLoading ? (
              <div data-testid="share-loading" className="space-y-2 pt-1">
                <Shimmer className="h-10 w-full rounded-2xl" />
                <Shimmer className="h-10 w-full rounded-2xl" />
              </div>
            ) : sharing.isError ? (
              <p className="text-xs font-semibold text-red-600 pl-1">
                Không tải được danh sách.{' '}
                <button type="button" onClick={() => sharing.reload()} className="underline cursor-pointer">
                  Thử lại
                </button>
              </p>
            ) : (
              <ul className="divide-y divide-slate-200/60">
                {owner && (
                  <li data-testid="share-owner" className="flex items-center gap-3 py-2">
                    <Avatar name={owner.displayName} email={owner.email} owner />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-slate-900 truncate">{owner.displayName || owner.email}</p>
                      {owner.displayName && <p className="text-xs text-slate-500 truncate">{owner.email}</p>}
                    </div>
                    <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-800 text-[11px] font-extrabold">
                      Chủ sở hữu
                    </span>
                    <span className="w-8 shrink-0" />
                  </li>
                )}
                <AnimatePresence initial={false}>{others.map(renderMember)}</AnimatePresence>
              </ul>
            )}
          </section>

          {/* General access */}
          <section className="space-y-2 pt-4 border-t border-slate-200/60">
            <h4 className="text-sm font-bold text-slate-600 pl-1">Quyền truy cập chung</h4>
            <div className="flex items-center gap-3">
              <span
                className={`w-9 h-9 rounded-full shrink-0 flex items-center justify-center transition-colors ${
                  sharing.generalAccess === 'RESTRICTED' ? 'bg-slate-200 text-slate-600' : 'bg-lime-100 text-lime-700'
                }`}
              >
                {sharing.generalAccess === 'RESTRICTED' ? <Lock className="w-4 h-4" /> : <Globe2 className="w-4 h-4" />}
              </span>
              <div className="flex-1 min-w-0">
                <Select
                  options={generalSelectOptions}
                  value={sharing.generalAccess}
                  onChange={(value) => run('general', () => sharing.changeGeneralAccess(value), 'Đã cập nhật quyền truy cập chung')}
                  size="lg"
                  variant="clean"
                  fullWidth
                  disabled={pendingId === 'general' || sharing.isLoading}
                />
              </div>
            </div>
          </section>

          <div className="pt-4 flex items-center justify-between gap-3 border-t border-slate-200/60">
            <button
              type="button"
              data-testid="share-copy-link"
              onClick={copyLink}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-white border border-zinc-200 hover:border-[#78C841] hover:bg-lime-50 text-sm font-bold text-slate-700 transition-all cursor-pointer"
            >
              {copied ? <Check className="w-4 h-4 text-lime-600" /> : <Link2 className="w-4 h-4" />}
              <span>{copied ? 'Đã sao chép' : 'Sao chép liên kết'}</span>
            </button>
            <button
              type="button"
              onClick={handleClose}
              className="px-6 py-3 bg-[#1A1A1A] hover:bg-black text-white text-sm font-bold rounded-2xl shadow-sm transition-all cursor-pointer"
            >
              Xong
            </button>
          </div>
        </div>
      </motion.div>
    </>
  );
};
