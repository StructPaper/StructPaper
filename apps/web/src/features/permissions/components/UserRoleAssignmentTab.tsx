'use client';

import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Search,
  CheckCircle2,
  Clock,
  Ban,
  X,
  AlertCircle,
  RefreshCw,
  UserPlus,
} from 'lucide-react';
import {
  useListUsers,
  useGetRoles,
  useAssignRole,
  useRevokeRole,
  type ManagedUser,
} from '@structpaper/api-client';
import { Select, type SelectOption } from '@/components/ui/Select';
import { sileo } from '@/components/toast';
import { useInvalidateMembers } from '../hooks/useInvalidateMembers';
import { usePermissionsPolicy } from '../access';
import { UserRowsShimmer } from './MemberTableShimmers';
import { apiErrorMessage, FALLBACK_ROLE_NAMES, GLOBAL_SCOPE_LABEL } from '../utils';

export type UserStatus = 'ACTIVE' | 'INVITED' | 'SUSPENDED';

export interface UserRoleItem {
  id: string;
  email: string;
  displayName?: string | null;
  /** Primary role (first assignment). Empty string when the user holds no role. */
  role: string;
  /** Journal the primary role is scoped to (null = global). */
  scopeJournalId?: string | null;
  scopeJournal?: string | null;
  /** How many additional role assignments the user has besides the primary one. */
  extraRoles?: number;
  status: UserStatus;
  permissionsVersion?: number;
  /** Why the current viewer can not edit this row (null/undefined = editable). Decided by the API. */
  lockReason?: 'SELF' | 'REQUIRES_SUPERADMIN' | null;
}

export interface UserRoleAssignmentTabProps {
  /** Optional override of the data (tests / storybook). By default users are loaded from the API. */
  users?: UserRoleItem[];
  onOpenInviteModal?: () => void;
  onRoleChangeSuccess?: (userId: string, newRole: string) => void;
}

type StatusFilterType = 'ALL' | UserStatus;

const STATUS_FILTER_TABS: Array<{ id: StatusFilterType; label: string }> = [
  { id: 'ALL', label: 'Tất cả' },
  { id: 'ACTIVE', label: 'ACTIVE' },
  { id: 'INVITED', label: 'INVITED' },
  { id: 'SUSPENDED', label: 'SUSPENDED' },
];

const NO_ROLE = '';

function toItem(user: ManagedUser): UserRoleItem {
  const [primary, ...rest] = user.roles ?? [];
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName ?? null,
    role: primary?.roleName ?? NO_ROLE,
    scopeJournalId: primary?.scopeJournalId ?? null,
    scopeJournal: primary?.scopeJournalName ?? null,
    extraRoles: rest.length,
    status: user.status as UserStatus,
    permissionsVersion: user.permissionsVersion,
    lockReason: user.lockReason ?? null,
  };
}

const LOCK_NOTES: Record<'SELF' | 'REQUIRES_SUPERADMIN', string> = {
  SELF: 'Không thể tự đổi vai trò của chính mình. Hãy nhờ quản trị viên khác.',
  REQUIRES_SUPERADMIN: 'Chỉ SuperAdmin mới đổi được vai trò của SuperAdmin.',
};

export const UserRoleAssignmentTab: React.FC<UserRoleAssignmentTabProps> = ({
  users: usersOverride,
  onOpenInviteModal,
  onRoleChangeSuccess,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilterType>('ALL');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [busyUserId, setBusyUserId] = useState<string | null>(null);

  const isTest = typeof process !== 'undefined' && process.env.NODE_ENV === 'test';

  const usersQuery = useListUsers({ limit: 100 }, { query: { enabled: usersOverride === undefined } });
  const rolesQuery = useGetRoles();
  const assignRoleMutation = useAssignRole({ request: { skipGlobalToast: true } });
  const revokeRoleMutation = useRevokeRole({ request: { skipGlobalToast: true } });
  const invalidateMembers = useInvalidateMembers();
  const policy = usePermissionsPolicy();

  const userList: UserRoleItem[] = useMemo(
    () => usersOverride ?? (usersQuery.data?.items ?? []).map(toItem),
    [usersOverride, usersQuery.data],
  );
  const total = usersOverride ? usersOverride.length : usersQuery.data?.total ?? 0;
  const isLoading = usersOverride === undefined && usersQuery.isLoading;
  const loadError = usersOverride === undefined && usersQuery.isError;

  // Real roles from the API (id needed to assign); fall back to the seeded names while loading.
  const apiRoles = (rolesQuery.data ?? []) as Array<{ id: string; name: string }>;
  const roleNames: string[] = apiRoles.length > 0 ? apiRoles.map((r) => r.name) : [...FALLBACK_ROLE_NAMES];

  const handleRoleChange = async (user: UserRoleItem, newRole: string) => {
    if (newRole === user.role || user.lockReason) return;

    const target = apiRoles.find((r) => r.name === newRole);
    if (!target) {
      sileo.error({
        title: 'Không thể phân vai trò',
        description: 'Danh sách vai trò chưa tải xong. Vui lòng thử lại sau giây lát.',
      });
      return;
    }
    const previous = apiRoles.find((r) => r.name === user.role);
    const journalId = user.scopeJournalId ?? null;

    setBusyUserId(user.id);
    try {
      // Assign first, then drop the old assignment: the user is never left without a role.
      await assignRoleMutation.mutateAsync({ data: { userId: user.id, roleId: target.id, journalId } });
      if (previous && previous.id !== target.id) {
        await revokeRoleMutation.mutateAsync({ data: { userId: user.id, roleId: previous.id, journalId } });
      }

      sileo.success({
        title: 'Cập nhật phân quyền tức thì',
        description: `Đã phân vai trò "${newRole}" cho ${user.email}. Phiên bản quyền (pv) đã tăng, các phiên cũ bị thu hồi.`,
      });
      onRoleChangeSuccess?.(user.id, newRole);
    } catch (err) {
      sileo.error({
        title: 'Không thể cập nhật vai trò',
        description: apiErrorMessage(err, 'Vui lòng thử lại.'),
      });
    } finally {
      // Always resync with the server (also after a failure that may have half-applied).
      await invalidateMembers();
      setBusyUserId(null);
    }
  };

  const filteredUsers = userList.filter((u) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      u.email.toLowerCase().includes(q) || (u.displayName || '').toLowerCase().includes(q);
    const matchesRole = roleFilter === 'ALL' || u.role === roleFilter;
    const matchesStatus = statusFilter === 'ALL' || u.status === statusFilter;
    return matchesSearch && matchesRole && matchesStatus;
  });

  const roleSelectOptions: SelectOption<string>[] = [
    { value: 'ALL', label: 'Tất cả vai trò' },
    ...roleNames.map((r) => ({ value: r, label: r })),
  ];

  // Only someone who may grant SuperAdmin is offered it (the server enforces this as well)
  const userRoleSelectOptions: SelectOption<string>[] = roleNames.map((r) => {
    const needsGrant = r === 'SuperAdmin' && !policy.canGrantSuperAdmin;
    return {
      value: r,
      label: r,
      disabled: needsGrant,
      description: needsGrant ? 'Chỉ SuperAdmin mới cấp được' : undefined,
    };
  });

  return (
    <div className="space-y-6">
      {/* Action & Filter Toolbar */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative group max-w-md w-full">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-3 z-10 pointer-events-none">
              <Search className="w-5 h-5 text-gray-400 group-hover:text-zinc-600 group-focus-within:text-[#78C841] transition-colors" />
              <div className="w-px h-4 bg-gray-200 group-hover:bg-zinc-300 transition-colors" />
            </div>
            <input
              type="text"
              role="searchbox"
              placeholder="Tìm theo email hoặc họ tên..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ boxShadow: 'inset 0 0 20px rgba(0, 0, 0, 0.09)' }}
              className="w-full bg-slate-50/40 backdrop-blur-sm border-2 border-white focus:border-[#78C841]/20 rounded-3xl py-3 pl-14 pr-12 text-sm font-bold text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-4 focus:ring-[#78C841]/5 transition-all shadow-eatzy-inner hover:shadow-eatzy-inner-hover"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 rounded-xl bg-zinc-200 hover:bg-zinc-300 flex items-center justify-center transition-all group/close cursor-pointer"
                title="Xóa tìm kiếm"
              >
                <X className="w-3.5 h-3.5 text-zinc-600 group-hover/close:rotate-90 transition-transform duration-300" />
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
            {STATUS_FILTER_TABS.map((tab) => {
              const isActive = statusFilter === tab.id;
              return (
                <motion.button
                  key={tab.id}
                  type="button"
                  data-testid={`status-filter-${tab.id.toLowerCase()}`}
                  whileHover={isTest ? undefined : { scale: 1.03 }}
                  whileTap={isTest ? undefined : { scale: 0.97 }}
                  transition={isTest ? { duration: 0 } : undefined}
                  onClick={() => setStatusFilter(tab.id)}
                  className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                    isActive
                      ? 'bg-[#1A1A1A] text-white shadow-md shadow-black/10'
                      : 'bg-gray-200 text-zinc-600 hover:text-zinc-900 hover:bg-gray-200/70'
                  }`}
                >
                  {tab.label}
                </motion.button>
              );
            })}
          </div>

          <div className="w-48 shrink-0">
            <Select
              options={roleSelectOptions}
              value={roleFilter}
              onChange={(val) => setRoleFilter(val)}
              size="sm"
              variant="eatzy-inner"
              fullWidth
            />
            {/* Hidden native select for test & accessibility integration */}
            <select
              aria-label="Lọc theo vai trò"
              data-testid="filter-role-select"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="sr-only"
              aria-hidden="true"
              tabIndex={-1}
            >
              <option value="ALL">Tất cả vai trò</option>
              {roleNames.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-[32px] border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50/60 border-b border-slate-200 text-[11px] uppercase font-bold text-slate-400 tracking-wider py-4 px-6">
              <tr>
                <th className="py-4 px-6">Người dùng / Thành viên</th>
                <th className="py-4 px-6">Phạm vi Tạp chí</th>
                <th className="py-4 px-6">Trạng thái</th>
                <th className="py-4 px-6">Phiên bản quyền (pv)</th>
                <th className="py-4 px-6">Vai trò (Role)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <UserRowsShimmer />
              ) : loadError ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center" data-testid="users-error">
                    <div className="inline-flex flex-col items-center gap-3 text-sm text-rose-700">
                      <span className="inline-flex items-center gap-2 font-semibold">
                        <AlertCircle className="w-4 h-4" />
                        Không tải được danh sách thành viên.
                      </span>
                      <button
                        type="button"
                        onClick={() => usersQuery.refetch()}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold rounded-xl cursor-pointer"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        Thử lại
                      </button>
                    </div>
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-400 text-sm">
                    <div className="inline-flex flex-col items-center gap-3">
                      <span>Không tìm thấy thành viên nào phù hợp với điều kiện tìm kiếm.</span>
                      {userList.length === 0 && onOpenInviteModal && (
                        <button
                          type="button"
                          onClick={onOpenInviteModal}
                          className="inline-flex items-center gap-2 px-4 py-2 bg-[#78C841] hover:bg-[#68B436] text-white text-xs font-bold rounded-xl cursor-pointer"
                        >
                          <UserPlus className="w-3.5 h-3.5" />
                          Mời thành viên mới
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => {
                  const busy = busyUserId === user.id;
                  return (
                    <tr key={user.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#78C841]/20 to-lime-100 ring-2 ring-white flex items-center justify-center font-bold text-slate-700 uppercase text-xs shadow-sm">
                            {(user.displayName || user.email).charAt(0)}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 flex items-center gap-2">
                              {user.displayName || 'Chưa cập nhật tên'}
                              {user.lockReason === 'SELF' && (
                                <span
                                  data-testid={`self-badge-${user.id}`}
                                  className="px-2 py-0.5 rounded-full bg-[#78C841]/15 text-lime-700 border border-[#78C841]/30 text-[10px] font-black uppercase tracking-wide"
                                >
                                  Bạn
                                </span>
                              )}
                            </div>
                            <div className="text-xs font-mono text-slate-400">{user.email}</div>
                          </div>
                        </div>
                      </td>

                      <td className="py-4 px-6 text-xs text-slate-600 font-medium">
                        <span
                          className="inline-block max-w-[220px] truncate"
                          title={user.scopeJournal || GLOBAL_SCOPE_LABEL}
                        >
                          {user.scopeJournal || GLOBAL_SCOPE_LABEL}
                        </span>
                      </td>

                      <td className="py-4 px-6">
                        {user.status === 'ACTIVE' && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-lime-50 text-lime-700 border border-lime-200">
                            <CheckCircle2 className="w-3.5 h-3.5 text-lime-600" />
                            <span>ACTIVE</span>
                          </span>
                        )}
                        {user.status === 'INVITED' && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            <Clock className="w-3.5 h-3.5 text-amber-600" />
                            <span>INVITED</span>
                          </span>
                        )}
                        {user.status === 'SUSPENDED' && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                            <Ban className="w-3.5 h-3.5 text-rose-600" />
                            <span>SUSPENDED</span>
                          </span>
                        )}
                      </td>

                      <td className="py-4 px-6">
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs font-mono font-bold border border-slate-200">
                          v{user.permissionsVersion ?? 1}
                        </span>
                      </td>

                      <td className="py-4 px-6">
                        <div className={`w-44 ${busy ? 'opacity-50 pointer-events-none' : ''}`} title={user.lockReason ? LOCK_NOTES[user.lockReason] : undefined}>
                          <Select
                            options={userRoleSelectOptions}
                            value={user.role}
                            placeholder="Chưa có vai trò"
                            disabled={!!user.lockReason || !policy.canAssignRoles}
                            onChange={(newRole) => handleRoleChange(user, newRole)}
                            size="sm"
                            variant="clean"
                            fullWidth
                          />
                          {/* Hidden native select for test & accessibility integration */}
                          <select
                            aria-label={`Phân vai trò cho ${user.email}`}
                            data-testid={`user-role-select-${user.id}`}
                            value={user.role}
                            disabled={busy || !!user.lockReason || !policy.canAssignRoles}
                            onChange={(e) => handleRoleChange(user, e.target.value)}
                            className="sr-only"
                            aria-hidden="true"
                            tabIndex={-1}
                          >
                            {!user.role && <option value="">Chưa có vai trò</option>}
                            {roleNames.map((r) => (
                              <option key={r} value={r} disabled={r === 'SuperAdmin' && !policy.canGrantSuperAdmin}>
                                {r}
                              </option>
                            ))}
                          </select>
                          {user.lockReason && (
                            <div
                              data-testid={`lock-note-${user.id}`}
                              className="mt-1 text-[11px] text-slate-500 font-medium leading-snug"
                            >
                              {LOCK_NOTES[user.lockReason]}
                            </div>
                          )}
                          {!!user.extraRoles && (
                            <div className="mt-1 text-[11px] text-slate-400 font-medium">
                              +{user.extraRoles} vai trò khác
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* End of List Indicator */}
      {filteredUsers.length > 0 && (
        <div className="py-8 flex items-center justify-center gap-4 opacity-50 select-none">
          <div className="h-[1px] bg-gradient-to-r from-transparent via-zinc-300 to-transparent w-24" />
          <div className="flex flex-col items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-zinc-500" />
            <span className="text-[12px] font-bold text-zinc-500 uppercase tracking-wider">
              Bạn đã xem hết danh sách thành viên
            </span>
            {total > userList.length && (
              <span className="text-[11px] font-medium text-zinc-500 normal-case tracking-normal">
                Đang hiển thị {userList.length}/{total} thành viên
              </span>
            )}
          </div>
          <div className="h-[1px] bg-gradient-to-r from-transparent via-zinc-300 to-transparent w-24" />
        </div>
      )}
    </div>
  );
};
