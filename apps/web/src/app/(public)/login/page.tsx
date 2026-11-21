'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Mail, Eye, EyeOff, AlertCircle, Key, ChevronRight } from 'lucide-react';
import { http } from '@structpaper/api-client';
import { useAuthStore } from '@/lib/auth-store';
import { sileo } from '@/components/toast';
import {
  AuthBrand,
  AuthHeading,
  AuthField,
  authPrimaryButton,
  authLinkClass,
} from '@/components/auth/AuthFields';

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get('redirect') || '/papers';

  const { setLogin } = useAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSessionExpired, setIsSessionExpired] = useState(false);

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

    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();

    if (!cleanEmail || !cleanPassword) {
      setErrorMessage('Vui lòng nhập đầy đủ email và mật khẩu.');
      return;
    }

    setIsLoading(true);
    try {
      const res: any = await http.post('/api/v1/auth/login', {
        email: cleanEmail,
        password: cleanPassword,
      });

      const token = res?.accessToken || res?.access_token || res?.data?.accessToken;
      const user = res?.user || res?.data?.user;

      if (!token || !user) {
        throw new Error('Dữ liệu phản hồi xác thực không hợp lệ');
      }

      // Store in memory and auth state (matching Eatzy)
      setLogin(token, user);

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

  return (
    <div className="w-full">
      <AuthBrand />
      <AuthHeading
        title="Đăng nhập"
      />

      <div className="space-y-4">
        {/* Session Expired Banner (fallback & test assertion) */}
        {isSessionExpired && (
          <div className="flex items-start gap-3 rounded-3xl border border-amber-200/80 bg-amber-50 p-4 text-xs text-amber-800 sm:text-sm">
            <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600" />
            <div>
              <span className="block font-bold text-amber-900">Phiên làm việc đã hết hạn</span>
              <p className="mt-0.5 text-amber-700">
                Phiên đăng nhập trước của bạn đã kết thúc. Vui lòng đăng nhập lại để tiếp tục bảo mật phiên làm việc.
              </p>
            </div>
          </div>
        )}

        {/* API Error Message Display */}
        {errorMessage && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-3xl border border-red-100 bg-red-50 p-4 text-xs text-red-600 sm:text-sm"
          >
            <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-500" />
            <div className="flex-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-red-400">Notice</span>
              <p className="mt-0.5 font-bold leading-tight text-red-600">{errorMessage}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <AuthField
            label="Email hoặc Tên đăng nhập"
            icon={<Mail className="h-4 w-4" />}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@structpaper.org"
            required
          />

          <AuthField
            label="Mật khẩu"
            icon={<Key className="h-4 w-4" />}
            labelAside={
              <button type="button" className="text-[11px] font-semibold text-[#2F7D32] hover:underline">
                Quên mật khẩu?
              </button>
            }
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••••••"
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

          <div className="flex items-center px-2 pt-1 text-xs">
            <label className="flex cursor-pointer select-none items-center gap-2 font-medium text-[#1A1A1A]/70">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="rounded border-zinc-300 text-[#78C841] focus:ring-[#78C841]"
              />
              <span>Ghi nhớ đăng nhập</span>
            </label>
          </div>

          <button type="submit" disabled={isLoading} className={authPrimaryButton}>
            {isLoading ? (
              <span className="flex items-center gap-3">
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                <span>Đang xác thực thông tin...</span>
              </span>
            ) : (
              <>
                <span>Đăng nhập hệ thống</span>
                <ChevronRight className="h-4 w-4" />
              </>
            )}
          </button>
        </form>

        <p className="pt-2 text-center text-xs text-[#1A1A1A]/60">
          Chưa có tài khoản?{' '}
          <span className={authLinkClass}>Liên hệ quản trị viên để nhận lời mời.</span>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex w-full justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#1A1A1A]/20 border-t-[#1A1A1A]" />
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
