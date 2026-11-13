'use client';

import React, { useState } from 'react';
import {
  ShieldCheck,
  Check,
  X,
  Lock,
  Info,
  Filter,
  FileText,
  Users,
  BookOpen,
  FolderOpen,
  Server,
  Layers,
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
// Value can be true (allowed), false (disallowed), or string (scoped / condition notes)
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
      Editor: { allowed: false },
      Reviewer: { allowed: false },
      Author: { allowed: false },
      Guest: { allowed: false },
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
      Editor: { allowed: false },
      Reviewer: { allowed: false },
      Author: { allowed: true, note: 'Self profile' },
      Guest: { allowed: false },
    },
    delete: {
      SuperAdmin: { allowed: true },
      JournalManager: { allowed: false },
      Editor: { allowed: false },
      Reviewer: { allowed: false },
      Author: { allowed: false },
      Guest: { allowed: false },
    },
    manage: {
      SuperAdmin: { allowed: true },
      JournalManager: { allowed: false },
      Editor: { allowed: false },
      Reviewer: { allowed: false },
      Author: { allowed: false },
      Guest: { allowed: false },
    },
    publish: {
      SuperAdmin: { allowed: false },
      JournalManager: { allowed: false },
      Editor: { allowed: false },
      Reviewer: { allowed: false },
      Author: { allowed: false },
      Guest: { allowed: false },
    },
  },
  Journal: {
    create: {
      SuperAdmin: { allowed: true },
      JournalManager: { allowed: false },
      Editor: { allowed: false },
      Reviewer: { allowed: false },
      Author: { allowed: false },
      Guest: { allowed: false },
    },
    read: {
      SuperAdmin: { allowed: true },
      JournalManager: { allowed: true },
      Editor: { allowed: true },
      Reviewer: { allowed: true },
      Author: { allowed: true },
      Guest: { allowed: true },
    },
    update: {
      SuperAdmin: { allowed: true },
      JournalManager: { allowed: true, note: 'Scoped Journal' },
      Editor: { allowed: false },
      Reviewer: { allowed: false },
      Author: { allowed: false },
      Guest: { allowed: false },
    },
    delete: {
      SuperAdmin: { allowed: true },
      JournalManager: { allowed: false },
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
      SuperAdmin: { allowed: false },
      JournalManager: { allowed: false },
      Editor: { allowed: false },
      Reviewer: { allowed: false },
      Author: { allowed: false },
      Guest: { allowed: false },
    },
  },
  Asset: {
    create: {
      SuperAdmin: { allowed: true },
      JournalManager: { allowed: true },
      Editor: { allowed: true },
      Reviewer: { allowed: false },
      Author: { allowed: true, note: 'Owned Assets' },
      Guest: { allowed: false },
    },
    read: {
      SuperAdmin: { allowed: true },
      JournalManager: { allowed: true },
      Editor: { allowed: true },
      Reviewer: { allowed: true },
      Author: { allowed: true },
      Guest: { allowed: true, note: 'Public Assets' },
    },
    update: {
      SuperAdmin: { allowed: true },
      JournalManager: { allowed: true },
      Editor: { allowed: true },
      Reviewer: { allowed: false },
      Author: { allowed: false },
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
      JournalManager: { allowed: true },
      Editor: { allowed: false },
      Reviewer: { allowed: false },
      Author: { allowed: false },
      Guest: { allowed: false },
    },
    publish: {
      SuperAdmin: { allowed: false },
      JournalManager: { allowed: false },
      Editor: { allowed: false },
      Reviewer: { allowed: false },
      Author: { allowed: false },
      Guest: { allowed: false },
    },
  },
  System: {
    create: {
      SuperAdmin: { allowed: true },
      JournalManager: { allowed: false },
      Editor: { allowed: false },
      Reviewer: { allowed: false },
      Author: { allowed: false },
      Guest: { allowed: false },
    },
    read: {
      SuperAdmin: { allowed: true },
      JournalManager: { allowed: true, note: 'Basic info' },
      Editor: { allowed: false },
      Reviewer: { allowed: false },
      Author: { allowed: false },
      Guest: { allowed: false },
    },
    update: {
      SuperAdmin: { allowed: true },
      JournalManager: { allowed: false },
      Editor: { allowed: false },
      Reviewer: { allowed: false },
      Author: { allowed: false },
      Guest: { allowed: false },
    },
    delete: {
      SuperAdmin: { allowed: true },
      JournalManager: { allowed: false },
      Editor: { allowed: false },
      Reviewer: { allowed: false },
      Author: { allowed: false },
      Guest: { allowed: false },
    },
    manage: {
      SuperAdmin: { allowed: true },
      JournalManager: { allowed: false },
      Editor: { allowed: false },
      Reviewer: { allowed: false },
      Author: { allowed: false },
      Guest: { allowed: false },
    },
    publish: {
      SuperAdmin: { allowed: false },
      JournalManager: { allowed: false },
      Editor: { allowed: false },
      Reviewer: { allowed: false },
      Author: { allowed: false },
      Guest: { allowed: false },
    },
  },
};

export const PermissionMatrixTab: React.FC = () => {
  const [selectedSubject, setSelectedSubject] = useState<string>('ALL');

  const visibleSubjects =
    selectedSubject === 'ALL'
      ? SUBJECTS
      : SUBJECTS.filter((s) => s.id === selectedSubject);

  return (
    <div className="space-y-6">
      {/* Security Architecture & Immutable System Roles Alert */}
      <div className="p-4 bg-amber-50/70 border border-amber-200/80 rounded-2xl flex items-start gap-3.5 shadow-sm">
        <div className="w-8 h-8 rounded-xl bg-amber-100 border border-amber-200 flex items-center justify-center text-amber-700 shrink-0 mt-0.5">
          <Lock className="w-4 h-4" />
        </div>
        <div className="text-sm">
          <div className="font-semibold text-amber-900 flex items-center gap-2">
            <span>Kiến trúc Bảo mật RBAC & CASL (Immutable System Roles)</span>
            <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-amber-200/60 text-amber-900 border border-amber-300/60">
              Bất biến / Immutable Baseline
            </span>
          </div>
          <p className="text-xs text-amber-800 mt-1 leading-relaxed">
            Các vai trò hệ thống (<strong className="font-semibold">SuperAdmin, JournalManager, Editor, Reviewer, Author, Guest</strong>) là các baseline quyền hạn bất biến theo đặc tả bảo mật StructPaper. Quản trị viên chỉ có thể gán người dùng vào vai trò hoặc mở rộng phạm vi tạp chí (<code className="font-mono text-amber-950 font-medium">scopeJournalId</code>), không thể tự ý vô hiệu hóa các quy tắc bảo mật cốt lõi.
          </p>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
          <Layers className="w-4 h-4 text-slate-400" />
          <span>Lọc đối tượng (Subject):</span>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => setSelectedSubject('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              selectedSubject === 'ALL'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Tất cả đối tượng
          </button>
          {SUBJECTS.map((s) => (
            <button
              key={s.id}
              onClick={() => setSelectedSubject(s.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
                selectedSubject === s.id
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <span>{s.id}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Matrix Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600 border-collapse">
            <thead className="bg-slate-50/90 border-b border-slate-200">
              <tr>
                <th className="px-5 py-4 text-xs uppercase font-semibold text-slate-500 tracking-wider w-64 border-r border-slate-200">
                  Đối tượng & Hành động
                </th>
                {ROLES.map((role) => (
                  <th
                    key={role.id}
                    className="px-4 py-4 text-center font-semibold text-xs tracking-wider border-r border-slate-200 last:border-r-0"
                  >
                    <div className="flex flex-col items-center gap-1">
                      <span className={`px-2.5 py-1 rounded-md text-xs font-bold border ${role.color}`}>
                        {role.label}
                      </span>
                      <span className="text-[10px] text-slate-400 font-normal">
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
                    {/* Subject Group Header */}
                    <tr className="bg-slate-50/60 font-semibold text-xs text-slate-700">
                      <td
                        colSpan={ROLES.length + 1}
                        className="px-5 py-2.5 border-t border-b border-slate-200"
                      >
                        <div className="flex items-center gap-2 text-indigo-700">
                          <IconComponent className="w-4 h-4" />
                          <span className="text-sm font-bold uppercase tracking-wide">
                            {subj.label}
                          </span>
                          <span className="text-slate-400 font-normal text-xs ml-2">
                            — {subj.desc}
                          </span>
                        </div>
                      </td>
                    </tr>

                    {/* Actions for this Subject */}
                    {ACTIONS.map((act) => (
                      <tr key={`${subj.id}-${act.id}`} className="hover:bg-slate-50/40 transition-colors">
                        <td className="px-5 py-3 border-r border-slate-200">
                          <div className="font-mono text-xs font-semibold text-slate-800">
                            {act.id}
                          </div>
                          <div className="text-[11px] text-slate-400">
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
                                    className="w-6 h-6 rounded-full bg-emerald-100 border border-emerald-300 text-emerald-700 flex items-center justify-center"
                                    title="Cho phép (Allowed)"
                                  >
                                    <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                                  </div>
                                ) : (
                                  <div
                                    className="w-6 h-6 rounded-full bg-slate-100 border border-slate-200 text-slate-300 flex items-center justify-center"
                                    title="Không cho phép (Disallowed)"
                                  >
                                    <X className="w-3.5 h-3.5 stroke-[2]" />
                                  </div>
                                )}

                                {perm.note && (
                                  <span className="text-[10px] text-slate-500 font-mono bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200">
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
    </div>
  );
};
