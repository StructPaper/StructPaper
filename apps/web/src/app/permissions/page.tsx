'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldCheck,
  Users,
  Shield,
  BookOpen,
  Clock,
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

  const kpiCards = [
    {
      title: 'Tổng thành viên',
      value: '6',
      label: 'Tài khoản đã kích hoạt',
      icon: Users,
      badgeClass: 'text-blue-600 bg-blue-50 border-blue-100/70',
    },
    {
      title: 'Vai trò hệ thống',
      value: '6 Roles',
      label: 'Immutable Baseline',
      icon: Shield,
      badgeClass: 'text-indigo-600 bg-indigo-50 border-indigo-100/70',
    },
    {
      title: 'Tạp chí ĐHQG-HCM',
      value: '7 Tạp chí',
      label: 'ĐHQG-HCM Scoped',
      icon: BookOpen,
      badgeClass: 'text-[#78C841] bg-[#78C841]/10 border-[#78C841]/25',
    },
    {
      title: 'Lời mời đang chờ',
      value: '3 Chờ kích hoạt',
      label: 'Pending Invites',
      icon: Clock,
      badgeClass: 'text-amber-600 bg-amber-50 border-amber-100/70',
    },
  ];

  return (
    <div className="min-h-screen bg-[#F8F9FA] pb-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-6 sm:space-y-8">
        {/* Sticky Hero Header matching Eatzy design system with backdrop blur & mask */}
        <StickyHubToolbar data-testid="permissions-header" className="pt-2 pb-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
                <ShieldCheck className="w-7 h-7 text-[#78C841]" strokeWidth={2.5} />
                <span>Quản lý Phân quyền &amp; Vai trò (RBAC / CASL)</span>
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1">
                Phân quyền theo phạm vi Tạp chí (Scoped RBAC) và kiểm soát truy cập chi tiết (CASL)
              </p>
            </div>

            {/* Quick Action Button */}
            <div className="flex items-center gap-3">
              <motion.button
                type="button"
                whileHover={isTest ? undefined : { scale: 1.02 }}
                whileTap={isTest ? undefined : { scale: 0.98 }}
                onClick={() => setIsInviteModalOpen(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#78C841] hover:bg-[#68B436] text-white text-sm font-bold rounded-2xl shadow-sm transition-all cursor-pointer"
              >
                <UserPlus className="w-4 h-4" />
                <span>Mời thành viên mới</span>
              </motion.button>
            </div>
          </div>
        </StickyHubToolbar>

        {/* Elevated KPI Metrics Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {kpiCards.map((kpi) => (
            <div
              key={kpi.title}
              className="bg-white/80 backdrop-blur-md rounded-2xl sm:rounded-3xl border border-white/60 p-4 sm:p-5 shadow-sm hover:shadow-md transition-all group relative overflow-hidden flex flex-col justify-between"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs sm:text-sm font-semibold text-slate-500">
                  {kpi.title}
                </span>
                <div
                  className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl sm:rounded-2xl border flex items-center justify-center shrink-0 ${kpi.badgeClass}`}
                >
                  <kpi.icon className="w-4 h-4 sm:w-4.5 sm:h-4.5" strokeWidth={2.2} />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                  {kpi.value}
                </div>
                <div className="text-[11px] sm:text-xs text-slate-400 font-medium mt-0.5">
                  {kpi.label}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Segmented Pill Tab Navigation */}
        <div className="flex items-center justify-start">
          <div
            role="tablist"
            aria-label="Các phân hệ quản lý phân quyền"
            className="p-1.5 bg-zinc-200/70 backdrop-blur-md rounded-2xl sm:rounded-3xl flex items-center gap-1.5 w-full sm:w-auto inline-flex select-none"
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
        </div>

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
