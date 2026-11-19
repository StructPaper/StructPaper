# Hoàn tác toàn cục và lịch sử phiên bản của bài báo: hiện trạng

Căn cứ: `docs/Architecture/Cơ chế lưu, hoàn tác và lịch sử phiên bản (kiểu Google Docs) — Thiết kế chi tiết.pdf`.
Đã làm: **H1** (undo/redo), **H4** (revision), **H5** (so sánh, xem bản cũ, khôi phục). Chưa làm theo yêu cầu: **H2b** (ghi nhật ký + checkpoint),
**H3** (khóa nhiều tab), **H6** (đồng bộ theo patch/offline).

## 1. Undo/redo toàn cục (H1)
- `apps/web/src/lib/history/`: `paper-content.ts` (phần nội dung được hoàn tác: `metadata`, `sections`, `references`, `layoutSettings`, `displayName`;
  `version`, `profilePin`, `articleTypeCode` của server **không** bị undo), `editor-history.ts` (ngăn xếp duy nhất, tối đa 300 bước),
  `focus.ts` (nhớ và đặt lại con trỏ).
- Mỗi bước giữ nội dung trước và sau; phần không đổi dùng chung tham chiếu (immutable) nên rẻ. Gõ liên tục trong cùng một chỗ
  (khoá `field:title`, `section:<id>`...) cách nhau dưới 1 giây và không quá 20 giây là **một bước**; sửa nhiều chỗ một lúc là một bước không gộp.
- `useEditorHistory` quan sát `formData`; Ctrl/Cmd+Z, Ctrl+Shift+Z, Ctrl+Y (không chặn khi đang có hộp thoại, hoặc con trỏ ở ô ngoài các tab soạn thảo).
  Trước khi undo, ô đang gõ được blur để TipTap đẩy chữ chưa commit vào bài.
- **Focus**: bước lưu `tab`, `sectionId` (thẻ `section-card-<id>`), vị trí ô trong thẻ/tab, thuộc tính nhận diện và vùng chọn. Undo chuyển tab, cuộn tới đúng đoạn,
  mở đoạn để gõ (TipTap) và đặt con trỏ; đoạn bị xoá/được thêm thì chuyển tới đúng tab. Panel tab có `data-editor-panel`.
- TipTap: `undoRedo: false` để chỉ còn một lịch sử.
- Nút Hoàn tác / Làm lại trên title bar (tooltip nói bước sẽ hoàn tác gì).

## 2. Revision của server (H4)
- Bảng `manuscript_revisions` (migration `0001_manuscript_revision_history`): thêm `kind`, `description`, `stats`, `pinned`, `size_bytes`; `tag_name` là tên,
  `checksum` là dấu vân tay nội dung (`contentFingerprintSource` của `@structpaper/doc-diff`). Kind `sync` là checkpoint của op log, không hiện trong lịch sử bài.
- `RevisionService` (`apps/api/src/modules/manuscripts/application/revision.service.ts`, module riêng `RevisionsModule`):
  - **Tự động** (`beforeSave`, gọi trước mỗi lần PATCH): bản đầu tiên; nghỉ ≥ 5 phút hoặc sửa liên tục ≥ 30 phút thì nội dung *trước* lần lưu này thành revision `auto`;
    đổi tạp chí → `pre-risk` "Trước khi đổi tạp chí"; chuyển trạng thái quan trọng (gửi duyệt, đang phản biện, sẵn sàng, chấp nhận...) → `named` được ghim "Gửi duyệt"...
  - **Trước thao tác rủi ro**: đổi loại bài (`pre-risk`), nâng cấp quy tắc cho một bài và áp dụng cho mọi bài (`profile-upgrade`), khôi phục (`pre-risk`).
    Nếu revision mới nhất cùng nội dung và là `auto` thì được đổi nhãn thay vì nhân đôi.
  - **Có tên**: `POST /manuscripts/:id/revisions` (tối đa 100/bài), ghim; đặt tên cho bản tự động biến nó thành bản có tên.
  - **Cắt tỉa** sau mỗi lần ghi (`revisionsToDrop`, thuần): 24 giờ đầu giữ hết; 1-7 ngày một bản/ngày; 7-30 ngày một bản/tuần; sau đó một bản/tháng; bản lưu an toàn 90 ngày
    (luôn giữ 5 bản mới nhất); tối đa 300 bản không ghim; bản ghim không bao giờ bị cắt.
  - Mỗi revision có `stats` (khối thêm/xoá/sửa/di chuyển, số từ, số tài liệu tham khảo...) tính bằng `diffDocs`.
- API: `GET/POST /manuscripts/:id/revisions`, `GET/PATCH/DELETE …/:revisionId` (chỉ xoá bản có tên), `POST …/restore`, `POST …/duplicate`.
- **Khôi phục** không viết lại lịch sử: giữ trạng thái hiện tại thành `pre-risk` "Trước khi khôi phục", đưa nội dung về bản đích, ghi revision `restore`
  (đo thay đổi so với nội dung vừa bị thay), tăng `version`. `profilePin` là cột của server nên **không** quay lại cùng nội dung (khác thiết kế gốc, nơi pin nằm trong doc).

## 3. So sánh (`packages/doc-diff`)
Gói thuần, dùng chung cho server (đếm) và web (vẽ). So theo **id** của khối, tác giả, đơn vị, tài liệu tham khảo: phân biệt thêm / xoá / sửa / di chuyển
(dãy tăng dài nhất), diff từng từ cho tiêu đề, tóm tắt, đoạn văn. Bảng so theo ô theo vị trí hàng/cột (hàng/cột chưa có id: kém chính xác hơn khi chèn hàng).

## 4. Trang lịch sử (H5)
`/papers/[id]/history` thay cả trang soạn thảo; vào từ menu **Tệp → Lịch sử phiên bản** (lưu bài trước khi chuyển trang). Title bar hiện "Lịch sử phiên bản" + tên bài.
- Phải: danh sách theo ngày, bản tự động cùng một phiên làm việc (cách nhau < 30 phút, cùng người) gộp thành một dòng mở ra được; lọc Tất cả / Có tên / Tự động /
  Trước thao tác rủi ro / Khôi phục; "Phiên bản hiện tại" luôn ở đầu; xem thêm bản cũ.
- Trái: bản đang chọn dựng như trang đọc, đánh dấu thay đổi so với bản liền trước (chữ thêm xanh, chữ xoá đỏ gạch, khối mới/xoá/sửa/di chuyển có viền và nhãn, danh sách
  thông tin đã đổi, nút nhảy tới thay đổi trước/sau), bật tắt đánh dấu.
- Hành động: Lưu phiên bản (đặt tên + ghi chú), Đặt/Đổi tên, Xoá (chỉ bản có tên, có xác nhận), Khôi phục (có xác nhận, quay về trang soạn thảo),
  Tạo bản sao (bài mới), **Chèn vào bài hiện tại** từng khối của bản cũ (khối nhận id mới, thêm vào cuối bài).
- Người chỉ xem không thấy các nút ghi.

## 5. Chưa làm / giới hạn
- H2b (journal + checkpoint), H3 (Web Locks), H6 (outbox/ops/offline, hợp nhất) vẫn là kế hoạch; web vẫn lưu cả tài liệu bằng PATCH.
- Chưa so sánh hai phiên bản bất kỳ (chỉ với bản liền trước); chưa tô màu theo tác giả; chưa biên dịch lại PDF của bản cũ.
- Undo không lưu qua lần tải lại (`persistUndo = false`). Nút Back của trình duyệt khi có thay đổi chưa lưu chưa bị chặn.
- Chưa kiểm tra trên trình duyệt thật (đăng nhập staging không có mật khẩu cho phiên kiểm tra); test tự động: `packages/doc-diff`, `apps/web/test/history/*`,
  `apps/api/test/manuscripts/revisions.integration.spec.ts` (Postgres thật khi có `TEST_DATABASE_URL`).
