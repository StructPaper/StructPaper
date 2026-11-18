import type { GeneralAccess } from '@structpaper/api-client';

/** Roles an owner can hand out to a person (the owner role itself can not be given away). */
export type ShareRole = 'VIEWER' | 'REVIEWER' | 'COAUTHOR' | 'EDITOR';

export const SHARE_ROLE_OPTIONS: Array<{ value: ShareRole; label: string; description: string }> = [
  { value: 'VIEWER', label: 'Người xem', description: 'Chỉ đọc bản thảo' },
  { value: 'REVIEWER', label: 'Phản biện', description: 'Đọc bản thảo để đánh giá' },
  { value: 'COAUTHOR', label: 'Đồng tác giả', description: 'Xem và chỉnh sửa nội dung' },
  { value: 'EDITOR', label: 'Biên tập', description: 'Xem và chỉnh sửa nội dung' },
];

export const GENERAL_ACCESS_OPTIONS: Array<{ value: GeneralAccess; label: string; description: string }> = [
  { value: 'RESTRICTED', label: 'Chỉ những người được thêm', description: 'Chỉ người có tên bên trên mới mở được' },
  { value: 'VIEWER', label: 'Bất kỳ ai có liên kết: chỉ xem', description: 'Kể cả khách chưa có tài khoản, mở liên kết là đọc được' },
  { value: 'EDITOR', label: 'Người đã đăng nhập có liên kết: chỉnh sửa', description: 'Khách chưa đăng nhập vẫn chỉ xem được' },
];

export const roleLabel = (role: string): string =>
  role === 'OWNER' ? 'Chủ sở hữu' : (SHARE_ROLE_OPTIONS.find((r) => r.value === role)?.label ?? role);
