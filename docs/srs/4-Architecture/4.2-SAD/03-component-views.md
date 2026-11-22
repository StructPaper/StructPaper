# 4.2.3 View thành phần (C4 mức 3)

## API (`apps/api`)

```mermaid
flowchart TB
    subgraph HTTP["Fastify + NestJS"]
        MW["helmet · cors · cookie · content-type application/pdf · prefix api/v1"]
        G1["JwtAuthGuard (APP_GUARD) — secure by default"]
        G2["PoliciesGuard (@CheckPolicies)"]
        F1["Rfc9457ExceptionFilter"]
        P1["ZodValidationPipe"]
    end
    subgraph Mods["Module nghiệp vụ"]
        direction LR
        ID["Identity<br/>auth, token, password, mail"]
        US["Users<br/>mời, khóa, danh sách"]
        AC["Access<br/>roles, CASL ability, cache, capability"]
        JR["Journals<br/>journal, article type, profile 3 tầng"]
        MS["Manuscripts<br/>CRUD, status FSM, sharing, trash, duplicates, preview"]
        RV["Revisions<br/>lịch sử, khôi phục, dọn"]
        SY["Sync<br/>patch, SSE, missing-ops"]
        AS["Assets<br/>presigned upload, verify"]
        PL["Platform<br/>compile, queue, health"]
    end
    subgraph Infra["Hạ tầng"]
        DB[("Drizzle → PostgreSQL")]
        S3C["S3StorageService"]
        MAIL["MailService (SMTP/log)"]
        TEC["tectonic / xelatex (child process)"]
        CACHE["AbilityCache · CompileCache · SSE clients (RAM)"]
    end
    MW --> G1 --> G2 --> P1 --> Mods
    Mods --> F1
    ID --> AC
    US --> AC
    MS --> RV
    MS --> JR
    MS --> AC
    SY --> AC
    ID --> MAIL
    US --> MAIL
    AS --> S3C
    MS --> S3C
    PL --> TEC
    Mods --> DB
    AC --> CACHE
    SY --> CACHE
    PL --> CACHE
```

| Module | Trách nhiệm chính | Điểm kiến trúc đáng chú ý |
|---|---|---|
| Identity | Đăng nhập, refresh, kích hoạt, đặt lại mật khẩu | Argon2id + đọc scrypt cũ; token một lần băm SHA-256 |
| Users | Mời/khóa/sửa thành viên | `assertCanAssign`, bất biến SuperAdmin; giao dịch mời + gán vai trò |
| Access | Vai trò, ability CASL, capability | Cùng hàm điều kiện cho guard và `/auth/me` |
| Journals | Tạp chí, loại bài, profile versions | Trigger DB; `resolveFromTiers` dùng chung client; áp hàng loạt |
| Manuscripts | Bài, trạng thái, chia sẻ, thùng rác | FSM `VALID_TRANSITIONS`; outbox cùng giao dịch; `accessOf()` gửi cờ quyền |
| Revisions | Lịch sử | `beforeSave` không bao giờ ném lỗi (không làm mất lần lưu) |
| Sync | Op/patch + SSE | idempotent `opId`, 409 + `missingOps`, checkpoint 20 op |
| Assets | Upload hai bước | kiểm MIME/size/SHA-256/magic bytes |
| Platform | `/compile/latex`, `/compile/status`, `/health` | `CompileQueue` công bằng theo người dùng, 429 khi quá tải |

## Worker (`apps/worker`)

```mermaid
flowchart LR
    BOSS[("pg-boss<br/>schema pgboss")] --> LCP["LatexCompileProcessor<br/>queue compile.latex"]
    BOSS --> OBD["OutboxDispatcherProcessor<br/>queue outbox.dispatch"]
    OBD -->|"PENDING → send"| BOSS
    LCP --> EXP["LatexExporter<br/>@structpaper/exporters"]
    LCP --> RUN{"LatexRunner"}
    RUN --> LOC["LocalProcessRunner"]
    RUN --> DOCK["DockerSandboxRunner"]
    LCP --> S3[("S3 PutObject")]
    LCP --> DB[("compile_jobs, assets")]
    OBD --> DB
```

## Web (`apps/web`)

```mermaid
flowchart TB
    subgraph Routes["App Router (src/app)"]
        PUB["(public): login, activate, invite"]
        MAIN["(authenticate)/(main): papers, templates, permissions, trash, account, settings, upload, extracted, history, preview"]
        WS["(authenticate)/(workspace): papers/[id] (+history), templates/{base,builder,journal/[id]}, trash/[id]"]
        NAPI["api/*: ai/proxy, ai-extract, compile-latex, templates, health"]
    end
    subgraph Feat["features/*"]
        F1[papers] --- F2[editor] --- F3[preview] --- F4[history]
        F5[journals] --- F6[templates] --- F7[sharing] --- F8[permissions]
        F9[trash] --- F10[account] --- F11[auth]
    end
    subgraph Lib["lib/* (logic thuần)"]
        L1["docx-*, omml, drawingml<br/>(nhập Word)"]
        L2["latex-*, jats-export, docx-export*<br/>(xuất)"]
        L3["validation/*<br/>(cổng kiểm tra)"]
        L4["documents/*, storage/*<br/>(autosave, đồng bộ)"]
        L5["access/*<br/>(capability, Gate)"]
        L6["template-engine/*, template-builder/*"]
        L7["batch-import/*"]
        L8["editor/*<br/>(page-turn, pdf-map, autosave status)"]
    end
    subgraph Ctx["context & platform"]
        C1[PaperContext] --- C2[StorageContext] --- C3[EditorSessionContext]
        C4["platform/provider (web|desktop)"]
    end
    subgraph Pk["@structpaper/*"]
        P1[doc-model] --- P2[editor-core] --- P3[storage] --- P4[compiler-client]
        P5[qc-engine] --- P6[journal-profiles] --- P7[doc-diff] --- P8[api-client] --- P9[platform*]
    end
    Routes --> Feat
    Feat --> Lib
    Feat --> Ctx
    Feat --> Pk
    Lib --> Pk
    Ctx --> Pk
```

| Khối | Vai trò |
|---|---|
| `app/` | Định tuyến; nhóm `(public)` không cần đăng nhập, `(authenticate)` bọc `AuthGuard`; `(workspace)` là layout toàn màn hình cho trình soạn/Template |
| `features/` | Mỗi tính năng: `components/`, `hooks/`, đôi khi `access.ts` (chính sách quyền theo nghiệp vụ) |
| `lib/` | Thuần logic (nhập Word, sinh LaTeX/JATS/DOCX, kiểm tra, autosave) – dễ test bằng Vitest |
| `context/` | `PaperContext` (bài đang mở), `StorageContext` (repo hợp nhất IndexedDB+server), `EditorSessionContext` |
| `platform/` | Khởi tạo dịch vụ nền tảng web/desktop theo môi trường |
| `components/` | Layout (`Sidebar`, `BottomNav`, `AuthGuard`), modal chung, toast, UI cơ bản, thẻ cập nhật desktop |

## Các package lõi

```mermaid
flowchart BT
    DM[doc-model]
    JP[journal-profiles] --> DM
    EC[editor-core] --> DM
    QC[qc-engine] --> DM
    QC --> JP
    EX[exporters] --> DM
    EX --> JP
    IN[ingest-docx] --> DM
    IN --> JP
    ST[storage] --> DM
    ST --> EC
    CC[compiler-client] --> DM
    DD[doc-diff]
    CT[contracts]
    DBp[db] --> CT
    AC[api-client] --> CT
    PL[platform]
    PW[platform-web] --> PL
    PD[platform-desktop] --> PL
```

Luật được kiểm bằng `pnpm deps:check` (xem [ADR-01](../4.1-ADD/01-decisions-core.md)). `doc-diff` và `contracts` không phụ thuộc package khác; `db` chỉ phụ thuộc `contracts`.
