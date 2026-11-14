# Báo Cáo Rà Soát Đối Soát Toàn Diện: Backend (NestJS), Frontend (Next.js) & Tài Liệu Thiết Kế Backend Chi Tiết

- **Dự án:** StructPaper v2 (VNUHCM Scientific Publishing Suite)
- **Tài liệu đối chiếu:** `docs/Architecture/Kiến trúc Backend (NestJS, PostgreSQL) — Thiết kế chi tiết (1).pdf` (82 trang, cập nhật 13/11/2026)
- **Ngày rà soát:** 15/11/2026
- **Trạng thái thực thi:** feat/nestjs-backend-and-frontend-sync

---

## 1. Tóm Tắt Điều Hành (Executive Summary)

Quá trình chuyển dịch kiến trúc toàn diện từ stack cũ (Spring Boot, MySQL) sang **NestJS, PostgreSQL, pg-boss, Drizzle ORM, MinIO S3** đang diễn ra đúng hướng theo triết lý *Modular Monolith*.

| Thành phần | Mức độ hoàn thiện theo PDF | Tình trạng cốt lõi |
| :--- | :---: | :--- |
| **Backend (NestJS API & Worker)** | **~65%** | Đã hoàn thành các trụ cột sống còn: Xác thực JWT/Argon2id, Phân quyền RBAC 3 lớp tích hợp CASL, Bản thảo CRUD, Đồng bộ OT Immer Patch theo thời gian thực (SSE), Tải lên tệp qua S3 presigned URL, và Worker biên dịch LaTeX qua pg-boss. <br>Đang thiếu: Module Tạp chí (Journals) & Profile phiên bản, Compile Jobs REST API bất đồng bộ, Nhóm API tự quản lý tài khoản (`/users/me`), Quản trị người dùng nâng cao (Khóa/Mở khóa, Xóa ẩn danh, Import CSV), Desktop Releases và Audit logs viewer. |
| **Frontend (Next.js Web App)** | **~60%** | Đã xây dựng giao diện hiện đại: Đăng nhập chuẩn Production, Quản lý bài báo gọi API thật (`/papers`), Quản lý phân quyền RBAC (`/permissions`) đồng bộ thiết kế Eatzy, Trình soạn thảo (Editor) kèm Live Preview đa định dạng (HTML/LaTeX/Typst). <br>Đang thiếu: Trang kích hoạt tài khoản/đặt mật khẩu (`/invite`), Trang quên/đặt lại mật khẩu, Trang Lịch sử phiên bản thực tế (`/history`), UI quản lý thành viên bản thảo, UI chuyển trạng thái nộp duyệt bài, và kết nối Template Builder với Backend Journals API. |

---

## 2. Rà Soát Chi Tiết 10 Giai Đoạn Triển Khai (B0 - B9)

### Giai đoạn B0: Nền tảng Monorepo & CI
- **Yêu cầu tài liệu PDF (Mục 3.7, 4.1, 4.4, 11.4, 12.4, 14 - Trang 75)**:
  - Khung `apps/api` (HTTP) và `apps/worker` (background).
  - Module `platform`: Cấu hình kiểm tra bằng Zod, log Pino có cấu trúc, CLS (AsyncLocalStorage), bộ lọc lỗi RFC 9457 (`application/problem+json`), health check (`/health/live`, `/health/ready`), tắt máy êm (`enableShutdownHooks`).
  - Hợp đồng Zod trong `packages/contracts` sinh OpenAPI 3.1 và SDK `packages/api-client`.
- **Hiện trạng Backend**:
  - Đã có `apps/api` và `apps/worker` tách biệt rõ ràng.
  - Bộ lọc lỗi `Rfc9457ExceptionFilter` và `ZodValidationPipe` hoạt động chuẩn.
  - Script sinh OpenAPI (`pnpm openapi:generate`) và sinh SDK client (`pnpm client:generate`) hoạt động tốt.
  - *Chưa hoàn thiện*: Chưa kích hoạt `enableShutdownHooks` để đóng kết nối SSE và worker an toàn; chưa xuất Prometheus metrics (`/metrics`) và OpenTelemetry traceparent.
- **Hiện trạng Frontend**:
  - Dùng trực tiếp `@structpaper/api-client` (Orval hooks & typed fetch), hiển thị lỗi đúng chuẩn RFC 9457.

---

### Giai đoạn B1: Cơ sở dữ liệu (PostgreSQL & Drizzle ORM)
- **Yêu cầu tài liệu PDF (Mục 5.1 - 5.4 - Trang 16-30)**:
  - Schema Drizzle ORM trong `packages/db` cho toàn bộ các thực thể.
  - Tách người dùng: `users`, `user_profiles` (thông tin khoa học, ORCID, học hàm, đơn vị), `user_credentials` (mật khẩu, đếm sai, khóa tạm).
  - Bảng danh mục: `journals`, `article_types`, `profile_versions`, `profile_files`, `compile_environments`.
  - Bảng phát hành & cấu hình: `desktop_releases`, `desktop_release_assets`, `client_installs`, `app_config`, `api_usage`.
  - Phân tách quyền người dùng DB (`app`, `migrator`, `readonly`).
- **Hiện trạng Backend**:
  - Đã tạo các bảng cốt lõi: `users`, `user_tokens`, `roles`, `permissions`, `user_roles`, `role_permissions`, `refresh_tokens`, `manuscripts`, `manuscript_members`, `manuscript_docs`, `manuscript_ops`, `manuscript_revisions`, `assets`, `compile_jobs`, `outbox_events`, `idempotency_keys`, `audit_logs`. Có lệnh `db:seed` lũy đẳng.
  - *Chưa hoàn thiện*: Bảng `users` đang gộp chung `password_hash` và `display_name`, chưa tách thành `user_profiles` và `user_credentials`. Chưa có các bảng: `article_types`, `profile_versions`, `profile_files`, `compile_environments`, `desktop_releases`, `app_config`, `api_usage`.

---

### Giai đoạn B2: Danh tính & Người dùng (Identity & Users)
- **Yêu cầu tài liệu PDF (Mục 6.1 - 6.7, 8.6 - Trang 34-40)**:
  - Đăng nhập (Argon2id), JWT access token (15 phút), refresh token xoay vòng (chống tái sử dụng).
  - Luồng lời mời: Admin tạo tài khoản -> gửi token lời mời qua email -> người dùng mở liên kết kích hoạt & đặt mật khẩu.
  - Quên mật khẩu & đặt lại mật khẩu bằng token một lần.
  - Quản lý hồ sơ cá nhân (`GET/PATCH /users/me`, đổi email, đổi mật khẩu, quản lý phiên đang mở).
  - Quản trị tài khoản admin (`/admin/users`): Tạm khóa (`suspend`), ngừng dùng (`deactivate`), thu hồi mọi phiên, xóa ẩn danh hóa (`anonymize delete`), nhập hàng loạt CSV.
- **Hiện trạng Backend**:
  - Đã có: `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `POST /auth/activate`, `POST /auth/reset-password`, `GET /auth/me`. Đã có `GET /users`, `POST /users/invite`, `GET /users/:id`, `PATCH /users/:id`.
  - *Chưa hoàn thiện*: Thiếu `POST /auth/logout-all`, `POST /auth/password/forgot` (trả về 202). Thiếu toàn bộ cụm `GET/PATCH /users/me`, `POST /users/me/password`, `POST /users/me/avatar`, `GET/DELETE /users/me/sessions`. Thiếu các hành động quản trị: suspend/reactivate, deactivate, revoke sessions, xóa ẩn danh hóa và import CSV.
- **Hiện trạng Frontend**:
  - Đã có: Trang `/login` chuẩn Production. Trang `/permissions` có Tab phân vai trò và Tab danh sách lời mời (copy link, resend).
  - *Chưa hoàn thiện*: Chưa có trang Kích hoạt tài khoản / Đặt mật khẩu lần đầu (`/invite` hoặc `/auth/activate`). Chưa có trang Quên mật khẩu / Đặt lại mật khẩu (`/forgot-password`, `/reset-password`). Trang `/account` đang là Mock tĩnh cục bộ.

---

### Giai đoạn B3: Phân quyền RBAC (Role-Based Access Control & CASL)
- **Yêu cầu tài liệu PDF (Mục 7.1 - 7.10 - Trang 41-47)**:
  - 6 vai trò chuẩn: `super_admin`, `admin`, `editor`, `production`, `author`, `reviewer`.
  - Phân quyền 3 lớp (Lớp 1: Vai trò theo phạm vi; Lớp 2: Quan hệ tài nguyên chủ sở hữu/thành viên; Lớp 3: Trạng thái tài nguyên).
  - CASL ability builder, từ chối mặc định, bộ nhớ đệm quyền LRU theo `permissions_version`.
  - Chống leo thang đặc quyền (chỉ gán quyền là tập con của mình, chỉ super_admin gán/gỡ admin).
- **Hiện trạng Backend**:
  - Đã có: `AbilityFactory`, `PoliciesGuard`, `AbilityCacheService` (LRU cache), API gán vai trò `POST /roles/assign`, danh mục quyền tĩnh trong `contracts`. Kiểm quyền 3 lớp trong `manuscript.service.ts` và `sync.service.ts`.
  - *Chưa hoàn thiện*: Logic chống leo thang đặc quyền chưa siết chặt; thiếu API gỡ vai trò riêng `DELETE /admin/users/{id}/roles/{assignmentId}`.
- **Hiện trạng Frontend**:
  - Đã có: Trang `/permissions` thiết kế mới cực kỳ chỉnh chu với Tab gán vai trò người dùng, Tab ma trận quyền, và Tab danh sách lời mời.
  - *Chưa hoàn thiện*: Giao diện gán vai trò hiện mới cho phép gán vai trò toàn cục (Global Scope), chưa có Dropdown chọn phạm vi Tạp chí cụ thể (`journalId`).

---

### Giai đoạn B4: Tạp chí, Profile, Bản thảo, Asset
- **Yêu cầu tài liệu PDF (Mục 5.4, 8.7, 9.3, 9.4, 9.5 - Trang 50-57)**:
  - Danh mục Tạp chí (`journals`) và loại bài viết (`article_types`).
  - Vòng đời Profile định dạng 3 tầng (base, journal, article_type) có phiên bản bất biến sau khi publish: `GET /profiles/resolve`.
  - Bản thảo CRUD, quản lý thành viên bản thảo (`manuscript_members`), chuyển trạng thái quy trình (`workflow_status`: draft -> in_review -> proofing -> ready -> published).
  - Asset: Presigned URL S3/MinIO, kiểm magic bytes, loại trùng SHA-256, dọn rác GC.
- **Hiện trạng Backend**:
  - Bản thảo: Đầy đủ CRUD `POST /manuscripts`, `GET /manuscripts` (tìm kiếm, phân trang), `GET /manuscripts/:id`, `PATCH /manuscripts/:id`, `DELETE /manuscripts/:id`.
  - Thành viên bản thảo: Đầy đủ `POST /manuscripts/:id/members`, `DELETE /manuscripts/:id/members/:userId`, `GET /manuscripts/:id/members`.
  - Assets: Đã có quy trình tải lên 2 bước qua S3 presigned URL: `POST /assets/upload-intent` và `POST /assets/upload-complete`.
  - *Chưa hoàn thiện*: Module `journals` hoàn toàn chưa có trong NestJS (`GET /journals`, `GET /journals/{id}/article-types`). Chưa có API Profile có phiên bản (`/profiles/resolve`). Chưa có endpoint chuyên biệt cho máy trạng thái `POST /manuscripts/{id}/status`. Asset chưa có kiểm tra magic bytes và cron dọn rác (GC).
- **Hiện trạng Frontend**:
  - Trang `/papers`: Đã kết nối API `useListManuscripts` của Backend NestJS, có bộ lọc trạng thái, tìm kiếm, phân trang, xóa bài báo, mở bài báo vào Editor.
  - Modal Tạo bài báo (`CreatePaperModal`): Đã hỗ trợ tải file Word (`.docx`) và chọn mẫu tạp chí.
  - *Chưa hoàn thiện*: Trang `/templates` và `/templates/builder` đang lấy và lưu dữ liệu 100% từ IndexedDB nội bộ trình duyệt, chưa kết nối Backend API. Chưa có UI quản lý thành viên bản thảo (mời coauthor, gán reviewer) và UI chuyển trạng thái duyệt bài.

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
| | `/auth/invitations/accept` | POST | ⚠️ Đã có dạng `/auth/activate` | ❌ Chưa có trang kích hoạt |
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
| | `/roles/assign` | POST | ✅ Đã hoàn thành | ✅ Đã tích hợp trên `/permissions` |
| | `/admin/users/{id}/roles/{roleId}` | DELETE | ❌ Chưa có route riêng | ⚠️ Xử lý qua gán lại mảng roles |
| **journals** | `/journals`, `/journals/{id}/article-types`| GET | ❌ Chưa có trong NestJS | ⚠️ FE đang lưu tại IndexedDB |
| | `/profiles/resolve` | GET | ❌ Chưa có trong NestJS | ⚠️ FE dùng hàm gộp nội bộ |
| **manuscripts**| `/manuscripts` (CRUD) | GET/POST/PATCH/DELETE | ✅ Đã hoàn thành đầy đủ | ✅ Đã tích hợp (`/papers`, Editor) |
| | `/manuscripts/{id}/members` | GET/POST/DELETE | ✅ Đã hoàn thành đầy đủ | ❌ Chưa có Modal quản lý thành viên |
| | `/manuscripts/{id}/status` | POST | ⚠️ Đang đi qua generic PATCH | ❌ Chưa có thanh nút đổi trạng thái |
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

## 4. Kế Hoạch Hành Động Ưu Tiên (Action Items)

1. **Ưu tiên 1 - Kích hoạt tài khoản người dùng**:
   - Xây dựng trang Frontend `/invite` (hoặc `/auth/activate`) cho phép người dùng mở liên kết mời, xác thực mã token và đặt mật khẩu lần đầu với phong cách thiết kế mượt mà của Eatzy.
2. **Ưu tiên 2 - Module Tạp chí (Journals) & Profile Backend**:
   - Xây dựng `JournalsModule` trong `apps/api` (`GET /journals`, `GET /journals/:id`, `GET /journals/:id/article-types`).
   - Cung cấp seed dữ liệu 7 tạp chí mặc định chuẩn ĐHQG-HCM (`VNUHCM-STD`, `VNUHCM-HS`, `VNUHCM-ET`, `VNUHCM-EES`, `VNUHCM-SSH`, `VNUHCM-EBL`, `VNUHCM-ARNS`).
   - Kết nối trang `/templates` và `/templates/builder` của Frontend với Backend API.
3. **Ưu tiên 3 - Mở Compile Jobs REST API**:
   - Thêm `POST /compile/jobs` và `GET /compile/jobs/:id` trong `apps/api` để đẩy việc vào pg-boss, kết nối trực tiếp với `LatexCompileProcessor` đã sẵn sàng trong `apps/worker`.
