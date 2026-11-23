# 4.6 Cấu trúc tổ chức mã nguồn (bản tóm tắt)

> Phần này mới có bản tóm tắt; mô tả chi tiết từng thư mục con chưa viết.

```
StructPaper/
├─ apps/
│  ├─ api/            NestJS+Fastify. src/main.ts, app.module.ts, modules/<m>/{presentation,application,domain,infrastructure}
│  │                  modules: access, assets, identity, journals, manuscripts (+revisions), platform, sync, users
│  │                  test/<module>, resources/latex (lớp .cls, logo), src/scripts (sinh OpenAPI)
│  ├─ worker/         src/main.ts, worker.module.ts, jobs/{latex-compile,outbox-dispatcher}.processor.ts, runners/{local-process,docker-sandbox}
│  ├─ web/            Next.js 14. src/app (route), features/*, lib/* (logic thuần), components/, context/, platform/, types/, data/templates
│  │                  src-tauri (Rust, tauri.conf.json), test/ + tests/ (Vitest), public/, scripts/export-desktop.mjs
│  └─ api-deprecated/ Backend Java Spring Boot cũ – không còn dùng, loại khỏi workspace
├─ packages/          api-client, compiler-client, contracts, db, doc-diff, doc-model, editor-core, exporters,
│                     ingest-docx, journal-profiles, platform, platform-desktop, platform-web, qc-engine, storage
├─ contracts/         openapi.yaml + test hợp đồng
├─ docker/            db-init.Dockerfile, fonts/, postgres/init-extensions.sql
├─ docker-compose.{dev,staging,prod}.yml, docker-compose.yml
├─ scripts/           ci/ (image-plan, build-image), deploy/, jats/, spikes/, verify-all.ts, verify-line-limits.js
├─ e2e/ , tests/ , fixtures/golden   Playwright, test kiến trúc/CI, snapshot
├─ docs/              tài liệu (srs/ là bộ SRS này), Architecture, Audit, tips, mẫu tạp chí
└─ .gitlab-ci.yml, .github/workflows/release.yml, .dependency-cruiser.js, vitest.workspace.ts, pnpm-workspace.yaml
```

Quy tắc chính: package lõi chỉ phụ thuộc xuống dưới (xem [4.5.1](../4.5-System-Architecture-Technology/01-architecture-overview.md)); trong `apps/api` mỗi module chia 4 lớp; logic chế bản của web đặt ở `apps/web/src/lib` để test thuần.
