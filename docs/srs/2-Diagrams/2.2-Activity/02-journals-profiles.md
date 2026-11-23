# 2.2.2 Activity – Tạp chí, Profile, Template (AD-08 … AD-12)

Sequence tương ứng: [2.3.2](../2.3-Sequence/02-journals-profiles.md).

## AD-08 Tạo tạp chí & loại bài (UC-JRN-04/05/07/08)

```mermaid
flowchart TD
    S([Manager mở /templates]) --> A{Hành động?}
    A -- Tạo tạp chí --> F1[/Nhập slug, code, tên vi/en, short, màu, ISSN, latexCls, status/]
    F1 --> C1{canManageJournals?}
    C1 -- Không --> E1[403]
    C1 -- Có --> V1{CHECK: màu #RRGGBB, ISSN dd-dd, slug/code duy nhất?}
    V1 -- Không --> E2[400/409]
    V1 -- Có --> I1[INSERT journals version=1]
    I1 --> B1[ensureJournalBaseline: tạo profile_versions v1 published]
    B1 --> AU1[Ghi audit_logs journal.create]
    A -- Sửa định danh --> F2[/Gửi PATCH kèm If-Match ETag/]
    F2 --> V2{version khớp?}
    V2 -- Không --> E3[412 Precondition Failed]
    V2 -- Có --> U2[UPDATE journals, version+1]
    U2 --> AU2[Audit journal.update]
    A -- Thêm loại bài --> F3[/code, nhãn vi + en/]
    F3 --> V3{code khớp regex, chưa trùng trong tạp chí?}
    V3 -- Không --> E2
    V3 -- Có --> I3[INSERT article_types + ensureArticleTypeBaseline + audit]
    AU1 --> OK([Hoàn tất])
    AU2 --> OK
    I3 --> OK
    E1 --> OK
    E2 --> OK
    E3 --> OK
```

## AD-09 Vòng đời Profile: nháp → kiểm tra → xuất bản → rollback (UC-JRN-09…14)

```mermaid
flowchart TD
    S([Mở tab Phiên bản / Layout...]) --> D[Tạo bản nháp từ bản published: version = max+1, state=draft]
    D --> ED[Sửa config trên các tab]
    ED --> UP[PATCH draft: state quay về draft]
    UP --> VL[Bấm Kiểm tra]
    VL --> ZV{Zod schema hợp lệ?}
    ZV -- Không --> ERR[Trả danh sách lỗi] --> ED
    ZV -- Có --> VS[state = validated]
    VS --> DF[Xem diff so với bản đang xuất bản]
    DF --> PB{Xuất bản?}
    PB -- Không --> ED
    PB -- Có --> TX[Giao dịch: bản published cũ -> archived; bản mới -> published, published_at]
    TX --> TR[Trigger profile_versions_guard bảo vệ bản published/archived bất biến]
    TR --> AP{Áp dụng cho các bài ngay?}
    AP -- Có --> AD11[[AD-11]]
    AP -- Không --> OK([Hoàn tất])
    AD11 --> OK
    S --> RB[Rollback toVersion]
    RB --> RC{Phiên bản từng published?}
    RC -- Không --> E[400]
    RC -- Có --> CP[Tạo bản mới = bản sao version cũ, state validated, rồi publish]
    CP --> OK
    E --> OK
```

## AD-10 Resolve profile & ghim profile cho bài (UC-JRN-03, UC-PAP-01)

```mermaid
flowchart TD
    S([Cần quy tắc dàn trang]) --> W{Ở đâu?}
    W -- Client --> L[Đọc profiles trong IndexedDB]
    L --> M{Có bản đã đồng bộ?}
    M -- Không --> N[GET /profiles/published] --> L
    M -- Có --> Q
    W -- Server --> Q
    Q[Lấy tier: Base v, Journal v, ArticleType v theo pin hoặc bản published] --> R[resolveFromTiers: deepMerge Base -> Journal -> ArticleType -> overrides]
    R --> ID[Giữ id tạp chí, gắn articleType]
    ID --> RP[ResolvedProfile]
    RP --> PIN{Khi tạo bài?}
    PIN -- Có --> SN[Ghi profile_pin + manuscript_profile_snapshots reason=create, hash SHA-256]
    PIN -- Không --> USE[Dùng cho QC, LaTeX, preview]
    SN --> USE
    USE --> E([Kết thúc])
```

## AD-11 Áp dụng profile mới cho các bài (UC-JRN-15)

```mermaid
flowchart TD
    S([Manager chọn Áp dụng cho tất cả bài]) --> C[POST /journals/:id/apply-profile-to-papers]
    C --> L[Lấy các bài chưa xóa của tạp chí có pin cũ]
    L --> LP{Còn bài?}
    LP -- Không --> SUM[Tổng kết]
    LP -- Có --> ONE[Với từng bài]
    ONE --> SV[Tạo revision profile-upgrade - bản sao an toàn]
    SV --> PN[Cập nhật profile_pin = bản published mới]
    PN --> SS[Thêm manuscript_profile_snapshots reason=profile_upgrade]
    SS --> OKB{Thành công?}
    OKB -- Có --> LP
    OKB -- Không --> SK[Bỏ qua bài, ghi lỗi] --> LP
    SUM --> AU[Audit journal.apply_profile_to_papers]
    AU --> R[Trả ApplyProfileToPapersResult số bài nâng/bỏ qua]
    R --> E([Kết thúc])
```

## AD-12 Template Builder (UC-JRN-17)

```mermaid
flowchart TD
    S([Mở /templates/builder]) --> N{Bắt đầu từ?}
    N -- Mới --> D[Nạp defaults template-engine]
    N -- Nhập JSON --> IM[Đọc StructPaperTemplateFile, kiểm schemaVersion 1.0.0/2.0.0]
    IM --> OKJ{Hợp lệ?}
    OKJ -- Không --> ERR[Báo lỗi schema] --> N
    OKJ -- Có --> D2[Nạp vào builder]
    D --> S1
    D2 --> S1
    S1[Bước 1: Trang và vùng - khổ giấy, lề, header/footer, số trang] --> S15[Bước 1.5: Lưới vùng - grid zones, nested zones]
    S15 --> S2[Bước 2: Cấu trúc phần tử - 23 semantic element]
    S2 --> S3[Bước 3: Tạo kiểu sâu - typography, spacing, layoutScope, decorations, numbering]
    S3 --> SP[Phần tử đặc biệt và quy tắc nổi floatingRules]
    SP --> S4[Bước 4: Xem trước và xuất - renderer HTML]
    S4 --> SAVE{Lưu?}
    SAVE -- Lưu --> ST[POST /api/templates: ghi JSON vào src/data/templates; hoặc lưu localStorage]
    SAVE -- Xuất --> EX[Tải JSON]
    SAVE -- Sửa tiếp --> S1
    ST --> E([Kết thúc])
    EX --> E
```
