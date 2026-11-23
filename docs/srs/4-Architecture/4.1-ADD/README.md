# 4.1 ADD – Architecture Design Decisions

Nhật ký **22 quyết định kiến trúc** (ADR) rút ra từ mã nguồn và tài liệu thiết kế sẵn có (`docs/Architecture/*.pdf`, `docs/Audit/*`). Mỗi ADR nêu bối cảnh, quyết định, phương án loại, hệ quả và **bằng chứng trong mã** để dễ kiểm chứng.

| File | ADR | Chủ đề |
|---|---|---|
| [01-decisions-core.md](01-decisions-core.md) | ADR-01 … 11 | Monorepo, backend, CSDL, phân lớp, phân quyền, phiên, hợp đồng API, profile, mô hình tài liệu, offline-first, đồng bộ |
| [02-decisions-typesetting-platform-ops.md](02-decisions-typesetting-platform-ops.md) | ADR-12 … 22 | Biên dịch PDF, outbox/worker, tài nguyên, web+desktop, lịch sử, thùng rác, nhập Word, AI, xuất bản, triển khai, kiểm thử |

> Các PDF thiết kế gốc (Đề xuất kiến trúc v2, Kiến trúc Backend, Biên dịch LaTeX trong trình duyệt, Cơ chế lưu/hoàn tác, RBAC frontend, Đa nền tảng) là tài liệu đầu vào ở dạng nhị phân; các ADR ở đây ghi lại **phần đã hiện thực trong code** và chỉ rõ chỗ lệch (ADR-04, 11, 13).

## Mẫu ADR dùng trong tài liệu

```
## ADR-nn <Tiêu đề>
* Trạng thái: Đề xuất | Chấp nhận | Lỗi thời
* Bối cảnh:   vấn đề, lực tác động
* Quyết định: điều được chọn
* Phương án đã loại
* Hệ quả: (+) lợi / (−) giá phải trả
* Bằng chứng: tệp/hàm trong repo
```
