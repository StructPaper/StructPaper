# Thùng rác (xóa mềm) và link mời không còn cứng tên miền

## 1. Thùng rác

### Hành vi
- **Xóa bài = chuyển vào thùng rác**, không xóa thật. `DELETE /manuscripts/:id` đặt `manuscripts.deleted_at` / `deleted_by` (migration `0002_manuscript_trash`)
  và ghi audit `manuscript.trash`. Luật ai được xóa giữ nguyên (chủ bài; bài đã vào quy trình thì chỉ quản lý).
- Bài trong thùng rác **biến mất ở mọi nơi trừ thùng rác**: danh sách, mở bài, sửa, lịch sử phiên bản, chia sẻ, bản xem trước, kiểm tra trùng tên, đồng bộ,
  áp dụng quy tắc cho mọi bài. Mọi truy vấn đó lọc `deleted_at IS NULL` (mở bài đã xóa trả 404).
- Bài giữ nguyên lịch sử, thành viên, chia sẻ khi nằm trong thùng rác.

### Ai thấy và làm được gì
- **Ai cũng có thùng rác** và thấy icon trên dock. Người thường (tác giả, editor...) chỉ thấy **các bài do chính mình xóa** , **khôi phục** và **xóa vĩnh viễn** được chúng.
- **Quản lý tạp chí trở lên** (JournalManager toàn hệ thống hoặc một tạp chí, SuperAdmin; capability `trash:manage`) thấy thêm mọi bài bị xóa trong **tạp chí họ quản lý**
  (SuperAdmin: tất cả), khôi phục và xóa vĩnh viễn được cả những bài đó.
- Quyền kiểm tra theo từng bài ở server (không chỉ theo vai trò); mỗi mục trả `access.canRestore` / `access.canPurge` và giao diện chỉ hiện nút theo đó.
- Quy tắc: khôi phục = (người đã xóa bài) hoặc (manage bài đó); xóa vĩnh viễn = cũng vậy (người đã xóa bài, hoặc manage bài đó).

### API (`/api/v1/manuscripts`)
| Endpoint | Việc |
|---|---|
| `GET /trash?search=&limit=` | Bài người gọi đã xóa (quản lý: thêm bài của tạp chí họ). Mỗi mục: tiêu đề, tạp chí, chủ bài, người xóa, ngày xóa, `purgeAt`, `daysLeft`, `access`; kèm `retentionDays` |
| `POST /trash/:id/restore` | Khôi phục: người đã xóa hoặc quản lý tạp chí (403 nếu không; 409 nếu bài không ở trong thùng rác) |
| `DELETE /trash/:id` | Xóa vĩnh viễn một bài trong thùng rác (cùng lịch sử, thành viên, chia sẻ); người đã xóa bài hoặc quản lý tạp chí của bài đó; không hoàn tác được |
| `POST /trash/bulk` {action: restore|purge, ids?} | Khôi phục / xóa vĩnh viễn nhiều bài một lượt; bỏ `ids` = mọi bài người gọi thấy ("dọn sạch"). Bài không thuộc quyền bị bỏ qua (`skipped`) |

Khôi phục và xóa vĩnh viễn ghi audit (`manuscript.restore`, `manuscript.purge`).

### Tự dọn
Bài ở trong thùng rác quá **`TRASH_RETENTION_DAYS`** (mặc định 30) bị xóa vĩnh viễn (`TrashService.purgeExpired`): chạy lúc API khởi động và mỗi 6 giờ
(timer không giữ tiến trình sống); ghi audit `manuscript.purge_expired`.

### Giao diện
- Trang `/trash`, icon **Thùng rác** trên dock ngay dưới "Phân quyền & Vai trò", hiện cho mọi người đăng nhập.
- Thẻ mỗi bài: nhãn tạp chí, tiêu đề, "Xóa 2 giờ trước bởi …", chủ bài, chip "Còn N ngày" (vàng khi ≤ 7 ngày, đỏ khi ≤ 3), nút **Khôi phục** (có hộp xác nhận) và **Xóa vĩnh viễn** (cảnh báo không hoàn tác); nút xoay trong hộp xác nhận tới khi server xong, rồi mới hiện thông báo.
  Bố cục như trang Bài báo: tìm kiếm, chip lọc (tất cả / sắp hết hạn / tôi xóa / người khác xóa), lọc tạp chí, sắp xếp, dạng lưới hoặc bảng, chọn nhiều bài, **Khôi phục tất cả**, **Dọn sạch thùng rác**. Dòng ghi chú nói rõ bạn thấy những bài nào. Tìm theo tiêu đề; trạng thái trống, đang tải, lỗi.
- Hộp xóa bài và các thông báo ở trang Bài báo nay nói rõ "chuyển vào Thùng rác, quản lý tạp chí có thể khôi phục trong thời gian lưu giữ".

### Xem bài trong thùng rác
- Bấm vào thẻ hoặc dòng thì mở `/trash/[id]`: nội dung bài chỉ đọc (cùng bộ hiển thị với trang lịch sử), thanh ghi chú "đang nằm trong thùng rác",
  nút Khôi phục / Xóa vĩnh viễn (theo `access`, có xoay + xác nhận). Khôi phục xong mở thẳng bài trong trình soạn thảo; xóa vĩnh viễn xong về thùng rác.
- Server: `GET /manuscripts/trash/:id` trả mục + `metadata`; cùng quyền với khôi phục (người xóa hoặc quản lý tạp chí; người khác 403, bài chưa xóa 409).

### Nút quay lại = lùi đúng 1 trang
- `lib/app-history.ts` ghi lại các trang đã đi qua trong tab (sessionStorage; `popstate` mới tính là lùi). `useGoBack(fallback)` gọi `router.back()` khi
  phía sau có một trang của app, nếu không (mở bằng link, tải lại) thì đi tới `fallback`. Trình soạn thảo bỏ qua trang `/history` để không quay vòng.
- Dùng cho: trình soạn thảo bài báo (cả bản chỉ đọc), trang xem trước PDF, chi tiết mẫu tạp chí (có hỏi khi chưa lưu), trang xem bài trong thùng rác.
- Nguyên nhân phải bấm back nhiều lần: iframe xem trước PDF đổi `src` (blob mới) sau mỗi lần biên dịch, mỗi lần thêm một mục vào lịch sử trình duyệt.
  Iframe giờ có `key` theo URL của PDF (iframe mới không thêm mục lịch sử).

### Giới hạn
- Xóa bài chỉ nằm trên máy (chưa có trên server) vẫn xóa luôn.
- Chưa có nút "Dọn sạch thùng rác" một lần; từng bài xóa vĩnh viễn riêng.

## 2. Link mời tham gia không cứng tên miền
Trước đây server dựng link kích hoạt từ `APP_URL` (mặc định `http://localhost:3000`), nên đổi tên miền là link sai.
- Server trả thêm **`activationPath`** (`/activate#token=…`, không có tên miền); `activationUrl` vẫn có để tương thích.
- **Màn hình** (sao chép link, hiện link, tạo link mới) ghép tên miền của **trang đang mở** (`window.location.origin`) vào `activationPath`
  (`lib/absolute-link.ts`), nên luôn đúng dù đổi tên miền.
- **Email mời** cần địa chỉ đầy đủ: lấy từ trang quản trị viên đang dùng (header `Origin`/`Referer`), chỉ tin khi nằm trong `CORS_ORIGIN`
  (không cấu hình hoặc `*` thì nhận mọi trang); không có thì dùng `APP_URL`. Không có cả hai: không gửi mail (ghi cảnh báo), link vẫn trả cho người mời.
  Không còn mặc định `localhost`.
