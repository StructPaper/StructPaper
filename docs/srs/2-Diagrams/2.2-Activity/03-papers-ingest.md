# 2.2.3 Activity – Bài báo, nhập Word, workflow, thùng rác (AD-13 … AD-19)

Sequence tương ứng: [2.3.3](../2.3-Sequence/03-papers-ingest.md).

## AD-13 Tạo bài mới (UC-PAP-01/02/07)

```mermaid
flowchart TD
    S([Bấm Tạo bài mới]) --> M[Mở CreatePaperModal]
    M --> J[/Chọn tạp chí - chỉ published, loại bài hoặc Khác - tự nhập/]
    J --> N[/Nhập tên tài liệu - để trống thì lấy theo tiêu đề/]
    N --> D{Trùng tên? GET /manuscripts/duplicates}
    D -- Có --> W[DuplicatePaperWarningModal: đổi tên / vẫn tạo]
    W --> OK2{Tiếp tục?}
    OK2 -- Không --> N
    OK2 -- Có --> SRC
    D -- Không --> SRC
    SRC{Nguồn?}
    SRC -- Trống --> B[Sinh CompletePaper rỗng theo profile]
    SRC -- Mẫu --> SM[Nạp bài mẫu của tạp chí]
    SRC -- Word --> AD14[[AD-14]]
    B --> L[Lưu IndexedDB]
    SM --> L
    L --> API[POST /manuscripts: giao dịch tạo manuscripts + OWNER member + manuscript_docs + profile snapshot]
    API --> OFF{Server tới được?}
    OFF -- Không --> LOC[Giữ bản cục bộ, syncState pending, đưa vào outbox]
    OFF -- Có --> SY[Đồng bộ nội dung + ảnh]
    LOC --> OPEN
    SY --> OPEN
    OPEN[Mở /papers/:id] --> E([Kết thúc])
    AD14 --> OPEN
```

## AD-14 Nhập một tệp Word (UC-PAP-03, UC-EDT-15)

```mermaid
flowchart TD
    S([Chọn / kéo thả 1 tệp]) --> T{Đuôi?}
    T -- .doc / RTF --> HG[Hướng dẫn lưu thành .docx] --> X([Dừng])
    T -- .docx --> RD{Tệp rỗng / hỏng?}
    RD -- Có --> ER[Báo lỗi, chặn] --> X
    RD -- Không --> TJ[/Chọn mẫu tạp chí/]
    TJ --> UZ[Giải nén OOXML: document.xml, styles, numbering, footnotes, media]
    UZ --> TC[Xử lý Track Changes: giữ w:ins, bỏ w:del/moveFrom, đếm thay đổi]
    TC --> RC[Chuỗi nhận diện: style-map rồi structure recognizer]
    RC --> AS[Assemblers: front matter, mục, bảng, hình, công thức OMML->LaTeX, tham khảo, footnote, back matter]
    AS --> NM[Chuẩn hóa: NFC, khoảng trắng tiếng Việt, tên bị tách, caption number, liên kết trích dẫn]
    NM --> FG[Vẽ lại hình DrawingML -> SVG -> PNG; ghép ảnh - chú thích]
    FG --> CF[Tính độ tin cậy confidence]
    CF --> MD[Sinh mô hình bài + báo cáo nhập: EMF/WMF, MathType chưa chuyển]
    MD --> GATE[Cổng kiểm tra đầu vào: thiếu trường, STT, nguồn hình/bảng, công thức]
    GATE --> SV[Lưu IndexedDB + ingestSources + đồng bộ server]
    SV --> OP[Mở trình soạn thảo, hiện danh sách lỗi/cảnh báo]
    OP --> RN{Bấm Tự động đánh lại số?}
    RN -- Có --> NR[numbering.ts đánh lại] --> E([Kết thúc])
    RN -- Không --> E
```

## AD-15 Nhập hàng loạt (UC-PAP-04)

```mermaid
flowchart TD
    S([Chọn >= 2 tệp .docx, tối đa 100]) --> F[Lọc tệp không phải Word, báo bỏ qua]
    F --> MD{Chế độ mẫu}
    MD -- Một mẫu cho tất cả --> TJ1[Chọn 1 tạp chí]
    MD -- Mỗi tệp một mẫu --> TJ2[Chọn mẫu riêng từng tệp]
    TJ1 --> Q
    TJ2 --> Q
    Q[run-batch: xếp hàng với limiter: đọc 2, biên dịch 3] --> LOOP{Còn tệp chờ?}
    LOOP -- Không --> SUM[Tổng kết + Tải tất cả PDF .zip]
    LOOP -- Có --> RD[Đang đọc tệp Word]
    RD --> RE{Lỗi?}
    RE -- Có --> FL[Đánh dấu Không tạo được, tiếp tục tệp khác] --> LOOP
    RE -- Không --> SV[Lưu: IndexedDB rồi server; tên tự thêm 1, 2 nếu trùng]
    SV --> SE{Lưu được?}
    SE -- Không --> FL
    SE -- Có --> FREE[Giải phóng bộ nhớ, chỉ giữ ảnh LaTeX dùng]
    FREE --> WT[Chờ tới lượt biên dịch]
    WT --> CP[Biên dịch PDF]
    CP --> DONE[Hoàn tất: Mở, Tải PDF; lưu PDF lên server]
    DONE --> LOOP
    S --> CAN{Người dùng Hủy?}
    CAN -- Có --> ST[Dừng tệp chưa xong; bài đã lưu giữ lại, chỉ dừng PDF]
    SUM --> RT{Thử lại?}
    RT -- Có --> LOOP
    RT -- Không --> E([Xong])
    ST --> E
```

## AD-16 Đổi trạng thái workflow (UC-PAP-10)

```mermaid
flowchart TD
    S([Chọn trạng thái mới]) --> SAME{Trùng trạng thái hiện tại?}
    SAME -- Có --> NOP[Trả success, không đổi] --> E([Kết thúc])
    SAME -- Không --> FSM{Hợp lệ theo VALID_TRANSITIONS hoặc là SuperAdmin?}
    FSM -- Không --> E1[400 Invalid status transition]
    FSM -- Có --> PERM{Quyền theo bước}
    PERM -- SUBMITTED hoặc rút lại --> P1{update/manage bài?}
    PERM -- IN_REVIEW, ACCEPTED, REJECTED, PUBLISHED --> P2{manage - Manager/SuperAdmin?}
    P1 -- Không --> E2[403]
    P2 -- Không --> E2
    P1 -- Có --> REV
    P2 -- Có --> REV
    REV[RevisionService.beforeSave: chụp phiên bản] --> TX[Giao dịch]
    TX --> U1[UPDATE manuscripts.status, version+1]
    U1 --> U2[INSERT outbox_events ManuscriptStatusChanged PENDING]
    U2 --> OK[Trả manuscript + outboxEventId + trạng thái trước/sau]
    OK --> E
    E1 --> E
    E2 --> E
```

## AD-17 Xóa bài → Thùng rác → Khôi phục / Xóa vĩnh viễn (UC-PAP-09, UC-TRS-01…05)

```mermaid
flowchart TD
    S([Menu thẻ: Xóa]) --> CK{ability delete/manage? và status không thuộc IN_REVIEW, PROOFING, READY, ACCEPTED, PUBLISHED?}
    CK -- Không --> E1[403: đã vào quy trình, ẩn mục Xóa]
    CK -- Có --> SD[UPDATE deleted_at = now, deleted_by]
    SD --> AU[Audit manuscript.trash]
    AU --> TR[Bài biến mất khỏi mọi danh sách]
    TR --> V[Vào /trash: người xóa thấy bài của mình; Manager thấy cả tạp chí]
    V --> PV[Xem trước chỉ đọc /trash/:id]
    PV --> ACT{Hành động?}
    ACT -- Khôi phục --> MR{mayRestore?}
    MR -- Có --> RS[deleted_at = null, audit manuscript.restore] --> OK([Bài trở lại])
    MR -- Không --> E2[403]
    ACT -- Xóa vĩnh viễn --> MP{mayPurge?}
    MP -- Có --> DEL[DELETE manuscripts - cascade members, docs, ops, revisions, snapshots; audit manuscript.purge] --> GONE([Đã xóa])
    MP -- Không --> E2
    ACT -- Hàng loạt --> BK{trash:manage?}
    BK -- Có --> LOOP[Lặp khôi phục/xóa từng bài] --> OK
    BK -- Không --> E2
```

## AD-18 Tự động dọn thùng rác (UC-TRS-06)

```mermaid
flowchart TD
    S([Khởi động API: onModuleInit]) --> P0[purgeExpired ngay]
    P0 --> TM[setInterval 6 giờ, unref]
    TM --> W([Chờ])
    W --> TICK[Mỗi 6 giờ]
    TICK --> CU[cutoff = now - TRASH_RETENTION_DAYS, mặc định 30]
    CU --> DL[DELETE manuscripts WHERE deleted_at < cutoff RETURNING id, title]
    DL --> AU[Audit manuscript.purge_expired cho từng bài]
    AU --> LG[Log số bài đã xóa]
    DL -. lỗi .-> WN[Log cảnh báo, không dừng tiến trình]
    LG --> W
    WN --> W
```

## AD-19 Đổi loại bài & nâng cấp profile của bài (UC-PAP-11/12)

```mermaid
flowchart TD
    S([Author chọn]) --> W{Thao tác}
    W -- Đổi loại bài --> A1{Quyền sửa và loại bài active hoặc đang dùng?}
    A1 -- Không --> E1[400/403]
    A1 -- Có --> R1[Tạo revision pre-risk Trước khi đổi loại bài]
    R1 --> PN1[Tính lại pin cho loại bài mới]
    W -- Nâng cấp profile --> A2{Có bản published mới hơn pin?}
    A2 -- Không --> NO[Trả upgraded=false] --> E([Kết thúc])
    A2 -- Có --> R2[Tạo revision profile-upgrade]
    R2 --> PN2[pinFor bản mới]
    PN1 --> TX
    PN2 --> TX
    TX[Giao dịch: UPDATE profile_pin, article_type_id; INSERT manuscript_profile_snapshots] --> NV[Không tăng version để save đang bay còn hợp lệ]
    NV --> OK[Trả profilePin, version] --> E
    E1 --> E
```
