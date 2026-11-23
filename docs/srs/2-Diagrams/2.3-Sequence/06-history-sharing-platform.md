# 2.3.6 Sequence – Lịch sử, chia sẻ, chỉ xem, cập nhật Desktop (SD-30 … SD-34)

Activity tương ứng: [2.2.6](../2.2-Activity/06-history-sharing-platform.md).

## SD-30 Phiên bản tự động & có tên

```mermaid
sequenceDiagram
    actor A as Author
    participant C as ManuscriptController
    participant MS as ManuscriptService
    participant RV as RevisionService
    participant DD as doc-diff
    participant DB as PostgreSQL
    A->>C: PATCH /manuscripts/:id (autosave server)
    C->>MS: updateManuscript(id, dto, userId, ability)
    MS->>RV: beforeSave(manuscript, {doc, status}, userId, now)
    RV->>DD: contentFingerprintSource(prev), (next)
    alt đổi tạp chí
        RV->>DB: INSERT manuscript_revisions (pre-risk)
    else đủ nhịp (idle>=5' hoặc >=30')
        RV->>DD: diffDocs(prev, latest) → stats
        RV->>DB: INSERT manuscript_revisions (auto, checksum, stats, size_bytes)
    end
    opt status đổi
        RV->>DB: INSERT manuscript_revisions (named, pinned)
    end
    RV->>DB: prune (ngân sách 300, bản an toàn 90 ngày)
    MS->>DB: UPDATE manuscripts SET metadata, version+1
    A->>C: POST /manuscripts/:id/revisions {name, description}
    C->>RV: createNamed()
    RV->>DB: INSERT (named, pinned=true), kiểm giới hạn 100
```

## SD-31 Khôi phục, so sánh, nhân bản phiên bản

```mermaid
sequenceDiagram
    actor A as Author
    participant H as PaperHistoryView
    participant C as ManuscriptController
    participant RV as RevisionService
    participant DD as doc-diff (web)
    participant DB as PostgreSQL
    A->>H: Mở /papers/:id/history
    H->>C: GET /manuscripts/:id/revisions
    C->>RV: list(id, query, ability)
    RV->>DB: SELECT (kind <> 'sync') ORDER BY created_at DESC
    RV-->>H: RevisionListDto
    A->>H: Chọn so sánh
    H->>C: GET /manuscripts/:id/revisions/:rid
    C-->>H: snapshot
    H->>DD: diffDocs(current, snapshot)
    DD-->>H: diff khối + inline
    A->>H: Khôi phục
    H->>C: POST /revisions/:rid/restore
    C->>RV: restore(id, rid, userId, ability)
    RV->>DB: INSERT revision pre-risk (Trước khi khôi phục)
    RV->>DB: UPDATE manuscripts WHERE version = current (optimistic)
    RV->>DB: INSERT revision 'restore'
    RV-->>H: {version, restoredAs}
    A->>H: Nhân bản bài
    H->>C: POST /revisions/:rid/duplicate
    C->>RV: duplicate → ManuscriptService.duplicateFromRevision
```

## SD-32 Chia sẻ bài

```mermaid
sequenceDiagram
    actor O as Owner
    participant M as ShareManuscriptModal
    participant C as ManuscriptController
    participant S as ManuscriptSharingService
    participant AC as AbilityCache
    participant DB as PostgreSQL
    O->>M: Gõ email
    M->>C: GET /manuscripts/people?q=
    C->>S: searchPeople(q, currentUserId)
    S->>DB: SELECT users (ACTIVE, citext ILIKE)
    S-->>M: PersonResult[]
    O->>M: Chọn người + vai trò
    M->>C: POST /manuscripts/:id/members
    C->>S: addMember(id, dto, ability)
    S->>S: assertCanShare (chủ sở hữu/manager)
    S->>DB: UPSERT manuscript_members
    S->>AC: invalidate(userId)
    S-->>M: members
    O->>M: Đặt quyền chung = VIEWER
    M->>C: PUT /manuscripts/:id/general-access
    C->>S: setGeneralAccess()
    S->>DB: UPDATE manuscripts.general_access
```

## SD-33 Chỉ xem, khách & PDF preview

```mermaid
sequenceDiagram
    actor G as Guest / Viewer
    participant W as Web (/papers/[id], ReadOnlyPaperView)
    participant C as ManuscriptController
    participant S as ManuscriptService
    participant PV as ManuscriptPreviewService
    participant SH as ManuscriptSharingService
    participant ST as S3 / Storage
    participant DB as PostgreSQL
    G->>W: Mở link
    W->>C: GET /manuscripts/:id  (@OptionalAuth)
    C->>S: getManuscript(id, ability)
    S->>S: ability.can('read') (VIEWER general access cho guest)
    opt đã đăng nhập & mở qua link công khai
        C->>SH: recordVisit(manuscript, userId)
        SH->>DB: UPSERT manuscript_visits
    end
    S-->>W: manuscript + access{canEdit:false,...}
    W->>C: GET /manuscripts/:id/preview
    C->>PV: read(id, ability)
    PV->>ST: getObject(preview key)
    alt có PDF
        PV-->>W: application/pdf
    else chưa có
        PV-->>W: 404 (người đăng nhập tự biên dịch)
    end
    Note over W,PV: Phía người sửa: sau biên dịch → PUT /manuscripts/:id/preview (%PDF-, ≤64MB)
```

## SD-34 Cập nhật tự động Desktop

```mermaid
sequenceDiagram
    actor U as Người dùng
    participant UI as CheckForUpdateCard / Banner / Toast
    participant US as DesktopUpdateService
    participant TU as tauri-plugin-updater
    participant GH as GitHub Releases (latest.json)
    participant PR as plugin-process
    U->>UI: Khởi động / Kiểm tra cập nhật
    UI->>US: check()
    US->>TU: check()
    TU->>GH: GET latest.json
    GH-->>TU: version, url, signature
    TU-->>US: Update | null
    US-->>UI: có bản mới
    U->>UI: Cập nhật
    UI->>US: downloadAndInstall(onProgress)
    US->>TU: update.downloadAndInstall(DownloadEvent)
    TU->>TU: kiểm minisign bằng pubkey
    TU-->>US: đã cài
    US->>PR: relaunch()
```
