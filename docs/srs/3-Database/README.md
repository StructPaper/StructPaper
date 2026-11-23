# 3. Database – StructPaper

CSDL chính: **PostgreSQL 16** (Drizzle ORM, `packages/db`), migration trong `packages/db/drizzle/` (`0000_init`, `0001_manuscript_revision_history`, `0002_manuscript_trash`). Ngoài ra có kho cục bộ **IndexedDB** trên client và **object storage S3/MinIO**.

> ⚠️ `docs/DATA_SCHEMA.md` cũ mô tả Spring Boot + H2/MySQL (`documents`, `document_exports`, `revisions`, `assets(sha256)`) – **không còn đúng**. Tài liệu này mô tả schema hiện hành, đối chiếu trực tiếp `packages/db/src/schema/*.ts` và các file SQL migration.

## Mục lục

| File | Nội dung |
|---|---|
| [01-erd-overview.md](01-erd-overview.md) | ERD tổng thể 22 bảng, danh mục bảng, quy ước chung, quan hệ & hành vi xóa |
| [02-identity-access.md](02-identity-access.md) | `users`, `user_tokens`, `refresh_tokens`, `roles`, `permissions`, `user_roles`, `role_permissions` |
| [03-journals-profiles.md](03-journals-profiles.md) | `journals`, `article_types`, `profile_versions` (+ trigger bất biến) |
| [04-manuscripts.md](04-manuscripts.md) | `manuscripts`, `manuscript_members`, `manuscript_visits`, `manuscript_profile_snapshots` |
| [05-sync-revisions.md](05-sync-revisions.md) | `manuscript_docs`, `manuscript_ops`, `manuscript_revisions` |
| [06-assets-compile-platform.md](06-assets-compile-platform.md) | `assets`, `compile_jobs`, `audit_logs`, `outbox_events`, `idempotency_keys` |
| [07-jsonb-structures.md](07-jsonb-structures.md) | Cấu trúc JSON trong các cột JSONB (`config`, `metadata`, `snapshot`, `stats`, …) |
| [08-client-storage-and-object-store.md](08-client-storage-and-object-store.md) | IndexedDB `StructPaperDB`, localStorage, S3/MinIO key, pg-boss, cache |
| [09-migrations-seed-operations.md](09-migrations-seed-operations.md) | Migration, seed (7 tạp chí, 5 vai trò), extension, chỉ mục, vận hành |

## Tóm tắt

* **22 bảng** chia 6 nhóm: Identity & Access (7), Journal & Profile (3), Manuscript (4), Sync & Revision (3), Assets & Compile (2), Platform (3).
* Khóa chính `uuid` (`defaultRandom`) trừ các bảng liên kết (khóa kép) và `idempotency_keys` (khóa chuỗi).
* Thời gian dùng `timestamp with time zone`.
* Trạng thái lưu bằng `varchar` + `CHECK`/enum ở lớp ứng dụng (không dùng enum Postgres).
* Dữ liệu linh hoạt dùng `jsonb` (cấu hình profile, nội dung bài, snapshot, payload).
* Đại đa số FK `ON DELETE CASCADE` theo `manuscripts` → xóa vĩnh viễn một bài kéo theo toàn bộ lịch sử/op/thành viên/asset/job.
