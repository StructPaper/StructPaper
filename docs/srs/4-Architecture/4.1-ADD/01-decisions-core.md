# 4.1.1 Quyết định kiến trúc – Nền tảng, backend, dữ liệu, bảo mật (ADR-01 … ADR-11)

Mỗi ADR gồm: **Bối cảnh · Quyết định · Phương án đã loại · Hệ quả · Bằng chứng trong mã**. Trạng thái: *Chấp nhận* (đang áp dụng), *Lỗi thời* (đã bị thay).

## ADR-01 Monorepo `pnpm` workspace, chia package theo tầng phụ thuộc

* **Trạng thái:** Chấp nhận
* **Bối cảnh:** Web, API, worker, desktop dùng chung mô hình tài liệu, hợp đồng API, bộ xuất, QC. Cần chia sẻ code mà không làm lẫn lộn tầng.
* **Quyết định:** Một repo `pnpm` (`apps/*`, `packages/*`, trừ `apps/api-deprecated`). Package lõi thuần TypeScript, phụ thuộc **chỉ đi xuống**: `doc-model` ← `journal-profiles` ← (`ingest-docx`, `exporters`, `qc-engine`, `editor-core`) ← `storage`; `compiler-client` độc lập; `contracts` dùng chung FE/BE. Luật được thực thi bằng `dependency-cruiser` (`pnpm deps:check`).
* **Phương án đã loại:** nhiều repo (khó đồng bộ phiên bản hợp đồng); một package lớn (không kiểm soát được phụ thuộc).
* **Hệ quả:** (+) tái dùng, test cô lập, `transpilePackages` ở Next. (−) cần giữ luật phụ thuộc; build CI phải theo đúng thứ tự (`contracts → db → api/worker`).
* **Bằng chứng:** `pnpm-workspace.yaml`, `.dependency-cruiser.js` (`no-doc-model-contamination`, `strict-downward-dependencies`, `storage-downward-dependencies`, `compiler-client-boundaries`), `apps/web/next.config.mjs`.

## ADR-02 Backend là *modular monolith* NestJS 10 + Fastify

* **Trạng thái:** Chấp nhận (thay `apps/api-deprecated` Java Spring Boot)
* **Bối cảnh:** Cùng ngôn ngữ TypeScript với frontend, đội nhỏ, tải thấp–trung bình, cần chia module rõ ràng.
* **Quyết định:** Một tiến trình API NestJS chạy trên Fastify với 9 module (Platform, Identity, Users, Access, Assets, Manuscripts, Revisions, Sync, Journals); tiến trình **worker** riêng (NestJS application context + pg-boss) cho việc nền.
* **Phương án đã loại:** microservices (chi phí vận hành lớn so với quy mô); tiếp tục Spring Boot (khác ngôn ngữ, không dùng chung Zod/contract/model).
* **Hệ quả:** (+) một codebase, triển khai đơn giản (3 container ứng dụng). (−) biên dịch LaTeX nặng CPU dễ tranh tài nguyên với API → tách `worker` và giới hạn bằng `CompileQueue`.
* **Bằng chứng:** `apps/api/src/app.module.ts`, `apps/worker/src/main.ts`, `apps/api-deprecated/DEPRECATED.md`.

## ADR-03 PostgreSQL 16 + Drizzle ORM, dữ liệu linh hoạt bằng JSONB

* **Trạng thái:** Chấp nhận (thay H2/MySQL của bản Java)
* **Quyết định:** PostgreSQL với `citext`, `pg_trgm`, `unaccent`, `uuid-ossp`; Drizzle ORM (schema TypeScript + migration SQL). Nội dung bài, cấu hình profile, snapshot, payload để ở `jsonb`; trạng thái bằng `varchar` + `CHECK`; ràng buộc nghiệp vụ nặng bằng **partial unique index** và **trigger** (`profile_versions_guard`).
* **Phương án đã loại:** MySQL (thiếu partial index/jsonb mạnh); chuẩn hóa toàn bộ cây bài thành bảng (quá nhiều JOIN, khó phiên bản hóa); enum Postgres (khó migrate).
* **Hệ quả:** (+) bất biến phiên bản profile do DB bảo đảm; tìm kiếm không dấu. (−) JSON không có schema ở mức DB → phải kiểm bằng Zod ở ứng dụng; migration trigger viết tay.
* **Bằng chứng:** `packages/db/src/schema/*`, `drizzle/0000_init.sql`, `docker/postgres/init-extensions.sql`.

## ADR-04 Phân lớp trong từng module: presentation / application / domain / infrastructure

* **Trạng thái:** Chấp nhận (có khoảng trống thực thi – xem [SAD §9](../4.2-SAD/09-risks-and-technical-debt.md))
* **Quyết định:** Mỗi module có `presentation` (controller, guard, decorator), `application` (service/use-case), `domain` (quy tắc thuần, abstract class làm **token DI** – `MailService`, `StorageService`, `AbilityCacheService`, `SseManagerService`), `infrastructure` (S3, SMTP, cache, SSE thật). Service nhận `DRIZZLE` bằng `@Optional() @Inject('DRIZZLE')` để test không cần DB.
* **Hệ quả:** (+) thay adapter dễ, test thuần. (−) luật dependency-cruiser cho lớp API trỏ `apps/api/src/(domain|application|…)/` nhưng thực tế mã nằm ở `apps/api/src/modules/<m>/…` nên **luật hiện không bắt được vi phạm** (cần sửa pattern).
* **Bằng chứng:** `apps/api/src/modules/*`, `.dependency-cruiser.js`.

## ADR-05 Phân quyền bằng CASL (RBAC + ABAC) và mô hình *capability* cho giao diện

* **Trạng thái:** Chấp nhận
* **Bối cảnh:** Vừa cần vai trò theo tạp chí, vừa cần ACL theo từng bài (thành viên, quyền chung kiểu Google Docs).
* **Quyết định:** `AbilityFactory` dựng `MongoAbility` từ `user_roles` (có phạm vi tạp chí) + `manuscript_members` + `general_access`. Guard `@CheckPolicies` dùng **cùng** hàm điều kiện với danh sách `capabilities` gửi cho UI qua `GET /auth/me`. Ability được cache theo `(userId, permissions_version)`; đổi vai trò/thành viên ⇒ tăng `permissions_version` ⇒ hiệu lực ngay.
* **Phương án đã loại:** if-else theo tên vai trò (khó mở rộng); ACL chỉ ở DB (không biểu diễn được điều kiện theo bản ghi).
* **Hệ quả:** (+) UI và API không thể lệch nhau; quyền theo bài có điều kiện. (−) phải nhớ vô hiệu cache khi đổi quyền; ability phụ thuộc đúng dữ liệu hàng (`subject('Manuscript', row)`).
* **Bằng chứng:** `access/domain/ability.factory.ts`, `capabilities.ts`, `packages/contracts/src/access/capabilities.ts`, `apps/web/src/lib/access`, `docs/Architecture/FRONTEND_ACCESS_CONTROL.md`.

## ADR-06 Phiên: JWT truy cập ngắn hạn + refresh token xoay vòng; Argon2id

* **Trạng thái:** Chấp nhận
* **Quyết định:** Access token JWT 15 phút (`sub`, `pv`); refresh token ngẫu nhiên 7 ngày, lưu **băm SHA-256** ở `refresh_tokens`, đặt trong cookie `httpOnly; sameSite=lax; secure(prod)`, **xoay vòng** mỗi lần dùng. Mật khẩu băm **Argon2id** (64 MB, t=3); vẫn xác thực được băm `scrypt:` cũ. Mọi route mặc định cần token (`APP_GUARD` `JwtAuthGuard`), mở bằng `@Public()`/`@OptionalAuth()`; test "route-audit" ghim danh sách route mở.
* **Hệ quả:** (+) secure-by-default, thu hồi phiên được. (−) cần `JWT_SECRET` mạnh ở production (có giá trị mặc định dev); chưa có 2FA/khóa phiên cũ khi đăng nhập nơi khác.
* **Bằng chứng:** `identity/*`, `access/presentation/guards/jwt-auth.guard.ts`.

## ADR-07 Hợp đồng API dùng chung: Zod → OpenAPI → client sinh tự động; lỗi RFC 9457

* **Trạng thái:** Chấp nhận
* **Quyết định:** Schema Zod ở `packages/contracts` là nguồn sự thật; `apps/api/src/scripts/generate-openapi.ts` sinh `contracts/openapi.yaml`; `packages/api-client` (Orval + axios + TanStack Query) sinh hook/endpoint; `ZodValidationPipe` kiểm đầu vào; lỗi trả theo Problem Details (RFC 9457).
* **Hệ quả:** (+) FE/BE khớp kiểu, có `openapi-validation.test.ts`. (−) phải chạy lại `openapi:generate` + `codegen` khi đổi contract.
* **Bằng chứng:** `packages/contracts`, `contracts/openapi.yaml`, `packages/api-client/orval.config.ts`, `platform/filters/rfc9457-exception.filter.ts`.

## ADR-08 Profile quy định 3 tầng, có phiên bản, bất biến khi đã xuất bản, ghim theo bài

* **Trạng thái:** Chấp nhận
* **Bối cảnh:** Tạp chí đổi quy định theo thời gian nhưng bài cũ phải dàn trang đúng như cũ; mỗi tạp chí/loại bài có quy tắc riêng.
* **Quyết định:** `Base → Journal → ArticleType` gộp bằng `deepMerge` (`resolveFromTiers`, **dùng chung** ở client và server). Mỗi tầng có `profile_versions` với vòng đời `draft → validated → published → archived`; bản published **bất biến** (trigger DB); tối đa 1 published/scope (partial unique). Bài **ghim** `{base, journal, articleType}` + lưu `manuscript_profile_snapshots`. Rollback = tạo bản mới sao chép bản cũ. Nâng cấp bài là thao tác chủ động (hoặc manager áp hàng loạt).
* **Phương án đã loại:** sửa tại chỗ profile (phá bài cũ); nhúng profile vào từng bài (không cập nhật được hàng loạt).
* **Hệ quả:** (+) tái lập được bản in cũ; offline được (cache profile). (−) bảng `profile_versions` tăng dần; cần UI diff trước khi xuất bản.
* **Bằng chứng:** `packages/journal-profiles/src/resolver/*`, `journals/application/profile.service.ts`, trigger ở `0000_init.sql`.

## ADR-09 Mô hình tài liệu chuẩn `Manuscript` v2 (Zod) + bộ chuyển đổi với mô hình UI v1

* **Trạng thái:** Chấp nhận (đang chuyển dần)
* **Quyết định:** `packages/doc-model` định nghĩa cây `Section → Block (8) → Inline (6)` có `id` ổn định, kiểm Zod, không phụ thuộc framework; UI hiện vẫn dùng `CompletePaper` (danh sách phẳng) và chuyển hai chiều bằng `migrateV1toV2`/`adaptV2toV1`; `layoutOverrides.sectionExtras` giữ các tùy chọn không có trong v1.
* **Hệ quả:** (+) exporters/QC/diff dùng chung một mô hình có `id` (diff nhận biết "di chuyển" khác "xóa + thêm"). (−) hai mô hình song song, nguy cơ mất thông tin khi chuyển – đã có test v1↔v2.
* **Bằng chứng:** `packages/doc-model/src/adapters`, `apps/web/src/types/paper.ts`.

## ADR-10 Offline-first: IndexedDB trước, server sau; khóa lạc quan

* **Trạng thái:** Chấp nhận
* **Quyết định:** Mọi lần lưu ghi vào IndexedDB (`StructPaperDB`, Dexie) **luôn**, rồi đẩy lên `PUT/PATCH /manuscripts/:id` với `If-Match`/`rev` (best effort). Mất mạng ⇒ "Đã lưu trên máy" + `outbox`. Xung đột (412/409) ⇒ người dùng chọn "Ghi đè bằng bản của tôi". Bài trên máy chỉ có ở client được coi là của người dùng.
* **Phương án đã loại:** lưu server bắt buộc (không dùng được khi mất mạng/desktop); CRDT (phức tạp, bài ít đồng soạn cùng lúc).
* **Hệ quả:** (+) không mất dữ liệu, dùng được desktop offline. (−) có hai nguồn sự thật cần đồng bộ; cần UI xung đột.
* **Bằng chứng:** `packages/storage`, `apps/web/src/lib/documents/autosave-controller.ts`, `lib/storage/paper-sync.ts`.

## ADR-11 Hai kênh đồng bộ nội dung: autosave tài liệu và op-log (patch + SSE)

* **Trạng thái:** Chấp nhận một phần (kênh op-log chưa được web dùng)
* **Quyết định:** (1) **Autosave tài liệu**: toàn bộ bài lưu ở `manuscripts.metadata`, lịch sử ở `manuscript_revisions`. (2) **Op-log**: `POST /sync/patches` (idempotent theo `opId`, checkpoint mỗi 20 op, phát qua SSE) để dành cho soạn thảo đồng thời/thời gian thực.
* **Hệ quả:** (+) hạ tầng thời gian thực sẵn sàng. (−) hai mô hình lưu có thể lệch nếu sau này bật cả hai; cần quyết định chọn một hoặc bắc cầu (`manuscript_docs` ↔ `metadata.doc`).
* **Bằng chứng:** `modules/sync/*`, `manuscripts.service.ts`; grep cho thấy `apps/web/src` không gọi `/sync/*`.
