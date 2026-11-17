# StructPaper (Cheban)

Hệ thống chế bản học thuật cho các tạp chí thuộc **ĐHQG-HCM (VNUHCM)**: nhập bài từ DOCX, biên tập,
dàn trang theo mẫu của từng tạp chí và xuất bản PDF (LaTeX / Tectonic).

## Kiến trúc

Monorepo `pnpm` (Node 20, pnpm 9.15.4).

| Thư mục | Vai trò |
|---|---|
| `apps/web` | Giao diện Next.js 14 (App Router), có bản desktop Tauri (`src-tauri`) |
| `apps/api` | REST API NestJS + Fastify (đăng nhập JWT, bài báo, biên dịch LaTeX bằng Tectonic) |
| `apps/worker` | Tác vụ nền (pg-boss): hàng đợi biên dịch, outbox |
| `packages/*` | Thư viện dùng chung: `db` (Drizzle + migration + seed), `contracts`, `doc-model`, `editor-core`, `exporters`, `journal-profiles`, `qc-engine`, `ingest-docx`, ... |
| `apps/api-deprecated` | Backend Java Spring Boot cũ, không còn dùng |

Hạ tầng: **PostgreSQL** (Drizzle ORM) và **MinIO/S3** (lưu file).

## Chạy khi phát triển

Cần Node 20, pnpm và Docker.

```bash
pnpm install
```

**Cách 1: mọi thứ chạy local** (Postgres + MinIO là container):
```bash
docker compose -f docker-compose.dev.yml up -d --build   # api + worker + db + minio
pnpm dev:web                                             # web ở http://localhost:3000
```

**Cách 2: dùng Postgres/MinIO trên VM** (qua VPN). Copy `.env.staging.example` thành `.env.staging.local`, điền thông tin kết nối, rồi:
```bash
docker compose -f docker-compose.staging.yml up -d --build   # api + worker, tự migrate + seed
pnpm dev:web
```

Lệnh hữu ích: `pnpm db:migrate`, `pnpm db:seed`, `pnpm test`, `pnpm lint`, `pnpm verify`.

## Triển khai (VM)

`docker-compose.prod.yml` chỉ **kéo image có sẵn và chạy** (không build), dùng Postgres/MinIO dùng chung trên mạng Docker `infra`.
Mỗi môi trường (staging, production) một thư mục riêng chứa compose + `.env` (mẫu: `.env.prod.example`), cổng và secret khác nhau:

```bash
docker compose up -d      # chạy trong thư mục của môi trường
```

Khi khởi động, `db-init` tự tạo extension, chạy migration và seed trước, rồi mới bật `api`, `worker`, `web`.

Image `api` cần font trong `docker/fonts/` (xem `docker/fonts/README.md`) để PDF giống bản local.
Font có bản quyền nên không commit vào repo.

## Nhánh

`main` (ổn định) ← `staging` ← `dev`.

## Tài liệu thêm

Xem thư mục `docs/` (kiến trúc, schema dữ liệu, quy trình bài báo, công nghệ định dạng).
