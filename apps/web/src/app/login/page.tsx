'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  ShieldCheck,
  Mail,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  BookOpen,
  FileText,
  UserCheck,
} from 'lucide-react';
import { http, setAccessToken, isMockModeEnabled, setMockMode } from '@structpaper/api-client';
import { useAuthStore } from '@/lib/auth-store';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get('redirect') || '/papers';

  const { setLogin, isAuthenticated } = useAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSessionExpired, setIsSessionExpired] = useState(false);
  const [mockActive, setMockActive] = useState(false);

  useEffect(() => {
    // Check if redirected due to expired session (eatzy_frontend pattern)
    if (typeof window !== 'undefined') {
      const expired = window.localStorage.getItem('auth_expired');
      if (expired === 'true') {
        setIsSessionExpired(true);
      }
      setMockActive(isMockModeEnabled());
    }
  }, []);

  const handleQuickFillAdmin = () => {
    setEmail('admin@structpaper.org');
    setPassword('AdminPassword123!');
    setErrorMessage(null);
  };

  const handleQuickFillAuthor = () => {
    setEmail('author@structpaper.org');
    setPassword('Author123!@#');
    setErrorMessage(null);
  };

  const handleToggleMock = () => {
    const nextVal = !mockActive;
    setMockMode(nextVal);
    setMockActive(nextVal);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!email.trim() || !password) {
      setErrorMessage('Vui lòng nhập đầy đủ email và mật khẩu.');
      return;
    }

    setIsLoading(true);
    try {
      const res: any = await http.post('/api/v1/auth/login', {
        email: email.trim().toLowerCase(),
        password,
      });

      const token = res?.accessToken || res?.access_token || res?.data?.accessToken;
      const user = res?.user || res?.data?.user;

      if (!token || !user) {
        throw new Error('Dữ liệu phản hồi xác thực không hợp lệ');
      }

      // Store in memory and auth state
      setLogin(token, user);

      // Clean session expired warning
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem('auth_expired');
      }

      router.push(redirectUrl);
    } catch (err: any) {
      const detail =
        err?.detail ||
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        err?.message ||
        'Đăng nhập thất bại. Vui lòng kiểm tra lại thông tin tài khoản.';
      setErrorMessage(detail);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col justify-center items-center p-4 sm:p-8 bg-gradient-to-br from-[#F8F9FA] via-[#F1F5F9] to-[#E2E8F0]">
      {/* Container Card */}
      <div className="w-full max-w-md sm:max-w-lg bg-white/90 backdrop-blur-2xl border border-white/80 rounded-3xl p-6 sm:p-10 shadow-[0_20px_50px_rgba(0,0,0,0.06)] space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#78C841] to-emerald-600 text-white shadow-lg shadow-[#78C841]/25 mb-1">
            <BookOpen className="w-7 h-7" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-zinc-950 tracking-tight">
            StructPaper
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 font-medium">
            Hệ thống Quản lý & Xuất bản Bản thảo Chuẩn ĐHQG-HCM
          </p>
        </div>

        {/* Session Expired Banner (matching eatzy_frontend) */}
        {isSessionExpired && (
          <div className="p-4 bg-amber-50 border border-amber-200/80 rounded-2xl flex items-start gap-3 text-amber-800 text-xs sm:text-sm">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block text-amber-900">Phiên làm việc đã hết hạn</span>
              <p className="mt-0.5 text-amber-700">
                Phiên đăng nhập trước của bạn đã kết thúc. Vui lòng đăng nhập lại để tiếp tục bảo mật phiên làm việc.
              </p>
            </div>
          </div>
        )}

        {/* Error Alert */}
        {errorMessage && (
          <div className="p-4 bg-rose-50 border border-rose-200/80 rounded-2xl flex items-start gap-3 text-rose-800 text-xs sm:text-sm">
            <div className="w-6 h-6 rounded-full bg-rose-100 flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-rose-600 font-bold text-xs">!</span>
            </div>
            <div className="flex-1">
              <span className="font-bold block text-rose-900 uppercase tracking-wider text-[11px]">
                Xác thực không thành công
              </span>
              <p className="mt-0.5 text-rose-700 font-medium">{errorMessage}</p>
            </div>
          </div>
        )}

        {/* Quick Credentials Helper (Dev Convenience) */}
        <div className="bg-zinc-50/80 border border-zinc-200/70 rounded-2xl p-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-zinc-600 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              Điền tài khoản nhanh (Mẫu):
            </span>
            <span className="text-[10px] text-zinc-400 font-mono">Dev / Staging</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleQuickFillAdmin}
              className="py-1.5 px-2.5 bg-white hover:bg-zinc-100 border border-zinc-200 rounded-xl text-xs font-semibold text-zinc-800 flex items-center justify-center gap-1.5 shadow-2xs transition-all active:scale-[0.98] cursor-pointer"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Admin (Toàn quyền)</span>
            </button>
            <button
              type="button"
              onClick={handleQuickFillAuthor}
              className="py-1.5 px-2.5 bg-white hover:bg-zinc-100 border border-zinc-200 rounded-xl text-xs font-semibold text-zinc-800 flex items-center justify-center gap-1.5 shadow-2xs transition-all active:scale-[0.98] cursor-pointer"
            >
              <UserCheck className="w-3.5 h-3.5 text-blue-600" />
              <span>Tác giả (Author)</span>
            </button>
          </div>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email field */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-zinc-700 block">
              Địa chỉ Email
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-400">
                <Mail className="w-4 h-4" />
              </div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@structpaper.org"
                required
                className="w-full pl-10 pr-4 py-2.5 bg-zinc-50/70 border border-zinc-200 rounded-2xl text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#78C841] focus:bg-white transition-all font-medium"
              />
            </div>
          </div>

          {/* Password field */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-zinc-700 block">
                Mật khẩu
              </label>
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-400">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                required
                className="w-full pl-10 pr-11 py-2.5 bg-zinc-50/70 border border-zinc-200 rounded-2xl text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#78C841] focus:bg-white transition-all font-medium"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-zinc-400 hover:text-zinc-600 cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Remember me & offline mode indicator */}
          <div className="flex items-center justify-between pt-1 text-xs">
            <label className="flex items-center gap-2 cursor-pointer select-none text-zinc-600 font-medium">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="rounded border-zinc-300 text-[#78C841] focus:ring-[#78C841]"
              />
              <span>Ghi nhớ đăng nhập</span>
            </label>

            <button
              type="button"
              onClick={handleToggleMock}
              className={`text-[11px] font-semibold px-2 py-0.5 rounded-lg border transition-all cursor-pointer ${
                mockActive
                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                  : 'bg-emerald-50 text-emerald-700 border-emerald-200'
              }`}
            >
              {mockActive ? '🟡 Mock Offline Mode' : '🟢 Live Cloud API'}
            </button>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 px-4 bg-gradient-to-r from-[#78C841] to-emerald-600 hover:from-[#6db738] hover:to-emerald-700 text-white font-extrabold text-sm rounded-2xl shadow-lg shadow-[#78C841]/25 hover:shadow-[#78C841]/35 active:scale-[0.99] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer mt-2"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Đang xác thực thông tin...</span>
              </>
            ) : (
              <>
                <span>Đăng nhập hệ thống</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Footer info */}
        <div className="pt-2 text-center border-t border-zinc-100">
          <p className="text-[11px] text-zinc-400 font-medium">
            Phiên bản StructPaper v2.0 &bull; Chuẩn xuất bản VNUHCM
          </p>
        </div>
      </div>
    </div>
  );
}
