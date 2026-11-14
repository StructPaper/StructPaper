'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/auth-store';
import { isMockModeEnabled } from '@structpaper/api-client';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    const handleRedirect = () => {
      const { isAuthenticated, token } = useAuthStore.getState();
      if ((isAuthenticated && token) || isMockModeEnabled()) {
        router.replace('/papers');
      } else {
        router.replace('/login');
      }
    };

    if (useAuthStore.persist.hasHydrated()) {
      handleRedirect();
    } else {
      const unsub = useAuthStore.persist.onFinishHydration(() => {
        handleRedirect();
      });
      return () => unsub();
    }
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8F9FA]">
      <div className="w-6 h-6 border-2 border-[#78C841] border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
