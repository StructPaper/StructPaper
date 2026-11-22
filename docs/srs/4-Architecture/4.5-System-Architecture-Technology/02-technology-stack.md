# 4.5.2 Công nghệ sử dụng

Phiên bản lấy từ `package.json` / `Cargo.toml` / Dockerfile tại thời điểm viết.

## Nền tảng chung

| Hạng mục | Công nghệ | Ghi chú |
|---|---|---|
| Ngôn ngữ | TypeScript 5 (Node 20/22), Rust (chỉ vỏ Tauri) | |
| Quản lý gói | pnpm 9.15.4 (workspace) | `pnpm-workspace.yaml` |
| Runtime container | `node:22-alpine` | api, worker, web, db-init |
| Kiểm thử | Vitest 2.1 (+ coverage-v8, happy-dom, Testing Library, fake-indexeddb), Playwright 1.64 | |
| Chất lượng | ESLint 8 + `@typescript-eslint` 8, dependency-cruiser 18, `verify-line-limits.js` | |
| Xác thực dữ liệu | Zod 3.23 | dùng ở contracts, doc-model, profile |

## Frontend (`apps/web`)

| Nhóm | Công nghệ |
|---|---|
| Framework | Next.js **14.2.15** (App Router), React 18 |
| Kiểu dáng | Tailwind CSS 3.4, PostCSS, framer-motion 14, lucide-react |
| Trạng thái | zustand 4.5 (store `auth-store`, `editor-core`), React Context, TanStack Query 5 |
| Soạn thảo | TipTap 3 (core, starter-kit, subscript, superscript, ProseMirror), FortuneSheet (bảng tính cho bảng biểu) |
| Công thức | KaTeX 0.16.11 |
| Danh sách lớn | `@tanstack/react-virtual` 3 |
| Nhập Word | mammoth 1.13, `fast-xml-parser` 5, jszip 3 (đọc OOXML), DrawingML tự viết → SVG → PNG (html2canvas/canvas) |
| Xuất | `docx` 9 (Word), jszip (zip), qrcode-generator (QR DOI). Lưu ý: `jspdf`, `html2canvas`, `latex.js`, FortuneSheet có trong `package.json` nhưng **không tìm thấy import trực tiếp** trong `apps/web/src` khi grep (có thể dùng gián tiếp/dynamic import hoặc là phụ thuộc thừa – cần kiểm tra) |
| PDF | pdfjs-dist 3.11 (worker `public/pdf.worker.min.js`) |
| Lưu cục bộ | Dexie 4 (IndexedDB) |
| API client | Orval + axios 1.7 + TanStack Query (package `api-client`) |
| Thông báo | sileo (toast) |

## Backend (`apps/api`) & Worker (`apps/worker`)

| Nhóm | Công nghệ |
|---|---|
| Framework | NestJS **10.4**, Fastify **4.28** (`@nestjs/platform-fastify`), RxJS 7 |
| Bảo mật HTTP | `@fastify/helmet` 11, `@fastify/cors` 9, `@fastify/cookie` 9 |
| Xác thực | `@nestjs/jwt` 12, `@node-rs/argon2` 2 (Argon2id) |
| Phân quyền | `@casl/ability` 7 |
| ORM / DB | Drizzle ORM 0.45, `postgres` (postgres.js) 3.4, drizzle-kit |
| Hàng đợi | pg-boss 10 (trên PostgreSQL, schema `pgboss`) |
| Lưu tệp | AWS SDK v3 (`client-s3`, `s3-request-presigner`) → MinIO/S3 |
| Bất biến | immer 10 (`PatchApplier`) |
| Biên dịch PDF | Tectonic 0.15.0 (Docker; Windows dev dùng `bin/tectonic.exe`), XeLaTeX tùy chọn; runner: process cục bộ hoặc Docker sandbox |
| Email | `MailService` trừu tượng (SMTP/log) |

## Cơ sở dữ liệu & hạ tầng

| Thành phần | Phiên bản / ghi chú |
|---|---|
| PostgreSQL | 16 (+ `citext`, `pg_trgm`, `unaccent`, `uuid-ossp`) |
| MinIO | image `cgr.dev/chainguard/minio` (dev); bất kỳ S3 tương thích ở prod |
| Docker Compose | 4 file: `dev`, `staging`, `prod`, mặc định |
| CI/CD | GitLab CI (`.gitlab-ci.yml`), GitHub Actions (`release.yml`, phát hành Desktop) |
| Script triển khai | `scripts/deploy/*.sh` (có test stub) |

## Desktop (`apps/web/src-tauri`)

| Hạng mục | Công nghệ |
|---|---|
| Vỏ | Tauri **2** (Rust): `tauri-plugin-shell`, `tauri-plugin-updater`, `tauri-plugin-process`; `serde`, `tokio`, `base64`, `uuid` |
| Giao diện | bản xuất tĩnh Next.js (`NEXT_EXPORT=true`, `frontendDist: ../out`), cửa sổ 1400×900 |
| Biên dịch | Tectonic đi kèm (`externalBin`) |
| Cập nhật | `latest.json` trên GitHub Releases, ký minisign (`.tauri-keys`, `pubkey`) |
| Gói cài | Windows NSIS (`installMode: passive`), macOS DMG (arm64) |

## Các package nội bộ

| Package | Công nghệ chính | Vai trò |
|---|---|---|
| `doc-model` | Zod, ulid | Mô hình tài liệu chuẩn |
| `journal-profiles` | Zod | Profile 3 tầng + resolver |
| `editor-core` | immer, zustand | Command bus, store, undo/redo |
| `qc-engine` | – | Luật + chấm điểm QC |
| `ingest-docx` | fast-xml-parser, jszip, comlink | Pipeline nhập Word v2 (worker) |
| `exporters` | docx, jszip | LaTeX, DOCX, JATS, zip, CSL |
| `compiler-client` | jspdf | Router + WASM/Tauri/Remote compiler |
| `storage` | Dexie, jszip | IndexedDB, outbox, backup |
| `doc-diff` | – (thuần) | Diff & fingerprint nội dung |
| `contracts` | Zod | Hợp đồng FE/BE |
| `db` | drizzle-orm, postgres | Schema, migration, seed, client |
| `api-client` | axios, TanStack Query, Orval | Client sinh tự động |
| `platform*` | React, `@tauri-apps/*` | Trừu tượng hóa web/desktop |

## Lý do chọn (tóm tắt)

| Lựa chọn | Lý do |
|---|---|
| TypeScript xuyên suốt | Dùng chung model/contract giữa FE, BE, worker, desktop |
| Fastify thay Express | Hiệu năng cao hơn, plugin bảo mật chính thức |
| Drizzle thay TypeORM/Prisma | Kiểu suy ra từ schema, SQL rõ ràng, migration SQL kiểm soát được (trigger, partial index) |
| pg-boss thay Redis | Giảm hạ tầng; outbox cùng DB |
| Tectonic | Một binary tự chứa, tải gói theo nhu cầu, tái lập được trên Docker/Desktop |
| Tauri thay Electron | Nhẹ, an toàn, updater có chữ ký |
| Dexie | API IndexedDB gọn, có migration phiên bản |
