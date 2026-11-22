# 2.2.4 Activity – Soạn thảo, đồng bộ, tài nguyên, AI (AD-20 … AD-24)

Sequence tương ứng: [2.3.4](../2.3-Sequence/04-editing-sync.md).

## AD-20 Tự động lưu & lưu thủ công (UC-EDT-11/12/19, UC-SYN-06)

```mermaid
flowchart TD
    S([Người dùng sửa nội dung]) --> N[notify paper: state = dirty]
    N --> DB{Công tắc Tự động lưu bật?}
    DB -- Tắt --> WT[Chờ Ctrl+S / bấm Lưu]
    DB -- Bật --> DEB[Debounce ~1,2 s; thêm khi ẩn tab / đóng trang]
    WT --> SV
    DEB --> SV
    SV[state = saving] --> LC[Ghi IndexedDB - luôn thực hiện]
    LC --> LOK{Ghi máy được?}
    LOK -- Không --> ERR[state = error: Lưu thất bại]
    LOK -- Có --> SRV{Có server và đang online?}
    SRV -- Không --> SL[state = saved-local: Đã lưu trên máy]
    SRV -- Có --> UP[Đẩy server: PUT/PATCH manuscripts kèm If-Match rev, ảnh asset:sha256]
    UP --> R{Kết quả}
    R -- 2xx --> OK[state = saved: Đã lưu máy + máy chủ]
    R -- 412/409 --> CF[state = conflict: Xung đột phiên bản]
    R -- Lỗi mạng --> SL
    CF --> OV{Người dùng chọn Ghi đè bằng bản của tôi?}
    OV -- Có --> FP[Đẩy lại với rev mới nhất] --> OK
    OV -- Không --> KEEP[Giữ bản trên máy, chờ quyết định]
    OK --> MORE{Có sửa trong lúc đang lưu?}
    SL --> MORE
    MORE -- Có --> N
    MORE -- Không --> SNAP{Lưu thủ công?}
    SNAP -- Có --> RV[Chụp revision / phiên bản] --> E([Kết thúc])
    SNAP -- Không --> E
    ERR --> E
    KEEP --> E
```

## AD-21 Gửi patch thời gian thực & xung đột (UC-SYN-01…04)

```mermaid
flowchart TD
    S([Client có danh sách patches]) --> P[POST /manuscripts/:id/sync/patches opId, baseServerRev, clientRev, patches]
    P --> AC{Có quyền update/manage?}
    AC -- Không --> E1[403]
    AC -- Có --> ID{opId đã áp dụng?}
    ID -- Có --> RET[200 trả lại serverRev + checksum đã ghi]
    ID -- Không --> FU{baseServerRev > serverRev hiện tại?}
    FU -- Có --> E2[400 vượt quá serverRev]
    FU -- Không --> BH{baseServerRev < serverRev hiện tại?}
    BH -- Có --> CO[409 OUT_OF_SYNC + missingOps]
    CO --> RB[Client rebase: áp missingOps rồi gửi lại]
    BH -- Không --> AP[PatchApplier.apply bất biến, tính checksum SHA-256]
    AP --> TX[Giao dịch]
    TX --> I1[INSERT manuscript_ops]
    I1 --> I2[UPDATE manuscript_docs doc_tree, server_rev]
    I2 --> I3[UPDATE manuscripts.current_server_rev]
    I3 --> I4[INSERT outbox_events OP_APPLIED]
    I4 --> CP{serverRev chia hết 20?}
    CP -- Có --> CK[INSERT manuscript_revisions kind=sync checkpoint]
    CP -- Không --> BC
    CK --> BC[SseManager phát op cho các client đang nghe]
    BC --> RS[Trả serverRev, checksum, opId]
    RS --> E([Kết thúc])
    RET --> E
    E1 --> E
    E2 --> E
    RB --> S
```

## AD-22 Tải ảnh lên (UC-AST-01/02, UC-EDT-06)

```mermaid
flowchart TD
    S([Chọn ảnh trong tab Hình ảnh]) --> H[Tính SHA-256 phía client]
    H --> EX{Asset đã có trên server theo hash?}
    EX -- Có --> REF[Chỉ tham chiếu asset:sha256]
    EX -- Không --> INT[POST /assets/upload-intent filename, mimeType, fileSize, manuscriptId]
    INT --> CK{MIME thuộc danh sách? kích thước <= 50 MB?}
    CK -- Không --> E1[400 Unsupported MIME / quá lớn]
    CK -- Có --> PU[Sinh storageKey manuscripts/id/uuid-tên, presigned PUT 15 phút]
    PU --> UP[Client PUT trực tiếp lên S3/MinIO]
    UP --> CMP[POST /assets/upload-complete]
    CMP --> HD[HeadObject: tồn tại? kích thước khớp?]
    HD --> OKH{Hợp lệ?}
    OKH -- Không --> E2[404/400]
    OKH -- Có --> CS[Tính SHA-256 server, so checksum]
    CS --> MG[Kiểm tra magic bytes theo MIME]
    MG --> OKM{Khớp?}
    OKM -- Không --> E3[400 Checksum/magic bytes]
    OKM -- Có --> INS[INSERT assets]
    INS --> REF
    REF --> LK[JSON bài chỉ giữ asset:sha256, không base64]
    LK --> E([Kết thúc])
    E1 --> E
    E2 --> E
    E3 --> E
```

## AD-23 Đồng bộ hàng đợi offline (UC-SYN-05, UC-PLT-03)

```mermaid
flowchart TD
    S([Người dùng sửa khi offline]) --> LS[Ghi IndexedDB manuscripts: syncState = pending]
    LS --> OB[Thêm outbox item: seq, manuscriptId, attempts]
    OB --> W([Chờ mạng])
    W --> ON{Online trở lại / lần lưu kế tiếp?}
    ON -- Không --> W
    ON -- Có --> PK[Lấy outbox theo seq]
    PK --> PU[Đẩy lên server qua paper-sync / document-sync]
    PU --> R{Thành công?}
    R -- Có --> RM[Xóa outbox item, syncState = synced]
    R -- Xung đột --> CF[Đánh dấu conflict -> AD-20 nhánh xung đột]
    R -- Lỗi --> AT[attempts + 1, thử lại sau]
    RM --> MORE{Còn item?}
    AT --> W
    MORE -- Có --> PK
    MORE -- Không --> E([Kết thúc])
    CF --> E
```

## AD-24 Trợ lý AI (UC-EDT-17)

```mermaid
flowchart TD
    S([Chọn thao tác AI: metadata, table, extractFrontMatter, suggestKeywords, refineAbstract, fixGrammar]) --> RQ[POST /api/ai/proxy action, text, model, options]
    RQ --> OR{Same-origin: Sec-Fetch-Site và Origin khớp Host?}
    OR -- Không --> E1[403]
    OR -- Có --> SZ{Content-Length <= 50 KB và text <= 15 000 ký tự?}
    SZ -- Không --> E2[413 / 400]
    SZ -- Có --> AL{action và model thuộc allow-list?}
    AL -- Không --> E3[400]
    AL -- Có --> KY{Có OPENAI_API_KEY trên server? khóa từ client bị loại bỏ}
    KY -- Không --> E4[500 chưa cấu hình khóa]
    KY -- Có --> PR[Dựng prompt theo action]
    PR --> OA[Gọi OpenAI chat/completions]
    OA --> PS[Phân tích JSON kết quả]
    PS --> RT[Trả gợi ý cho UI]
    RT --> AC{Người dùng chấp nhận?}
    AC -- Có --> AP[Áp vào bài -> autosave]
    AC -- Không --> E([Kết thúc])
    AP --> E
    E1 --> E
    E2 --> E
    E3 --> E
    E4 --> E
```
