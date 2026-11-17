'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldCheck,
  Users,
  Grid3X3,
  MailCheck,
  UserPlus,
} from 'lucide-react';
import {
  UserRoleAssignmentTab,
  PermissionMatrixTab,
  InvitationsTab,
  InviteMemberModal,
} from '@/features/permissions';
import { StickyHubToolbar } from '@/components/layout/StickyHubToolbar';

const isTest = typeof process !== 'undefined' && process.env.NODE_ENV === 'test';

type TabKey = 'users' | 'matrix' | 'invitations';

interface TabItem {
  id: TabKey;
  label: string;
  icon: React.ElementType;
}

const TABS: TabItem[] = [
  { id: 'users', label: 'Người dùng & Vai trò', icon: Users },
  { id: 'matrix', label: 'Ma trận Phân quyền', icon: Grid3X3 },
  { id: 'invitations', label: 'Lời mời tham gia', icon: MailCheck },
];

export default function PermissionsPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('users');
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#F8F9FA] pb-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-6 sm:space-y-8">
        {/* Page Title (Non-sticky) */}
        <div className="flex items-center justify-between pt-2">
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <ShieldCheck className="w-7 h-7 text-[#78C841]" strokeWidth={2.5} />
            <span>Quản lý phân quyền</span>
          </h1>
        </div>

        {/* Sticky Toolbar: Segmented Tabs & Quick Invite Button on the same row with blur mask */}
        <StickyHubToolbar data-testid="permissions-sticky-toolbar" className="py-2 pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Segmented Pill Tab Navigation */}
            <div
              role="tablist"
              aria-label="Các phân hệ quản lý phân quyền"
              className="p-1.5 bg-zinc-200/70 backdrop-blur-md rounded-2xl sm:rounded-3xl flex items-center gap-1.5 w-full sm:w-auto inline-flex select-none overflow-x-auto scrollbar-none"
            >
              {TABS.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <motion.button
                    key={tab.id}
                    role="tab"
                    aria-selected={isActive}
                    whileHover={isTest ? undefined : { scale: 1.02 }}
                    whileTap={isTest ? undefined : { scale: 0.98 }}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center justify-center gap-2 cursor-pointer select-none whitespace-nowrap transition-all ${
                      isActive
                        ? 'bg-[#1A1A1A] text-white shadow-md font-extrabold rounded-xl sm:rounded-2xl px-4 py-2 text-xs sm:text-sm'
                        : 'text-zinc-600 hover:text-zinc-950 hover:bg-white/60 font-bold rounded-xl sm:rounded-2xl px-4 py-2 text-xs sm:text-sm'
                    }`}
                  >
                    <tab.icon className="w-4 h-4 shrink-0" />
                    <span>{tab.label}</span>
                  </motion.button>
                );
              })}
            </div>

            {/* Sticky Action Button (Ngang hàng với tabs) */}
            <motion.button
              type="button"
              whileHover={isTest ? undefined : { scale: 1.02 }}
              whileTap={isTest ? undefined : { scale: 0.98 }}
              onClick={() => setIsInviteModalOpen(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#78C841] hover:bg-[#68B436] text-white text-sm font-bold rounded-2xl shadow-sm transition-all cursor-pointer shrink-0 self-start sm:self-auto"
            >
              <UserPlus className="w-4 h-4" />
              <span>Mời thành viên mới</span>
            </motion.button>
          </div>
        </StickyHubToolbar>

        {/* Main Tab Content with AnimatePresence & motion.div */}
        <main className="w-full">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={isTest ? undefined : { opacity: 0, y: 8 }}
              animate={isTest ? undefined : { opacity: 1, y: 0 }}
              exit={isTest ? undefined : { opacity: 0, y: -8 }}
              transition={isTest ? { duration: 0 } : { duration: 0.18, ease: 'easeOut' }}
            >
              {activeTab === 'users' && (
                <UserRoleAssignmentTab
                  onOpenInviteModal={() => setIsInviteModalOpen(true)}
                />
              )}

              {activeTab === 'matrix' && <PermissionMatrixTab />}

              {activeTab === 'invitations' && (
                <InvitationsTab onOpenInviteModal={() => setIsInviteModalOpen(true)} />
              )}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Invite Member Modal */}
      <InviteMemberModal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
      />
    </div>
  );
}
