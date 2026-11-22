# 4.2.8 Khái niệm xuyên suốt

## Xử lý lỗi

| Tầng | Cách làm |
|---|---|
| API | Ném `HttpException` chuẩn Nest (`NotFound`, `Forbidden`, `Conflict`, `BadRequest`, `Unauthorized`, `TooManyRequests`) → `Rfc9457ExceptionFilter` trả **Problem Details** (`application/problem+json`) |
| Mã lỗi nghiệp vụ | `409 OUT_OF_SYNC` (kèm `missingOps`), `412` (lệch ETag), `429` (hàng đợi biên dịch) |
| Dịch vụ phụ không được làm mất thao tác chính | `RevisionService.beforeSave` bắt mọi lỗi (không ném); `audit()` bọc try/catch; `TrashService.purgeExpired` ghi cảnh báo |
| Client | Toast (không dùng `alert`), `CompileErrorModal` (phân tích log), trạng thái lưu 6 mức, `ValidationModals` |
| Lỗi biên dịch | Trả JSON lỗi + log, **không bao giờ trả PDF rỗng giả** (`/api/compile-latex`); PDF dự phòng chỉ dùng cho test/dev không có TeX |

## Kiểm tra dữ liệu vào

* **Zod** là nguồn duy nhất (`packages/contracts`, `doc-model/schemas`, `journal-profiles/schemas`); `ZodValidationPipe` ở controller.
* CSDL có `CHECK` bổ sung (ranh giới an toàn cuối).
* Làm sạch trước khi chèn vào CSS/LaTeX (`lib/theme-config.ts`, `latex-escape.ts`, `escape-tex.ts`).

## Cấu hình

* Biến môi trường; nạp `.env` ở gốc khi dev (`process.loadEnvFile` trong `main.ts`).
* Mẫu: `.env.example`, `.env.prod.example`, `.env.staging.example`, `.env.staging.local` (không commit bí mật thật).
* Web: `NEXT_PUBLIC_API_BASE_URL` (desktop/độc lập), `INTERNAL_API_URL` (rewrite), `NEXT_EXPORT`, `NEXT_STANDALONE`.
* Tính năng bật/tắt: kill-switch biên dịch cục bộ (`localDisabledByFlag`), công tắc Tự động lưu, `RUN_SEED`.

## Ghi log & quan sát

| Mục | Hiện trạng |
|---|---|
| Log API | Nest `Logger` + Fastify logger (tắt ở production), `json-file` 10 MB×3 ở Docker |
| Health | `GET /health` (DB), `/api/health` (web) – dùng cho healthcheck compose |
| Số liệu | Chưa có metrics/tracing (Prometheus/OTel); `GET /compile/status` cho thấy mức bận hàng đợi biên dịch |
| Audit | `audit_logs` cho thao tác quản trị chọn lọc |

## Kiểm thử

| Loại | Công cụ | Vị trí |
|---|---|---|
| Unit/integration API | Vitest | `apps/api/test/{access,assets,identity,journals,manuscripts,platform,sync,users}` |
| Unit worker | Vitest | `apps/worker/test` |
| Package lõi | Vitest | `packages/*/test(s)` |
| Web (component, hook, lib, routing) | Vitest + Testing Library + happy-dom + fake-indexeddb | `apps/web/test`, `apps/web/tests` |
| Kiến trúc | Vitest + dependency-cruiser | `tests/architecture.test.ts`, `pnpm deps:check` |
| Hợp đồng | Vitest | `contracts/tests/openapi-validation.test.ts` |
| JATS | DTD chính thức (cần python+lxml) | `tests/jats-dtd.test.ts`, `scripts/jats` |
| Golden snapshot | JSON | `fixtures/golden/baseline-snapshots.json`, `tests/baseline-parser.test.ts` |
| E2E | Playwright (Chrome) | `e2e/*.spec.ts` (nhập Word→xuất, IME tiếng Việt, lưu bền vững, smoke) |
| CI/CD | Vitest | `tests/ci/gitlab-ci-config.spec.ts`, `scripts/deploy/test-deploy-scripts.sh` |
| Tổng hợp | `pnpm verify` | `scripts/verify-all.ts` (build, schema, test, kiến trúc, giới hạn dòng) |

## Đa ngôn ngữ & tiếng Việt

* Giao diện và thông báo chủ yếu tiếng Việt (chuỗi viết trực tiếp trong mã, chưa có lớp i18n).
* Nội dung bài hai ngôn ngữ (`vi`/`en`): tiêu đề/tóm tắt/từ khóa/đơn vị tiếng Anh, trang tiếng Anh cuối bài.
* Chuẩn hóa Unicode **NFC**, sửa khoảng trắng/tên bị tách ("Nguyễ n"), polyglossia/xeCJK cho LaTeX, e2e IME.
* Tìm kiếm không dấu ở DB (`unaccent`, `pg_trgm`).

## Hiệu năng

| Biện pháp | Nơi |
|---|---|
| Ảo hóa danh sách mục (`@tanstack/react-virtual`) – bài 150 mục chỉ vẽ ~29 thẻ | `SectionCardItem`, `useSectionVirtualizer` |
| Debounce autosave 1,2 s; ghi IndexedDB trước | `AutosaveController` |
| Cache PDF theo hash (client) + cache 30' (server) | `compile-cache.ts`, `CompileService` |
| Compiler Router chuyển việc nặng sang server khi thiết bị yếu/bài lớn | `compiler-client/router` |
| Giải phóng bộ nhớ trong nhập hàng loạt; chỉ gửi ảnh LaTeX dùng | `lib/batch-import` |
| Ảnh content-addressed, tải thẳng S3 | `AssetService` |
| Next `transpilePackages`, `output: standalone` | `next.config.mjs` |
| Cache gói Tectonic bằng volume | `docker-compose.prod.yml` |

## Quy ước mã & giới hạn

* TypeScript nghiêm ngặt, ESLint (`.eslintrc.cjs`), `verify-line-limits.js` giữ mỗi file không phình quá baseline (`scripts/baseline-line-limits.json`).
* Tên theo vai trò: `*.service.ts` (application), `*.controller.ts` (presentation), `*.guard.ts`, `*.module.ts`; `domain/*.ts` là thuần.
* Bình luận mã bằng tiếng Anh; thông báo người dùng bằng tiếng Việt.
