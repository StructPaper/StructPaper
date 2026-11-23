# 2.2.5 Activity – Biên dịch, QC, xuất bản (AD-25 … AD-29)

Sequence tương ứng: [2.3.5](../2.3-Sequence/05-compile-export.md).

## AD-25 Biên dịch PDF với bộ định tuyến compiler (UC-PRV-02, UC-CMP-01/04)

```mermaid
flowchart TD
    S([Bài thay đổi / bấm biên dịch]) --> SC[CompileScheduler: gộp yêu cầu, hủy lần cũ]
    SC --> LT[Sinh LaTeX bằng LatexExporter theo ResolvedProfile]
    LT --> H[Tính hash nội dung]
    H --> CC{compileCache IndexedDB có hash?}
    CC -- Có --> PDF[Dùng PDF đã cache]
    CC -- Không --> CTX[Dựng CompileContext: online, serverReachable, localEnv, deviceScore, pageEstimate, assetBytes, lỗi gần đây, preference]
    CTX --> R[CompilerRouter chạy 11 luật theo thứ tự]
    R --> D{Quyết định}
    D -- Server --> SRV[RemoteCompiler -> POST /compile/latex]
    D -- Cục bộ --> LOC{Desktop?}
    LOC -- Có --> TA[Tectonic qua Tauri]
    LOC -- Không --> WA[WASM compiler trong Web Worker]
    D -- Lỗi E1 offline không env --> HT[Hiện xem trước HTML nhanh]
    SRV --> Q{Server: hàng đợi còn chỗ?}
    Q -- Không --> BUSY[429 quá tải / quá nhiều bài]
    Q -- Có --> SC2[CompileService: kiểm cache 30 phút]
    SC2 --> RUN[Chạy tectonic hoặc xelatex trong thư mục tạm, timeout 300 s]
    RUN --> OKS{Thành công?}
    OKS -- Không --> LOGE[Trả JSON lỗi + log]
    OKS -- Có --> PB[Trả application/pdf, header X-Compiler-Engine]
    TA --> RES
    WA --> RES
    PB --> RES
    RES{Kết quả cục bộ lỗi?} -- Có: OOM/Timeout/Crash --> REC[Ghi recentLocalFailures 10 phút, chuyển Server]
    REC --> SRV
    RES -- Không --> SAVE[Ghi compileCache]
    PDF --> VW
    SAVE --> VW[Hiển thị bằng pdf.js]
    VW --> UPL{Người sửa? Tự gửi PDF preview}
    UPL -- Có --> UP[PUT /manuscripts/:id/preview]
    UPL -- Không --> E([Kết thúc])
    UP --> E
    LOGE --> ERR[CompileErrorModal: phân tích log] --> E
    BUSY --> E
    HT --> E
```

## AD-26 Biên dịch nền bằng Worker & outbox (UC-CMP-03, UC-PLT-05)

```mermaid
flowchart TD
    S([Yêu cầu biên dịch ghi vào outbox_events compile.requested]) --> P[OutboxDispatcher đọc PENDING, batch 50]
    P --> E{Có sự kiện?}
    E -- Không --> W([Chờ])
    E -- Có --> SD[boss.send compile.latex payload]
    SD --> OK{Gửi được?}
    OK -- Có --> PR[Đánh dấu PROCESSED, processed_at]
    OK -- Không --> RT[retry_count+1; từ lần thứ 5 -> FAILED]
    PR --> E
    RT --> E
    SD --> J[Worker LatexCompileProcessor nhận job]
    J --> ST[compile_jobs.status = PROCESSING]
    ST --> MS[Nạp manuscripts + manuscript_docs / revision]
    MS --> NF{Tìm thấy?}
    NF -- Không --> FL[FAILED: Manuscript not found]
    NF -- Có --> TX[LatexExporter sinh .tex]
    TX --> RUN[LatexRunner: local-process hoặc docker-sandbox]
    RUN --> RS{Thành công?}
    RS -- Không --> FL2[FAILED + log_output + duration_ms]
    RS -- Có --> S3[PutObject PDF lên S3/MinIO]
    S3 --> AS[INSERT assets, gắn pdf_asset_id]
    AS --> DN[status = COMPLETED, duration_ms]
    FL --> END([Kết thúc])
    FL2 --> END
    DN --> END
```

## AD-27 Kiểm tra chất lượng & cổng xuất (UC-EDT-14/15, UC-EXP-05)

```mermaid
flowchart TD
    S([Mở tab QC / chọn Xuất]) --> R[Lấy ResolvedProfile.qc: ruleset + weights]
    R --> EN[QcEngine chạy các luật]
    EN --> M[metadata: tiêu đề, tóm tắt, từ khóa, tác giả, đơn vị, tác giả liên hệ]
    EN --> ST[cấu trúc: IMRaD, mục rỗng, đoạn rỗng]
    EN --> NU[đánh số: trích dẫn thiếu, tham khảo chưa trích, thứ tự lần nhắc đầu, xref hỏng]
    EN --> RF[tham khảo: định dạng, DOI]
    EN --> FL[nổi: caption bảng/hình, bảng/hình rỗng, DPI hình]
    M --> SC
    ST --> SC
    NU --> SC
    RF --> SC
    FL --> SC
    SC[Chấm điểm scoring theo weights] --> RP[Báo cáo issues: lỗi / cảnh báo]
    RP --> EXP{Đang xuất?}
    EXP -- Không --> SHOW[Hiển thị tab QC, cho sửa/đánh lại số] --> E([Kết thúc])
    EXP -- Có --> IS{Có vấn đề?}
    IS -- Không --> GO[Tiến hành xuất]
    IS -- Có --> DLG[Hộp thoại liệt kê vấn đề]
    DLG --> CH{Người dùng chọn?}
    CH -- Sửa --> SHOW
    CH -- Vẫn xuất --> GO
    GO --> E
```

## AD-28 Xuất PDF / DOCX / JATS / XML+hình (UC-EXP-01…04)

```mermaid
flowchart TD
    S([Tệp > Xuất thành / Dock > Tải xuống]) --> G[[AD-27 cổng kiểm tra đầu ra]]
    G --> F{Định dạng}
    F -- PDF --> P1[Biên dịch PDF AD-25; khóa menu, hiện Đang xuất PDF]
    P1 --> P2{Biên dịch OK?}
    P2 -- Không --> PE[Báo lỗi bằng toast - không có tệp] --> E([Kết thúc])
    P2 -- Có --> DL
    F -- DOCX --> D1[DocxExporter: khổ giấy, lề, đầu/chân, cột, QR, công thức Word, bảng ô gộp, trang tiếng Anh] --> DL
    F -- XML JATS --> J1[JatsExporter: front, body, công thức, fig, table-wrap, ref-list] --> J2[Kiểm DTD JATS 1.2 khi test] --> DL
    F -- XML+hình --> Z1[JATS + gom hình theo articles/abbr/v-/i-/a-/img-n] --> Z2{Đủ Tập/Số/Mã bài?}
    Z2 -- Không --> Z3[Hình vào images/, nhắc bổ sung] --> ZP
    Z2 -- Có --> ZP[ZipPackager] --> DL
    DL[Tải tệp về máy] --> SV[Lưu bản xuất lên server nếu có]
    SV --> E
```

## AD-29 Tương tác PDF & xoay trang (UC-PRV-03/04/05)

```mermaid
flowchart TD
    S([PDF hiển thị trong PdfInteractiveViewer]) --> A{Thao tác}
    A -- Nhấp đơn --> SEL[Chọn/sao chép chữ hoặc theo liên kết nội bộ/ngoài]
    A -- Nhấp đúp --> DC[pdf-click-target: lấy văn bản tại điểm nhấp]
    DC --> MP[pdf-section-map: ghép chữ PDF với mục, bỏ khoảng trắng/dấu nối/công thức]
    MP --> FD{Ghép được?}
    FD -- Không --> NO[Không làm gì]
    FD -- Có --> OPN[Mở tab và thẻ tương ứng, tô sáng; tô dòng trên PDF vài giây]
    A -- Trang này: Dọc / Ngang --> LK{Trang 1 hoặc trang Anh cuối?}
    LK -- Có --> DIS[Nút bị khóa]
    LK -- Không --> PT[page-turn: đặt pageLayout turned=true cho mục đầu trang; đặt dấu đóng ở trang kế]
    PT --> RC[Biên dịch lại AD-25]
    RC --> BL{Trang cuối của phần xoay dùng < 55%?}
    BL -- Có --> FILL[Cảnh báo trang trống: Lấp bằng nội dung kế tiếp / Bỏ qua]
    BL -- Không --> UD[Có thể Hoàn tác: chỉ gỡ dấu, không đụng nội dung]
    FILL --> UD
    SEL --> E([Kết thúc])
    NO --> E
    OPN --> E
    DIS --> E
    UD --> E
```
