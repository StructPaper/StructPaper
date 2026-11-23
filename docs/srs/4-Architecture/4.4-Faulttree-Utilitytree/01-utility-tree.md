# 4.4.1 Utility tree (cây tiện ích chất lượng)

Gốc **Utility** → thuộc tính chất lượng → mối quan tâm → **kịch bản** kèm ưu tiên **(Mức quan trọng nghiệp vụ, Mức khó kiến trúc)**: H/M/L. Kịch bản (H,H) là ASR cốt lõi, xem [4.3 ASR](../4.3-ASR/README.md).

```mermaid
flowchart LR
    U(("UTILITY<br/>StructPaper"))

    U --> Q1["Độ chính xác chế bản"]
    U --> Q2["Độ bền & sẵn sàng dữ liệu"]
    U --> Q3["Bảo mật"]
    U --> Q4["Hiệu năng"]
    U --> Q5["Khả năng thay đổi"]
    U --> Q6["Khả năng vận hành"]
    U --> Q7["Khả năng sử dụng"]

    Q1 --> Q1a["Tái lập quy định"]
    Q1a --> S1["S1 Tạp chí ra quy tắc mới, bài cũ không đổi (H,H) ASR-01"]
    Q1 --> Q1b["Khớp mẫu in"]
    Q1b --> S2["S2 PDF bài mẫu EBL/EES khớp bản in: cột, bảng dài, công thức (H,H) ASR-02"]
    Q1b --> S3["S3 JATS hợp lệ DTD 1.2, ảnh đúng đường dẫn (H,L) ASR-13"]
    Q1b --> S4["S4 Không tự bịa DOI/tập/số/ngày (H,L)"]

    Q2 --> Q2a["Không mất dữ liệu"]
    Q2a --> S5["S5 Mất mạng khi đang sửa: 0 mất dữ liệu, tự đồng bộ lại (H,H) ASR-03"]
    Q2a --> S6["S6 Hai phiên cùng sửa: phát hiện xung đột, không ghi đè ngầm (H,M)"]
    Q2 --> Q2b["Khôi phục"]
    Q2b --> S7["S7 Khôi phục bản cũ/bài đã xóa trong 30 ngày (H,M) ASR-14"]
    Q2 --> Q2c["Ngoại tuyến"]
    Q2c --> S8["S8 Desktop không mạng: soạn, biên dịch, xuất (H,M) ASR-04"]

    Q3 --> Q3a["Kiểm soát truy cập"]
    Q3a --> S9["S9 Reviewer chỉ xem; guest chỉ đọc khi VIEWER (H,M) ASR-05"]
    Q3a --> S10["S10 Đổi vai trò có hiệu lực ngay (M,M) ASR-06"]
    Q3 --> Q3b["Bảo vệ bí mật"]
    Q3b --> S11["S11 Khóa AI/secret không lộ cho client (M,L) ASR-17"]
    Q3 --> Q3c["Chống lạm dụng"]
    Q3c --> S12["S12 Một người gửi quá nhiều biên dịch: 429, người khác vẫn chạy (M,H) ASR-08"]

    Q4 --> Q4a["Tương tác"]
    Q4a --> S13["S13 Bài 150 mục: đổi thẻ < 130 ms, mở < 2 s (M,M) ASR-07"]
    Q4 --> Q4b["Thông lượng"]
    Q4b --> S14["S14 Nhập 100 tệp Word, đọc/lưu/biên dịch song song (M,M) ASR-12"]
    Q4 --> Q4c["Biên dịch"]
    Q4c --> S15["S15 Máy yếu/bài lớn tự chuyển server; bài chính thức luôn server (M,H) ASR-08"]

    Q5 --> Q5a["Dữ liệu hóa quy tắc"]
    Q5a --> S16["S16 Thêm tạp chí/loại bài/đổi cỡ chữ không cần deploy (H,M) ASR-09"]
    Q5 --> Q5b["Mở rộng mã"]
    Q5b --> S17["S17 Thêm capability mới: thiếu quy tắc thì không biên dịch (M,L)"]
    Q5b --> S18["S18 Đổi hợp đồng API: test OpenAPI/Orval phát hiện (M,L) ASR-10"]
    Q5b --> S19["S19 Package lõi không phụ thuộc ngược: CI chặn (M,L)"]

    Q6 --> Q6a["Triển khai"]
    Q6a --> S20["S20 Deploy staging→prod bằng image, migrate+seed tự động (M,M) ASR-11"]
    Q6 --> Q6b["Giám sát"]
    Q6b --> S21["S21 Phát hiện API/DB chết trong ≤ 1 phút: healthcheck 15 s x 8 (M,L)"]

    Q7 --> Q7a["Học & dùng"]
    Q7a --> S22["S22 Cổng kiểm tra không chặn, 'Vẫn xuất' (M,L)"]
    Q7 --> Q7b["Tiếng Việt"]
    Q7b --> S23["S23 Gõ tiếng Việt IME, NFC, tìm không dấu (M,L)"]
```

## Bảng ưu tiên

| Ưu tiên | Kịch bản | Lý do ảnh hưởng kiến trúc |
|---|---|---|
| (H,H) | S1, S2, S5 | Quyết định mô hình profile bất biến, pipeline LaTeX, kiến trúc local-first |
| (H,M) | S6, S7, S8, S9, S16 | Xác định khóa lạc quan, revision/trash, nền tảng đa môi trường, CASL, dữ liệu hóa cấu hình |
| (M,H) | S12, S15 | Xác định Compiler Router + hàng đợi công bằng |
| (M,M) | S10, S13, S14, S20 | Cache quyền, ảo hóa danh sách, limiter, CI/CD |
| (H,L)/(M,L) | S3, S4, S11, S17–S19, S21–S23 | Kỷ luật kỹ thuật (test, contract, guard) hơn là cấu trúc |

## Độ phủ

Mỗi ASR trong [4.3](../4.3-ASR/README.md) xuất hiện ít nhất một lần trong cây; kịch bản không thuộc ASR (S4, S17, S19, S21–S23) là **ràng buộc thiết kế** đã được hiện thực bằng test hoặc luật CI.
