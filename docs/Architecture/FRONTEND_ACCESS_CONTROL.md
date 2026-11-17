# Phân quyền phía giao diện (phần đã áp dụng)

Bản thiết kế đầy đủ nằm trong file PDF cùng thư mục
(*Kiến trúc phân quyền phía giao diện (RBAC trên Frontend)*). Tài liệu này ghi lại **phần đang chạy
trong code** và cách dùng.

## Nguyên tắc
1. Giao diện **chỉ hỏi khả năng (capability)**, không so tên vai trò. Tên vai trò chỉ để hiển thị.
2. Ẩn nút **không phải bảo mật**: API luôn kiểm tra lại.
3. Backend gửi sẵn danh sách khả năng của người đăng nhập và dùng **đúng hàm điều kiện** của guard
   API để tính, nên màn hình và API không lệch nhau.
4. Chưa biết quyền (đang tải) thì **từ chối mặc định**, hiện khung chờ (shimmer).

## Cách hoạt động
```
packages/contracts/src/access/capabilities.ts   danh mục capability (dùng chung FE + BE)
apps/api/.../access/domain/capabilities.ts      quy tắc cho từng capability (cùng hàm với @CheckPolicies)
GET /auth/me  ->  { ..., roles, capabilities }   backend tính từ vai trò của người dùng
apps/web/src/lib/access/                         useAccess(), <Gate>, createAccess(), denyMessage()
apps/web/src/components/layout/navigation.ts     bảng điều hướng khai báo một nơi (dock, drawer, bottom bar)
apps/web/src/features/<tính-năng>/access.ts      chính sách mang tên nghiệp vụ của từng tính năng
```

Capability hiện có:

| Capability | Nghĩa | Hàm backend |
|---|---|---|
| `member:manage` | Xem/mời/thu hồi lời mời, khóa-mở thành viên | `canManageMembers` |
| `role:assign` | Gán/gỡ vai trò của người khác | `canAssignRoles` |
| `role:grant_superadmin` | Cấp/gỡ vai trò SuperAdmin | `canGrantSuperAdmin` |

## Dùng trong giao diện
```tsx
// Ẩn cả vùng khi không có quyền (đặt cổng càng cao càng tốt, đừng rải vào từng ô)
<Gate capability="member:manage"><InviteButton /></Gate>

// Hiện nhưng khóa, kèm lý do
<Gate capability="member:manage" mode="disable">
  {(d) => <button disabled={!d.allowed} title={denyMessage(d)}>Mời</button>}
</Gate>

// Điều kiện ghép: đặt tên trong access.ts của tính năng, không viết `can(a) && can(b)` trong JSX
const policy = usePermissionsPolicy();   // features/permissions/access.ts
```

Ẩn một mục trên dock chỉ cần thêm `access` vào `navigation.ts`:
```ts
{ path: '/audit', label: 'Nhật ký', icon: ScrollText, activeOn: ['/audit'], access: 'audit:read' }
```
Dock, drawer mobile và thanh dưới cùng đọc từ một bảng nên không thể lệch nhau.

## Thêm một capability mới
1. Khai báo trong `packages/contracts/src/access/capabilities.ts`.
2. Viết quy tắc cho nó trong `apps/api/.../access/domain/capabilities.ts` (thiếu quy tắc thì **không biên dịch**).
3. Dùng **chính hàm đó** cho `@CheckPolicies` của endpoint tương ứng.
4. Thêm khóa vào enum `capabilities` ở `generate-openapi.ts`, chạy lại `openapi:generate` và `codegen`.
5. Dùng ở giao diện bằng `Gate` / `access` của navigation. Thêm persona vào test.

## Trang Phân quyền hiện tại
- Ai đăng nhập cũng mở được và xem **ma trận phân quyền**; cột vai trò của chính mình được tô nhạt.
- Có `member:manage`: thêm hai tab (thành viên, lời mời) và nút mời thành viên.
- Có `role:assign`: đổi được vai trò trong bảng thành viên; chỉ có `role:grant_superadmin` mới chọn được SuperAdmin.

## Chưa làm so với bản thiết kế
Gói `authz` dùng chung đầy đủ (quy tắc theo tài nguyên, lý do từ chối chi tiết như `WORKFLOW_LOCKED`),
registry hành động, `RouteGuard` theo bảng route, quyền theo từng bản thảo, lưu đệm cho ngoại tuyến,
đồng bộ nhiều tab. Hiện chỉ có hai lý do từ chối (`LOADING`, `NO_PERMISSION`); các lý do khác của thao tác
phân quyền (tự đổi mình, SuperAdmin cuối cùng) đang do API trả về và hiển thị qua `lockReason` / thông báo lỗi.
