# 2.1 Use Case diagrams

Sơ đồ use case của toàn hệ thống, chia theo module. Mermaid không có loại use-case gốc nên dùng `flowchart`: **hình chữ nhật bo tròn** = actor, **oval** = use case, **mũi tên nét liền** = actor tham gia, **nét đứt** = `include`/`extend`.

| File | Nội dung | Mã UC |
|---|---|---|
| [00-overview.md](00-overview.md) | Tổng quan actor, nhóm use case, ma trận actor × nhóm | tất cả |
| [01-auth-members-roles.md](01-auth-members-roles.md) | Xác thực, thành viên, vai trò | UC-AUTH, UC-MEM, UC-ROLE |
| [02-journals-templates.md](02-journals-templates.md) | Tạp chí, loại bài, vòng đời Profile, Template Builder | UC-JRN |
| [03-papers-editor.md](03-papers-editor.md) | Quản lý bài, nhập Word, trình soạn thảo | UC-PAP, UC-EDT |
| [04-preview-export-history-share-platform.md](04-preview-export-history-share-platform.md) | Xem trước/xuất, lịch sử, chia sẻ, thùng rác, đồng bộ, tài nguyên, nền tảng | UC-PRV, UC-EXP, UC-HIS, UC-SHR, UC-TRS, UC-SYN, UC-AST, UC-CMP, UC-PLT |

Bảng mô tả chi tiết từng UC: [1.1 Use case](../../1-BRD/1.1-Use-case.md).
