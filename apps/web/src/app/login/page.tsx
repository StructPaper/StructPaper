'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldCheck,
  Mail,
  Eye,
  EyeOff,
  AlertCircle,
  BookOpen,
  Key,
  ChevronRight,
} from 'lucide-react';
import { http } from '@structpaper/api-client';
import { useAuthStore } from '@/lib/auth-store';
import { sileo } from '@/components/toast';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get('redirect') || '/papers';

  const { setLogin } = useAuthStore();

  const [isDesktop, setIsDesktop] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSessionExpired, setIsSessionExpired] = useState(false);

  // Viewport tracking (desktop vs mobile customer drawer layout)
  useEffect(() => {
    const checkViewport = () => setIsDesktop(window.innerWidth >= 1024);
    checkViewport();
    window.addEventListener('resize', checkViewport);
    return () => window.removeEventListener('resize', checkViewport);
  }, []);

  // Redirect if already authenticated
  useEffect(() => {
    const { isAuthenticated, token } = useAuthStore.getState();
    if (isAuthenticated && token) {
      if (router.replace) {
        router.replace(redirectUrl);
      } else {
        router.push(redirectUrl);
      }
    }
  }, [redirectUrl, router]);

  // Handle session expiration message from Interceptor (matching eatzy_frontend/apps/customer)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const expired = window.localStorage.getItem('auth_expired');
      if (expired === 'true') {
        setIsSessionExpired(true);
        sileo.error({
          title: 'Phiên đăng nhập đã hết hạn',
          description: 'Vui lòng đăng nhập lại để tiếp tục!',
          duration: 5000,
        });
        window.localStorage.removeItem('auth_expired');
      }
    }
  }, []);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
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
      const refreshToken = res?.refreshToken || res?.refresh_token || res?.data?.refreshToken;
      const user = res?.user || res?.data?.user;

      if (!token || !user) {
        throw new Error('Dữ liệu phản hồi xác thực không hợp lệ');
      }

      // Store in memory and auth state
      setLogin(token, user, refreshToken);

      // Clean session expired warning
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem('auth_expired');
      }

      sileo.success({
        title: 'Đăng nhập thành công!',
        description: 'Đang chuyển hướng về trang bài báo...',
        duration: 3000,
      });

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

  // Shared Form Component used in both Desktop Split and Mobile Drawer
  const renderLoginForm = () => (
    <div className="w-full space-y-4">
      {/* Session Expired Banner (fallback & test assertion) */}
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

      {/* API Error Message Display */}
      {errorMessage && (
        <div className="p-4 bg-red-50 border border-red-100/60 text-red-600 rounded-2xl text-xs sm:text-sm flex items-start gap-3 shadow-xs">
          <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0 mt-0.5">
            <span className="text-red-500 font-black text-xs">!</span>
          </div>
          <div className="flex-1">
            <span className="font-bold text-[10px] uppercase tracking-wider text-red-400">Notice</span>
            <p className="font-bold text-red-600 mt-0.5 leading-tight">{errorMessage}</p>
          </div>
        </div>
      )}

      {/* Form starts directly without dev helpers */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Email Capsule Input */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-zinc-700 block">
            Email hoặc Tên đăng nhập
          </label>
          <div className="relative">
            <div className="absolute left-2 top-2 bottom-2 w-10 rounded-xl bg-zinc-100 flex items-center justify-center text-zinc-400 z-10">
              <Mail className="w-4 h-4" />
            </div>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@structpaper.org"
              required
              className="w-full h-12 bg-zinc-50 border border-zinc-200 focus:border-zinc-300 focus:bg-white rounded-2xl pl-14 pr-4 text-sm font-semibold text-zinc-900 transition-all focus:ring-4 focus:ring-zinc-100 placeholder:text-zinc-400"
            />
          </div>
        </div>

        {/* Password Capsule Input */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-zinc-700 block">
              Mật khẩu
            </label>
            <button
              type="button"
              className="text-[11px] font-bold text-zinc-400 hover:text-zinc-800 transition-colors uppercase tracking-wider"
            >
              Quên mật khẩu?
            </button>
          </div>
          <div className="relative">
            <div className="absolute left-2 top-2 bottom-2 w-10 rounded-xl bg-zinc-100 flex items-center justify-center text-zinc-400 z-10">
              <Key className="w-4 h-4" />
            </div>
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              required
              className="w-full h-12 bg-zinc-50 border border-zinc-200 focus:border-zinc-300 focus:bg-white rounded-2xl pl-14 pr-12 text-sm font-semibold text-zinc-900 transition-all focus:ring-4 focus:ring-zinc-100 placeholder:text-zinc-400"
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

        {/* Remember me */}
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
        </div>

        {/* Submit Button - Sleek modern style matching Eatzy customer */}
        <button
          type="submit"
          disabled={isLoading}
          className={`w-full h-13 rounded-2xl font-bold transition-all duration-300 flex items-center justify-center gap-3 active:scale-[0.98] cursor-pointer ${
            isLoading
              ? 'bg-zinc-100 text-zinc-400 cursor-not-allowed shadow-none'
              : 'bg-[#1A1A1A] hover:bg-black text-white hover:scale-[1.01] hover:shadow-xl hover:shadow-black/10 shadow-[0_15px_30px_rgba(0,0,0,0.1)]'
          }`}
        >
          {isLoading ? (
            <div className="flex items-center gap-3">
              <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              <span className="text-white font-bold text-sm">Đang xác thực thông tin...</span>
            </div>
          ) : (
            <>
              <span className="tracking-tight text-base">Đăng nhập hệ thống</span>
              <ChevronRight className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-1" />
            </>
          )}
        </button>
      </form>
    </div>
  );

  return (
    <div className="h-screen w-full bg-[#fafafa] flex items-center justify-center overflow-hidden selection:bg-[#78C841] selection:text-black">
      {/* MOBILE VIEW (<1024px) - Sliding Drawer UX */}
      {!isDesktop && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end overflow-hidden">
          {/* Subtle Academic Hero Backdrop */}
          <div className="absolute inset-0 z-0 bg-gradient-to-b from-zinc-900 via-zinc-950 to-black">
            <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#78C841_1px,transparent_1px)] [background-size:24px_24px]" />
            <div className="p-8 pt-12 text-white">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#78C841]/20 border border-[#78C841]/30 rounded-full text-[#78C841] text-[11px] font-bold uppercase tracking-widest mb-3">
                <BookOpen className="w-3.5 h-3.5" />
                VNUHCM Scientific Publishing
              </div>
              <h1 className="text-4xl font-black uppercase tracking-tight text-white leading-none">
                Struct<span className="text-[#78C841]">Paper</span>
              </h1>
            </div>
          </div>

          {/* Bottom Drawer */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 180 }}
            className="relative z-10 w-full bg-white rounded-t-[36px] p-6 sm:p-8 flex flex-col shadow-[0_-20px_60px_rgba(0,0,0,0.25)] max-h-[85vh] overflow-y-auto"
          >
            <div className="w-12 h-1.5 bg-zinc-200 rounded-full mx-auto mb-6" />
            <div className="mb-4">
              <h2 className="text-2xl font-black text-zinc-900 uppercase tracking-tight">
                Đăng nhập tài khoản
              </h2>
              <p className="text-xs text-zinc-400 mt-1">
                Hệ thống Quản lý &amp; Xuất bản Bản thảo Chuẩn ĐHQG-HCM
              </p>
            </div>

            {renderLoginForm()}

            <div className="mt-6 pt-4 text-center border-t border-zinc-100">
              <p className="text-[11px] text-zinc-400 font-medium">
                Customer Interface v4.0 &bull; StructPaper © 2026
              </p>
            </div>
          </motion.div>
        </div>
      )}

      {/* DESKTOP VIEW (>=1024px) - Editorial Split Screen (Eatzy Customer Style) */}
      {isDesktop && (
        <motion.div
          layoutId="auth-container"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="flex w-full h-full bg-[#fafafa] flex-row relative"
        >
          {/* Left Column (49% width): Dark Editorial Hero */}
          <div className="flex w-[48%] xl:w-[49%] p-3 h-full z-10 relative">
            <div className="w-full h-full relative rounded-[24px] overflow-hidden bg-zinc-950 border border-white/10 shadow-2xl flex flex-col justify-between p-12 xl:p-16 text-white">
              {/* Background pattern & gradient */}
              <div className="absolute inset-0 bg-gradient-to-t from-black via-zinc-950/80 to-zinc-900/60 z-0" />
              <div className="absolute inset-0 opacity-15 bg-[radial-gradient(#78C841_1.5px,transparent_1.5px)] [background-size:28px_28px] z-0" />

              {/* Top Hero Header */}
              <div className="relative z-10">
                <div className="flex items-center gap-4 mb-10">
                  <div className="px-4 py-1.5 bg-[#78C841] text-zinc-950 font-black text-xs tracking-widest uppercase rounded-full">
                    Issue No. 01
                  </div>
                  <div className="h-px w-20 bg-white/20" />
                  <span className="text-[10px] text-white/50 font-bold uppercase tracking-[0.4em]">
                    VNUHCM Scholarly Publishing
                  </span>
                </div>

                <h1 className="text-[90px] xl:text-[110px] font-black text-white leading-[0.82] tracking-tighter uppercase mb-6 drop-shadow-2xl select-none">
                  <span className="sr-only">StructPaper</span>
                  STRUCT<br />
                  <span className="text-[#78C841] italic">PAPER.</span>
                </h1>
                <p className="text-white/70 text-lg xl:text-xl font-medium max-w-md leading-relaxed italic">
                  &quot;Designing the future of academic publishing, one manuscript at a time.&quot;
                </p>
              </div>

              {/* Bottom Hero Security & Metadata */}
              <div className="relative z-10 flex items-center justify-between border-t border-white/10 pt-10">
                <div className="flex flex-col">
                  <span className="text-[10px] font-black text-[#78C841] uppercase tracking-widest mb-1.5">
                    Security Verified
                  </span>
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-white/90" />
                    <span className="text-sm text-white/90 font-medium tracking-tight">
                      Argon2id &bull; Encrypted Connection
                    </span>
                  </div>
                </div>
                <div
                  className="text-[10px] text-white/40 font-bold uppercase tracking-[0.3em] rotate-180 select-none"
                  style={{ writingMode: 'vertical-rl' }}
                >
                  Est. Twenty Twenty Six
                </div>
              </div>
            </div>
          </div>

          {/* Right Column (51% width): Clean Minimalist Customer Form */}
          <div className="flex-1 flex flex-col h-full bg-[#fafafa] relative overflow-y-auto z-10">
            <div className="flex-1 flex flex-col justify-center px-8 md:px-14 lg:px-20 max-w-2xl mx-auto w-full">
              <div className="mt-8 mb-4">
                <h2 className="text-4xl xl:text-5xl font-black text-zinc-950 uppercase tracking-tighter leading-none mb-3">
                  SIGN IN <span className="text-zinc-300">NOW</span>
                </h2>
                <p className="text-zinc-500 font-medium italic text-sm">
                  Experience the next-generation scientific publishing suite for VNUHCM.
                </p>
              </div>

              <div className="bg-white p-6 sm:p-8 rounded-[32px] shadow-[0_15px_50px_rgba(0,0,0,0.02)] border border-zinc-100 relative group">
                {renderLoginForm()}
              </div>
            </div>

            {/* Footer Decoration matching Eatzy Customer */}
            <div className="mt-auto p-6 sm:p-8 flex items-center justify-between text-[10px] text-zinc-400 font-bold uppercase tracking-[0.25em] select-none">
              <span>Customer Interface v4.0</span>
              <span>StructPaper Publishing Group &copy; 2026</span>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
