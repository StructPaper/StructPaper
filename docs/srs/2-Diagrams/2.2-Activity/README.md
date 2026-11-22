# 2.2 Activity diagrams

Mỗi tính năng/nhóm tính năng có một **Activity diagram** (`AD-xx`) viết bằng Mermaid `flowchart` (hình thoi = rẽ nhánh, `[[AD-xx]]` = gọi sang diagram khác). Mỗi `AD-xx` có **đúng một** Sequence diagram tương ứng `SD-xx` ở [2.3](../2.3-Sequence/README.md).

| File | AD | Tính năng | UC |
|---|---|---|---|
| [01-identity-access.md](01-identity-access.md) | AD-01 | Đăng nhập | UC-AUTH-01 |
| | AD-02 | Làm mới phiên | UC-AUTH-02 |
| | AD-03 | Kích hoạt tài khoản | UC-AUTH-04 |
| | AD-04 | Đặt lại mật khẩu | UC-AUTH-05 |
| | AD-05 | Mời thành viên | UC-MEM-02…05 |
| | AD-06 | Gán/gỡ vai trò (bất biến SuperAdmin) | UC-ROLE-02…04 |
| | AD-07 | Kiểm tra quyền mỗi request (CASL) | – (xuyên suốt) |
| [02-journals-profiles.md](02-journals-profiles.md) | AD-08 | Tạo tạp chí & loại bài | UC-JRN-04…08 |
| | AD-09 | Vòng đời Profile (nháp → xuất bản → rollback) | UC-JRN-09…14 |
| | AD-10 | Resolve & ghim profile | UC-JRN-03, UC-PAP-01 |
| | AD-11 | Áp dụng profile mới cho các bài | UC-JRN-15 |
| | AD-12 | Template Builder | UC-JRN-17 |
| [03-papers-ingest.md](03-papers-ingest.md) | AD-13 | Tạo bài mới | UC-PAP-01/02/07 |
| | AD-14 | Nhập một tệp Word | UC-PAP-03, UC-EDT-15 |
| | AD-15 | Nhập hàng loạt | UC-PAP-04 |
| | AD-16 | Đổi trạng thái workflow | UC-PAP-10 |
| | AD-17 | Xóa → thùng rác → khôi phục/xóa vĩnh viễn | UC-PAP-09, UC-TRS-01…05 |
| | AD-18 | Tự động dọn thùng rác | UC-TRS-06 |
| | AD-19 | Đổi loại bài & nâng cấp profile của bài | UC-PAP-11/12 |
| [04-editing-sync.md](04-editing-sync.md) | AD-20 | Tự động lưu / lưu thủ công | UC-EDT-11/12/19, UC-SYN-06 |
| | AD-21 | Gửi patch thời gian thực & xung đột | UC-SYN-01…04 |
| | AD-22 | Tải ảnh lên | UC-AST-01/02, UC-EDT-06 |
| | AD-23 | Đồng bộ outbox offline | UC-SYN-05, UC-PLT-03 |
| | AD-24 | Trợ lý AI | UC-EDT-17 |
| [05-compile-export.md](05-compile-export.md) | AD-25 | Biên dịch PDF với router 11 luật | UC-PRV-02, UC-CMP-01/02/04 |
| | AD-26 | Worker biên dịch nền & outbox | UC-CMP-03, UC-PLT-05 |
| | AD-27 | QC & cổng kiểm tra xuất | UC-EDT-14, UC-EXP-05 |
| | AD-28 | Xuất PDF/DOCX/JATS/zip | UC-EXP-01…04 |
| | AD-29 | Tương tác PDF & xoay trang | UC-PRV-03/04/05 |
| [06-history-sharing-platform.md](06-history-sharing-platform.md) | AD-30 | Phiên bản tự động & có tên | UC-HIS-02, UC-HIS-09 |
| | AD-31 | Xem/so sánh/khôi phục/nhân bản phiên bản | UC-HIS-01…08 |
| | AD-32 | Chia sẻ bài | UC-SHR-01…05 |
| | AD-33 | Chỉ xem, khách, PDF preview | UC-PAP-13, UC-SHR-07…10 |
| | AD-34 | Cập nhật tự động Desktop | UC-PLT-02 |

**34 activity diagram.** Các tính năng nhỏ (sửa thông tin, thêm tác giả, thêm hình…) là thao tác CRUD trên mô hình tài liệu rồi đi vào **AD-20** (tự động lưu).
