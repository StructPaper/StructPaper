# SRS – StructPaper (Cheban)

> **StructPaper** là hệ thống chế bản học thuật cho các tạp chí thuộc **ĐHQG-HCM (VNUHCM)**: nhập bài từ DOCX → biên tập có cấu trúc → dàn trang theo mẫu (profile) của từng tạp chí → xuất **PDF (LaTeX/Tectonic)**, **DOCX**, **XML JATS**.
>
> Bộ tài liệu này được **dựng lại từ mã nguồn thực tế** (monorepo `pnpm`: `apps/api`, `apps/web`, `apps/worker`, `packages/*`) tại thời điểm 2026-11-20. Mọi sơ đồ viết bằng **Mermaid**.

## Mục lục

| # | Thư mục | Nội dung |
|---|---|---|
| 1 | [`1-BRD`](1-BRD/) | Tài liệu yêu cầu nghiệp vụ |
| 1.1 | [Use case](1-BRD/1.1-Use-case.md) | Toàn bộ use case dạng bảng (126 UC, chia theo module) |
| 1.2 | [Function list](1-BRD/1.2-Function-list.md) | Toàn bộ tính năng dạng bảng, kèm trạng thái và nguồn mã |
| 2 | [`2-Diagrams`](2-Diagrams/) | Các sơ đồ |
| 2.1 | [Use Case](2-Diagrams/2.1-Use-Case/) | Sơ đồ use case theo module + tổng quan |
| 2.2 | [Activity](2-Diagrams/2.2-Activity/) | Sơ đồ activity cho từng tính năng (mã `AD-xx`) |
| 2.3 | [Sequence](2-Diagrams/2.3-Sequence/) | Sơ đồ tuần tự tương ứng 1-1 với activity (mã `SD-xx` ↔ `AD-xx`) |
| 2.4 | [Class](2-Diagrams/2.4-Class/) | Class diagram: backend, doc-model, profile, client, compiler |
| 2.5 | [Domain](2-Diagrams/2.5-Domain/) | Domain model, bounded context, state machine |
| 3 | [`3-Database`](3-Database/) | Mô tả chi tiết CSDL PostgreSQL (22 bảng), JSONB, IndexedDB, Object Storage |
| 4 | [`4-Architecture`](4-Architecture/) | Kiến trúc |
| 4.1 | [ADD](4-Architecture/4.1-ADD/) | Architecture Design Decisions (ADR) |
| 4.2 | [SAD](4-Architecture/4.2-SAD/) | Software Architecture Document (các view) |
| 4.3 | [ASR](4-Architecture/4.3-ASR/) | Architecturally Significant Requirements |
| 4.4 | [Fault tree & Utility tree](4-Architecture/4.4-Faulttree-Utilitytree/) | Cây lỗi, cây tiện ích chất lượng |
| 4.5 | [Kiến trúc & công nghệ](4-Architecture/4.5-System-Architecture-Technology/) | Trình bày kiến trúc hệ thống, stack công nghệ, triển khai |
| 4.6 | [Cấu trúc code](4-Architecture/4.6-Code-Structure/) | Cấu trúc tổ chức mã nguồn, mô tả từng thư mục/package |

## Quy ước

* **Actor**: `Guest` (khách mở link), `Author` (người soạn – thành viên bản thảo), `Reviewer`/`Viewer` (chỉ xem), `Editor` (vai trò hệ thống), `JournalManager`, `SuperAdmin`, `System` (worker/scheduler), `Desktop Updater`.
* **Mã**: `UC-<module>-nn` (use case), `FN-<module>-nn` (function), `AD-nn`/`SD-nn` (activity/sequence), `ADR-nn` (quyết định kiến trúc), `ASR-nn`, `FT-nn`.
* **Trạng thái tính năng**: ✅ hoàn thành · 🟡 một phần · ❌ chưa có (theo `docs/Audit/DOI_CHIEU_YEU_CAU_PHAN_MEM_2026-11-20.md` và đọc mã).
* Mermaid không có loại *use case diagram* gốc nên sơ đồ use case dùng `flowchart` (actor = hình chữ nhật bo tròn, use case = hình oval).
* Đường dẫn API đều có tiền tố `/api/v1` (trừ `/health`).

## Nguồn dữ liệu đã quét

`apps/api/src/modules/*` (9 module NestJS) · `apps/worker/src` · `apps/web/src` (≈ 40 route/page, 8 feature) · `packages/*` (15 package) · `packages/db/src/schema` + `drizzle/*.sql` · `contracts/openapi.yaml` · `docker-compose*.yml` · `.gitlab-ci.yml` · `apps/web/src-tauri` · các tài liệu sẵn có trong `docs/` (một số cũ: đề cập Spring Boot/H2/MySQL – **đã thay bằng NestJS/PostgreSQL**; `apps/api-deprecated` là backend Java cũ không còn dùng).

## Lưu ý đồng bộ với tài liệu cũ

`docs/DATA_SCHEMA.md` mô tả backend Spring Boot + MySQL (bảng `documents`, `document_exports`, `revisions`…) – **đã lỗi thời**. Backend hiện hành dùng **NestJS + Fastify + Drizzle ORM + PostgreSQL 16** với 22 bảng (xem [3-Database](3-Database/README.md)). Luồng "documents" kiểu Word ở web hiện được lưu qua `manuscripts` + `manuscript_docs`/`metadata.doc` và đồng bộ qua `lib/documents`.
