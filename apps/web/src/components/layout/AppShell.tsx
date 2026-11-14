'use client';

import React, { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Sidebar } from '@/components/Sidebar';
import { BottomNav } from '@/components/BottomNav';
import { useAuthStore } from '@/lib/auth-store';
import { useAuth } from '@/features/auth';
import { isMockModeEnabled } from '@structpaper/api-client';

interface AppShellProps {
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({ children }) => {
  const pathname = usePathname();
  const router = useRouter();

  // Automatic session hydration on mount across all pages
  useAuth();

  // The editor, authoring editor, template builder, and journal template editor are secondary/focused steps, so the main sidebar is hidden
  const isEditorPage =
    pathname === '/editor' ||
    pathname.startsWith('/editor/') ||
    pathname === '/papers/editor' ||
    pathname.startsWith('/papers/editor/');
  const isBuilderPage = pathname === '/templates/builder' || pathname.startsWith('/templates/builder/');
  const isJournalEditorPage = pathname.startsWith('/templates/journal/');
  const isLoginPage = pathname === '/login' || pathname.startsWith('/login');

  // Route protection guard: redirect unauthenticated users to /login
  useEffect(() => {
    if (isLoginPage) return;

    const checkAuth = () => {
      const { isAuthenticated, token } = useAuthStore.getState();
      if (!isAuthenticated && !token && !isMockModeEnabled()) {
        router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
      }
    };

    if (useAuthStore.persist?.hasHydrated?.()) {
      checkAuth();
    } else {
      const unsub = useAuthStore.persist?.onFinishHydration?.(() => {
        checkAuth();
      });
      return () => unsub?.();
    }
  }, [pathname, isLoginPage, router]);

  if (isEditorPage || isBuilderPage || isJournalEditorPage || isLoginPage) {
    return (
      <div className="h-[calc(100vh-var(--titlebar-height,0px))] w-full bg-[#F8F9FA] overflow-hidden p-2 sm:p-0 flex flex-col">
        {children}
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-var(--titlebar-height,0px))] flex flex-col sm:flex-row bg-[#F8F9FA]">
      {/* Persistent Main Flow Sidebar */}
      <Sidebar />

      {/* Main Application Flow Area */}
      <div className="w-full flex-1 flex flex-col min-w-0 min-h-[calc(100vh-var(--titlebar-height,0px))]">
        <main className="w-full flex-1 px-3 sm:px-4 lg:px-6 py-3 pb-24 sm:pb-6 flex flex-col min-w-0 min-h-0">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar (Main Flow Only) */}
      <BottomNav />
    </div>
  );
};
