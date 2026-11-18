import type { LucideIcon } from 'lucide-react';
import { FolderArchive, BookOpen, ShieldCheck, User } from 'lucide-react';
import type { Capability } from '@structpaper/contracts';
import type { Access } from '@/lib/access';

/**
 * The navigation is declared ONCE here. The desktop dock, the mobile drawer and the bottom bar
 * are all generated from this table, so an item can never appear in one place and be missing
 * (or visible when it should be hidden) in another.
 *
 * To hide an item from people who lack a capability, give it `access`.
 */
export interface NavItem {
  path: string;
  label: string;
  description: string;
  icon: LucideIcon;
  /** Paths that make this item look "active" (the page itself and its sub pages). */
  activeOn: string[];
  /** Capability (or list, all required) needed to see the item. Omit = every logged-in user. */
  access?: Capability | Capability[];
  /** Also shown in the mobile bottom bar, with this short label. */
  bottomBarLabel?: string;
}

export const MAIN_NAV: NavItem[] = [
  {
    path: '/papers',
    label: 'Quản lý Bài báo',
    description: 'Quản lý & lưu trữ bản thảo',
    icon: FolderArchive,
    activeOn: ['/papers', '/history'],
    bottomBarLabel: 'Bài báo',
  },
  {
    path: '/templates',
    label: 'Quản lý Mẫu & Tạp chí',
    description: '7 Tạp chí ĐHQG & Quy định',
    icon: BookOpen,
    activeOn: ['/templates'],
    bottomBarLabel: 'Mẫu Tạp chí',
  },
  {
    // Everybody can open it (the permission matrix is informative); the management tabs and
    // buttons inside need 'member:manage' / 'role:assign' (see features/permissions/access.ts).
    path: '/permissions',
    label: 'Phân quyền & Vai trò',
    description: 'Quản lý vai trò & thành viên',
    icon: ShieldCheck,
    activeOn: ['/permissions'],
  },
];

export const ACCOUNT_NAV: NavItem = {
  path: '/account',
  label: 'Tài khoản',
  description: 'Hồ sơ & phiên đăng nhập',
  icon: User,
  activeOn: ['/account'],
  bottomBarLabel: 'Tài khoản',
};

const required = (item: NavItem): Capability[] =>
  item.access === undefined ? [] : Array.isArray(item.access) ? item.access : [item.access];

/** Items the user may see (default deny while the capabilities are loading). */
export function visibleNav(items: NavItem[], access: Access): NavItem[] {
  // no requirement -> always visible; otherwise every listed capability must be granted
  return items.filter((item) => access.canAll(...required(item)));
}

export function isNavItemActive(item: NavItem, pathname: string): boolean {
  return item.activeOn.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

/** Items of the mobile bottom bar, in the order of the navigation table. */
export function bottomBarNav(items: NavItem[]): NavItem[] {
  return items.filter((item) => item.bottomBarLabel);
}
