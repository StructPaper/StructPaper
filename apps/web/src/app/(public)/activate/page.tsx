'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ShieldCheck,
  KeyRound,
  Eye,
  EyeOff,
  AlertCircle,
  ChevronRight,
  CheckCircle2,
  Lock,
} from 'lucide-react';
import { http } from '@structpaper/api-client';
import { sileo } from '@/components/toast';
import {
  AuthBrand,
  AuthHeading,
  AuthField,
  authPrimaryButton,
  authLinkClass,
} from '@/components/auth/AuthFields';

function ActivateForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tokenParam = searchParams.get('token') || '';

  const [token, setToken] = useState(tokenParam);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    // New links carry the token in the URL fragment (#token=...), which is never sent to a server,
    // proxy or access log. Old links used ?token=..., still accepted.
    const hashToken =
      typeof window !== 'undefined'
        ? new URLSearchParams(window.location.hash.replace(/^#/, '')).get('token')
        : null;
    const found = hashToken || tokenParam;
    if (found) {
      setToken(found);
      // Remove the secret from the address bar and browser history once it is in memory.
      try {
        window.history.replaceState(null, '', window.location.pathname);
      } catch {
        // history API unavailable: harmless
      }
    }
  }, [tokenParam]);

  const isPasswordLongEnough = password.length >= 8;
  const isPasswordMatching = password.length > 0 && password === confirmPassword;
  const canSubmit = token.trim().length > 0 && isPasswordLongEnough && isPasswordMatching && !isLoading;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!token.trim()) {
      setErrorMessage('Vui lòng cung cấp mã token kích hoạt.');
      return;
    }

    if (password.length < 8) {
      setErrorMessage('Mật khẩu phải có độ dài tối thiểu 8 ký tự.');
      return;
    }

    if (password.length > 128) {
      setErrorMessage('Mật khẩu quá dài (tối đa 128 ký tự).');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Mật khẩu xác nhận không khớp. Vui lòng kiểm tra lại.');
      return;
    }

    setIsLoading(true);
    try {
      // This page explains failures itself: skip the generic network-error toast.
      await http.post(
        '/api/v1/auth/activate',
        {
          token: token.trim(),
          password,
        },
        { skipGlobalToast: true },
      );

      setIsSuccess(true);
      sileo.success({
        title: 'Kích hoạt tài khoản thành công!',
        description: 'Mật khẩu đã được thiết lập. Đang chuyển hướng về trang đăng nhập...',
        duration: 4000,
      });

      setTimeout(() => {
        router.push('/login');
      }, 2000);
    } catch (err: any) {
      const rawDetail: string =
        err?.detail ||
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        err?.message ||
        '';
      // The backend deliberately answers with one generic message for a missing, expired or
      // already used token. Explain it in plain language.
      const detail = /activation token/i.test(rawDetail)
        ? 'Liên kết kích hoạt không hợp lệ, đã hết hạn hoặc đã được sử dụng. Hãy liên hệ quản trị viên để nhận liên kết mới.'
        : rawDetail || 'Kích hoạt tài khoản thất bại. Vui lòng thử lại.';
      setErrorMessage(detail);
      sileo.error({
        title: 'Kích hoạt không thành công',
        description: detail,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full">
      <AuthBrand />
      <AuthHeading
        title="Kích hoạt tài khoản"
      />

      {isSuccess ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="space-y-4 rounded-[32px] border border-[#78C841]/40 bg-white p-8 text-center shadow-sm"
        >
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-[#78C841]/40 bg-[#78C841]/15 text-[#2F7D32]">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-[#1A1A1A]">Thiết lập hoàn tất!</h2>
            <p className="mt-1 text-xs leading-relaxed text-[#1A1A1A]/60">
              Tài khoản của bạn đã chuyển sang trạng thái <strong>ACTIVE</strong>. Bạn có thể sử dụng mật khẩu vừa đặt để đăng nhập ngay bây giờ.
            </p>
          </div>
          <Link href="/login" className={authPrimaryButton}>
            <span>Đến trang Đăng nhập</span>
            <ChevronRight className="h-4 w-4" />
          </Link>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="space-y-4"
        >
          {errorMessage && (
            <div
              role="alert"
              className="flex items-start gap-3 rounded-3xl border border-red-100 bg-red-50 p-4 text-xs text-red-600"
            >
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
              <div className="flex-1">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-red-400">Lỗi kích hoạt</span>
                <p className="mt-0.5 font-bold leading-tight text-red-600">{errorMessage}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <AuthField
              label="Mã Token Lời Mời"
              icon={<KeyRound className="h-4 w-4" />}
              type="text"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="tok_invitation_..."
              required
              className="font-mono text-xs"
            />

            <AuthField
              label="Mật khẩu mới"
              icon={<Lock className="h-4 w-4" />}
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Tối thiểu 8 ký tự..."
              required
              trailing={
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-[#1A1A1A]/40 hover:text-[#1A1A1A]"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              }
            />

            <AuthField
              label="Xác nhận mật khẩu"
              icon={<ShieldCheck className="h-4 w-4" />}
              type={showConfirmPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Nhập lại mật khẩu..."
              required
              trailing={
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-[#1A1A1A]/40 hover:text-[#1A1A1A]"
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              }
            />

            {/* Password Validation Hints */}
            <div className="space-y-1 rounded-3xl border border-[#1A1A1A]/10 bg-white/70 p-4 text-[11px]">
              <div className={`flex items-center gap-1.5 font-medium ${isPasswordLongEnough ? 'text-[#2F7D32]' : 'text-[#1A1A1A]/40'}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${isPasswordLongEnough ? 'bg-[#78C841]' : 'bg-zinc-300'}`} />
                <span>Độ dài từ 8 ký tự trở lên (chuẩn Argon2id)</span>
              </div>
              <div className={`flex items-center gap-1.5 font-medium ${isPasswordMatching ? 'text-[#2F7D32]' : 'text-[#1A1A1A]/40'}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${isPasswordMatching ? 'bg-[#78C841]' : 'bg-zinc-300'}`} />
                <span>Hai mật khẩu đã khớp</span>
              </div>
            </div>

            <button type="submit" disabled={!canSubmit} className={authPrimaryButton}>
              {isLoading ? (
                <span className="flex items-center gap-3">
                  <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  <span>Đang kích hoạt tài khoản...</span>
                </span>
              ) : (
                <>
                  <span>Hoàn tất kích hoạt</span>
                  <ChevronRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          <p className="pt-2 text-center text-xs text-[#1A1A1A]/60">
            Đã có tài khoản?{' '}
            <Link href="/login" className={authLinkClass}>
              Quay lại Đăng nhập
            </Link>
          </p>
        </motion.div>
      )}
    </div>
  );
}

export default function ActivatePage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center gap-2 py-20 text-xs font-semibold text-[#1A1A1A]/50">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#1A1A1A]/20 border-t-[#1A1A1A]" />
          <span>Đang tải thông tin kích hoạt...</span>
        </div>
      }
    >
      <ActivateForm />
    </Suspense>
  );
}
