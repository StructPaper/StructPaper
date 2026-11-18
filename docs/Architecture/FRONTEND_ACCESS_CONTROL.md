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
| `journal:manage` | Thêm/sửa tạp chí và mẫu (không có thì trang Mẫu chỉ để xem) | `canManageJournals` |

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

## Quyền theo từng bản thảo (khác với capability toàn cục)
Capability trả lời "tôi làm được gì nói chung"; **quyền theo bản thảo** trả lời "tôi làm được gì với bản thảo này"
nên không nằm trong `capabilities` mà do API tính cho từng bản thảo và gửi kèm dưới `access`
(`canEdit`, `canShare`, `canDelete`) cùng `generalAccess`. Giao diện chỉ đọc các cờ này.

- **Mặc định chỉ của mình**: vai trò (kể cả Editor) không cho xem bản thảo người khác. Chỉ JournalManager/SuperAdmin
  được quản lý mọi bản thảo.
- **Thành viên** (`manuscript_members`): OWNER (toàn quyền), COAUTHOR/EDITOR (xem + sửa), REVIEWER/VIEWER (chỉ xem).
- **Quyền chung** (`manuscripts.general_access`): `RESTRICTED` | `VIEWER` | `EDITOR` cho mọi người đã đăng nhập;
  chỉ mở được khi có đường dẫn, không làm đầy danh sách của người khác.
- **Xóa**: chủ sở hữu xóa được khi bản thảo chưa vào quy trình (không ở IN_REVIEW, PROOFING, READY, ACCEPTED, PUBLISHED);
  khi không xóa được, mục xóa bị ẩn khỏi menu thẻ.
- **Chia sẻ**: chỉ chủ sở hữu (và quản lý). Tìm người theo email qua `GET /manuscripts/people?q=`, thêm/đổi vai trò
  `POST /manuscripts/:id/members`, gỡ `DELETE …/members/:userId`, quyền chung `PUT …/general-access`.
- Thêm thành viên làm vô hiệu bộ nhớ đệm quyền của người đó nên hiệu lực ngay (không buộc đăng nhập lại).
- Quyết định biên tập (IN_REVIEW, ACCEPTED, REJECTED, PUBLISHED) chỉ dành cho người có quyền `manage` (JournalManager/SuperAdmin).
- **Cách giao diện hỏi quyền theo bài**: một nơi duy nhất là `features/papers/access.ts` (`createPaperAccess`, `paperAccessOfRecord` cho danh sách, `usePaperAccess(id)` cho trang/titlebar) và cổng `<PaperGate access allow="edit|share|delete|view">`. Trả về `canView/canEdit/canShare/canDelete/readOnly`, `explain()` với lý do như `lib/access`; đang tải thì từ chối mặc định; bài chỉ có trên máy là của người dùng; bài trên server không có `access` thì không có quyền gì.
- **Bản xem trước PDF cho người chỉ xem**: người sửa được biên dịch xong thì tự gửi PDF lên `PUT /manuscripts/:id/preview`; ai đọc được bài (kể cả khách có link) lấy bằng `GET /manuscripts/:id/preview` (`@OptionalAuth`, quyền đọc của bài). Người xem đã đăng nhập mà bài chưa có bản nào thì tự biên dịch; khách thì chỉ thấy khi đã có.
- **Khách (không tài khoản)**: `GET /manuscripts/:id` là route duy nhất cho phép không cần token (`@OptionalAuth`, được ghim trong test route-audit). Khách chỉ đọc được khi quyền chung là `VIEWER` ("bất kỳ ai có liên kết"); `EDITOR` chỉ áp dụng cho người đã đăng nhập.
- **Chế độ chỉ xem** (`access.canEdit = false`): trang `/papers/:id` dùng `ReadOnlyPaperView` thay vì trình soạn thảo, nên không có tự lưu, không đồng bộ. Titlebar giữ tên (không sửa được) và chỉ còn nút "Sao chép liên kết"; dock ẩn sửa thông tin, dàn trang, lưu, biên dịch, trạng thái, QC; nội dung các tab bọc trong `ReadOnlyScope` (ô nhập chỉ đọc, nút thêm/xóa/đổi thứ tự gắn `data-edit-only` bị ẩn). Khi thêm nút sửa mới trong tab, nhớ gắn `data-edit-only`.
- Giao diện: `features/sharing` (hộp thoại chia sẻ, nút ở titlebar trang chi tiết, mục "Chia sẻ" ở menu thẻ).

## Trang Phân quyền hiện tại
- Ai đăng nhập cũng mở được và xem **ma trận phân quyền**; cột vai trò của chính mình được tô nhạt.
- Có `member:manage`: thêm hai tab (thành viên, lời mời) và nút mời thành viên.
- Có `role:assign`: đổi được vai trò trong bảng thành viên; chỉ có `role:grant_superadmin` mới chọn được SuperAdmin.

## Chưa làm so với bản thiết kế
Gói `authz` dùng chung đầy đủ (quy tắc theo tài nguyên, lý do từ chối chi tiết như `WORKFLOW_LOCKED`),
registry hành động, `RouteGuard` theo bảng route, lưu đệm cho ngoại tuyến,
đồng bộ nhiều tab. Hiện chỉ có hai lý do từ chối (`LOADING`, `NO_PERMISSION`); các lý do khác của thao tác
phân quyền (tự đổi mình, SuperAdmin cuối cùng) đang do API trả về và hiển thị qua `lockReason` / thông báo lỗi.
