'use client';

import React, { useState } from 'react';
import {
  ShieldCheck,
  Users,
  Grid3X3,
  MailCheck,
  ShieldAlert,
  UserPlus,
  RefreshCw,
  BookOpen,
  Lock,
} from 'lucide-react';
import {
  UserRoleAssignmentTab,
  PermissionMatrixTab,
  InvitationsTab,
  InviteMemberModal,
  type UserRoleItem,
} from '@/features/permissions';

export default function PermissionsPage() {
  const [activeTab, setActiveTab] = useState<'users' | 'matrix' | 'invitations'>('users');
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#F8F9FA] pb-16">
      {/* Page Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-sm">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                    Quản lý Phân quyền & Vai trò (RBAC / CASL)
                  </h1>
                  <p className="text-sm text-slate-500 mt-0.5">
                    Phân quyền theo phạm vi Tạp chí (Scoped RBAC) và kiểm soát truy cập chi tiết (CASL)
                  </p>
                </div>
              </div>

              {/* Subtitle explaining pv cache invalidation & instant revocation */}
              <div className="mt-4 p-3 bg-indigo-50/60 border border-indigo-100 rounded-xl text-xs text-indigo-900 leading-relaxed max-w-4xl">
                <span className="font-semibold text-indigo-700">Cơ chế Thu hồi Quyền tức thì (Instant Revocation): </span>
                Mỗi khi thay đổi vai trò hoặc quyền của thành viên, trường <code className="font-mono font-bold bg-white px-1.5 py-0.5 rounded text-indigo-800 border border-indigo-200">permissions_version (pv)</code> trong cơ sở dữ liệu sẽ tự động gia tăng. Access token và LRU ability cache cũ sẽ bị vô hiệu hóa ngay lập tức tại request tiếp theo mà không cần chờ JWT hết hạn.
              </div>
            </div>

            {/* Quick Action */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsInviteModalOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl shadow-sm transition-colors cursor-pointer"
              >
                <UserPlus className="w-4 h-4" />
                <span>Mời thành viên mới</span>
              </button>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3">
              <div className="text-xs text-slate-500 font-medium">Tổng thành viên</div>
              <div className="text-xl font-bold text-slate-800 mt-0.5">6</div>
            </div>
            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3">
              <div className="text-xs text-slate-500 font-medium">Vai trò hệ thống</div>
              <div className="text-xl font-bold text-indigo-600 mt-0.5">6 Roles</div>
            </div>
            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3">
              <div className="text-xs text-slate-500 font-medium">Tạp chí ĐHQG-HCM</div>
              <div className="text-xl font-bold text-slate-800 mt-0.5">7 Tạp chí</div>
            </div>
            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3">
              <div className="text-xs text-slate-500 font-medium">Lời mời đang chờ</div>
              <div className="text-xl font-bold text-amber-600 mt-0.5">3 Chờ kích hoạt</div>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex items-center gap-2 mt-8 border-b border-slate-200" role="tablist">
            <button
              role="tab"
              aria-selected={activeTab === 'users'}
              onClick={() => setActiveTab('users')}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
                activeTab === 'users'
                  ? 'border-indigo-600 text-indigo-600 bg-indigo-50/30'
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Người dùng & Vai trò</span>
            </button>

            <button
              role="tab"
              aria-selected={activeTab === 'matrix'}
              onClick={() => setActiveTab('matrix')}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
                activeTab === 'matrix'
                  ? 'border-indigo-600 text-indigo-600 bg-indigo-50/30'
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
              }`}
            >
              <Grid3X3 className="w-4 h-4" />
              <span>Ma trận Phân quyền</span>
            </button>

            <button
              role="tab"
              aria-selected={activeTab === 'invitations'}
              onClick={() => setActiveTab('invitations')}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
                activeTab === 'invitations'
                  ? 'border-indigo-600 text-indigo-600 bg-indigo-50/30'
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
              }`}
            >
              <MailCheck className="w-4 h-4" />
              <span>Lời mời tham gia</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Tab Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {activeTab === 'users' && (
          <UserRoleAssignmentTab
            onOpenInviteModal={() => setIsInviteModalOpen(true)}
          />
        )}

        {activeTab === 'matrix' && <PermissionMatrixTab />}

        {activeTab === 'invitations' && (
          <InvitationsTab onOpenInviteModal={() => setIsInviteModalOpen(true)} />
        )}
      </main>

      {/* Invite Member Modal */}
      <InviteMemberModal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
      />
    </div>
  );
}
