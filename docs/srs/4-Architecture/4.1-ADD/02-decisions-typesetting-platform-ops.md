# 4.1.2 Quyết định kiến trúc – Chế bản, nền tảng, vận hành (ADR-12 … ADR-22)

## ADR-12 Sinh PDF bằng LaTeX (Tectonic/XeLaTeX); chọn nơi biên dịch bằng *Compiler Router*

* **Trạng thái:** Chấp nhận
* **Bối cảnh:** Cần PDF đúng chuẩn in của từng tạp chí (font, cột, bảng dài, công thức); nhưng cũng cần xem trước nhanh, dùng offline và không làm quá tải server.
* **Quyết định:** Mô hình → `LatexExporter` → `.tex` theo `ResolvedProfile` (lớp `structpaper-<tạp chí>.cls`) → biên dịch ở một trong 3 môi trường qua cổng `CompilerPort`: **WASM trong Web Worker**, **Tectonic gắn kèm Desktop (Tauri)**, **server** (`POST /compile/latex`, Tectonic/XeLaTeX). `CompilerRouter` chọn bằng **11 luật có thứ tự** (final→server, kill-switch, ưu tiên server, offline→local, thiết bị yếu→server, bài > 40 MB→server, lỗi cục bộ trong 10 phút→server, mặc định→local…). Cache PDF theo hash nội dung ở client; cache 30 phút + hàng đợi có giới hạn ở server.
* **Phương án đã loại:** chỉ biên dịch server (tốn tài nguyên, không offline); chỉ HTML→PDF (không đạt chất lượng in).
* **Hệ quả:** (+) giảm tải server, offline, đa nền tảng. (−) ba môi trường có thể cho kết quả khác (font thay thế → luật 06 `parity`); cần font bản quyền gắn vào image.
* **Bằng chứng:** `packages/compiler-client/src/router/rules/*`, `compile.service.ts`, `compile-queue.ts`, `apps/api/Dockerfile` (Tectonic 0.15.0 có kiểm SHA-256), `docker/fonts`.

## ADR-13 Transactional Outbox + hàng đợi pg-boss cho việc nền

* **Trạng thái:** Chấp nhận (producer chưa đầy đủ)
* **Quyết định:** Sự kiện nghiệp vụ (`ManuscriptStatusChanged`, `OP_APPLIED`) ghi vào `outbox_events` **cùng giao dịch** với thay đổi dữ liệu. Worker `OutboxDispatcher` đọc `PENDING` theo lô 50, chuyển `compile.requested` → hàng đợi pg-boss `compile.latex`, thử lại ≤ 5 lần rồi `FAILED`. `LatexCompileProcessor` nhận job, chạy `LatexRunner` (tiến trình cục bộ hoặc Docker sandbox), lưu PDF lên S3 + `assets`, cập nhật `compile_jobs`.
* **Phương án đã loại:** Redis/BullMQ (thêm hạ tầng); gọi thẳng khi ghi (mất sự kiện khi lỗi).
* **Hệ quả:** (+) không mất sự kiện; không cần broker riêng (dùng chính Postgres). (−) hiện **chưa có producer** phát `compile.requested` trong API; `ManuscriptStatusChanged`/`OP_APPLIED` chưa có consumer.
* **Bằng chứng:** `apps/worker/src/jobs/*`, `manuscript.service.ts#changeStatus`, `sync.service.ts`.

## ADR-14 Tệp nhị phân: content-addressed + tải lên presigned S3 có xác minh

* **Trạng thái:** Chấp nhận
* **Quyết định:** Client tính SHA-256, JSON bài chỉ giữ `asset:<sha256>`; tải lên 2 bước: `upload-intent` (kiểm MIME allow-list, ≤ 50 MB, cấp **presigned PUT 15 phút**, khóa `manuscripts/<id>/<uuid>-<tên>`) → client PUT thẳng S3/MinIO → `upload-complete` (HeadObject, so kích thước, tính lại SHA-256, kiểm **magic bytes**, ghi `assets`). Có thể thay S3 bằng adapter khác nhờ `StorageService` trừu tượng.
* **Hệ quả:** (+) API không "gánh" băng thông; chống giả mạo MIME; dedup ảnh. (−) cần dọn S3 mồ côi (chưa có).
* **Bằng chứng:** `assets/application/asset.service.ts`, `infrastructure/s3-storage.service.ts`, `apps/web/src/lib/documents/document-sync.ts`.

## ADR-15 Web Next.js 14 (App Router) + Desktop Tauri từ bản xuất tĩnh; trừu tượng hóa nền tảng

* **Trạng thái:** Chấp nhận
* **Quyết định:** Một codebase giao diện. `NEXT_EXPORT=true` ⇒ xuất tĩnh cho Tauri (WebView2/WKWebView), `NEXT_STANDALONE=true` ⇒ image Docker. Khác biệt web/desktop gói trong `@structpaper/platform` (`FileService`, `ShellService`, `UpdateService`, `WindowService`) với hai triển khai `platform-web`/`platform-desktop`, nạp theo `Capabilities`. Desktop có Tectonic đi kèm, cập nhật tự động có chữ ký minisign, phát hành qua GitHub Actions (Windows NSIS, macOS DMG).
* **Hệ quả:** (+) một code, hai nền tảng, offline thật. (−) route `api/*` của Next (AI proxy, compile-latex, templates) không chạy trong bản xuất tĩnh → desktop dùng đường khác (`NEXT_PUBLIC_API_BASE_URL`, Tectonic cục bộ).
* **Bằng chứng:** `apps/web/next.config.mjs`, `src-tauri/tauri.conf.json`, `packages/platform*`, `.github/workflows/release.yml`.

## ADR-16 Chiến lược lịch sử phiên bản (kiểu Google Docs, có kiểm soát dung lượng)

* **Trạng thái:** Chấp nhận
* **Quyết định:** Revision **tự động theo nhịp** (nghỉ ≥ 5 phút hoặc ≥ 30 phút), **bản an toàn** trước thao tác rủi ro (đổi tạp chí/loại bài, khôi phục, nâng profile), **bản có tên** (ghim, ≤ 100/bài, tự tạo khi đổi trạng thái workflow). Dedup theo checksum nội dung; thống kê thay đổi (`stats`) tính ở server bằng `doc-diff` (thuần, dùng chung với trình duyệt); dọn theo ngân sách (300 bản không ghim; bản an toàn 90 ngày, giữ ≥ 5). Khôi phục không phá lịch sử (tạo revision `restore`).
* **Hệ quả:** (+) hoàn tác an toàn, dung lượng bị chặn. (−) mỗi snapshot lưu toàn bộ bài (không delta) – ổn với bài vài trăm KB.
* **Bằng chứng:** `revision.service.ts` (`HISTORY_CONFIG`), `packages/doc-diff`.

## ADR-17 Xóa mềm + Thùng rác có thời hạn

* **Trạng thái:** Chấp nhận
* **Quyết định:** Xóa bài chỉ đặt `deleted_at/deleted_by` (giữ lịch sử, thành viên, chia sẻ); ẩn khỏi mọi truy vấn; người xóa hoặc manager khôi phục/xóa vĩnh viễn; tự dọn sau `TRASH_RETENTION_DAYS` (30) bằng timer 6 giờ; chặn xóa bài đã vào quy trình (`NON_DELETABLE_STATUSES`).
* **Bằng chứng:** `trash.service.ts`, migration `0002`.

## ADR-18 Nhập Word chạy **trong trình duyệt**, không gửi tệp lên server

* **Trạng thái:** Chấp nhận
* **Quyết định:** Đọc DOCX (OOXML), nhận diện cấu trúc, chuẩn hóa tiếng Việt, OMML→LaTeX, vẽ lại DrawingML thành PNG đều ở client (`apps/web/src/lib/docx-*`, hỗ trợ bởi `packages/ingest-docx` v2). Nhập hàng loạt dùng limiter (đọc 2 song song, biên dịch 3).
* **Hệ quả:** (+) hoạt động offline/desktop, tải server thấp, bảo mật tệp. (−) chiếm CPU luồng chính (giao diện có thể khựng ~1 s khi đọc tệp lớn – đã ghi nhận); hai bộ đọc (cũ v1 và pipeline v2) cần hợp nhất.
* **Bằng chứng:** `docs/DOCUMENT_WORKFLOW.md §2b, §9`, `lib/batch-import`.

## ADR-19 Trợ lý AI qua proxy phía server của Next, có danh sách cho phép

* **Trạng thái:** Chấp nhận
* **Quyết định:** Giao diện không bao giờ giữ khóa OpenAI. Route `POST /api/ai/proxy` kiểm same-origin (`Sec-Fetch-Site`, `Origin`), giới hạn 50 KB/15 000 ký tự, **allow-list** hành động (7) và model (3), đọc `OPENAI_API_KEY` từ môi trường server, bỏ khóa do client gửi.
* **Hệ quả:** (+) không lộ khóa, hạn chế lạm dụng. (−) không dùng được trong bản desktop tĩnh nếu không có server Next; chưa có rate limit theo người dùng.
* **Bằng chứng:** `apps/web/src/app/api/ai/proxy/route.ts`.

## ADR-20 Xuất bản đa định dạng: LaTeX/PDF, DOCX (thư viện `docx`), JATS 1.2

* **Trạng thái:** Chấp nhận
* **Quyết định:** Ba bộ xuất độc lập trong `packages/exporters` đọc cùng mô hình; JATS kiểm định theo DTD chính thức trong test (khi có Python/lxml); gói XML + hình theo quy ước `articles/<tạp chí>/v-#/i-#/a-#/img-n`. **Cổng kiểm tra đầu ra không chặn** (chỉ cảnh báo, "Vẫn xuất"), trừ khi không có PDF.
* **Bằng chứng:** `packages/exporters`, `tests/jats-dtd.test.ts`, `lib/jats-package.ts`.

## ADR-21 Triển khai bằng Docker Compose với image dựng sẵn; CI GitLab bỏ qua build không đổi

* **Trạng thái:** Chấp nhận
* **Quyết định:** 3 môi trường compose (`dev` build tại chỗ + Postgres/MinIO; `staging` dùng DB/MinIO trên VM qua VPN; `prod` **chỉ kéo image** và dùng Postgres/MinIO dùng chung trên mạng Docker `infra`). Container `db-init` chạy extension + migrate + seed **trước** khi bật `api`, `worker`, `web`. GitLab CI: `plan` (băm nguồn từng image để bỏ qua build không đổi) → `quality` (lint, deps:check, build) → `deploy-scripts` (test script triển khai) → `audit` → `unit-tests` → `build:verify/push` → `deploy:staging|production`. Nhánh `main ← staging ← dev`.
* **Hệ quả:** (+) triển khai lặp lại được, rollback bằng tag image. (−) font bản quyền phải nằm trong repo/image, quản lý bí mật qua `.env` từng thư mục môi trường.
* **Bằng chứng:** `docker-compose*.yml`, `.gitlab-ci.yml`, `scripts/ci/image-plan.mjs`, `scripts/deploy/*`.

## ADR-22 Chiến lược kiểm thử và "guardrail" tự động

* **Trạng thái:** Chấp nhận
* **Quyết định:** Vitest workspace cho package/app (có test kiến trúc `tests/architecture.test.ts`, test cấu hình CI, test hợp đồng OpenAPI, golden snapshot cho bộ đọc Word), Playwright e2e (nhập Word → xuất, IME tiếng Việt, lưu bền vững), dependency-cruiser, giới hạn số dòng/file (`verify-line-limits.js` với baseline), `pnpm verify` chạy tổng hợp.
* **Bằng chứng:** `vitest.workspace.ts`, `e2e/*.spec.ts`, `scripts/verify-all.ts`, `fixtures/golden`.

## Bảng tổng hợp

| ADR | Quyết định | Thuộc tính chất lượng chính |
|---|---|---|
| 01 | Monorepo pnpm, phụ thuộc đi xuống | Bảo trì, tái dùng |
| 02 | Modular monolith NestJS + Fastify + worker | Đơn giản vận hành, hiệu năng |
| 03 | PostgreSQL + Drizzle + JSONB | Toàn vẹn, linh hoạt |
| 04 | Phân lớp module + DI trừu tượng | Kiểm thử được, thay thế adapter |
| 05 | CASL + capability | Bảo mật, nhất quán UI/API |
| 06 | JWT ngắn hạn + refresh xoay vòng + Argon2id | Bảo mật |
| 07 | Zod → OpenAPI → client | Tương thích hợp đồng |
| 08 | Profile 3 tầng bất biến + pin | Khả năng tái lập, thay đổi quy định |
| 09 | Doc-model v2 + adapter | Khả năng mở rộng |
| 10 | Offline-first + khóa lạc quan | Sẵn sàng, độ bền dữ liệu |
| 11 | Hai kênh đồng bộ | Mở rộng thời gian thực |
| 12 | LaTeX + Compiler Router | Chất lượng in, hiệu năng, offline |
| 13 | Outbox + pg-boss | Tin cậy, tách tải |
| 14 | Content-addressed + presigned | Bảo mật, hiệu năng |
| 15 | Next.js + Tauri + platform abstraction | Đa nền tảng |
| 16 | Revision có chính sách | Phục hồi, dung lượng |
| 17 | Xóa mềm + thùng rác | An toàn dữ liệu |
| 18 | Nhập Word ở client | Riêng tư, offline |
| 19 | AI proxy allow-list | Bảo mật khóa |
| 20 | Xuất PDF/DOCX/JATS | Tương thích xuất bản |
| 21 | Compose + CI image-hash | Vận hành, lặp lại |
| 22 | Kiểm thử + guardrail | Chất lượng |
