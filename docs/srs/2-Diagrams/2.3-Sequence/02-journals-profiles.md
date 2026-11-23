# 2.3.2 Sequence – Tạp chí, Profile, Template (SD-08 … SD-12)

Activity tương ứng: [2.2.2](../2.2-Activity/02-journals-profiles.md).

## SD-08 Tạo tạp chí / sửa định danh / thêm loại bài

```mermaid
sequenceDiagram
    actor M as Manager
    participant W as Web (JournalGeneralTab)
    participant C as JournalAdminController
    participant S as JournalAdminService
    participant PS as ProfileService
    participant DB as PostgreSQL
    M->>W: Nhập thông tin tạp chí
    W->>C: POST /journals
    C->>C: CheckPolicies(canManageJournals)
    C->>S: create(dto, userId)
    S->>DB: INSERT journals
    S->>PS: ensureJournalBaseline(journal)
    PS->>DB: INSERT profile_versions (journal, v1, published)
    S->>DB: INSERT audit_logs (journal.create)
    S-->>W: Journal (ETag = version)
    M->>W: Sửa tên / màu
    W->>C: PATCH /journals/:id (If-Match)
    C->>S: update(id, dto, expectedVersion)
    alt version khớp
        S->>DB: UPDATE journals SET ..., version = version+1
        S->>DB: INSERT audit_logs (journal.update)
        S-->>W: 200 Journal mới
    else lệch
        S-->>W: 412
    end
    M->>W: Thêm loại bài
    W->>C: POST /journals/:id/article-types
    C->>S: addArticleType()
    S->>DB: INSERT article_types
    S->>PS: ensureArticleTypeBaseline(type)
    S->>DB: INSERT audit_logs (article_type.create)
    S-->>W: ArticleType
```

## SD-09 Vòng đời Profile

```mermaid
sequenceDiagram
    actor M as Manager
    participant W as Web (JournalVersionsModal)
    participant C as JournalAdminController
    participant PS as ProfileService
    participant DB as PostgreSQL
    M->>W: Tạo bản nháp
    W->>C: POST /profiles/journal/:id/drafts
    C->>PS: createDraft(scope,id,dto,ability)
    PS->>DB: BEGIN, SELECT max(version), INSERT profile_versions(draft), COMMIT
    PS-->>W: ProfileVersionDto
    M->>W: Sửa config
    W->>C: PATCH .../drafts/:v
    C->>PS: updateDraft()
    PS->>DB: UPDATE config, state='draft'
    M->>W: Kiểm tra
    W->>C: POST .../validate
    C->>PS: validate()
    PS->>PS: Zod parse config
    PS->>DB: UPDATE state='validated'
    PS-->>W: ProfileValidationDto
    M->>W: Xuất bản
    W->>C: POST .../publish
    C->>PS: publish()
    PS->>DB: BEGIN, bản published cũ thành archived, bản mới thành published
    Note over DB: trigger profile_versions_guard chỉ cho đổi state của bản published
    PS->>DB: COMMIT
    PS-->>W: ProfileVersionDto(published)
    M->>W: Rollback
    W->>C: POST /profiles/:scope/:id/rollback {toVersion}
    C->>PS: rollback()
    PS->>DB: INSERT bản sao (version mới) rồi publish
```

## SD-10 Resolve & ghim profile

```mermaid
sequenceDiagram
    participant W as Web (PublishedProfilesSync)
    participant IDB as IndexedDB (profiles)
    participant C as JournalController (@Public)
    participant PR as ProfileResolveService
    participant DB as PostgreSQL
    participant Res as resolveFromTiers
    W->>C: GET /profiles/published
    C->>DB: SELECT profile_versions WHERE state='published'
    C-->>W: tiers
    W->>IDB: put profiles / profileIndex
    W->>Res: resolve(base, journal, articleType)
    Res-->>W: ResolvedProfile
    Note over C,PR: Phía server khi tạo bài
    C->>PR: pinFor(journal, articleTypeCode, requestedPin)
    PR->>DB: SELECT published versions
    PR->>Res: resolveFromTiers(...)
    PR-->>C: {pin, resolved, articleTypeId}
```

## SD-11 Áp dụng profile mới cho các bài

```mermaid
sequenceDiagram
    actor M as Manager
    participant W as Web (ApplyToAllPapersFlow)
    participant C as JournalAdminController
    participant PB as ProfileBulkService
    participant RV as RevisionService
    participant DB as PostgreSQL
    M->>W: Áp dụng cho tất cả bài
    W->>C: POST /journals/:id/apply-profile-to-papers
    C->>PB: applyToPapers(journalId, ability, userId)
    PB->>DB: SELECT manuscripts (journal, chưa xóa)
    loop từng bài
        PB->>RV: tạo revision profile-upgrade
        PB->>DB: UPDATE manuscripts.profile_pin
        PB->>DB: INSERT manuscript_profile_snapshots (profile_upgrade)
    end
    PB->>DB: INSERT audit_logs
    PB-->>W: {upgraded, skipped}
```

## SD-12 Template Builder

```mermaid
sequenceDiagram
    actor M as Người dùng
    participant B as Template Builder (React)
    participant Eng as lib/template-engine
    participant R as /api/templates (Next route)
    participant FS as Thư mục src/data/templates (JSON) / localStorage
    M->>B: Mở /templates/builder
    B->>Eng: nạp defaults (page, zones, elements)
    loop các bước 1 → 4
        M->>B: chỉnh cấu hình
        B->>Eng: validate + css-style-resolver
        Eng-->>B: preview HTML
    end
    M->>B: Lưu
    B->>R: POST /api/templates (StructPaperTemplateFile)
    R->>FS: ghi file/JSON
    R-->>B: id
    M->>B: Xuất JSON
    B-->>M: tải file .json
```
