'use client';

import React, { useEffect, useState } from 'react';
import { Layers, KeyRound, Loader2, ShieldAlert, Eye, EyeOff } from 'lucide-react';
import { ActionConfirmModal, ModalCard } from '@/components/modals';
import { toast } from '@/components/toast';
import { useApplyProfileToPapers } from '../hooks/useJournalVersionTools';

interface ApplyToAllPapersFlowProps {
  isOpen: boolean;
  onClose: () => void;
  journalKey: string;
  /** The version being applied (the one in force). */
  version?: number;
}

type Step = 'warn' | 'final' | 'password';

const isWrongPassword = (err: Error): boolean => (err as { status?: number }).status === 403 && /password/i.test(err.message);

/**
 * Moving every paper of a journal to the rules in force cannot be undone, so it takes three deliberate steps, like signing
 * out of everywhere: a warning, a second and plainer one, then the account password.
 */
export const ApplyToAllPapersFlow: React.FC<ApplyToAllPapersFlowProps> = ({ isOpen, onClose, journalKey, version }) => {
  const [step, setStep] = useState<Step>('warn');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [wrong, setWrong] = useState(false);
  const apply = useApplyProfileToPapers(journalKey);

  useEffect(() => {
    if (isOpen) return;
    setStep('warn');
    setPassword('');
    setShow(false);
    setWrong(false);
    apply.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const submit = () => {
    if (!password || apply.isPending) return;
    setWrong(false);
    apply.mutate(password, {
      onSuccess: (result) => {
        onClose();
        toast.success(
          'Đã áp dụng cho các bài báo',
          result.updated > 0
            ? `${result.updated} bài báo đã chuyển sang quy định phiên bản ${version ?? 'mới nhất'}.${result.unchanged ? ` ${result.unchanged} bài đã ở phiên bản này.` : ''}`
            : 'Tất cả bài báo đã ở quy định mới nhất.',
        );
      },
      onError: (err) => {
        if (isWrongPassword(err)) {
          setWrong(true);
          setPassword('');
        } else {
          toast.error('Không áp dụng được', err.message);
        }
      },
    });
  };

  return (
    <>
      <ActionConfirmModal
        isOpen={isOpen && step === 'warn'}
        onClose={onClose}
        onConfirm={() => setStep('final')}
        variant="warning"
        zIndex={130}
        title="Áp dụng cho các bài báo cũ?"
        description={
          <>
            Các bài báo của tạp chí này đang giữ quy định mà chúng được viết theo. Thao tác này chuyển <b>tất cả</b> sang quy định của
            phiên bản {version ?? 'đang áp dụng'}, nên cách dàn trang của nhiều bài có thể thay đổi.
          </>
        }
        cancelLabel="Hủy bỏ"
        confirmLabel="Tiếp tục"
        confirmIcon={<Layers className="w-4 h-4" />}
        testId="apply-all-warn-modal"
        confirmTestId="apply-all-continue-btn"
      />

      <ActionConfirmModal
        isOpen={isOpen && step === 'final'}
        onClose={onClose}
        onConfirm={() => setStep('password')}
        variant="danger"
        zIndex={130}
        title="Không thể hoàn tác"
        description={
          <>
            Quy định mới sẽ áp dụng cho <b>tất cả bài báo cũ</b> của tạp chí, kể cả bài của người khác. Sau khi áp dụng, bạn
            <b> không thể hoàn tác</b>; từng bài chỉ quay về quy định cũ bằng cách sửa lại thủ công.
          </>
        }
        cancelLabel="Hủy bỏ"
        confirmLabel="Tôi hiểu, tiếp tục"
        confirmIcon={<ShieldAlert className="w-4 h-4" />}
        testId="apply-all-final-modal"
        confirmTestId="apply-all-understand-btn"
      />

      <ModalCard
        isOpen={isOpen && step === 'password'}
        onClose={onClose}
        icon={<KeyRound className="w-5 h-5" />}
        title="Nhập mật khẩu để xác nhận"
        subtitle="Nhập mật khẩu tài khoản của bạn nếu thật sự muốn áp dụng cho tất cả bài báo."
        maxWidthClass="max-w-[460px]"
        zIndex={130}
        testId="apply-all-password-modal"
        footer={
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={apply.isPending}
              className="w-full py-2.5 rounded-full text-xs sm:text-sm font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all cursor-pointer disabled:opacity-50 active:scale-95"
            >
              Hủy bỏ
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={!password || apply.isPending}
              data-testid="apply-all-submit-btn"
              className="w-full py-2.5 rounded-full text-xs sm:text-sm font-bold bg-[#FF3B30] hover:bg-red-600 text-white shadow-lg shadow-red-500/25 transition-all cursor-pointer inline-flex items-center justify-center gap-1.5 disabled:opacity-50 hover:scale-102 active:scale-98"
            >
              {apply.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Layers className="w-4 h-4" />}
              <span>{apply.isPending ? 'Đang áp dụng...' : 'Áp dụng cho tất cả'}</span>
            </button>
          </div>
        }
      >
        <div className="px-0.5 pb-1">
          <div className="relative">
            <input
              autoFocus
              type={show ? 'text' : 'password'}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setWrong(false);
              }}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              placeholder="Mật khẩu"
              autoComplete="current-password"
              data-testid="apply-all-password-input"
              aria-invalid={wrong}
              className={`w-full bg-gray-200/60 rounded-2xl py-3 pl-4 pr-11 text-sm font-semibold text-zinc-900 placeholder:text-zinc-400 outline-none transition-all focus:bg-white focus:ring-2 ${
                wrong ? 'ring-2 ring-rose-400 bg-rose-50' : 'focus:ring-[#78C841]/40'
              }`}
            />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              aria-label={show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-xl flex items-center justify-center text-zinc-500 hover:text-zinc-900 hover:bg-white transition-colors cursor-pointer"
            >
              {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {wrong && (
            <p className="mt-2 text-xs font-bold text-rose-600" role="alert" data-testid="apply-all-wrong-password">
              Mật khẩu không đúng. Hãy thử lại.
            </p>
          )}
        </div>
      </ModalCard>
    </>
  );
};
