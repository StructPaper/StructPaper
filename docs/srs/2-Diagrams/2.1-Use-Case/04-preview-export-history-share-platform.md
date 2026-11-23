# 2.1.4 Use case – Xem trước/Xuất, Lịch sử, Chia sẻ/Thùng rác, Đồng bộ & Nền tảng

## Xem trước & Xuất bản (UC-PRV, UC-EXP)

```mermaid
flowchart LR
    Author([Author])
    Viewer([Viewer / Guest])
    subgraph PRV["Xem trước & biên dịch"]
        V1(["UC-PRV-01 Xem trước HTML"])
        V2(["UC-PRV-02 Biên dịch & xem PDF"])
        V3(["UC-PRV-03 Nhấp đúp PDF → mục"])
        V4(["UC-PRV-04 Xoay trang"])
        V5(["UC-PRV-05 Lấp trang trống"])
        V6(["UC-PRV-06 So sánh PDF"])
        V7(["UC-PRV-07 Xem lỗi biên dịch"])
        C4(["UC-CMP-04 Chọn compiler"])
    end
    subgraph EXP["Xuất bản"]
        X1(["UC-EXP-01 Xuất PDF"])
        X2(["UC-EXP-02 Xuất DOCX"])
        X3(["UC-EXP-03 Xuất JATS XML"])
        X4(["UC-EXP-04 Xuất XML + hình"])
        X5(["UC-EXP-05 Cổng kiểm tra đầu ra"])
        X6(["UC-EXP-06 Sao lưu zip"])
    end
    Author --> V1 & V2 & V3 & V4 & V5 & V6 & X1 & X2 & X3 & X4 & X6
    Viewer --> V2
    V2 -. "include" .-> C4
    V2 -. "extend (lỗi)" .-> V7
    V3 -. "extend" .-> V2
    V4 -. "include" .-> V2
    V5 -. "extend" .-> V4
    X1 -. "include" .-> X5
    X2 -. "include" .-> X5
    X3 -. "include" .-> X5
    X4 -. "include" .-> X3
    X1 -. "include" .-> V2
```

## Lịch sử phiên bản (UC-HIS)

```mermaid
flowchart LR
    Author([Author])
    Sys([System])
    subgraph HIS["Lịch sử"]
        H1(["UC-HIS-01 Xem lịch sử"])
        H2(["UC-HIS-02 Lưu phiên bản có tên"])
        H3(["UC-HIS-03 Xem 1 phiên bản"])
        H4(["UC-HIS-04 So sánh"])
        H5(["UC-HIS-05 Khôi phục"])
        H6(["UC-HIS-06 Đổi tên / ghim"])
        H7(["UC-HIS-07 Xóa phiên bản"])
        H8(["UC-HIS-08 Nhân bản bài"])
        H9(["UC-HIS-09 Tự động tạo phiên bản"])
    end
    Author --> H1 & H2 & H3 & H4 & H5 & H6 & H7 & H8
    Sys --> H9
    H4 -. "include" .-> H3
    H5 -. "include: tạo revision pre-risk" .-> H9
    H8 -. "include" .-> H3
```

## Chia sẻ & Thùng rác (UC-SHR, UC-TRS)

```mermaid
flowchart LR
    Owner([Owner])
    Viewer([Viewer / người dùng])
    Guest([Guest])
    Mgr([JournalManager])
    Sys([System])
    subgraph SHR["Chia sẻ"]
        S1(["UC-SHR-01 Tìm người"])
        S2(["UC-SHR-02 Thêm / đổi vai trò thành viên"])
        S3(["UC-SHR-03 Gỡ thành viên"])
        S4(["UC-SHR-04 Xem thành viên bài"])
        S5(["UC-SHR-05 Quyền chung"])
        S6(["UC-SHR-06 Sao chép link"])
        S7(["UC-SHR-07 Được chia sẻ với tôi"])
        S8(["UC-SHR-08 Khách xem bằng link"])
        S9(["UC-SHR-09 Tải PDF preview"])
        S10(["UC-SHR-10 Lấy PDF preview"])
    end
    subgraph TRS["Thùng rác"]
        T1(["UC-TRS-01 Xem thùng rác"])
        T2(["UC-TRS-02 Xem trước"])
        T3(["UC-TRS-03 Khôi phục"])
        T4(["UC-TRS-04 Xóa vĩnh viễn"])
        T5(["UC-TRS-05 Hàng loạt"])
        T6(["UC-TRS-06 Tự dọn"])
    end
    Owner --> S1 & S2 & S3 & S4 & S5 & S6 & S9
    Viewer --> S7 & S10 & T1 & T2 & T3
    Guest --> S8 & S10
    Mgr --> T1 & T2 & T3 & T4 & T5
    Owner --> T4
    Sys --> T6
    S2 -. "include" .-> S1
    T3 -. "include" .-> T2
    T5 -. "include" .-> T3
    T5 -. "include" .-> T4
```

## Đồng bộ, tài nguyên, biên dịch nền & nền tảng (UC-SYN, UC-AST, UC-CMP, UC-PLT)

```mermaid
flowchart LR
    Client([Client Web/Desktop])
    Sys([System / Worker])
    Upd([Desktop Updater])
    Ops([Ops])
    subgraph SYN["Đồng bộ"]
        Y1(["UC-SYN-01 Gửi patch"])
        Y2(["UC-SYN-02 Nhận SSE"])
        Y3(["UC-SYN-03 Lấy missing ops"])
        Y4(["UC-SYN-04 Lấy cây tài liệu"])
        Y5(["UC-SYN-05 Đồng bộ outbox offline"])
        Y6(["UC-SYN-06 Giải quyết xung đột"])
    end
    subgraph AST["Tài nguyên"]
        F1(["UC-AST-01 Upload-intent"])
        F2(["UC-AST-02 Upload-complete"])
        F3(["UC-AST-03 Lấy asset"])
    end
    subgraph CMP["Biên dịch server/nền"]
        C1(["UC-CMP-01 Biên dịch LaTeX server"])
        C2(["UC-CMP-02 Xem hàng đợi"])
        C3(["UC-CMP-03 Biên dịch nền (worker)"])
    end
    subgraph PLT["Nền tảng"]
        L1(["UC-PLT-01 Chạy bản Desktop"])
        L2(["UC-PLT-02 Cập nhật tự động"])
        L3(["UC-PLT-03 Làm việc offline"])
        L4(["UC-PLT-04 Health check"])
        L5(["UC-PLT-05 Outbox dispatch"])
        L6(["UC-PLT-06 CI/CD triển khai"])
    end
    Client --> Y1 & Y2 & Y3 & Y4 & Y5 & F1 & F2 & F3 & C1 & C2 & L1 & L3
    Upd --> L2
    Ops --> L4 & L6
    Sys --> C3 & L5
    Y1 -. "extend (409)" .-> Y3
    Y1 -. "extend (409)" .-> Y6
    Y5 -. "include" .-> Y1
    F2 -. "include" .-> F1
    L5 -. "include" .-> C3
    L1 -. "include" .-> L3
    L1 -. "include" .-> L2
```
