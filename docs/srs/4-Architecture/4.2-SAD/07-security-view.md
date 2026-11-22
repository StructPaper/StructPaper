# 4.2.7 View bảo mật

## Mô hình mối đe dọa rút gọn (STRIDE)

| Mối đe dọa | Bề mặt | Biện pháp hiện có | Khoảng trống |
|---|---|---|---|
| **S**poofing – giả danh | Đăng nhập, token | Argon2id; JWT 15 phút; refresh xoay vòng, băm SHA-256, cookie httpOnly/sameSite lax/secure(prod); tài khoản `SUSPENDED` bị từ chối | Không có 2FA; không khóa tài khoản sau nhiều lần sai; `JWT_SECRET` mặc định ở dev |
| **T**ampering – sửa dữ liệu | API, tệp tải lên | Zod validate; CASL từng bản ghi; khóa lạc quan; SHA-256 + magic bytes cho asset; trigger bất biến profile | Cần quét virus/phân tích SVG nếu bật nhận SVG công khai |
| **R**epudiation | Hành động quản trị | `audit_logs` (tạp chí, loại bài, thùng rác); revision kèm `created_by` | Chưa ghi audit cho gán vai trò/mời; chưa có màn hình xem |
| **I**nformation disclosure | Link chia sẻ, preview, lỗi | `general_access` mặc định `RESTRICTED`; khách chỉ đọc khi `VIEWER`; lỗi theo RFC 9457 (không lộ stack); helmet | CSP chỉ bật ở production; presigned URL 15 phút |
| **D**enial of service | `/compile/latex`, upload | `bodyLimit` 64 MiB; `CompileQueue` (60 chờ, 12/người, 429); timeout 300 s; asset ≤ 50 MB | Chưa rate-limit đăng nhập/AI; chưa quota dung lượng/người |
| **E**levation of privilege | Vai trò, chia sẻ | Mặc định từ chối; `canAssignRoles` + `assertCanAssign` theo phạm vi; chỉ SuperAdmin cấp SuperAdmin; bất biến SuperAdmin ≥ 1; JournalManager chỉ trong phạm vi tạp chí | Route `@Public` phải được rà (test route-audit ghim danh sách) |

## Kiểm soát truy cập

```mermaid
flowchart TD
    R[Request] --> A{Route @Public?}
    A -- Có --> H[Handler]
    A -- Không --> T{Bearer JWT hợp lệ và pv khớp?}
    T -- Không --> O{@OptionalAuth?}
    O -- Có --> G[Guest: ability chỉ đọc theo general_access=VIEWER]
    O -- Không --> X401[401]
    T -- Có --> AB[Ability từ cache hoặc dựng mới]
    G --> H
    AB --> P{@CheckPolicies?}
    P -- Không đạt --> X403[403]
    P -- Đạt --> H
    H --> S[Service: ability.can action, subject row]
    S -- Không --> X403
    S -- Có --> OK[200]
```

| Lớp | Cơ chế |
|---|---|
| Vai trò toàn cục/theo tạp chí | `user_roles.scope_journal_id` → CASL (`manage`, `read`, `update`…) |
| Quyền theo bài | `manuscript_members` (5 vai trò) + `created_by` + `general_access` |
| Quyết định biên tập | Chuyển `IN_REVIEW/ACCEPTED/REJECTED/PUBLISHED` cần `manage` |
| Giao diện | `capabilities` (`member:manage`, `role:assign`, `role:grant_superadmin`, `journal:manage`, `manuscript:read_all`, `trash:manage`) và cờ `access` theo bài; ẩn nút **không phải** biện pháp bảo mật |
| Chỉ xem | `ReadOnlyPaperView`: không autosave/sync; nút `data-edit-only` bị ẩn |

## Bảo vệ dữ liệu & bí mật

| Mục | Biện pháp |
|---|---|
| Mật khẩu | Argon2id (64 MB, t=3); đọc được scrypt cũ |
| Token một lần/refresh | Chỉ lưu băm SHA-256; `consumed_at` có điều kiện (chống race) |
| Bí mật cấu hình | Biến môi trường; compose prod dùng cú pháp `${VAR:?bắt buộc}` |
| Khóa OpenAI | Chỉ ở server Next; khóa do client gửi bị loại |
| Tệp Word gốc | Xử lý ở trình duyệt, không rời máy trừ khi người dùng lưu bài |
| Kênh truyền | TLS qua reverse proxy (ngoài repo); cookie `secure` ở production |
| Cập nhật Desktop | Chữ ký minisign (`pubkey` trong `tauri.conf.json`); khóa ký ở `.tauri-keys` (không công bố) |
| Docker | Image `node:22-alpine`, chạy user `node`; Tectonic tải kèm kiểm SHA-256; runner biên dịch có chế độ **Docker sandbox** |
| Lọc đầu vào LaTeX | Escape (`escape-tex`), làm sạch giá trị theme trước khi chèn CSS/LaTeX (`theme-config.ts`) |

## Việc nên làm (khuyến nghị bảo mật)

1. Rate limit `/auth/login`, `/auth/reset-password`, `/api/ai/proxy`; khóa tạm sau N lần sai.
2. Bắt buộc `JWT_SECRET`/`JWT_REFRESH_SECRET` ≥ 32 ký tự khi `NODE_ENV=production` (hiện có giá trị mặc định dev).
3. Ghi `audit_logs` cho mời/gán/gỡ vai trò, đổi quyền chung, đăng nhập thất bại; thêm màn hình xem nhật ký.
4. Chạy biên dịch LaTeX luôn trong sandbox (tắt `\write18`/shell-escape; hiện child process chạy cùng user container).
5. Quản lý vòng đời S3 (dọn tệp mồ côi) và quota theo người dùng.
6. Sửa luật dependency-cruiser cho lớp API để bắt vi phạm phân lớp (xem [ADR-04](../4.1-ADD/01-decisions-core.md)).
