# Báo cáo khoảng trống: tài liệu kiến trúc (8 PDF) so với mã nguồn hiện tại

Ngày: 2026-11-18. Phương pháp: trích văn bản 8 PDF trong `docs/Architecture`, đối chiếu bảng DB (§5.2), danh mục endpoint (§8.6),
các mục §6–§13 của PDF Backend với `packages/db`, `apps/api`, `apps/worker`, và kiểm tra có/không có tính năng trong `apps/web`,
`packages/*`. Kiểm tra mức này là **tìm kiếm trong mã**: "không tìm thấy" nghĩa là không thấy từ khoá/route tương ứng, chưa đọc từng dòng.
Báo cáo cũ `BAO_CAO_DOI_CHIEU_KIEN_TRUC_V2.md` ghi nhiều mục "100% Đạt"; báo cáo này cho thấy phần đó đúng với *frontend/doc-model*, còn
backend và nhiều tài liệu chuyên đề mới đạt một phần.

## 1. Backend (PDF "Kiến trúc Backend")

### 1.1 Bảng DB (§5.2): có 20 / ~34
Có: `users, user_tokens, refresh_tokens, roles, permissions, role_permissions, user_roles, journals, profile_versions, manuscripts,
manuscript_docs, manuscript_members, manuscript_ops, manuscript_revisions, manuscript_visits*, assets, compile_jobs, outbox_events,
idempotency_keys, audit_logs`  (*`manuscript_visits` không có trong spec).

Thiếu: `user_profiles, user_credentials, auth_identities, auth_sessions, article_types, profile_files, manuscript_assets,
manuscript_profile_snapshots, batches, compile_environments, desktop_releases, desktop_release_assets, client_installs, app_config, api_usage`.
Lệch thiết kế: `journals` dùng `slug/name/settings jsonb` thay vì `code/names/status/sort_order`; mật khẩu nằm ở `users`; `profile_versions`
chưa có phạm vi `article_type`.

### 1.2 Endpoint (§8.6)
| Nhóm | Có | Thiếu / lệch |
|---|---|---|
| identity | login, refresh, logout, activate, reset-password, me | `/auth/logout-all`, `/auth/password/forgot`, `/auth/invitations/accept` (tên khác: `/activate`), `/.well-known/jwks.json` (đang HS256 một khoá, spec: khoá bất đối xứng) |
| users | quản trị mời/xoá lời mời | `/users/me*` (sửa hồ sơ, đổi email/mật khẩu/avatar, danh sách phiên), `/admin/users...` đầy đủ (§6.7) |
| journals | CRUD + profile versions (mới làm) | phạm vi `article_type`, `profile_files` |
| manuscripts | CRUD, status, members, preview, duplicates | xoá mềm (`DELETE` hiện xoá hẳn?), lọc/tìm nâng cao theo spec, `deleted_at` |
| sync | submit-ops / stream (đường dẫn khác spec `PUT /ops`, `GET /events`) | idempotent theo `opId`, 409 + dữ liệu hợp nhất cần đối chiếu |
| revisions | list/create | `PATCH/DELETE` bản có tên, chính sách giữ/cắt tỉa (§6.8) |
| assets | upload-intent/complete | `HEAD /assets/{sha}`, `GET /assets/{sha}/download` (URL ký), quét virus, chuyển đổi TIFF/EMF, GC theo tham chiếu đầy đủ |
| compile | `POST /compile/latex`, `/compile/status` | `compile/environments`, `compile/jobs` (+SSE, DELETE), môi trường bất biến |
| releases / config | — | `GET /desktop/updates/...`, `/admin/releases`, `GET /config/client` |
| ai | proxy nằm ở Next (`/api/ai/proxy`) | `POST /ai/extract` trên API, hạn mức `api_usage` |
| audit / hạ tầng | — | `GET /admin/audit`, `/health/live`, `/health/ready`, `/metrics` |

### 1.3 Cắt ngang (§8, §10, §11)
- Idempotency-Key: bảng có, gần như chưa dùng (1 file).
- Giới hạn tần suất (§8.5): không tìm thấy.
- Phiên đăng nhập (`auth_sessions`, đăng xuất mọi nơi, quản lý thiết bị): không có.
- Quên mật khẩu qua email, đổi email, avatar: không tìm thấy.
- Quan sát (§11): không có metrics Prometheus, tracing, logger Pino theo spec, SLO.
- Bảo mật (§10): có helmet; chưa có RLS, vai trò DB tách quyền, quét chuỗi cung ứng, kiểm soát khoá ký.
- Nền (§9.9, worker): có outbox dispatcher + compile processor; `pg-boss`, các job GC/dọn tải lên dở chưa đủ.

## 2. Biên dịch LaTeX trong trình duyệt + ngoại tuyến (PDF 1)
Không tìm thấy engine WASM (SwiftLaTeX/BusyTeX), cơ chế chọn trình biên dịch (`browser | server | native`), màn hình "Chuẩn bị chế độ ngoại tuyến",
chính sách font nhúng, `TexEnvironment` bất biến ghim vào bản thảo. Có package `compiler-client` (khung). PDF hiện sinh qua API/Docker (tectonic).

## 3. Lưu, hoàn tác, lịch sử phiên bản kiểu Google Docs (PDF 2)
Có: Dexie (`packages/storage`), autosave. Thiếu/mức độ chưa rõ: hệ undo/redo thống nhất theo command, journal thao tác + checkpoint, so sánh hai
phiên bản (`doc-diff` chưa dùng), chính sách giữ/cắt tỉa revision, hợp nhất xung đột 3 chiều, nhiều tab.

## 4. RBAC phía giao diện (PDF 4)
Phần lớn có (`lib/access`, `Gate`, capabilities từ `/auth/me`). Thiếu: bảng khai báo route/`RouteGuard` tập trung, cache quyền cho ngoại tuyến, đo độ lệch.

## 5. Đa nền tảng Web/Desktop + cập nhật tự động (PDF 5)
Có: Tauri, `platform`/`platform-web`/`platform-desktop`, UpdateService. Thiếu phía server: `desktop_releases`, endpoint cập nhật, phát hành dần/chặn/thu hồi,
`client_installs`, CI ký và phát hành.

## 6. Tài liệu v2 (PDF 6–8)
Phần doc-model, ingest-docx, qc-engine, journal-profiles, storage: có. Cần kiểm chéo lại các mục "100%" của báo cáo cũ với mã (đặc biệt pin phiên bản profile,
`manuscript_profile_snapshots`, exporters đa định dạng).

## 7. Đề xuất giai đoạn (có thể bỏ DB và dựng lại)
| GĐ | Nội dung | Ghi chú |
|---|---|---|
| 0 | Squash migration, schema khớp §5 (đủ ~34 bảng), seed lại | được phép dropdb ở staging |
| 1 | Nền API: idempotency, rate limit, health/metrics, `config/client`, audit, xoá mềm | |
| 2 | Danh tính: sessions, logout-all, quên mật khẩu, `/users/me*`, JWKS | cần SMTP/driver mail |
| 3 | Journals hoàn chỉnh: `article_types`, `profile_files`, pin vào bản thảo (`manuscript_profile_snapshots`), nối quy tắc vào PDF | |
| 4 | Assets + compile jobs/environments/SSE, worker pg-boss | |
| 5 | Releases + cập nhật desktop, CI | cần hạ tầng ký |
| 6 | Hoàn tác/lịch sử (PDF 2), RouteGuard (PDF 4) | |
| 7 | Biên dịch WASM + ngoại tuyến (PDF 1) | lớn nhất, rủi ro kỹ thuật cao |
