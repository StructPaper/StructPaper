# 4.2 SAD – Software Architecture Document

Tài liệu kiến trúc phần mềm của StructPaper, trình bày theo các **view** (kiểu 4+1/C4). Nội dung bám mã nguồn tại 2026-11-20.

| File | View |
|---|---|
| [01-introduction-and-goals.md](01-introduction-and-goals.md) | Mục đích, phạm vi, bên liên quan, ràng buộc, mục tiêu chất lượng |
| [02-context-and-container-views.md](02-context-and-container-views.md) | Ngữ cảnh hệ thống & container (C4 mức 1–2) |
| [03-component-views.md](03-component-views.md) | Thành phần: API, Worker, Web, các package lõi (C4 mức 3) |
| [04-runtime-views.md](04-runtime-views.md) | Các kịch bản chạy then chốt (trỏ tới Sequence 2.3) |
| [05-deployment-view.md](05-deployment-view.md) | Triển khai: dev / staging / production / desktop |
| [06-data-view.md](06-data-view.md) | Kiến trúc dữ liệu và luồng dữ liệu |
| [07-security-view.md](07-security-view.md) | Mô hình bảo mật |
| [08-cross-cutting-concepts.md](08-cross-cutting-concepts.md) | Khái niệm xuyên suốt: lỗi, xác thực dữ liệu, cấu hình, log, kiểm thử, đa ngôn ngữ, hiệu năng |
| [09-risks-and-technical-debt.md](09-risks-and-technical-debt.md) | Rủi ro, nợ kỹ thuật, khoảng trống kiến trúc |

Liên quan: [ADD](../4.1-ADD/README.md) (vì sao), [ASR](../4.3-ASR/README.md) (yêu cầu quyết định kiến trúc), [Utility/Fault tree](../4.4-Faulttree-Utilitytree/README.md).
