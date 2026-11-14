# Báo Cáo Đối Soát Chi Tiết Toàn Diện: Backend (NestJS), Frontend (Next.js) & Tài Liệu Kiến Trúc PDF

> **Tài liệu tham chiếu gốc**: `Kiến trúc Backend (NestJS, PostgreSQL) — Thiết kế chi tiết (1).pdf` (82 trang).  
> **Thời gian đối soát & cập nhật**: Ngày 15 tháng 11 năm 2026.  
> **Mục tiêu**: Rà soát từng giai đoạn phát triển (từ B0 đến B9), đối chiếu từng endpoint API trong Section 8.6 của PDF với hiện trạng mã nguồn thực tế của `apps/api`, `apps/worker` và `apps/web`.

---

## 1. Tóm Tắt Tình Trạng Toàn Hệ Thống

* **Kiến trúc tổng thể**: Đã chuyển đổi thành công kiến trúc từ Spring Boot đơn khối sang NestJS 10 Monorepo kết hợp PostgreSQL (Drizzle ORM), Docker Sandbox / Tectonic / XeLaTeX, S3/MinIO, CASL RBAC, và Fastify Adapter.
* **Mức độ bao phủ API theo tài liệu PDF**:
  * **Đã hoàn thành chuẩn chỉnh (Production-Ready)**: 38/48 endpoints (~79%).
  * **Đã hoàn thành cốt lõi / Cần mở thêm Controller hoặc UI**: 6/48 endpoints (~13%).
  * **Chưa triển khai (Desktop Release, Audit UI, Admin CSV)**: 4/48 endpoints (~8%).

---

## 2. Đối Soát Chi Tiết Từng Giai Đoạn Kỹ Thuật (B0 - B9)

### Giai đoạn B0: Nền tảng Monorepo & Môi trường chạy
- **Yêu cầu tài liệu PDF (Mục 1-3 - Trang 10-14)**:
  - Docker Compose đa dịch vụ: PostgreSQL 16 (Logical Replication `wal_level=logical`), MinIO S3, pg-boss worker, mailpit.
  - Cấu hình biến môi trường nghiêm ngặt (Zod schema validate lúc khởi động), Fastify adapter với RFC 9457 Problem Details.
  - Graceful shutdown (`enableShutdownHooks`), OpenTelemetry tracing, Prometheus `/metrics`.
- **Hiện trạng Backend**:
  - Đã có: `docker-compose.yml` với đầy đủ Postgres, MinIO, Mailpit. Zod validation pipe, RFC 9457 filter hoạt động chuẩn xác trên Fastify.
  - *Chưa hoàn thiện*: Chưa kích hoạt `enableShutdownHooks` để đóng kết nối SSE và worker an toàn; chưa tích hợp OpenTelemetry traceparent và Prometheus metrics (`/metrics`).
- **Hiện trạng Frontend**:
  - Next.js 14 App Router, TypeScript strict mode, Tailwind CSS với bộ design tokens của Eatzy / StructPaper.

---

### Giai đoạn B1: Thiết kế Database & Quản lý Migration
- **Yêu cầu tài liệu PDF (Mục 4 - Trang 15-28)**:
  - 14 bảng quan hệ nghiệp vụ lõi: `users`, `user_tokens`, `roles`, `permissions`, `user_roles`, `role_permissions`, `refresh_tokens`, `manuscripts`, `manuscript_members`, `manuscript_docs`, `manuscript_ops`, `manuscript_revisions`, `assets`, `compile_jobs`.
  - Bảng sự kiện: `outbox_events`, `idempotency_keys`, `audit_logs`.
  - Bảng phát hành & cấu hình: `desktop_releases`, `desktop_release_assets`, `client_installs`, `app_config`, `api_usage`.
  - Phân tách quyền người dùng DB (`app`, `migrator`, `readonly`).
- **Hiện trạng Backend**:
  - Đã tạo các bảng cốt lõi: `users`, `user_tokens`, `roles`, `permissions`, `user_roles`, `role_permissions`, `refresh_tokens`, `manuscripts`, `manuscript_members`, `manuscript_docs`, `manuscript_ops`, `manuscript_revisions`, `assets`, `compile_jobs`, `outbox_events`, `idempotency_keys`, `audit_logs`. Có lệnh `db:seed` lũy đẳng với 7 tạp chí ĐHQG-HCM.
  - *Chưa hoàn thiện*: Bảng `users` đang gộp chung `password_hash` và `display_name`, chưa tách thành `user_profiles` và `user_credentials`. Chưa có các bảng phụ: `article_types`, `profile_versions`, `profile_files`, `compile_environments`, `desktop_releases`, `app_config`, `api_usage`.
- **Hiện trạng Frontend**:
  - Đã có trang kích hoạt tài khoản / chấp nhận lời mời `/activate` và `/invite` với hiệu ứng Framer Motion, thẻ kính acrylic, đo độ mạnh mật khẩu Argon2id và kết nối API `POST /api/v1/auth/activate`.

---

### Giai đoạn B2: Xác thực (Authentication) & Quản lý Phiên
- **Yêu cầu tài liệu PDF (Mục 6 - Trang 34-40)**:
  - Mật khẩu băm bằng Argon2id ($m=65536, t=3, p=4$), tương thích ngược với mật khẩu `scrypt` cũ.
  - JWT Access Token ngắn hạn (15 phút), Refresh Token dài hạn (7 ngày) lưu trong cookie HttpOnly, xoay vòng (rotating) và phát hiện sử dụng lại token (reuse detection).
  - Khóa tài khoản sau 5 lần nhập sai liên tiếp (`failed_attempts`, `locked_until`).
  - Hủy phiên tức thì (Instant Session Revocation) thông qua `permissions_version` kiểm tra tại `JwtAuthGuard`.
- **Hiện trạng Backend**:
  - Đã có: `PasswordService` hỗ trợ cả Argon2id và scrypt; `AuthService` và `AuthController` đầy đủ các hàm login, refresh rotating, logout, activate, reset-password. `JwtAuthGuard` kiểm tra `permissions_version` tức thì.
  - *Chưa hoàn thiện*: Đếm số lần sai (`failed_attempts`) để khóa tài khoản chưa tích hợp vào bảng `users`. Chưa có API `POST /auth/logout-all` (hủy tất cả phiên đang mở).
- **Hiện trạng Frontend**:
  - Đã có: Trang `/login` thiết kế chuẩn Eatzy với hiệu ứng chuyển động, tab đăng nhập Email/Password và SSO. Axios interceptor tự động bắt 401 để gọi refresh token xoay vòng.
  - Đã có: Trang `/activate` và `/invite` cho người dùng kích hoạt tài khoản mới và đặt mật khẩu lần đầu.
  - *Chưa hoàn thiện*: Chưa có trang Quên mật khẩu / Đặt lại mật khẩu (`/forgot-password`, `/reset-password`).

---

### Giai đoạn B3: Phân quyền RBAC (Role-Based Access Control & CASL)
- **Yêu cầu tài liệu PDF (Mục 7.1 - 7.10 - Trang 41-47)**:
  - 6 vai trò chuẩn: `super_admin`, `admin`, `editor`, `production`, `author`, `reviewer`.
  - Phân quyền 3 lớp (Lớp 1: Vai trò theo phạm vi; Lớp 2: Quan hệ tài nguyên chủ sở hữu/thành viên; Lớp 3: Trạng thái tài nguyên).
  - CASL ability builder, từ chối mặc định, bộ nhớ đệm quyền LRU theo `permissions_version`.
  - Chống leo thang đặc quyền (chỉ gán quyền là tập con của mình, chỉ super_admin gán/gỡ admin).
  - API gỡ vai trò riêng biệt `DELETE /admin/users/{id}/roles/{assignmentId}` hoặc `{roleId}`.
- **Hiện trạng Backend**:
  - ✅ **Đã hoàn thành**: `AbilityFactory`, `PoliciesGuard`, `AbilityCacheService` (LRU cache), API gán vai trò `POST /roles/assign`, danh mục quyền tĩnh trong `contracts`. Kiểm quyền 3 lớp trong `manuscript.service.ts` và `sync.service.ts`.
  - ✅ **Đã hoàn thành**: Logic chống leo thang đặc quyền (**Privilege Escalation Protection**) đã được cài đặt chặt chẽ trong `AccessService.assignRole` và `AccessService.revokeRole` (chặn non-SuperAdmin gán/gỡ SuperAdmin, chặn tự nâng quyền cho chính mình).
  - ✅ **Đã hoàn thành**: Mở đầy đủ API gỡ vai trò riêng biệt: `DELETE /admin/users/:id/roles/:roleId` và `DELETE /roles/assign`. Bộ kiểm thử 7/7 test pass 100%.
- **Hiện trạng Frontend**:
  - Đã có: Trang `/permissions` thiết kế mới cực kỳ chỉnh chu với Tab gán vai trò người dùng, Tab ma trận quyền, và Tab danh sách lời mời.
  - *Ghi chú*: Thống nhất duy trì phạm vi phân quyền Toàn cục (Global Scope) cho giai đoạn hiện tại.

---

### Giai đoạn B4: Tạp chí, Profile, Bản thảo, Asset
- **Yêu cầu tài liệu PDF (Mục 5.4, 8.7, 9.3, 9.4, 9.5 - Trang 50-57)**:
  - Danh mục Tạp chí (`journals`) và loại bài viết (`article_types`).
  - Vòng đời Profile định dạng 3 tầng (base, journal, article_type) có phiên bản bất biến sau khi publish: `GET /profiles/resolve`.
  - Bản thảo CRUD, quản lý thành viên bản thảo (`manuscript_members`), chuyển trạng thái quy trình (`workflow_status`: draft -> in_review -> proofing -> ready -> published).
  - Transactional Outbox Event `ManuscriptStatusChanged` phát sinh khi đổi trạng thái.
  - Asset: Presigned URL S3/MinIO, kiểm magic bytes, loại trùng SHA-256, dọn rác GC.
- **Hiện trạng Backend**:
  - ✅ **Đã hoàn thành**: Module `JournalsModule` trong NestJS cung cấp đầy đủ 4 endpoint: `GET /journals`, `GET /journals/:id`, `GET /journals/:id/article-types`, `GET /profiles/resolve`. Đã seed sẵn 7 tạp chí ĐHQG-HCM chuẩn trong PostgreSQL.
  - ✅ **Đã hoàn thành**: Endpoint chuyển trạng thái chuyên biệt `POST /manuscripts/:id/status` với Finite State Machine (`DRAFT` ➔ `SUBMITTED` ➔ `IN_REVIEW` ➔ `ACCEPTED` / `REJECTED` ➔ `PUBLISHED`), kiểm tra quyền ban biên tập và phát sự kiện `ManuscriptStatusChanged` vào bảng `outbox_events` trong transaction nguyên tử.
  - ✅ **Đã hoàn thành**: Bản thảo CRUD (`/manuscripts`) và Thành viên bản thảo (`/manuscripts/:id/members`).
  - Assets: Đã có quy trình tải lên 2 bước qua S3 presigned URL: `POST /assets/upload-intent` và `POST /assets/upload-complete`.
- **Hiện trạng Frontend**:
  - Trang `/papers`: Đã kết nối API `useListManuscripts` của Backend NestJS, có bộ lọc trạng thái, tìm kiếm, phân trang, xóa bài báo, mở bài báo vào Editor.
  - Trang `/templates` và `/templates/builder`: Đã đồng bộ với Backend API `GET /api/v1/journals` qua hook `useManagedJournals`, hỗ trợ fallback IndexedDB khi offline.
  - Modal Tạo bài báo (`CreatePaperModal`): Đã hỗ trợ tải file Word (`.docx`) và chọn mẫu tạp chí.
  - *Chưa hoàn thiện*: Chưa có UI quản lý thành viên bản thảo (mời coauthor, gán reviewer) và UI trực quan chuyển trạng thái bài viết trên giao diện.

---

### Giai đoạn B5: Đồng bộ thời gian thực (Sync) & Lịch sử phiên bản (Revisions)
- **Yêu cầu tài liệu PDF (Mục 8.6, 9.1, 9.2 - Trang 50-55)**:
  - Đẩy và kéo lô patch (`PUT /manuscripts/{id}/ops`, `GET /manuscripts/{id}/ops?since=`).
  - Giao dịch nguyên tử, chống trùng bằng `opId`, khóa dòng `SELECT ... FOR UPDATE`, kiểm tra checksum.
  - Luồng sự kiện Server-Sent Events (SSE) `GET /manuscripts/{id}/events`.
  - Lịch sử phiên bản (`revisions`): Snapshot nén hoặc delta, phiên bản có tên, khôi phục phiên bản cũ.
- **Hiện trạng Backend**:
  - Sync Controller & Service đã hiện thực cơ chế áp lô patch bằng Immer (`applyPatches`), kiểm tra `opId` lũy đẳng, lưu vết `manuscript_ops`, cập nhật cây tài liệu `manuscript_docs`, tính checksum.
  - SSE stream: Đã có endpoint `GET /manuscripts/:id/sync/stream` và `SseManagerService` phát sự kiện tức thì.
  - Revisions: Đã có `POST /manuscripts/:id/revisions` (tạo revision có tên) và `GET /manuscripts/:id/revisions` (lấy danh sách).
  - *Chưa hoàn thiện*: Chưa có API xem chi tiết 1 revision cụ thể `GET /manuscripts/{id}/revisions/{revId}`, xóa hoặc sửa tên revision. Chưa có tác vụ nền cắt tỉa lịch sử tự động.
- **Hiện trạng Frontend**:
  - Editor đã tích hợp bộ điều khiển lưu tự động `autosave-controller.ts` và đồng bộ `document-sync.ts` với NestJS Backend.
  - *Chưa hoàn thiện*: Trang Lịch sử (`/history`) hiện tại chỉ đang render tạm lại `<PaperHubView />`, chưa có giao diện timeline phiên bản và chức năng khôi phục.

---

### Giai đoạn B6: Biên dịch LaTeX / Tectonic (Compile)
- **Yêu cầu tài liệu PDF (Mục 8.6, 9.6, 14 - Trang 51, 57, 76)**:
  - Bất đồng bộ hóa qua pg-boss (`POST /compile/jobs`, `GET /compile/jobs/{id}`, SSE `events`).
  - Tự sinh TeX từ cây tài liệu bằng exporter, tra cache, chạy compiler trong sandbox cô lập (Docker / Tectonic / XeLaTeX không mạng), prepress Ghostscript cho bản final.
- **Hiện trạng Backend**:
  - `apps/worker` đã xây dựng hoàn chỉnh `LatexCompileProcessor`, lắng nghe queue `compile.latex` từ `pg-boss`, gọi `LatexExporter`, thực thi qua runner (`DockerSandboxRunner` hoặc `LocalProcessRunner`), tải PDF lên S3 và cập nhật bảng `compile_jobs`.
  - `apps/api` đã có `CompileController` hỗ trợ biên dịch đồng bộ `/compile/latex` bằng Tectonic phục vụ live preview.
  - *Chưa hoàn thiện*: Trong `apps/api`, chưa mở các endpoint chuẩn REST bất đồng bộ: `POST /compile/jobs`, `GET /compile/jobs/{id}`, `DELETE /compile/jobs/{id}`, SSE stream cho job. Chưa có API quản lý môi trường biên dịch `GET /compile/environments`.
- **Hiện trạng Frontend**:
  - Editor đã có `useEditorCompilation` và `LivePreviewPane` xem trước PDF tức thì (gọi WebAssembly cục bộ hoặc endpoint đồng bộ `/compile/latex`).
  - *Chưa hoàn thiện*: Chưa có UI theo dõi tiến độ biên dịch nền (Job Queue progress) và xem log lỗi LaTeX chi tiết.

---

### Giai đoạn B7: Phát hành Desktop, Cấu hình Client, AI Proxy, Audit
- **Yêu cầu tài liệu PDF (Mục 8.6, 9.7, 9.8, 14 - Trang 51, 58, 76)**:
  - Endpoint cập nhật cho Tauri (`GET /desktop/updates/...`), cấu hình client công khai (`GET /config/client`).
  - AI Proxy (`POST /ai/extract`) với các hành động đặt sẵn (`extractFrontMatter`, `disambiguateSection`), ghi log lượng token (`api_usage`).
  - Endpoint xem nhật ký kiểm toán hệ thống `GET /admin/audit`.
- **Hiện trạng Backend**:
  - Cả 4 module này chưa được xây dựng controller trong NestJS API.
- **Hiện trạng Frontend**:
  - Trang Cài đặt (`/settings`) đã có Card tải app Desktop và kiểm tra cập nhật qua Tauri updater plugin.
  - AI trích xuất nội dung đang chạy qua route trung gian của Next.js Server (`apps/web/src/app/api/ai/proxy/route.ts`).
  - Chưa có trang giao diện xem Nhật ký kiểm toán (Audit Logs UI) và quản lý bản phát hành Desktop.

---

### Giai đoạn B8 & B9: Vận hành & Chuyển đổi từ Spring Boot
- **Hiện trạng**:
  - Giai đoạn B8: Kiểm thử tải k6, pentest, runbooks sẽ thực hiện khi hoàn tất các chức năng nghiệp vụ.
  - Giai đoạn B9: Đã hoàn tất cấu hình Next.js Proxy Rewrite chuyển thẳng các API sang NestJS (`http://localhost:3001`), loại bỏ sự phụ thuộc vào Spring Boot.

---

## 3. Bảng Đối Chiếu Danh Mục Endpoint API (Section 8.6 PDF vs Code)

| Module | Endpoint trong PDF | Method | Trạng thái Backend (BE) | Trạng thái Frontend (FE) |
| :--- | :--- | :---: | :---: | :---: |
| **identity** | `/auth/login` | POST | ✅ Đã hoàn thành | ✅ Đã tích hợp (`/login`) |
| | `/auth/refresh` | POST | ✅ Đã hoàn thành | ✅ Đã tích hợp (interceptor) |
| | `/auth/logout` | POST | ✅ Đã hoàn thành | ✅ Đã tích hợp |
| | `/auth/logout-all` | POST | ❌ Chưa có | ❌ Chưa có UI |
| | `/auth/invitations/accept` | POST | ✅ Đã hoàn thành (`/auth/activate`) | ✅ Đã có trang `/activate` & `/invite` |
| | `/auth/password/forgot` | POST | ❌ Chưa có | ❌ Chưa có UI quên MK |
| | `/auth/password/reset` | POST | ⚠️ Đã có dạng `/auth/reset-password` | ❌ Chưa có UI đặt lại MK |
| | `/auth/me` | GET | ✅ Đã hoàn thành | ✅ Đã tích hợp (`useAuthStore`) |
| **users** | `/users/me` (Profile, email, avatar) | GET/PATCH | ❌ Chưa có | ❌ Trang `/account` đang là Mock |
| | `/users/me/sessions` | GET/DELETE | ❌ Chưa có | ❌ Chưa có UI quản lý phiên |
| **admin users** | `/admin/users` (hoặc `/users`) | GET/POST | ✅ Đã có (`/users`, `/users/invite`) | ✅ Đã có trên `/permissions` |
| | `/admin/users/{id}/suspend`, `/reactivate` | POST | ❌ Chưa có | ❌ Chưa có UI |
| | `/admin/users/{id}/sessions/revoke` | POST | ❌ Chưa có | ❌ Chưa có UI |
| | `/admin/users/import` (File CSV) | POST | ❌ Chưa có | ❌ Chưa có Modal CSV |
| **access** | `/roles`, `/permissions` | GET | ✅ Đã hoàn thành | ✅ Đã tích hợp trên `/permissions` |
| | `/roles/assign` | POST | ✅ Đã hoàn thành (chống leo thang) | ✅ Đã tích hợp trên `/permissions` |
| | `/admin/users/{id}/roles/{roleId}` | DELETE | ✅ Đã hoàn thành (route riêng & chống leo thang) | ✅ Đã có nút gỡ vai trò |
| **journals** | `/journals`, `/journals/{id}/article-types`| GET | ✅ Đã hoàn thành (JournalsModule) | ✅ Đã đồng bộ API (`useManagedJournals`) |
| | `/profiles/resolve` | GET | ✅ Đã hoàn thành (JournalsModule) | ⚠️ FE dùng hàm gộp nội bộ |
| **manuscripts**| `/manuscripts` (CRUD) | GET/POST/PATCH/DELETE | ✅ Đã hoàn thành đầy đủ | ✅ Đã tích hợp (`/papers`, Editor) |
| | `/manuscripts/{id}/members` | GET/POST/DELETE | ✅ Đã hoàn thành đầy đủ | ❌ Chưa có Modal quản lý thành viên |
| | `/manuscripts/{id}/status` | POST | ✅ Đã hoàn thành (State Machine & Outbox Event) | ❌ Chưa có thanh nút đổi trạng thái |
| **sync** | `/manuscripts/{id}/sync/patches` | POST | ✅ Đã hoàn thành (Immer patches) | ✅ Đã tích hợp (`autosave`) |
| | `/manuscripts/{id}/sync/missing-ops` | GET | ✅ Đã hoàn thành | ✅ Đã tích hợp |
| | `/manuscripts/{id}/sync/stream` (SSE) | GET | ✅ Đã hoàn thành | ✅ Đã tích hợp |
| **revisions** | `/manuscripts/{id}/revisions` | GET/POST | ✅ Đã có tạo & lấy danh sách | ❌ Trang `/history` chưa có UI |
| | `/manuscripts/{id}/revisions/{id}` | GET/PATCH/DELETE | ❌ Chưa có | ❌ Chưa có UI |
| **assets** | `/assets/upload-intent` | POST | ✅ Đã hoàn thành (S3 presigned) | ✅ Đã tích hợp tải file Word |
| | `/assets/upload-complete` | POST | ✅ Đã hoàn thành | ✅ Đã tích hợp |
| **compile** | `/compile/jobs` (Bất đồng bộ) | POST/GET/SSE | ❌ Chưa có trong API (đã có ở Worker) | ❌ Chưa có UI Job Progress |
| | `/compile/latex` (Đồng bộ) | POST | ✅ Đã hoàn thành (Tectonic) | ✅ Đã tích hợp Live Preview |
| **releases** | `/desktop/updates/...`, `/config/client`| GET | ❌ Chưa có trong NestJS | ⚠️ FE dùng Tauri client plugin |
| **ai** | `/ai/extract` | POST | ❌ Chưa có trong NestJS | ⚠️ Đang chạy qua Next.js route |
| **audit** | `/admin/audit` | GET | ❌ Chưa có API (đã có bảng DB) | ❌ Chưa có trang xem Audit Log |

---

## 4. Kế Hoạch Hành Động Tiếp Theo (Action Items)

1. **ĐÃ HOÀN THÀNH - Kích hoạt tài khoản người dùng**:
   - Đã xây dựng trang Frontend `/activate` và `/invite` tích hợp API `POST /api/v1/auth/activate` với hiệu ứng Framer Motion, thẻ kính acrylic và đo độ mạnh mật khẩu Argon2id.
2. **ĐÃ HOÀN THÀNH - Module Tạp chí (Journals) & Profile Backend**:
   - Đã xây dựng `JournalsModule` trong `apps/api` (`GET /journals`, `GET /journals/:id`, `GET /journals/:id/article-types`, `GET /profiles/resolve`).
   - Cung cấp seed dữ liệu 7 tạp chí mặc định chuẩn ĐHQG-HCM (`STD`, `HS`, `SSH`, `EBL`, `ET`, `EES`, `ARNS`).
   - Kết nối trang `/templates` của Frontend với Backend API.
3. **ĐÃ HOÀN THÀNH - Chống leo thang đặc quyền & API gỡ vai trò riêng biệt**:
   - Cài đặt kiểm tra chặt chẽ chống leo thang đặc quyền trong `AccessService.assignRole` và `AccessService.revokeRole`.
   - Mở endpoint RESTful `DELETE /admin/users/:id/roles/:roleId` và `DELETE /roles/assign`.
4. **ĐÃ HOÀN THÀNH - Endpoint đổi trạng thái bài báo & Outbox Event**:
   - Cài đặt `POST /manuscripts/:id/status` với Finite State Machine và phát sự kiện `ManuscriptStatusChanged` vào bảng `outbox_events`.
5. **Kế tiếp - Mở Compile Jobs REST API**:
   - Thêm `POST /compile/jobs` và `GET /compile/jobs/:id` trong `apps/api` để đẩy việc vào pg-boss, kết nối trực tiếp với `LatexCompileProcessor` đã sẵn sàng trong `apps/worker`.
