# 2.3.3 Sequence – Bài báo, nhập Word, workflow, thùng rác (SD-13 … SD-19)

Activity tương ứng: [2.2.3](../2.2-Activity/03-papers-ingest.md).

## SD-13 Tạo bài mới

```mermaid
sequenceDiagram
    actor A as Author
    participant UI as CreatePaperModal
    participant Sto as UnifiedManuscriptRepository (IndexedDB)
    participant C as ManuscriptController
    participant S as ManuscriptService
    participant PR as ProfileResolveService
    participant DB as PostgreSQL
    A->>UI: Chọn tạp chí, loại bài, tên
    UI->>C: GET /manuscripts/duplicates?title=
    C-->>UI: danh sách trùng
    UI->>Sto: savePaperToIndexedDb(paper)
    UI->>C: POST /manuscripts
    C->>S: createManuscript(dto, userId, ability)
    S->>S: ability.can('create','Manuscript')
    S->>PR: pinFor(journal, articleType, profilePin)
    PR-->>S: {pin, resolved, articleTypeId}
    S->>DB: BEGIN
    S->>DB: INSERT manuscripts (DRAFT)
    S->>DB: INSERT manuscript_members (OWNER)
    S->>DB: INSERT manuscript_docs (docTree rỗng)
    S->>DB: INSERT manuscript_profile_snapshots (create)
    S->>DB: COMMIT
    S-->>UI: ManuscriptResponse
    UI->>UI: router.push(/papers/:id)
```

## SD-14 Nhập một tệp Word

```mermaid
sequenceDiagram
    actor A as Author
    participant UI as UploadView / CreatePaperModal
    participant P as docx-parser (lib) / ingest-docx
    participant Pk as DocxPackage + RawDocVisitor
    participant Rc as RecognizerChain
    participant As as DocAssembler
    participant Nm as Normalizers
    participant V as validation (cổng đầu vào)
    participant Sto as IndexedDB
    participant API as manuscripts API
    A->>UI: Chọn tệp .docx + mẫu
    UI->>P: parse(buffer, fileName)
    P->>Pk: unzip + đọc document.xml, styles, footnotes, media
    Pk-->>P: RawDoc (đã xử lý w:ins/w:del)
    P->>Rc: nhận diện khối (style-map, structure)
    Rc-->>P: RecognizedBlock[]
    P->>As: assemble(front matter, sections, tables, figures, equations, refs)
    As-->>P: Manuscript
    P->>Nm: NFC, spacing VI, citation linker
    P->>P: DrawingML -> SVG -> PNG (trình duyệt)
    P-->>UI: paper + importReport + confidence
    UI->>V: validateIntake(paper)
    V-->>UI: issues (lỗi / cảnh báo)
    UI->>Sto: save paper + ingestSources(blob)
    UI->>API: đồng bộ (POST /manuscripts + ảnh qua /assets)
    UI-->>A: Mở editor + danh sách lỗi
```

## SD-15 Nhập hàng loạt

```mermaid
sequenceDiagram
    actor A as Author
    participant UI as BatchImportPanel
    participant H as useBatchImport
    participant RB as run-batch
    participant L as limiter (đọc=2, biên dịch=3)
    participant D as default-deps
    participant Sto as IndexedDB
    participant API as API
    A->>UI: Chọn N tệp + mẫu
    UI->>H: start(files, templates)
    H->>RB: runBatch(items, deps)
    loop từng tệp (song song theo limiter)
        RB->>L: acquire(read)
        RB->>D: readDocx(file)
        D-->>RB: paper
        RB->>D: savePaper(paper)
        D->>Sto: savePaperToIndexedDb
        D->>API: POST /manuscripts + sync
        RB->>L: acquire(compile)
        RB->>D: compilePdf(paper)
        D->>API: POST /compile/latex
        API-->>D: PDF
        D->>API: lưu PDF lên server
        RB-->>H: progress(item.status)
    end
    H-->>UI: bảng tiến độ
    A->>UI: Hủy / Thử lại / Tải zip
    UI->>H: cancel() / retry()
    H->>RB: AbortSignal
```

## SD-16 Đổi trạng thái workflow

```mermaid
sequenceDiagram
    actor U as Author/Manager
    participant W as Web (status menu)
    participant C as ManuscriptController
    participant S as ManuscriptService
    participant RV as RevisionService
    participant DB as PostgreSQL
    U->>W: Chọn trạng thái
    W->>C: POST /manuscripts/:id/status {status, reason?, note?}
    C->>S: changeStatus(id, dto, userId, ability)
    S->>DB: SELECT manuscripts
    S->>S: kiểm tra VALID_TRANSITIONS (SuperAdmin bỏ qua)
    S->>S: kiểm tra quyền theo bước
    S->>RV: beforeSave(manuscript, {status})
    RV->>DB: INSERT manuscript_revisions (nhãn trạng thái)
    S->>DB: BEGIN
    S->>DB: UPDATE manuscripts SET status, version+1
    S->>DB: INSERT outbox_events (ManuscriptStatusChanged, PENDING)
    S->>DB: COMMIT
    S-->>W: {success, manuscript, outboxEventId, previousStatus, newStatus}
```

## SD-17 Xóa → Thùng rác → Khôi phục / Xóa vĩnh viễn

```mermaid
sequenceDiagram
    actor U as Người dùng
    participant W as Web (PaperMenuItems, TrashView)
    participant MC as ManuscriptController
    participant MS as ManuscriptService
    participant TS as TrashService
    participant DB as PostgreSQL
    U->>W: Xóa bài
    W->>MC: DELETE /manuscripts/:id
    MC->>MS: deleteManuscript(id, ability, userId)
    MS->>MS: ability.can('delete'|'manage')
    MS->>DB: UPDATE manuscripts SET deleted_at, deleted_by
    MS->>DB: INSERT audit_logs (manuscript.trash)
    MS-->>W: {success, movedToTrash:true}
    U->>W: Mở /trash
    W->>MC: GET /manuscripts/trash
    MC->>TS: list(query, ability, userId)
    TS->>DB: SELECT ... WHERE deleted_at IS NOT NULL (lọc theo deleted_by nếu không phải manager)
    TS-->>W: items + daysLeft
    U->>W: Khôi phục
    W->>MC: POST /manuscripts/trash/:id/restore
    MC->>TS: restore() mayRestore?
    TS->>DB: UPDATE deleted_at = NULL
    TS->>DB: INSERT audit_logs (manuscript.restore)
    U->>W: Xóa vĩnh viễn
    W->>MC: DELETE /manuscripts/trash/:id
    MC->>TS: purge() mayPurge?
    TS->>DB: DELETE manuscripts (cascade)
    TS->>DB: INSERT audit_logs (manuscript.purge)
```

## SD-18 Tự động dọn thùng rác

```mermaid
sequenceDiagram
    participant N as NestJS lifecycle
    participant TS as TrashService
    participant T as setInterval (6h)
    participant DB as PostgreSQL
    N->>TS: onModuleInit()
    TS->>TS: purgeExpired()
    TS->>DB: DELETE manuscripts WHERE deleted_at < cutoff RETURNING id,title
    TS->>DB: INSERT audit_logs (manuscript.purge_expired) x N
    TS->>T: tạo timer (unref)
    loop mỗi 6 giờ
        T->>TS: purgeExpired()
        TS->>DB: DELETE ... (như trên)
    end
    N->>TS: onModuleDestroy() -> clearInterval
```

## SD-19 Đổi loại bài & nâng cấp profile

```mermaid
sequenceDiagram
    actor A as Author
    participant W as Web (ArticleTypeField / PaperProfileInfoButton)
    participant C as ManuscriptController
    participant S as ManuscriptService
    participant RV as RevisionService
    participant PR as ProfileResolveService
    participant DB as PostgreSQL
    A->>W: Đổi loại bài
    W->>C: PUT /manuscripts/:id/article-type {code}
    C->>S: changeArticleType()
    S->>RV: tạo revision pre-risk
    S->>PR: pinFor(journal, code)
    S->>DB: BEGIN, UPDATE manuscripts (article_type_id + profile_pin), INSERT manuscript_profile_snapshots, COMMIT
    S-->>W: ArticleTypeChangeResult
    A->>W: Nâng cấp quy tắc
    W->>C: POST /manuscripts/:id/profile/upgrade
    C->>S: upgradeProfile(id, ability)
    S->>PR: pinFor(journal, currentType)
    alt có bản mới
        S->>RV: revision profile-upgrade
        S->>DB: UPDATE profile_pin + INSERT snapshot (profile_upgrade)
        S-->>W: {upgraded:true, profilePin, version}
    else không có
        S-->>W: {upgraded:false}
    end
```
