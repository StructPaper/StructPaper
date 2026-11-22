# 2.3 Sequence diagrams

Mỗi Activity diagram `AD-xx` ở [2.2](../2.2-Activity/README.md) có đúng một Sequence diagram `SD-xx` (cùng số thứ tự). Tên participant bám theo class/module thực trong mã nguồn.

| File | SD ↔ AD | Tính năng |
|---|---|---|
| [01-identity-access.md](01-identity-access.md) | SD-01 … SD-07 | Đăng nhập, refresh, kích hoạt, đặt lại mật khẩu, mời thành viên, gán vai trò, kiểm tra quyền |
| [02-journals-profiles.md](02-journals-profiles.md) | SD-08 … SD-12 | Tạp chí/loại bài, vòng đời profile, resolve & pin, áp dụng hàng loạt, Template Builder |
| [03-papers-ingest.md](03-papers-ingest.md) | SD-13 … SD-19 | Tạo bài, nhập Word, nhập hàng loạt, workflow, thùng rác, dọn tự động, đổi loại bài/nâng cấp profile |
| [04-editing-sync.md](04-editing-sync.md) | SD-20 … SD-24 | Autosave, sync patch, upload asset, outbox offline, AI |
| [05-compile-export.md](05-compile-export.md) | SD-25 … SD-29 | Biên dịch (router), worker, QC, xuất, tương tác PDF |
| [06-history-sharing-platform.md](06-history-sharing-platform.md) | SD-30 … SD-34 | Revision, khôi phục, chia sẻ, chỉ xem/guest, cập nhật Desktop |

**34 sequence diagram** ↔ 34 activity diagram.
