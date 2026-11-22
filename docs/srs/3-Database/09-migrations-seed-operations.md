# 3.9 Migration, seed & vận hành CSDL

## Migration (Drizzle Kit)

| File | Nội dung |
|---|---|
| `drizzle/0000_init.sql` | Tạo toàn bộ 22 bảng, FK, CHECK, các partial unique index của `profile_versions`, hàm + trigger `profile_versions_guard` |
| `drizzle/0001_manuscript_revision_history.sql` | Thêm cho `manuscript_revisions`: `description`, `kind`, `stats`, `pinned`, `size_bytes`; index `idx_revisions_ms_created` |
| `drizzle/0002_manuscript_trash.sql` | Thêm `manuscripts.deleted_at`, `deleted_by` (FK `users`, SET NULL); index `idx_manuscripts_deleted_at` |

* Sinh migration: `drizzle.config.ts` đọc schema `src/schema/*.ts` → `drizzle-kit generate`; áp dụng: `pnpm db:migrate` (`drizzle-kit migrate`).
* Trigger/hàm thủ công (không do Drizzle sinh) nằm ở cuối `0000_init.sql`.
* Khuyến nghị đã ghi trong audit: nâng cấp DB production từ chuỗi migration cũ cần kế hoạch riêng.

## Extension & schema phụ

`docker/postgres/init-extensions.sql` (chạy khi khởi tạo container Postgres):

| Extension | Dùng cho |
|---|---|
| `uuid-ossp` | sinh UUID |
| `citext` | `users.email`, `journals.slug` không phân biệt hoa/thường |
| `pg_trgm` | tìm kiếm mờ (`ILIKE`) tiêu đề/người dùng |
| `unaccent` | tìm không dấu |
| schema `pgboss` | hàng đợi pg-boss do worker tự tạo bảng |

Container `db-init` (`docker/db-init.Dockerfile`) chạy `pnpm --filter @structpaper/db migrate && … seed` trước khi bật `api`, `worker`, `web`.

## Seed (`packages/db/src/seed.ts`)

Idempotent (kiểm tra tồn tại trước khi chèn):

1. **7 tạp chí VNUHCM** – `vnuhcm-std`, `-hs`, `-ssh`, `-ebl`, `-et`, `-ees`, `-arns` (ARNS `draft`), mỗi tạp chí có màu, ISSN, `latex_cls`, thứ tự và danh sách **loại bài** được nhận (từ 9 mã `ARTICLE_TYPE_LABELS`).
2. **5 vai trò hệ thống** (`is_system = true`): `SuperAdmin`, `JournalManager`, `Editor`, `Author`, `Reviewer`.
3. **SuperAdmin ban đầu** – email `INITIAL_ADMIN_EMAIL` (mặc định `admin@structpaper.org`):
   * Có `INITIAL_ADMIN_PASSWORD` ⇒ tạo `ACTIVE` ngay (mật khẩu băm `scrypt` – định dạng cũ; `PasswordService.verify` chấp nhận cả scrypt lẫn Argon2id).
   * Không có ⇒ tạo `INVITED` + `user_tokens(INVITATION)` kèm token kích hoạt in ra log.
4. Gán vai trò `SuperAdmin` (phạm vi `GLOBAL_SCOPE_ID`).
5. Khi API khởi động, `ProfileService.onModuleInit` bảo đảm có `profile_versions` `base v1` (và v1 cho từng journal/article type) từ quy tắc dựng sẵn trong `packages/journal-profiles`.

## Chỉ mục & hiệu năng

| Bảng | Chỉ mục | Phục vụ truy vấn |
|---|---|---|
| `journals` | `idx_journals_sort`; UNIQUE `slug`, `code` | danh sách tạp chí |
| `article_types` | UNIQUE `(journal_id, code)` | loại bài theo tạp chí |
| `profile_versions` | 6 partial unique + `idx_profile_versions_journal` | phiên bản/bản xuất bản mỗi scope |
| `manuscripts` | `idx_manuscripts_journal`, `idx_manuscripts_deleted_at` | danh sách theo tạp chí; thùng rác |
| `manuscript_profile_snapshots` | `idx_profile_snapshots_ms` | lịch sử ghim |
| `manuscript_revisions` | `idx_revisions_ms_created` | danh sách phiên bản |
| `manuscript_ops` | UNIQUE `op_id` | idempotency |
| `assets` | UNIQUE `storage_key` | tra theo khóa S3 |
| `users` | UNIQUE `email` | đăng nhập |

Gợi ý bổ sung (chưa có trong schema, nên đo trước): index `manuscript_ops(manuscript_id, server_rev)` cho `missing-ops`; index `manuscripts(created_by)`, `manuscript_members(user_id)` cho danh sách "bài của tôi"; GIN trigram trên `manuscripts.title`; dọn định kỳ `refresh_tokens`, `user_tokens`, `idempotency_keys` quá hạn.

## Dữ liệu tăng nhanh – cần dọn

| Dữ liệu | Cơ chế dọn hiện có |
|---|---|
| `manuscripts` đã xóa mềm | Tự xóa vĩnh viễn sau `TRASH_RETENTION_DAYS` (30) |
| `manuscript_revisions` | `HISTORY_CONFIG`: 300 bản không ghim; bản an toàn 90 ngày (giữ ≥ 5) |
| `manuscript_ops` | Chưa có (op tích lũy; checkpoint `kind='sync'` mỗi 20 op cho phép cắt tỉa sau này) |
| `outbox_events` | Chưa có (nên xóa `PROCESSED` cũ) |
| `refresh_tokens`, `user_tokens`, `audit_logs` | Chưa có |

## Biến môi trường liên quan

`DATABASE_URL`, `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_REGION`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `JWT_ACCESS_EXPIRES_IN` (15m), `JWT_REFRESH_EXPIRES_IN` (7d), `COOKIE_SECRET`, `CORS_ORIGIN`, `BODY_LIMIT_BYTES` (64 MB), `TRASH_RETENTION_DAYS`, `COMPILE_CONCURRENCY`, `COMPILE_MAX_QUEUE`, `COMPILE_MAX_PER_USER`, `COMPILE_TIMEOUT_MS`, `INITIAL_ADMIN_EMAIL`, `INITIAL_ADMIN_PASSWORD`, `OPENAI_API_KEY` (web). Mẫu: `.env.example`, `.env.prod.example`, `.env.staging.example`.

## Sao lưu / khôi phục

Sao lưu PostgreSQL (`pg_dump`) **và** bucket S3 cùng thời điểm (DB chỉ giữ metadata `assets`, nội dung ảnh/PDF ở S3). Phía client có sao lưu zip kho IndexedDB (`packages/storage/src/backup`).
