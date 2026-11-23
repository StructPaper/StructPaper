# 4.5.1 Kiến trúc hệ thống (tổng quan)

## Phong cách kiến trúc

| Khía cạnh | Lựa chọn |
|---|---|
| Tổng thể | **Modular monolith** (API NestJS) + **worker** nền + **client giàu logic** (offline-first) |
| Client | SPA/SSR lai (Next.js App Router) với logic chế bản **chạy tại trình duyệt/WebView** (nhập Word, sinh LaTeX/DOCX/JATS, QC, diff) |
| Backend | REST `/api/v1` theo module nghiệp vụ, phân lớp `presentation → application → domain ← infrastructure`, DI của NestJS |
| Dữ liệu | PostgreSQL (nghiệp vụ + hàng đợi), S3/MinIO (tệp), IndexedDB (offline) |
| Tích hợp bất đồng bộ | Transactional Outbox + pg-boss |
| Đa nền tảng | Web (Docker) và Desktop (Tauri) từ cùng mã, ngăn cách bằng `@structpaper/platform` |
| Phân quyền | CASL (RBAC + ABAC theo bản ghi) + capability cho UI |

## Sơ đồ phân tầng tổng thể

```mermaid
flowchart TB
    subgraph L1["Tầng trình bày (apps/web)"]
        UI["Next.js App Router · React 18 · Tailwind<br/>features/*: papers, editor, preview, history, journals, templates, sharing, permissions, trash, account"]
    end
    subgraph L2["Tầng logic phía client (apps/web/src/lib + packages)"]
        direction LR
        ING["Nhập Word<br/>docx-*, ingest-docx"]
        EDI["Lõi soạn thảo<br/>editor-core, doc-model"]
        QCE["QC<br/>qc-engine, validation"]
        EXPO["Xuất<br/>exporters (LaTeX, DOCX, JATS)"]
        CMP["Biên dịch<br/>compiler-client"]
        DIF["Lịch sử/diff<br/>doc-diff"]
        PRF["Quy tắc<br/>journal-profiles"]
    end
    subgraph L3["Tầng lưu trữ & nền tảng phía client"]
        STO["storage (IndexedDB, outbox, backup)"]
        PLT["platform / platform-web / platform-desktop"]
        APIC["api-client (OpenAPI → TanStack Query)"]
    end
    subgraph L4["Tầng dịch vụ (apps/api)"]
        direction LR
        P4["presentation<br/>controller · guard · pipe · filter"]
        A4["application<br/>service / use case"]
        D4["domain<br/>quy tắc thuần · token DI"]
        I4["infrastructure<br/>S3 · mail · cache · SSE"]
    end
    subgraph L5["Tầng nền (apps/worker)"]
        W5["pg-boss: compile.latex · outbox.dispatch"]
    end
    subgraph L6["Tầng dữ liệu"]
        PG[("PostgreSQL 16")]
        S3[("S3 / MinIO")]
    end
    L1 --> L2
    L1 --> L3
    L2 --> L3
    L3 -->|"HTTPS /api/v1"| P4
    P4 --> A4 --> D4
    A4 --> I4
    I4 --> S3
    A4 --> PG
    W5 --> PG
    W5 --> S3
```

## Nguyên tắc kiến trúc

1. **Dữ liệu hóa quy tắc** – quy định tạp chí là dữ liệu có phiên bản, không phải mã (ADR-08).
2. **Local-first** – IndexedDB là nơi ghi đầu tiên; server là bản sao đồng bộ (ADR-10).
3. **Một nguồn sự thật cho hợp đồng** – Zod → OpenAPI → client (ADR-07).
4. **Logic thuần, dễ test** – nghiệp vụ chế bản nằm trong package không phụ thuộc framework (ADR-01).
5. **Mặc định từ chối** – guard toàn cục; ẩn UI chỉ là tiện ích, API luôn kiểm lại (ADR-05, 06).
6. **Không mất việc của người dùng** – bản an toàn trước thao tác rủi ro, thùng rác, cổng kiểm tra không chặn.
7. **Đẩy việc nặng đúng chỗ** – Compiler Router chọn cục bộ/server; worker cho việc nền (ADR-12, 13).
8. **Cùng một mã cho web và desktop** – khác biệt nằm sau `PlatformServices` (ADR-15).

## Luồng chính end-to-end

```mermaid
flowchart LR
    W["Word (.docx)"] --> IN["Nhập<br/>(trình duyệt)"]
    IN --> GATE1["Cổng kiểm tra đầu vào"]
    GATE1 --> MODEL["Mô hình bài<br/>(CompletePaper ↔ Manuscript v2)"]
    MODEL --> ED["Biên tập<br/>8 tab + QC"]
    ED --> LOCAL[("IndexedDB")]
    ED -->|"autosave"| SRV[("API + PostgreSQL")]
    ED --> PROFILE["Profile đã resolve<br/>(Base→Journal→ArticleType)"]
    PROFILE --> TEX["LatexExporter → .tex"]
    TEX --> ROUTER{"Compiler Router"}
    ROUTER --> WASM["WASM"]
    ROUTER --> TECT["Tectonic Desktop"]
    ROUTER --> SERVER["Server Tectonic"]
    WASM --> PDF["PDF"]
    TECT --> PDF
    SERVER --> PDF
    MODEL --> DOCX["DocxExporter → .docx"]
    MODEL --> JATS["JatsExporter → .xml (+ zip hình)"]
    PDF --> GATE2["Cổng kiểm tra đầu ra"]
    DOCX --> GATE2
    JATS --> GATE2
    GATE2 --> OUT["Tải về / lưu bản xuất"]
```

## Ranh giới và phụ thuộc

| Ranh giới | Quy tắc |
|---|---|
| `doc-model` | Không phụ thuộc React, DOM, `apps/*`, package khác |
| `exporters`, `qc-engine`, `ingest-docx`, `editor-core` | Chỉ phụ thuộc `doc-model` (+ `journal-profiles` trừ `editor-core`) |
| `storage` | Chỉ `doc-model`, `editor-core` |
| `compiler-client` | Không React, không `apps/*`, chỉ `doc-model` |
| `apps/api` module | `domain` không phụ thuộc `application/presentation/infrastructure` (luật nêu trong `.dependency-cruiser.js`, hiện cần sửa pattern – xem [SAD D4](../4.2-SAD/09-risks-and-technical-debt.md)) |
| `apps/web` ↔ API | Chỉ qua `@structpaper/api-client` / `DocumentApi` và `contracts` |
