'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Check,
  X,
  FileText,
  Users,
  BookOpen,
  FolderOpen,
  Server,
  Layers,
  CheckCircle2,
} from 'lucide-react';

export const ACTIONS = [
  { id: 'create', label: 'Tạo mới (create)', desc: 'Tạo đối tượng mới' },
  { id: 'read', label: 'Xem (read)', desc: 'Xem nội dung và siêu dữ liệu' },
  { id: 'update', label: 'Cập nhật (update)', desc: 'Chỉnh sửa và ghi nhận phiên bản mới' },
  { id: 'delete', label: 'Xóa (delete)', desc: 'Xóa hoặc chuyển vào lưu trữ' },
  { id: 'manage', label: 'Quản lý (manage)', desc: 'Toàn quyền cấu hình và điều hành' },
  { id: 'publish', label: 'Xuất bản (publish)', desc: 'Phê duyệt và công bố bản thảo' },
] as const;

export type ActionType = typeof ACTIONS[number]['id'];

export const SUBJECTS = [
  { id: 'Manuscript', label: 'Bản thảo (Manuscript)', icon: FileText, desc: 'Bài báo, tệp Word/PDF và cấu trúc trích xuất' },
  { id: 'User', label: 'Người dùng (User)', icon: Users, desc: 'Hồ sơ tài khoản, vai trò và lời mời thành viên' },
  { id: 'Journal', label: 'Tạp chí (Journal)', icon: BookOpen, desc: 'Cấu hình mẫu tạp chí ĐHQG-HCM, danh mục và hội đồng' },
  { id: 'Asset', label: 'Tệp đính kèm (Asset)', icon: FolderOpen, desc: 'Hình ảnh, biểu bảng, tệp đính kèm MinIO S3' },
  { id: 'System', label: 'Hệ thống (System)', icon: Server, desc: 'Cấu hình nền tảng, nhật ký kiểm toán và máy chủ' },
] as const;

export type SubjectType = typeof SUBJECTS[number]['id'];

export const ROLES = [
  { id: 'SuperAdmin', label: 'SuperAdmin', isSystem: true, color: 'text-purple-700 bg-purple-50 border-purple-200' },
  { id: 'JournalManager', label: 'JournalManager', isSystem: true, color: 'text-indigo-700 bg-indigo-50 border-indigo-200' },
  { id: 'Editor', label: 'Editor', isSystem: true, color: 'text-blue-700 bg-blue-50 border-blue-200' },
  { id: 'Reviewer', label: 'Reviewer', isSystem: true, color: 'text-teal-700 bg-teal-50 border-teal-200' },
  { id: 'Author', label: 'Author', isSystem: true, color: 'text-amber-700 bg-amber-50 border-amber-200' },
  { id: 'Guest', label: 'Guest', isSystem: true, color: 'text-slate-700 bg-slate-100 border-slate-200' },
] as const;

export type RoleType = typeof ROLES[number]['id'];

// Permission lookup definition: Record<Subject, Record<Action, Record<Role, boolean | string>>>
export const PERMISSION_GRID: Record<SubjectType, Record<ActionType, Record<RoleType, { allowed: boolean; note?: string }>>> = {
  Manuscript: {
    create: {
      SuperAdmin: { allowed: true },
      JournalManager: { allowed: true, note: 'Scoped Journal' },
      Editor: { allowed: true, note: 'Scoped Journal' },
      Reviewer: { allowed: false },
      Author: { allowed: true },
      Guest: { allowed: false },
    },
    read: {
      SuperAdmin: { allowed: true },
      JournalManager: { allowed: true, note: 'Scoped Journal' },
      Editor: { allowed: true, note: 'Scoped Journal' },
      Reviewer: { allowed: true, note: 'Assigned Only' },
      Author: { allowed: true, note: 'Owned / Co-author' },
      Guest: { allowed: true, note: 'Published Only' },
    },
    update: {
      SuperAdmin: { allowed: true },
      JournalManager: { allowed: true, note: 'Scoped Journal' },
      Editor: { allowed: true, note: 'Scoped Journal' },
      Reviewer: { allowed: true, note: 'Review Feedback' },
      Author: { allowed: true, note: 'Draft / Revisions' },
      Guest: { allowed: false },
    },
    delete: {
      SuperAdmin: { allowed: true },
      JournalManager: { allowed: true, note: 'Scoped Journal' },
      Editor: { allowed: false },
      Reviewer: { allowed: false },
      Author: { allowed: false },
      Guest: { allowed: false },
    },
    manage: {
      SuperAdmin: { allowed: true },
      JournalManager: { allowed: true, note: 'Scoped Journal' },
      Editor: { allowed: false },
      Reviewer: { allowed: false },
      Author: { allowed: false },
      Guest: { allowed: false },
    },
    publish: {
      SuperAdmin: { allowed: true },
      JournalManager: { allowed: true, note: 'Scoped Journal' },
      Editor: { allowed: true, note: 'Scoped Journal' },
      Reviewer: { allowed: false },
      Author: { allowed: false },
      Guest: { allowed: false },
    },
  },
  User: {
    create: {
      SuperAdmin: { allowed: true },
      JournalManager: { allowed: true, note: 'Invite to Journal' },
      Editor: { allowed: false }, Reviewer: { allowed: false },
      Author: { allowed: false }, Guest: { allowed: false },
    },
    read: {
      SuperAdmin: { allowed: true },
      JournalManager: { allowed: true, note: 'Scoped Journal' },
      Editor: { allowed: true, note: 'Author list' },
      Reviewer: { allowed: false },
      Author: { allowed: true, note: 'Self only' },
      Guest: { allowed: false },
    },
    update: {
      SuperAdmin: { allowed: true },
      JournalManager: { allowed: true, note: 'Scoped Journal' },
      Editor: { allowed: false }, Reviewer: { allowed: false },
      Author: { allowed: true, note: 'Self profile' },
      Guest: { allowed: false },
    },
    delete: {
      SuperAdmin: { allowed: true }, JournalManager: { allowed: false },
      Editor: { allowed: false }, Reviewer: { allowed: false },
      Author: { allowed: false }, Guest: { allowed: false },
    },
    manage: {
      SuperAdmin: { allowed: true }, JournalManager: { allowed: false },
      Editor: { allowed: false }, Reviewer: { allowed: false },
      Author: { allowed: false }, Guest: { allowed: false },
    },
    publish: {
      SuperAdmin: { allowed: false }, JournalManager: { allowed: false },
      Editor: { allowed: false }, Reviewer: { allowed: false },
      Author: { allowed: false }, Guest: { allowed: false },
    },
  },
  Journal: {
    create: {
      SuperAdmin: { allowed: true }, JournalManager: { allowed: false },
      Editor: { allowed: false }, Reviewer: { allowed: false },
      Author: { allowed: false }, Guest: { allowed: false },
    },
    read: {
      SuperAdmin: { allowed: true }, JournalManager: { allowed: true },
      Editor: { allowed: true }, Reviewer: { allowed: true },
      Author: { allowed: true }, Guest: { allowed: true },
    },
    update: {
      SuperAdmin: { allowed: true },
      JournalManager: { allowed: true, note: 'Scoped Journal' },
      Editor: { allowed: false }, Reviewer: { allowed: false },
      Author: { allowed: false }, Guest: { allowed: false },
    },
    delete: {
      SuperAdmin: { allowed: true }, JournalManager: { allowed: false },
      Editor: { allowed: false }, Reviewer: { allowed: false },
      Author: { allowed: false }, Guest: { allowed: false },
    },
    manage: {
      SuperAdmin: { allowed: true },
      JournalManager: { allowed: true, note: 'Scoped Journal' },
      Editor: { allowed: false }, Reviewer: { allowed: false },
      Author: { allowed: false }, Guest: { allowed: false },
    },
    publish: {
      SuperAdmin: { allowed: false }, JournalManager: { allowed: false },
      Editor: { allowed: false }, Reviewer: { allowed: false },
      Author: { allowed: false }, Guest: { allowed: false },
    },
  },
  Asset: {
    create: {
      SuperAdmin: { allowed: true }, JournalManager: { allowed: true },
      Editor: { allowed: true }, Reviewer: { allowed: false },
      Author: { allowed: true, note: 'Owned Assets' },
      Guest: { allowed: false },
    },
    read: {
      SuperAdmin: { allowed: true }, JournalManager: { allowed: true },
      Editor: { allowed: true }, Reviewer: { allowed: true },
      Author: { allowed: true },
      Guest: { allowed: true, note: 'Public Assets' },
    },
    update: {
      SuperAdmin: { allowed: true }, JournalManager: { allowed: true },
      Editor: { allowed: true }, Reviewer: { allowed: false },
      Author: { allowed: false }, Guest: { allowed: false },
    },
    delete: {
      SuperAdmin: { allowed: true },
      JournalManager: { allowed: true, note: 'Scoped Journal' },
      Editor: { allowed: false }, Reviewer: { allowed: false },
      Author: { allowed: false }, Guest: { allowed: false },
    },
    manage: {
      SuperAdmin: { allowed: true }, JournalManager: { allowed: true },
      Editor: { allowed: false }, Reviewer: { allowed: false },
      Author: { allowed: false }, Guest: { allowed: false },
    },
    publish: {
      SuperAdmin: { allowed: false }, JournalManager: { allowed: false },
      Editor: { allowed: false }, Reviewer: { allowed: false },
      Author: { allowed: false }, Guest: { allowed: false },
    },
  },
  System: {
    create: {
      SuperAdmin: { allowed: true }, JournalManager: { allowed: false },
      Editor: { allowed: false }, Reviewer: { allowed: false },
      Author: { allowed: false }, Guest: { allowed: false },
    },
    read: {
      SuperAdmin: { allowed: true },
      JournalManager: { allowed: true, note: 'Basic info' },
      Editor: { allowed: false }, Reviewer: { allowed: false },
      Author: { allowed: false }, Guest: { allowed: false },
    },
    update: {
      SuperAdmin: { allowed: true }, JournalManager: { allowed: false },
      Editor: { allowed: false }, Reviewer: { allowed: false },
      Author: { allowed: false }, Guest: { allowed: false },
    },
    delete: {
      SuperAdmin: { allowed: true }, JournalManager: { allowed: false },
      Editor: { allowed: false }, Reviewer: { allowed: false },
      Author: { allowed: false }, Guest: { allowed: false },
    },
    manage: {
      SuperAdmin: { allowed: true }, JournalManager: { allowed: false },
      Editor: { allowed: false }, Reviewer: { allowed: false },
      Author: { allowed: false }, Guest: { allowed: false },
    },
    publish: {
      SuperAdmin: { allowed: false }, JournalManager: { allowed: false },
      Editor: { allowed: false }, Reviewer: { allowed: false },
      Author: { allowed: false }, Guest: { allowed: false },
    },
  },
};

export const PermissionMatrixTab: React.FC = () => {
  const [selectedSubject, setSelectedSubject] = useState<string>('ALL');
  const isTest = typeof process !== 'undefined' && process.env.NODE_ENV === 'test';

  const visibleSubjects =
    selectedSubject === 'ALL'
      ? SUBJECTS
      : SUBJECTS.filter((s) => s.id === selectedSubject);

  return (
    <div className="space-y-6">
      {/* Subject Filter Pills Toolbar */}
      <div className="flex items-center justify-between gap-4 bg-white/80 backdrop-blur-md p-3 sm:p-4 rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-xs flex-wrap">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
          <Layers className="w-4 h-4 text-slate-400" />
          <span>Lọc đối tượng (Subject):</span>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <motion.button
            type="button"
            data-testid="subject-filter-all"
            onClick={() => setSelectedSubject('ALL')}
            whileHover={isTest ? undefined : { scale: 1.03 }}
            whileTap={isTest ? undefined : { scale: 0.97 }}
            className={
              selectedSubject === 'ALL'
                ? 'bg-[#1A1A1A] text-white shadow-md shadow-black/10 font-extrabold rounded-full px-4 py-1.5 text-xs'
                : 'bg-gray-200 text-zinc-600 hover:text-zinc-950 hover:bg-gray-200/70 font-bold rounded-full px-4 py-1.5 text-xs transition-all'
            }
          >
            Tất cả đối tượng
          </motion.button>
          {SUBJECTS.map((s) => (
            <motion.button
              key={s.id}
              type="button"
              data-testid={`subject-filter-${s.id.toLowerCase()}`}
              onClick={() => setSelectedSubject(s.id)}
              whileHover={isTest ? undefined : { scale: 1.03 }}
              whileTap={isTest ? undefined : { scale: 0.97 }}
              className={
                selectedSubject === s.id
                  ? 'bg-[#1A1A1A] text-white shadow-md shadow-black/10 font-extrabold rounded-full px-4 py-1.5 text-xs'
                  : 'bg-gray-200 text-zinc-600 hover:text-zinc-950 hover:bg-gray-200/70 font-bold rounded-full px-4 py-1.5 text-xs transition-all'
              }
            >
              <span>{s.id}</span>
            </motion.button>
          ))}
        </div>
      </div>

      {/* High-Fidelity Matrix Table */}
      <div className="bg-white rounded-[32px] border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600 border-collapse">
            <thead className="bg-slate-50/90 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 text-xs uppercase font-extrabold text-slate-500 tracking-wider w-64 border-r border-slate-200">
                  Đối tượng & Hành động
                </th>
                {ROLES.map((role) => (
                  <th
                    key={role.id}
                    className="px-4 py-4 text-center font-semibold text-xs tracking-wider border-r border-slate-200 last:border-r-0"
                  >
                    <div className="flex flex-col items-center gap-1.5">
                      <span className={`px-3 py-1 rounded-xl text-xs font-black border ${role.color}`}>
                        {role.label}
                      </span>
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                        System Baseline
                      </span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleSubjects.map((subj) => {
                const IconComponent = subj.icon;
                return (
                  <React.Fragment key={subj.id}>
                    {/* Subject Category Header Row */}
                    <tr className="bg-slate-50/60 font-bold text-xs text-slate-800">
                      <td
                        colSpan={ROLES.length + 1}
                        className="px-6 py-3 border-t border-b border-slate-200"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-6 h-6 rounded-lg bg-[#78C841]/15 text-[#78C841] flex items-center justify-center">
                            <IconComponent className="w-3.5 h-3.5" />
                          </div>
                          <span className="text-sm font-extrabold uppercase tracking-wide text-slate-900">
                            {subj.label}
                          </span>
                          <span className="text-slate-400 font-medium text-xs ml-1.5">
                            — {subj.desc}
                          </span>
                        </div>
                      </td>
                    </tr>

                    {/* Actions for this Subject */}
                    {ACTIONS.map((act) => (
                      <tr key={`${subj.id}-${act.id}`} className="hover:bg-slate-50/40 transition-colors">
                        <td className="px-6 py-3.5 border-r border-slate-200">
                          <div className="font-mono text-xs font-bold text-slate-800">
                            {act.id}
                          </div>
                          <div className="text-[11px] text-slate-400 font-medium">
                            {act.desc}
                          </div>
                        </td>

                        {ROLES.map((role) => {
                          const perm = PERMISSION_GRID[subj.id]?.[act.id]?.[role.id] || { allowed: false };
                          return (
                            <td
                              key={`${subj.id}-${act.id}-${role.id}`}
                              className="px-3 py-3 text-center border-r border-slate-200 last:border-r-0 align-middle"
                            >
                              <div className="flex flex-col items-center justify-center gap-1">
                                {perm.allowed ? (
                                  <div
                                    className="w-7 h-7 rounded-full bg-emerald-100 border border-emerald-300 text-emerald-700 flex items-center justify-center shadow-2xs"
                                    title="Cho phép (Allowed)"
                                  >
                                    <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                                  </div>
                                ) : (
                                  <div
                                    className="w-7 h-7 rounded-full bg-slate-100 border border-slate-200 text-slate-300 flex items-center justify-center"
                                    title="Không cho phép (Disallowed)"
                                  >
                                    <X className="w-3.5 h-3.5 stroke-[2]" />
                                  </div>
                                )}

                                {perm.note && (
                                  <span className="text-[10px] text-slate-600 font-mono font-bold bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200/80 shadow-2xs">
                                    {perm.note}
                                  </span>
                                )}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Signature End-of-List Divider */}
      <div className="py-8 flex items-center justify-center gap-4 opacity-50 select-none">
        <div className="h-[1px] bg-gradient-to-r from-transparent via-zinc-300 to-transparent w-24" />
        <div className="flex flex-col items-center gap-1.5">
          <CheckCircle2 className="w-4 h-4 text-zinc-500" />
          <span className="text-[12px] font-bold text-zinc-500 uppercase tracking-wider">
            Bạn đã xem hết ma trận phân quyền hệ thống
          </span>
        </div>
        <div className="h-[1px] bg-gradient-to-r from-transparent via-zinc-300 to-transparent w-24" />
      </div>
    </div>
  );
};
