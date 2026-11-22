# 2.3.4 Sequence – Soạn thảo, đồng bộ, tài nguyên, AI (SD-20 … SD-24)

Activity tương ứng: [2.2.4](../2.2-Activity/04-editing-sync.md).

## SD-20 Tự động lưu

```mermaid
sequenceDiagram
    actor A as Author
    participant Ed as Editor (PaperContext)
    participant AS as autosave-controller / useDocumentAutosave
    participant IDB as IndexedDB (StructPaperDB)
    participant API as DocumentApi (/api/v1/manuscripts)
    participant RV as RevisionService (server)
    A->>Ed: Sửa nội dung
    Ed->>AS: notify(paper)  [dirty]
    AS->>AS: debounce ~1.2s
    AS->>IDB: put manuscripts (doc + metadata phẳng)
    IDB-->>AS: ok
    AS->>API: PUT /manuscripts/:id (If-Match rev, ảnh asset:sha256)
    alt thành công
        API->>RV: beforeSave(...) (revision theo nhịp)
        API-->>AS: 200 {rev}
        AS-->>Ed: state = saved
    else lệch phiên bản
        API-->>AS: 412
        AS-->>Ed: state = conflict
        A->>Ed: Ghi đè bằng bản của tôi
        Ed->>AS: overwrite()
        AS->>API: PUT (rev mới nhất)
    else offline
        AS-->>Ed: state = saved-local
    end
```

## SD-21 Gửi patch & xung đột

```mermaid
sequenceDiagram
    participant Cl as Client
    participant C as SyncController
    participant S as SyncService
    participant PA as PatchApplier
    participant SSE as SseManagerService
    participant DB as PostgreSQL
    Cl->>C: POST /manuscripts/:id/sync/patches {opId, baseServerRev, clientRev, patches}
    C->>S: submitOps(id, dto, userId, ability)
    S->>DB: SELECT manuscripts, manuscript_ops(opId)
    alt opId đã tồn tại
        S-->>Cl: 200 {serverRev, checksum, opId}
    else baseServerRev < current
        S->>DB: SELECT manuscript_ops WHERE server_rev > base
        S-->>Cl: 409 OUT_OF_SYNC + missingOps
        Cl->>C: GET /sync/missing-ops?sinceRev=
        Cl->>Cl: rebase rồi gửi lại
    else hợp lệ
        S->>PA: apply(docTree, patches)
        PA-->>S: {docTree, checksum}
        S->>DB: BEGIN
        S->>DB: INSERT manuscript_ops
        S->>DB: UPDATE manuscript_docs
        S->>DB: UPDATE manuscripts.current_server_rev
        S->>DB: INSERT outbox_events (OP_APPLIED)
        opt serverRev % 20 == 0
            S->>DB: INSERT manuscript_revisions (kind='sync')
        end
        S->>DB: COMMIT
        S->>SSE: broadcast(manuscriptId, op)
        S-->>Cl: 200 {serverRev, checksum, opId}
    end
    Cl->>C: GET /manuscripts/:id/sync/stream (SSE)
    SSE-->>Cl: event: op
```

## SD-22 Tải ảnh lên

```mermaid
sequenceDiagram
    actor A as Author
    participant UI as useAssetUpload
    participant C as AssetController
    participant S as AssetService
    participant ST as S3StorageService (MinIO)
    participant DB as PostgreSQL
    A->>UI: Chọn ảnh
    UI->>UI: SHA-256(blob)
    UI->>C: POST /assets/upload-intent
    C->>S: createUploadIntent(dto, userId)
    S->>S: kiểm MIME + size <= 50MB
    S->>ST: getPresignedPutUrl(storageKey, mime, 900)
    S-->>UI: {uploadUrl, storageKey, expiresIn}
    UI->>ST: PUT blob (presigned)
    UI->>C: POST /assets/upload-complete {storageKey, checksum, ...}
    C->>S: completeUpload(dto, userId)
    S->>ST: headObject(storageKey)
    S->>ST: getObjectBuffer(storageKey)
    S->>S: SHA-256 + validateMagicBytes
    S->>DB: INSERT assets
    S-->>UI: AssetResponse
    UI->>UI: gắn asset:<sha256> vào figure
```

## SD-23 Đồng bộ outbox offline

```mermaid
sequenceDiagram
    participant Ed as Editor
    participant Repo as UnifiedManuscriptRepository
    participant IDB as IndexedDB (manuscripts, outbox)
    participant PS as paper-sync / document-sync
    participant API as API
    Ed->>Repo: save(paper) khi offline
    Repo->>IDB: put manuscripts (syncState=pending)
    Repo->>IDB: add outbox {manuscriptId, attempts:0}
    Note over Ed,API: mạng trở lại
    PS->>IDB: đọc outbox theo seq
    PS->>API: đẩy nội dung (PUT/POST manuscripts, asset)
    alt ok
        API-->>PS: 2xx
        PS->>IDB: delete outbox, syncState=synced
    else lỗi
        PS->>IDB: attempts+1
    end
```

## SD-24 Trợ lý AI

```mermaid
sequenceDiagram
    actor A as Author
    participant UI as Editor (AbstractTab, KeywordsInput...)
    participant R as Next route /api/ai/proxy
    participant OA as OpenAI API
    A->>UI: Chọn "Gợi ý từ khóa"
    UI->>R: POST {action:'suggestKeywords', text, model}
    R->>R: validateOrigin, giới hạn 50KB/15000 ký tự
    R->>R: allow-list action + model
    R->>R: đọc OPENAI_API_KEY từ env (bỏ khóa client)
    R->>OA: POST /v1/chat/completions
    OA-->>R: nội dung
    R-->>UI: JSON gợi ý
    UI-->>A: Hiện gợi ý, chấp nhận → autosave
```
