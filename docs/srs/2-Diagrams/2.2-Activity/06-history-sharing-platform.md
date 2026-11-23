# 2.2.6 Activity – Lịch sử, chia sẻ, chế độ chỉ xem, cập nhật Desktop (AD-30 … AD-34)

Sequence tương ứng: [2.3.6](../2.3-Sequence/06-history-sharing-platform.md).

## AD-30 Tạo phiên bản tự động & phiên bản có tên (UC-HIS-02, UC-HIS-09)

```mermaid
flowchart TD
    S([Lưu bài: RevisionService.beforeSave]) --> HC{Bản trước có nội dung và nội dung đổi - fingerprint khác?}
    HC -- Không --> ST
    HC -- Có --> JC{Đổi tạp chí?}
    JC -- Có --> PR[Revision pre-risk: Trước khi đổi tạp chí]
    JC -- Không --> LT{Đã có revision nào chưa?}
    LT -- Chưa --> FR[Revision auto: Phiên bản đầu]
    LT -- Rồi --> DIFF{checksum revision mới nhất khác bản trước?}
    DIFF -- Không --> ST
    DIFF -- Có --> TM{Nghỉ >= 5 phút HOẶC cách revision trước >= 30 phút?}
    TM -- Có --> AU[Revision auto]
    TM -- Không --> ST
    PR --> ST
    FR --> ST
    AU --> ST
    ST{Trạng thái workflow đổi?}
    ST -- Có --> NM[Revision named, pinned: nhãn theo trạng thái - Gửi duyệt, Đang phản biện, ...]
    ST -- Không --> PRN
    NM --> PRN[Dọn: giữ pinned; > 300 bản không ghim thì xóa cũ nhất; bản an toàn > 90 ngày xóa, giữ >= 5 gần nhất]
    PRN --> E([Kết thúc])
    S --> MAN{Người dùng bấm Lưu phiên bản có tên?}
    MAN -- Có --> NL{Đã đủ 100 bản có tên?}
    NL -- Có --> ER[400 vượt giới hạn]
    NL -- Không --> NV[VersionNameModal: tên, mô tả -> kind=named, pinned=true]
    NV --> E
    ER --> E
```

## AD-31 Xem, so sánh, khôi phục, nhân bản phiên bản (UC-HIS-01,03,04,05,08)

```mermaid
flowchart TD
    S([Mở /papers/:id/history]) --> L[Liệt kê revision, ẩn kind=sync, lọc theo loại, kèm stats]
    L --> P[Chọn một phiên bản]
    P --> A{Hành động}
    A -- So sánh --> DF[doc-diff: diff khối + inline, so với hiện tại hoặc phiên bản khác] --> E([Kết thúc])
    A -- Khôi phục --> RT{Có quyền update?}
    RT -- Không --> E1[403]
    RT -- Có --> PC[Tạo revision pre-risk: Trước khi khôi phục]
    PC --> OL[UPDATE manuscripts metadata, title, version+1 có kiểm tra version]
    OL --> OK{Cập nhật được?}
    OK -- Không --> E2[400: bài vừa được lưu bởi người khác, thử lại]
    OK -- Có --> RS[Tạo revision kind=restore, diff với bản trước]
    RS --> E
    A -- Nhân bản --> DP[Tạo bài mới từ snapshot, tên theo duplicate] --> E
    A -- Đổi tên / ghim --> PT[PATCH tagName, description, pinned] --> E
    A -- Xóa --> DL{Bản ghim?}
    DL -- Có --> E3[Không cho xóa]
    DL -- Không --> RM[DELETE revision] --> E
    E1 --> E
    E2 --> E
    E3 --> E
```

## AD-32 Chia sẻ bài (UC-SHR-01…05)

```mermaid
flowchart TD
    S([Mở ShareManuscriptModal]) --> CK{Là chủ sở hữu / manager? share}
    CK -- Không --> E1[403: Chỉ chủ sở hữu được chia sẻ]
    CK -- Có --> ACT{Hành động}
    ACT -- Tìm người --> SR[GET /manuscripts/people?q >= 2 ký tự] --> SEL[Chọn người]
    SEL --> RL[/Chọn vai trò: COAUTHOR, EDITOR, REVIEWER, VIEWER/]
    RL --> OW{Vai trò OWNER?}
    OW -- Có --> E2[400 không thể thêm chủ sở hữu]
    OW -- Không --> US{Người dùng tồn tại và active?}
    US -- Không --> E3[404]
    US -- Có --> UP[UPSERT manuscript_members]
    UP --> IV[Vô hiệu cache quyền của người đó -> có hiệu lực ngay]
    ACT -- Gỡ thành viên --> RO{Là OWNER?}
    RO -- Có --> E4[400 không gỡ chủ sở hữu]
    RO -- Không --> DM[DELETE manuscript_members] --> IV
    ACT -- Quyền chung --> GA[/RESTRICTED, VIEWER, EDITOR/] --> SG[UPDATE general_access]
    SG --> E([Kết thúc])
    IV --> E
    E1 --> E
    E2 --> E
    E3 --> E
    E4 --> E
```

## AD-33 Mở bài chỉ xem, khách xem bằng link, PDF preview (UC-PAP-13, UC-SHR-07…10)

```mermaid
flowchart TD
    S([Mở link /papers/:id]) --> TK{Đã đăng nhập?}
    TK -- Không --> GU[Guest - GET /manuscripts/:id OptionalAuth]
    GU --> GA{general_access = VIEWER?}
    GA -- Không --> LG[Yêu cầu đăng nhập]
    GA -- Có --> RO
    TK -- Có --> AC{Quyền đọc? thành viên, tạo bởi, general_access, manage}
    AC -- Không --> E1[403]
    AC -- Có --> VS[recordVisit nếu mở qua link công khai - manuscript_visits]
    VS --> ED{access.canEdit?}
    ED -- Có --> EDT[Trình soạn đầy đủ: autosave, sync] --> CMP[Biên dịch xong thì PUT /preview PDF]
    ED -- Không --> RO
    RO[ReadOnlyPaperView: không autosave/sync, ô nhập chỉ đọc, ẩn nút edit-only] --> PV[GET /manuscripts/:id/preview]
    PV --> HP{Đã có PDF preview?}
    HP -- Có --> SH[Hiển thị PDF]
    HP -- Không --> WHO{Người xem đã đăng nhập?}
    WHO -- Có --> SC[Tự biên dịch cục bộ/server] --> SH
    WHO -- Không --> NP[Khách: không có bản xem trước]
    CMP --> E([Kết thúc])
    SH --> E
    NP --> E
    LG --> E
    E1 --> E
```

## AD-34 Kiểm tra & cập nhật tự động bản Desktop (UC-PLT-02)

```mermaid
flowchart TD
    S([Khởi động Desktop / bấm Kiểm tra cập nhật]) --> ON{Có mạng?}
    ON -- Không --> OFF[Bỏ qua, thử lại lần sau]
    ON -- Có --> CK[plugin updater: GET latest.json từ GitHub Releases]
    CK --> NW{Có bản mới hơn?}
    NW -- Không --> UP[Hiện: đang dùng bản mới nhất]
    NW -- Có --> NT[UpdateNotificationBanner + Toast]
    NT --> US{Người dùng chọn Cập nhật?}
    US -- Sau --> LT[Nhắc lại sau]
    US -- Có --> DL[Tải bản cập nhật, hiện tiến độ DownloadEvent]
    DL --> SG{Chữ ký minisign hợp lệ - pubkey?}
    SG -- Không --> ER[Từ chối: lỗi chữ ký/checksum]
    SG -- Có --> IN[Cài đặt Windows passive]
    IN --> RL[relaunch ứng dụng]
    RL --> E([Kết thúc])
    OFF --> E
    UP --> E
    LT --> E
    ER --> E
```
