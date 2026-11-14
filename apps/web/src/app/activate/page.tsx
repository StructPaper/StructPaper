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
  BookOpen,
  ChevronRight,
  CheckCircle2,
  Lock,
} from 'lucide-react';
import { http } from '@structpaper/api-client';
import { sileo } from '@/components/toast';

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
    if (tokenParam) {
      setToken(tokenParam);
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

    if (password !== confirmPassword) {
      setErrorMessage('Mật khẩu xác nhận không khớp. Vui lòng kiểm tra lại.');
      return;
    }

    setIsLoading(true);
    try {
      await http.post('/api/v1/auth/activate', {
        token: token.trim(),
        password,
      });

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
      const detail =
        err?.detail ||
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        err?.message ||
        'Kích hoạt tài khoản thất bại. Mã lời mời có thể đã hết hạn hoặc không hợp lệ.';
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
    <div className="w-full max-w-md mx-auto space-y-6">
      {/* Brand Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#78C841]/15 border border-[#78C841]/30 rounded-full text-[#78C841] text-[11px] font-black uppercase tracking-widest">
          <BookOpen className="w-3.5 h-3.5" />
          VNUHCM Scholarly Publishing
        </div>
        <h1 className="text-3xl font-black text-zinc-950 uppercase tracking-tight">
          Kích hoạt <span className="text-[#78C841]">Tài khoản</span>
        </h1>
        <p className="text-xs text-zinc-500 font-medium max-w-sm mx-auto">
          Nhập mật khẩu an toàn để kích hoạt phiên làm việc và bắt đầu xuất bản bản thảo.
        </p>
      </div>

      {/* Success Celebration View */}
      {isSuccess ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white p-8 rounded-[32px] border border-emerald-100 shadow-xl text-center space-y-4"
        >
          <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center mx-auto shadow-sm">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-lg font-black text-zinc-900 uppercase">Thiết lập hoàn tất!</h2>
            <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
              Tài khoản của bạn đã chuyển sang trạng thái <strong>ACTIVE</strong>. Bạn có thể sử dụng mật khẩu vừa đặt để đăng nhập ngay bây giờ.
            </p>
          </div>
          <Link
            href="/login"
            className="inline-flex items-center justify-center gap-2 w-full h-12 rounded-2xl bg-[#1A1A1A] hover:bg-black text-white text-xs font-bold uppercase tracking-wider transition-all"
          >
            <span>Đến trang Đăng nhập</span>
            <ChevronRight className="w-4 h-4" />
          </Link>
        </motion.div>
      ) : (
        /* Form Card */
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="bg-white p-6 sm:p-8 rounded-[32px] border border-zinc-200/80 shadow-[0_15px_50px_rgba(0,0,0,0.03)] space-y-4"
        >
          {/* Error Banner */}
          {errorMessage && (
            <div className="p-4 bg-red-50 border border-red-100 text-red-600 rounded-2xl text-xs flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="font-bold block uppercase tracking-wider text-[10px] text-red-400">Lỗi kích hoạt</span>
                <p className="font-bold text-red-600 mt-0.5 leading-tight">{errorMessage}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Activation Token Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-700 block">
                Mã Token Lời Mời
              </label>
              <div className="relative">
                <div className="absolute left-2 top-2 bottom-2 w-10 rounded-xl bg-zinc-100 flex items-center justify-center text-zinc-400 z-10">
                  <KeyRound className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="tok_invitation_..."
                  required
                  className="w-full h-12 bg-zinc-50 border border-zinc-200 focus:border-zinc-300 focus:bg-white rounded-2xl pl-14 pr-4 text-xs font-mono font-semibold text-zinc-900 transition-all focus:ring-4 focus:ring-zinc-100"
                />
              </div>
            </div>

            {/* New Password Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-700 block">
                Mật khẩu mới
              </label>
              <div className="relative">
                <div className="absolute left-2 top-2 bottom-2 w-10 rounded-xl bg-zinc-100 flex items-center justify-center text-zinc-400 z-10">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Tối thiểu 8 ký tự..."
                  required
                  className="w-full h-12 bg-zinc-50 border border-zinc-200 focus:border-zinc-300 focus:bg-white rounded-2xl pl-14 pr-12 text-sm font-semibold text-zinc-900 transition-all focus:ring-4 focus:ring-zinc-100"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-zinc-400 hover:text-zinc-600 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Confirm Password Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-700 block">
                Xác nhận mật khẩu
              </label>
              <div className="relative">
                <div className="absolute left-2 top-2 bottom-2 w-10 rounded-xl bg-zinc-100 flex items-center justify-center text-zinc-400 z-10">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Nhập lại mật khẩu..."
                  required
                  className="w-full h-12 bg-zinc-50 border border-zinc-200 focus:border-zinc-300 focus:bg-white rounded-2xl pl-14 pr-12 text-sm font-semibold text-zinc-900 transition-all focus:ring-4 focus:ring-zinc-100"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-zinc-400 hover:text-zinc-600 cursor-pointer"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Password Validation Hints */}
            <div className="p-3 bg-zinc-50 rounded-2xl border border-zinc-200/60 text-[11px] space-y-1">
              <div className={`flex items-center gap-1.5 font-medium ${isPasswordLongEnough ? 'text-emerald-700' : 'text-zinc-400'}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${isPasswordLongEnough ? 'bg-emerald-500' : 'bg-zinc-300'}`} />
                <span>Độ dài từ 8 ký tự trở lên (chuẩn Argon2id)</span>
              </div>
              <div className={`flex items-center gap-1.5 font-medium ${isPasswordMatching ? 'text-emerald-700' : 'text-zinc-400'}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${isPasswordMatching ? 'bg-emerald-500' : 'bg-zinc-300'}`} />
                <span>Hai mật khẩu đã khớp</span>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={!canSubmit}
              className={`w-full h-13 rounded-2xl font-bold transition-all duration-300 flex items-center justify-center gap-3 active:scale-[0.98] cursor-pointer ${
                !canSubmit
                  ? 'bg-zinc-100 text-zinc-400 cursor-not-allowed shadow-none'
                  : 'bg-[#1A1A1A] hover:bg-black text-white hover:scale-[1.01] hover:shadow-xl shadow-[0_15px_30px_rgba(0,0,0,0.1)]'
              }`}
            >
              {isLoading ? (
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  <span className="text-white font-bold text-sm">Đang kích hoạt tài khoản...</span>
                </div>
              ) : (
                <>
                  <span className="tracking-tight text-sm uppercase">Hoàn tất kích hoạt</span>
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Back to Login Link */}
          <div className="pt-2 text-center">
            <Link
              href="/login"
              className="text-xs font-bold text-zinc-400 hover:text-zinc-800 transition-colors uppercase tracking-wider"
            >
              Quay lại Đăng nhập
            </Link>
          </div>
        </motion.div>
      )}
    </div>
  );
}

export default function ActivatePage() {
  return (
    <div className="min-h-screen w-full bg-[#fafafa] flex items-center justify-center p-4 selection:bg-[#78C841] selection:text-black">
      <Suspense
        fallback={
          <div className="text-xs font-bold text-zinc-400 flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-zinc-300 border-t-zinc-600 rounded-full animate-spin" />
            <span>Đang tải thông tin kích hoạt...</span>
          </div>
        }
      >
        <ActivateForm />
      </Suspense>
    </div>
  );
}
