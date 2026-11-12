# Quy trình làm việc theo tài liệu (kiểu Word)

Phần mềm tổ chức quanh **từng tài liệu**: tạo mới (đặt tên) → chỉnh sửa (tự động lưu) → lưu → mở lại → xuất Word / PDF / XML.

## 1. Vòng đời tài liệu

| Thao tác | Nơi thực hiện | Cách hoạt động |
| --- | --- | --- |
| **Mới** | `Tệp ▸ Mới…` hoặc nút tạo ở trang Bài báo | Hộp thoại có ô **Tên tài liệu**. Để trống thì lấy theo tiêu đề bài báo. |
| **Nhập Word gốc** | Hộp thoại Mới, bước tải tệp | Chạy **cổng kiểm tra đầu vào** (mục 3) trước khi vào chỉnh sửa. Chọn **nhiều** tệp cùng lúc thì chuyển sang **nhập hàng loạt** (mục 2b). |
| **Chỉnh sửa** | Trình soạn thảo | Mọi thay đổi được **tự động lưu** sau ~1,2 giây ngừng gõ, và khi ẩn tab/đóng trang. |
| **Lưu** | `Tệp ▸ Lưu` / `Ctrl+S` | Lưu ngay và tạo thêm **bản chụp phiên bản** (file JSON trong kho tệp). |
| **Mở** | `Tệp ▸ Mở…` | Danh sách tài liệu đã lưu, gộp từ máy này (IndexedDB) và máy chủ; tìm theo tên. |
| **Đổi tên** | Ô tên trên thanh menu | Enter hoặc rời ô để xác nhận. |
| **Xuất** | `Tệp ▸ Xuất thành` | **Cổng kiểm tra đầu ra** (mục 4), rồi tải Word (.docx), PDF hoặc XML JATS; bản xuất cũng được lưu lên máy chủ. |

Chỉ báo trạng thái ở góc phải thanh menu:

| Trạng thái | Ý nghĩa |
| --- | --- |
| Đang chờ lưu / Đang lưu | Có thay đổi chưa ghi / đang ghi. |
| Đã lưu | Đã ghi trên máy **và** máy chủ. |
| Đã lưu trên máy | Máy chủ không với tới được; dữ liệu an toàn trên máy, tự thử lại ở lần lưu sau. |
| Xung đột phiên bản | Phiên khác đã lưu bản mới hơn. Nút **Ghi đè bằng bản của tôi** để chọn bản đang soạn. |
| Lưu thất bại | Không ghi được cả trên máy — cần xử lý ngay. |

## 2. Lưu trữ

* **Trên máy (ưu tiên, offline):** IndexedDB qua `@structpaper/storage`.
* **Máy chủ:** `apps/api`, module `document`.
  * **CSDL** (H2 khi dev, MySQL khi chạy thật; Flyway `V2__documents.sql`): bảng `documents` (tên, trạng thái, `rev`, nội dung JSON) và `document_exports`.
  * **Kho tệp** (`ObjectStorage`): **MinIO** khi `STRUCTPAPER_STORAGE_TYPE=minio`, mặc định lưu thư mục `./data/objects`. Chứa bản chụp phiên bản `documents/{id}/snapshots/{rev}.json` và các bản xuất `documents/{id}/exports/{id}.{docx|pdf|xml}`.
  * Hình ảnh được tải một lần theo **SHA-256** lên `/api/v1/assets/{sha256}`; JSON tài liệu chỉ giữ tham chiếu `asset:<sha256>` (không nhúng ảnh base64).
* Khoá lạc quan: `baseRev` trong `PUT /documents/{id}`; sai phiên bản trả **412**.

Khởi chạy MinIO: `docker compose -f docker-compose.minio.yml up -d`, rồi chạy API với các biến môi trường ghi trong tệp đó.

### API chính (`/api/v1/documents`)

| Phương thức | Đường dẫn | Mô tả |
| --- | --- | --- |
| GET | `/` | Danh sách (không kèm nội dung) cho hộp thoại Mở |
| POST | `/` | Tạo mới có tên |
| GET | `/{id}` | Mở (kèm nội dung) |
| PUT | `/{id}` | Tự động lưu / Lưu (upsert; `snapshot=true` ghi bản chụp) |
| DELETE | `/{id}` | Xóa mềm |
| POST/GET | `/{id}/exports` | Lưu / liệt kê bản xuất (multipart `format`, `file`) |
| GET | `/{id}/exports/{exportId}` | Tải bản xuất |

## 2b. Nhập nhiều tệp Word cùng lúc

Trong hộp thoại **Tạo bài báo mới**, chọn (hoặc kéo thả) **2 tệp .docx trở lên**: mỗi tệp thành một bài báo, hệ thống đọc, lưu và biên dịch PDF **song song**, người dùng không phải chờ hay thao tác từng bài. Một tệp thì giữ nguyên quy trình cũ (mục 3).

1. Chọn tệp → chọn mẫu tạp chí. Hai chế độ: **Một mẫu cho tất cả** (mặc định) hoặc **Mỗi tệp một mẫu** (mỗi tệp có ô chọn riêng, kèm "Đặt cùng một mẫu cho tất cả"; dùng khi lô gồm bài của nhiều tạp chí). Mỗi dòng trong bảng tiến độ hiện mẫu thực sự được áp dụng; Thử lại giữ đúng mẫu của từng tệp. Mở từ trang Mẫu tạp chí thì mẫu đã chọn sẵn, bỏ qua bước này. Không có tuỳ chọn "tự nhận mẫu": bộ đoán tạp chí của bộ đọc Word chỉ dò từ khoá và mặc định về HS nên không đủ tin cậy.
2. Bảng tiến độ: mỗi tệp một dòng với trạng thái *Đang chờ → Đang đọc tệp Word → Đang lưu → Chờ tới lượt biên dịch → Đang biên dịch PDF → Hoàn tất* (hoặc *Không tạo được* / *Đã hủy*), thanh tiến độ chung, số lỗi/cảnh báo của cổng kiểm tra đầu vào cho từng bài.
3. Giới hạn song song: **2 tệp đọc cùng lúc** (CPU trình duyệt), **3 PDF biên dịch cùng lúc** (CPU máy chủ); phần còn lại xếp hàng theo thứ tự. Tối đa **100 tệp** mỗi lần; tệp không phải Word bị bỏ qua và được báo.
4. Mỗi dòng có **Mở** (vào `/editor?id=…`, mở được ngay khi bài đã lưu dù PDF còn đang biên dịch) và **tải PDF**; cuối lô có **Tải tất cả PDF (.zip)**, **Thử lại** và **Xong**.
5. **Hủy** dừng các tệp chưa xong: tệp đang xếp hàng hoặc đang đọc không được tạo; bài đã lưu thì giữ lại và chỉ dừng PDF. Một tệp lỗi (hỏng, không lưu được) **không làm dừng** các tệp khác. **Thử lại** chạy lại tệp lỗi/đã hủy từ đầu, còn bài đã tạo mà chưa có PDF thì chỉ biên dịch lại PDF.
6. Đóng hộp thoại khi đang chạy **không dừng** lô: có thông báo khi xong và danh sách bài tự tải lại; mở lại hộp thoại sẽ thấy tiến độ.

Khác với nhập một tệp: tên bài lấy theo tiêu đề đọc được (hoặc tên tệp), **tự thêm "(1)", "(2)"** khi trùng thay vì hỏi; ô "Tên tài liệu" không dùng; cổng kiểm tra không chặn mà chỉ hiện số lỗi/cảnh báo, sửa trong trình soạn. Bài được lưu như nhập một tệp (IndexedDB, rồi bản sao máy chủ; PDF được lưu kèm trên máy chủ sau khi bản sao bài đã có).

Mã: `lib/batch-import/` (`limiter.ts` giới hạn đồng thời, `run-batch.ts` điều phối, `default-deps.ts` đọc/lưu/biên dịch thật, `zip-pdfs.ts`, `summary.ts`), `hooks/useBatchImport.ts`, `components/modals/CreatePaperModal/BatchImportPanel.tsx`. Điều phối chạy qua các phụ thuộc truyền vào nên kiểm thử bằng bản giả. Bài đã lưu được giải phóng khỏi bộ nhớ trong lúc chờ biên dịch (đọc lại từ IndexedDB), và chỉ gửi những ảnh mà mã LaTeX thật sự dùng (nhỏ hơn khoảng 6 lần so với trình soạn).

## 3. Cổng kiểm tra đầu vào (ngay sau khi nhập Word)

Chạy ngay khi nhập tệp, trước khi cho vào chỉnh sửa; **không chặn** (trừ tệp rỗng), nhưng liệt kê để sửa. Có nút **Tự động đánh lại số thứ tự**.

* Trường còn thiếu: tiêu đề, tác giả, đơn vị, tác giả liên hệ + email, tóm tắt (275–500 từ), 3–5 từ khóa, ngày nhận/sửa/chấp nhận (`dd/mm/yyyy`, đúng lịch, đúng thứ tự).
* **STT:** trích dẫn `[n]` theo thứ tự xuất hiện lần đầu (kiểu Vancouver); danh mục tham khảo liên tục; Bảng / Hình / Phương trình đánh số liên tục theo vị trí; mỗi đối tượng phải được nhắc trong văn bản **trước** khi xuất hiện; trích dẫn không có tài liệu tham khảo; tài liệu chưa được trích dẫn.
* Hình/Bảng thiếu dòng **Nguồn**; công thức sai cú pháp.

## 4. Cổng kiểm tra đầu ra (trước khi xuất)

Cùng bộ luật nhưng **mang tính cảnh báo**: bảng liệt kê mọi phần còn thiếu/sai, người dùng vẫn bấm **"Vẫn xuất"** được. Chỉ có một trường hợp không xuất được: PDF biên dịch lỗi (không có tệp để tải). Quy tắc nằm ở `apps/web/src/lib/validation/` (`numbering.ts`, `validators.ts`).

## 5. Công thức toán học

* Khối **Công thức** (`+ Công thức`): nhập LaTeX, xem KaTeX trực tiếp, đánh số tự động `(n)`.
* Công thức inline `$…$` và dòng riêng `$$…$$` trong đoạn văn cũng được hiển thị.
* **Nhập Word:** công thức Word (OMML) được chuyển sang LaTeX bằng bộ chuyển theo cấu trúc (`lib/omml.ts`) và chèn lại đúng vị trí. Công thức *nằm giữa dòng chữ* chưa được khôi phục (chỉ công thức trên dòng riêng).
* **Công thức luôn nằm trong lề:** độ rộng ước lượng bằng em (chữ hoa nghiêng như HDI/EXPO rộng hơn chữ thường, khoảng trắng quanh `=`/`+`, chỉ số, phân số, thụt lề căn thẳng hàng; `lib/latex-math-width.ts`) để chọn chỗ ngắt dòng; công thức gần giới hạn được đặt trong hộp **tự co vừa khổ** (`\fiteq`) chỉ co khi dòng vẫn quá rộng, số `(n)` luôn nằm cạnh trên cùng dòng. Đã kiểm bằng biên dịch thật bài mẫu (1 công thức) và EES (7 công thức): không còn Overfull do công thức.
* **Độ rộng công thức:** mỗi công thức chọn **Trong 1 cột** (mặc định; công thức quá rộng được ngắt dòng tại dấu `=`, `+`, `−` ngoài cùng và xếp thẳng hàng trong khối `aligned`, số `(n)` vẫn bên phải) hoặc **Trải 2 cột** (một dòng liền mạch qua cả hai cột như bảng/hình rộng; PDF dùng khối nổi `figure*`, nên có thể nằm ở đầu trang). Lưu ở `equation.columnSpan`. Bố cục 1 cột thì lựa chọn này không có tác dụng.
* **Xuất:** LaTeX/PDF dùng môi trường `equation`; **Word** xuất công thức Word gốc (chỉnh sửa được); **XML** xuất `<disp-formula>` / `<inline-formula>` với `<tex-math>`.

## 6. Bảng: 1 cột / 2 cột / xoay ngang, và bảng dài

Mỗi bảng chọn được **1 cột**, **2 cột**, **xoay ngang** (Cài đặt bảng) và **Ngắt qua trang** (Tự động / Luôn cắt / Giữ nguyên). Bảng dài (mặc định > 12 hàng) được cắt qua trang giống PDF mẫu của tạp chí:

| Kiểu bảng | Cách dàn trang |
| --- | --- |
| Ngắn | Khối nổi, giữ nguyên (`table`, `table*`, `sidewaystable`) |
| Dài, 1 cột | Chảy trong cột (`supertabular`), lặp hàng tiêu đề |
| Dài, 2 cột | Trang riêng một cột, bảng rộng 2 cột (`longtable`), lặp hàng tiêu đề |
| Dài, xoay ngang | Các trang ngang (`landscape` + `longtable`), tiêu đề chạy dọc lề phải như bản mẫu |

Mỗi trang tiếp theo có dòng **"Table N continued"** phía trên và **"Continued on next page"** phía dưới (đúng chữ của PDF mẫu EBL ID1750; đổi được trong cài đặt giao diện). Độ rộng cột tự chia theo độ dài nội dung. Word: hàng tiêu đề lặp ở đầu mỗi trang, hàng không bị cắt.

## 6b. Bố cục trang: 1 cột / 2 cột và xoay ngang

| Phạm vi | Tuỳ chọn | Nơi chỉnh | Lưu ở |
| --- | --- | --- | --- |
| Toàn bài | 1 cột / 2 cột | Giao diện → Bố cục | `layoutSettings.columnLayout` |
| Toàn bài | Dọc / Ngang | Giao diện → Bố cục → "Hướng trang" | `layoutSettings.orientation` |
| Từ một mục trở đi | Trang mới với số cột và hướng riêng | thẻ của mục → "Bố cục trang" | `section.pageLayout` |
| Một bảng / hình | 1 cột / 2 cột; bảng xoay ngang | Cài đặt bảng / hình | `table`, `figure` |
| Một công thức | Trong 1 cột / Trải 2 cột | thẻ công thức | `equation.columnSpan` |
| Lọc danh sách | Tất cả / Tiêu đề / Đoạn văn / Bảng / Hình / **Công thức** | dải lọc tab Nội dung | |

* **Xem trước PDF (thay cho "Tách nhóm trang"):** khung xem trước dùng trình xem của pdf.js (`components/preview/PdfInteractiveViewer.tsx`) nên hoạt động như một PDF bình thường: **nhấp đơn** để chọn/sao chép chữ hoặc đi theo liên kết, cuộn, thu phóng (nút "vừa chiều rộng"), ô số trang, **tìm kiếm** (Ctrl+F hoặc nút kính lúp), tải xuống, mở tab mới bằng trình xem gốc của trình duyệt. Liên kết nội bộ (trích dẫn [n] tới tài liệu tham khảo) có nút "Quay lại"; liên kết ngoài như DOI mở tab mới.
  * **Nhấp đúp vào nội dung** thì tab tương ứng mở đúng thẻ tạo ra phần đó và làm nổi bật thẻ; dòng vừa nhấp đúp được tô trên PDF vài giây. Áp dụng cho đoạn văn, tiêu đề, công thức có số (nhận qua nhãn "(n)" bên cạnh), hình và bảng (nhấp đúp vào ảnh hoặc thân bảng thì lấy chú thích "Hình n"/"Bảng n" gần nhất), tài liệu tham khảo; nhấp đúp vào tiêu đề bài, tóm tắt/từ khoá, tác giả/đơn vị thì mở tab Tựa đề, Tóm tắt, Tác giả. Ghép chữ PDF với mục dựa trên chữ và số (bỏ khoảng trắng, dấu nối từ, công thức), câu lặp ở hai mục được phân biệt bằng phần chữ phía sau (`lib/editor/pdf-section-map.ts`, `pdf-click-target.ts`). Tiêu đề chạy, số trang không ghép được thì không làm gì.
  * **"Trang này: Dọc | Ngang"** trên thanh công cụ xoay trang đang xem: mục bắt đầu trang đó nhận dấu `pageLayout` với hướng đã chọn (giữ số cột của nhóm đang chứa nó), mục bắt đầu trang kế tiếp nhận dấu đưa về bố cục cũ, rồi tự biên dịch lại. Các dấu do thao tác xoay ghi ra mang `turned: true`; xoay trang mở đầu của một phần đã xoay về như cũ thì cả phần đó được trả lại (dấu đóng được tìm theo cặp dấu, không tính lại từ chỗ các trang đang ngắt, vì trang ngang chứa ít chữ hơn nên phần xoay có thể tràn sang trang thứ hai) và các dấu bị gỡ hết: xoay rồi xoay lại cho đúng cùng mã LaTeX, số trang, khổ giấy và chữ từng trang (test `page-turn.test.ts`; với bản biên dịch thật, `RUN_TEX_E2E=1` chạy đúng thuật toán của giao diện, gồm cả tài liệu mặc định một cột có nhóm ngang sẵn). Nút "Hoàn tác" trả các dấu về như trước lần xoay hoặc lấp gần nhất (chỉ đụng tới dấu, không đụng tới nội dung đã sửa). Trang 1 (khối tiêu đề) và trang tiếng Anh cuối bài luôn dọc nên hai nút xoay bị khoá ở đó. Các dấu "Trang mới · …" có sẵn trong bài từ trước (không mang `turned`) được giữ nguyên; muốn bỏ thì gỡ ở hộp "Bố cục trang" của thẻ. Dấu do người soạn đặt tay (kể cả dấu rỗng "trang mới") không bao giờ bị tự gỡ. Lưu ý: dấu gắn với mục chứ không phải trang vật lý nên trang sau khi xoay có thể chứa lượng nội dung khác.
  * **Trang bị trống sau khi xoay:** đổi hướng giấy hoặc số cột luôn bắt đầu trang mới, nên trang cuối của phần xoay có thể trống một nửa. Khi một trang dùng dưới 55% chiều cao và trang sau bắt đầu bằng một mục có dấu bố cục, khung xem trước báo "Trang n còn trống khoảng x%" với nút "Lấp bằng nội dung kế tiếp" (dời dấu sang mục kế để kéo thêm nội dung vào phần xoay, rồi biên dịch lại) hoặc "Bỏ qua".
  * Chỉ còn hộp "Bố cục trang" ở từng thẻ (huy hiệu "Trang mới · …" cho thẻ có dấu) để chỉnh hoặc gỡ dấu. Đã bỏ dải "Nhóm trang", thanh đầu nhóm và nút "Tách nhóm trang". `lib/editor/page-groups.ts` vẫn dùng để tính bố cục đang có khi xoay trang. Trình xem pdf.js cần `requestAnimationFrame`, nên trong khung trình duyệt bị ẩn thì không vẽ được; trang thử `/dev-pdf-viewer?raf=timeout` dùng bộ hẹn giờ thay thế.
* **Dấu bố cục trang** (`pageLayout`): mục mang dấu này **bắt đầu một trang mới** với số cột/hướng đã chọn; bố cục giữ nguyên **cho đến mục kế tiếp có dấu**. Trường để trống = theo mặc định của tài liệu; dấu rỗng `{}` = "trang mới, quay về bố cục chung".
* **Hướng ngang toàn bài** có hiệu lực từ mục thân bài đầu tiên; trang 1 (khối tiêu đề có cột thông tin bên trái) luôn để dọc, trang tiếng Anh cuối bài luôn dọc.
* Bảng đặt "xoay ngang" nằm trong một trang đã ngang thì không bị xoay thêm lần nữa.
* PDF: `\onecolumn`/`\twocolumn` + môi trường `landscape` (gói `pdflscape`), mã ở `lib/latex-page-layout.ts` và `lib/latex-equation.ts`. Xem trước HTML nhanh không mô phỏng các dấu bố cục trang (chỉ PDF và Word).
* Lưu trữ: các tuỳ chọn này, cùng ngắt trang và số công thức, được giữ qua chuyển đổi v1↔v2 trong `layoutOverrides.sectionExtras` (trước đây ngắt trang và số công thức bị mất khi mở lại bài).

## 7. Cấu hình động (không hard-code)

`Cài đặt dàn trang ▸ Màu sắc, phông chữ & lề` (lưu cùng tài liệu trong `layoutSettings.theme`):

| Thuộc tính | Mặc định |
| --- | --- |
| Màu tiêu đề/chú thích | màu tạp chí (hoặc `#2B74B7`) |
| Màu nền hàng tiêu đề bảng / hàng xen kẽ | `#E5E5E5` / `#E7ECF7` |
| Phông nội dung / tiêu đề | Times New Roman / Calibri |
| Lề trên, dưới, trái, phải (cm) | 1,8 / 2 / 1,7 / 1,3 |
| Lặp hàng tiêu đề bảng, ngưỡng "bảng dài" | bật, 12 hàng |

Giá trị được làm sạch (`lib/theme-config.ts`) trước khi chèn vào CSS/LaTeX.

## 8. XML (JATS)

Xuất theo JATS 1.2 (`lib/jats-export.ts`): `front` (tạp chí, tác giả, đơn vị, ngày, tóm tắt, từ khóa), `body` lồng mục đúng cấp, công thức, `fig`/`table-wrap` kèm nguồn, `ref-list` có `xref` tới `[n]`. Đường dẫn ảnh theo quy ước của hệ thống tạp chí khi biết mã bài (`a-#`):
`https://static.vnuhcmjournal.com.vn/articles/<viết tắt tạp chí>/v-<tập>/i-<số>/a-<mã bài>/img-<n>.<ext>`; nếu chưa có mã bài thì dùng `images/img-<n>.<ext>`. Kiểm tra bằng <https://jats4r.niso.org/jats4r-validator/>.

**Tải XML trong ứng dụng:** menu Tải xuống ở thanh bên trái có hai mục. "XML (JATS)" tải `<Mã bài>.xml` (chưa có mã bài thì lấy tên tài liệu). "XML + hình" tải một gói zip gồm `<Mã bài>.xml` và hình đặt đúng thư mục `articles/<viết tắt tạp chí>/v-<tập>/i-<số>/a-<mã bài>/img-<n>.<ext>` để đưa lên máy chủ tĩnh (chưa đủ Tập/Số/Mã bài thì hình nằm ở `images/`). Thiếu thông tin hoặc có hình ở địa chỉ ngoài thì thông báo nhắc bổ sung. Mã: `lib/jats-package.ts`, `figureRelPath`/`listJatsFigures` trong `lib/jats-export.ts`.

## 9. Nhập từ Word: những gì được khôi phục

Kiểm tra bằng bài mẫu EBL ID1750 (so với PDF của tạp chí):

* **Bảng:** nhãn trong ô tiêu đề được tách thành tên bảng (không còn "Bảng 2: Bảng 2"), ô nhiều dòng giữ nguyên từng dòng, bảng nằm trong **trang ngang** của Word được đặt **xoay ngang**, bảng hẹp (≤ 4 cột) để 1 cột và bảng rộng 2 cột, bảng bị bỏ sót được chèn đúng thứ tự số. Dòng "Chú thích:" / "Nguồn:" ngay sau bảng thuộc về bảng.
* **Hình:** mỗi hình ghép với ảnh gần nó nhất trong XML. Hình vẽ bằng khối Word (ô oval, mũi tên, ô chữ — không phải file ảnh, ví dụ mô hình nghiên cứu) được **vẽ lại**: đọc hình khối trong XML (`lib/drawingml.ts`), dựng SVG rồi chuyển thành PNG ngay trong trình duyệt. Nếu không vẽ được (khối lạ, hoặc chạy ngoài trình duyệt) thì hình để trống và báo "Hình trống" chứ không gắn nhầm ảnh khác.
* **Chỉ số trên/dưới** (f², R², CO₂…) giữ nguyên dạng công thức; công thức Word (OMML) trên dòng riêng thành khối công thức.
* **Tác giả/đơn vị:** sửa lỗi tên bị tách ("Nguyễ n"); đơn vị viết hai dòng Việt + Anh gộp thành một (tiếng Anh dùng cho trang tóm tắt cuối).
* **Không tự bịa** DOI, tập, số, trang, ngày nhận/sửa/chấp nhận/đăng: file Word thường không có, nên để trống, hiện "?" trên đầu trang và cảnh báo ở cổng kiểm tra.

### Trang tóm tắt tiếng Anh cuối bài
Nếu có tiêu đề + tóm tắt tiếng Anh, bài PDF kết thúc bằng trang tiếng Anh như bản in của tạp chí (tiêu đề, tác giả, khung Abstract, Key words, đơn vị tiếng Anh, Correspondence, History, DOI, Copyright, "Cite this article"). Tắt bằng `layoutSettings.theme.englishSummaryPage = false`. Thân bài dùng cỡ chữ 9pt thật (`extarticle`); máy biên dịch cần gói `extsizes` (MiKTeX tự cài lần đầu).

### Thông tin xuất bản, tiêu đề, số mục, nền bảng
* **Thông tin xuất bản** (DOI, tập, số, trang, ngày): chưa có thì ô hiện `?`; người dùng xóa `?` để nhập giá trị, hoặc xóa hết để **để trống** (in ra rỗng). Chưa đụng tới thì in `?`.
* **Mã QR** trang 1 tự tạo từ ô DOI (link `https://doi.org/…`), vẽ bằng nét TeX nên không cần ảnh/gói và giống nhau trên mọi bộ biên dịch. DOI còn "?" hoặc trống thì không in mã (không bao giờ in mã giả).
* **Tiêu đề viết hoa toàn bộ** trong Word được chuẩn hóa về dạng câu khi nhập (có nút hoàn tác về tiêu đề gốc).
* **Số mục** gõ trong Word ("4. Kết quả") không in theo tạp chí; bật "Giữ số thứ tự mục" trong Giao diện để giữ lại (áp dụng cho PDF, Word, XML, xem trước).
* **Nền thân bảng**: mặc định trắng; tùy chọn "xen kẽ" hoặc "tô toàn bộ" ở từng bảng. Bài cũ từng bật sọc vẫn giữ sọc.
* **Chữ 9pt** dựng trực tiếp (không cần gói `extsizes`). Dấu nháy cong được khai báo cho xeCJK nên không bị lỗi dấu nháy. Lần biên dịch PDF đầu có thể chậm vì phải tải gói; chạy `pnpm warmup:latex` một lần để tải sẵn.

### Bổ sung khi so với mẫu EES ID850 và bài mẫu template tiếng Việt
- Tài liệu tham khảo kết thúc bằng "DOI: …" không còn bị nuốt; DOI bài báo chỉ lấy từ dòng "DOI:" ở phần đầu (không lấy DOI của một tài liệu tham khảo, nên mã QR không bao giờ trỏ nhầm bài).
- Trang tiếng Anh sau tài liệu tham khảo ("Research Article", tiêu đề, ABSTRACT, Keywords – kể cả lỗi gõ "Keywwords") được đọc thành titleEn/abstractEn/keywordsEn/nameEn.
- Công thức Word (OMML) có số "(n)" gõ bên cạnh được nhận là công thức hiển thị và giữ đúng số (`\tag{n}`); dòng "n là …" ngắn dưới "Trong đó:" được giữ.
- Bảng chứa lưới hình + ô chú thích "Hình N" là một hình (các ô a/b/c được ghép thành một ảnh trong trình duyệt); mã trường "SEQ Bảng" không lọt vào chú thích; ô gộp (tiêu đề nhiều tầng, "Dự báo" gộp 2 dòng) được giữ ở PDF và Word; bảng "Danh mục từ viết tắt" được liệt kê dưới đề mục.
- Trang hướng dẫn tác giả của template (style GuideHeading/GuideText/Instruction) bị bỏ qua; các mục cuối bài (Đóng góp của các tác giả, Xung đột lợi ích, Tính khả dụng của dữ liệu, …) là đề mục.
- PDF: tên tạp chí tiếng Anh in như mẫu của từng tạp chí, mã QR 42 pt có logo VNUHCM Press ở giữa (mức sửa lỗi H, vẫn quét được), huy hiệu "Check for updates" và logo đóng gói sẵn trong API (`apps/api/src/main/resources/latex-assets`), số trang bắt đầu từ trang đầu trong số, tiêu đề "TÀI LIỆU THAM KHẢO".
- Word (.docx): dàn trang như bản in (khổ giấy, lề, đầu/chân trang trang 1 và chẵn/lẻ, cột bên trái có QR/Liên hệ/Lịch sử/DOI/Check for updates, khung tóm tắt, thân 2 cột có ảnh, công thức Word, bảng ô gộp, trang tiếng Anh) và dùng tên style của template.
- Khi biên dịch/xuất: khung xem trước hiện "Đang biên dịch… Ns", thanh menu hiện "Đang xuất PDF…", mục xuất bị khoá cho tới khi xong.

## 10. Kiểm tra tự động

| Kiểm tra | Lệnh |
| --- | --- |
| Unit + component + tích hợp | `pnpm test` |
| XML xuất ra hợp lệ theo **DTD JATS 1.2 chính thức** | `python scripts/jats/fetch-dtd.py scripts/jats/dtd` (một lần) rồi `pnpm test` (cần python + lxml; không có thì bỏ qua) |
| End-to-end trình duyệt (nhập Word → cổng kiểm tra → tự động lưu → xuất Word/XML/PDF → mở lại), cần API chạy ở :8080 | `pnpm exec playwright test e2e/document-workflow.spec.ts --project=chrome` |

Chạy cả hệ thống thật: `docker compose -f docker-compose.minio.yml up -d`, API với `STRUCTPAPER_STORAGE_TYPE=minio` (xem docker-compose), rồi `pnpm dev:web`. (Image `minio/minio` chính thức đã bị gỡ khỏi Docker Hub nên compose dùng bản Bitnami cố định.)

## 11. Ứng dụng đóng gói (Windows / macOS)
Bản desktop (Tauri) dùng bản xuất tĩnh của web: tự động lưu và lưu trữ chạy cục bộ (IndexedDB), biên dịch PDF dùng tectonic đi kèm; nếu cấu hình `NEXT_PUBLIC_API_BASE_URL` trỏ tới máy chủ thì đồng bộ DB + MinIO, nếu không thì chỉ hiện "Đã lưu trên máy". `node apps/web/scripts/export-desktop.mjs` vẫn build thành công với các thay đổi này (khâu đóng gói Tauri/Rust chưa chạy trong môi trường này).

## 12. Nhật ký thay đổi (nhập/xuất Word, PDF, trình soạn)

Mỗi dòng ứng với một lần commit; hash dùng với `git show <hash>`.

### Trình soạn thảo
| Commit | Thay đổi |
| --- | --- |
| `8ecb161` | Biên dịch/xuất có trạng thái chờ rõ ràng: khung xem trước "Đang biên dịch… Ns", thanh menu "Đang xuất PDF…", mục xuất bị khoá, báo lỗi bằng thông báo nổi (không dùng `alert`). Sửa lỗi lần biên dịch bị thay thế làm tắt vòng quay của lần đang chạy. |
| `7e8aabd` | **Tạo bài mới bị treo / bị đè về bài cũ.** `PaperContext` tạo lại `setPaper`/`setCurrentJournal` mỗi lần render, làm effect nạp bài theo `?id=` chạy lại vô hạn (đọc IndexedDB + ghi ~4 MB vào `sessionStorage` mỗi vòng) và đặt lại bài cũ lên bài mới. Hàm nay ổn định. Tự lưu không còn coi việc *mở* bài là chỉnh sửa và không lưu bài cũ vào bài mới. |
| (mới) | **Loại bài báo không còn bị gán cứng.** Chọn gợi ý theo tạp chí hoặc "Khác — tự nhập…" để gõ tên tiếng Việt và tên tiếng Anh riêng (`metadata.articleTypeEn`, lưu qua v1↔v2). Tên tiếng Anh in ở trang tiếng Anh, Word và XML (`article-type` theo JATS, hoặc slug của tên đã gõ). Mã: `lib/article-types.ts`, `ArticleTypeField.tsx`. |
| (mới) | **Xuất XML có trong menu Tải xuống.** Thêm "XML (JATS)" và "XML + hình (.zip)" vào menu bên trái; tên file theo Mã bài; hình đặt theo quy ước `articles/<tạp chí>/v-#/i-#/a-#`; cảnh báo khi thiếu Tập/Số/Mã bài; số hình trong XML và trong gói luôn khớp. |
| (mới) | **Xem trước PDF bấm được, bỏ "Tách nhóm trang".** Bấm vào chữ trong PDF để mở đúng thẻ ở tab Nội dung; nút "Trang này: Dọc/Ngang" xoay trang đang xem và tự biên dịch lại. Gỡ dải nhóm trang, thanh đầu nhóm và nút tách nhóm. |
| (mới) | **Xem trước PDF: liên kết, mọi phần tử, trang trống.** Liên kết trích dẫn/DOI trong PDF bấm được (kèm "Quay lại", mở tab mới); bấm vào công thức, hình, bảng cũng mở đúng thẻ; trang bị trống sau khi đổi hướng/cột được báo kèm nút lấp thêm nội dung. |
| (mới) | **Xem trước PDF như PDF bình thường; nhấp đúp mới nhảy sang trình soạn; xoay trang đảo ngược được.** Chuyển sang trình xem pdf.js (chọn chữ, liên kết, tìm kiếm, thu phóng, tải xuống). Dấu xoay trang được gắn `turned` và giữ số cột của nhóm; xoay lại là gỡ hết dấu, bản biên dịch thật cho cùng số trang, khổ giấy và chữ. |

### Nhập từ Word
| Commit | Thay đổi |
| --- | --- |
| `f083292` | Giữ đủ tài liệu tham khảo (mục kết thúc bằng "DOI: …" không còn bị nuốt, DOI bài báo chỉ lấy từ dòng "DOI:" ở phần đầu), đọc trang tiếng Anh cuối bài thành siêu dữ liệu, giữ công thức Word có số "(n)", đúng tác giả liên hệ, từ khoá không còn dấu chấm thừa. |
| `70ac7a8` | Bảng chứa lưới hình thành hình nhiều ô (a/b/c ghép lại), ô gộp của tiêu đề bảng, chú thích sạch (không còn mã "SEQ"), bảng "Danh mục từ viết tắt". |
| `81763ac` | Bỏ qua trang hướng dẫn tác giả của template; các mục cuối bài là đề mục. |
| `95f5f62` | Bài mẫu template tiếng Việt: nhận "Ngày sửa bài" / "Ngày xuất bản trực tuyến" (ngày sửa trước đây in "?" dù file có); dòng in đậm nghiêng cả dòng là đề mục cấp 2; công thức dài ngắt dòng; ô tiêu đề bảng trống giữ trống (không tự điền "Cột 1"). |
| `ed1cc68` | Giữ dấu "-" ("không có") dưới các mục cuối bài (Kinh phí, Lời cảm ơn, …) thay vì để đề mục trống. |

### PDF (LaTeX)
| Commit | Thay đổi |
| --- | --- |
| `c51a056` | Tên tạp chí tiếng Anh in đúng từng tạp chí, mã QR có logo VNUHCM Press, huy hiệu "Check for updates" và logo đóng gói sẵn trong API, trang tiếng Anh cuối bài. |
| `2f61b21` | Tiêu đề "TÀI LIỆU THAM KHẢO" (polyglossia đặt lại `\refname`). |
| `4e1f296` | Công thức **Trải 2 cột**, **bố cục trang theo mục** (1/2 cột, ngang/dọc), **hướng ngang toàn bài**; lưu các tuỳ chọn qua v1↔v2 (xem mục 6b). |

### Giao diện chỉnh bố cục
| Commit | Thay đổi |
| --- | --- |
| `69b6312` | Thẻ công thức có nút "Trong 1 cột / Trải 2 cột"; mọi thẻ mục có nút "Bố cục trang" (trang mới, cột, hướng) và huy hiệu "Trang mới · 1 cột · Ngang"; Giao diện → "Hướng trang (toàn bộ nội dung)". Xem trước HTML cho công thức Trải 2 cột chiếm cả hai cột. |
| `117661b` | PDF: công thức dài không còn lồi ra lề (độ rộng ước lượng bằng em + hộp tự co vừa khổ làm lưới an toàn). |
| `b0bca08` | Tab Nội dung: thêm chip lọc **Công thức (n)** (trước đây các chip cộng lại ít hơn "Tất cả" đúng bằng số công thức). |
| `9d3c42c` | **Nhóm trang**: dải tổng quan, thanh đầu nhóm điều khiển chung hướng giấy/số cột cho cả nhóm, vạch màu, "Tách nhóm trang" / "Gộp vào nhóm trên" (xem mục 6b). |

### Xuất Word (.docx)
| Commit | Thay đổi |
| --- | --- |
| `e2ac6ff` | Word theo đúng bố cục trang: 1/2 cột toàn bài, công thức Trải 2 cột, dấu bố cục trang theo mục (mỗi dấu là một section Word sang trang mới, có cột và hướng riêng), hướng ngang toàn bài, và bảng "xoay ngang" nằm riêng một trang ngang (trước đây bị bỏ qua). Mã ở `lib/docx-export-layout.ts`. Giới hạn: tab của đầu/chân trang chỉnh theo khổ dọc nên ở trang ngang dòng chữ căn phải không chạm lề phải. |
| `1679b50` | Bộ xuất Word viết lại: dàn trang như bản in (khổ giấy, lề, đầu/chân trang, cột bên trái, khung tóm tắt, thân 2 cột, ảnh, công thức Word, bảng ô gộp, trang tiếng Anh) và tên style của template. |

### Nhập nhiều tệp cùng lúc
| Commit | Thay đổi |
| --- | --- |
| `1e35fa0` | Nhập hàng loạt (mục 2b): chọn nhiều .docx, mỗi tệp thành một bài, đọc/lưu/biên dịch PDF song song với bảng tiến độ, hủy, thử lại, mở, tải PDF/zip. Đã kiểm chứng bằng 7 tệp mẫu thật trên trình duyệt (~57 s, so với ~150 s nếu làm lần lượt) và một đợt rà soát độc lập; sửa theo đó: lưu thất bại không còn báo thành công, hủy được cả bước đọc/lưu bị kẹt, giải phóng bộ nhớ, thử lại riêng phần PDF, lưu PDF máy chủ sau khi bài đã có, tên tệp zip an toàn trên Windows. `savePaperToIndexedDb` giờ trả về `true/false`. |

| `4827f61` | Nhập hàng loạt: mỗi tệp có thể dùng cùng một mẫu hoặc mẫu khác nhau (bước chọn mẫu có hai chế độ, dòng tiến độ hiện mẫu đã áp dụng, thử lại giữ đúng mẫu từng tệp). |

### Hợp nhất với bản gốc (upstream/main, v1.0.12)
Bản gốc và nhánh này cùng viết lại trình soạn theo hai hướng; khi gộp:

| Phần | Giữ | Lý do |
| --- | --- | --- |
| Tự lưu | `useDocumentAutosave` của nhánh này (lưu máy + máy chủ, phát hiện xung đột, bản chụp phiên bản, tự chạy lại nếu có sửa trong lúc lưu). `useEditorAutoSave` của bản gốc không còn được dùng | hook cũ bỏ lỡ chỉnh sửa trong lúc đang lưu và không đồng bộ máy chủ |
| Công tắc "Tự động lưu" ở thanh tiêu đề | nối vào tự lưu của nhánh này (`enabled`); tắt thì chỉ lưu khi bấm Lưu / Ctrl+S | giữ tính năng của bản gốc |
| Trạng thái ở thanh tiêu đề / dock | suy ra từ trạng thái tự lưu (`lib/editor/autosave-status.ts`: lưu máy cũng tính là đã lưu, xung đột/lỗi là lỗi) | |
| Danh sách mục | bản ảo hoá của bản gốc (`SectionCardItem`, `useSectionVirtualizer`); đã gắn lại mục Công thức, nút Bố cục trang, nút thêm công thức | bài 150 mục chỉ vẽ ~29 thẻ |
| Ảnh để biên dịch | `extractPaperImagesAsync` của bản gốc (đọc được cả ảnh `blob:`); `lib/paper-images.ts` đã bỏ | |
| Hỏi lại khi thoát, cảnh báo đóng tab | của bản gốc (`isDirty`) + `useUnsavedChangesWarning` | |
| Mở bài khác | `useShowPaperOnSwitch`: chỉ đổi bản sao khi id đổi, không phải lúc vừa mở (tránh coi việc mở bài là một lần sửa) | |

Kiểm tra sau gộp: 46 file test web (455 test) đều đạt, các gói con đạt (riêng `platform-desktop` có 2 test gọi GitHub thật bị quá thời gian, không liên quan). Hai test của bản gốc phải chỉnh nhẹ vì giao diện nhánh này có thêm ô tên trên menu Tệp (chọn đúng ô tiêu đề ở tab Tựa đề). Thử thật trên trình duyệt: nhập hàng loạt 2 tệp hai mẫu khác nhau, mở bài, thêm công thức "Trải 2 cột", trạng thái "Đã lưu", tải lại vẫn còn. `EditorLeftDock.tsx` của bản gốc dài 768 dòng (vượt mốc 553): đã tách thành `DockIconButton`, `DockDownloadMenu`, `DockStatusMenu` (còn ~400 dòng), giữ nguyên hành vi. Test `live-updater-e2e` (gọi GitHub thật) chỉ chạy khi đặt `RUN_LIVE_UPDATER_E2E=1`.

### Kiểm tra mất thông tin với bài mẫu template tiếng Việt
So từng dòng của file Word với bài đã nhập (378 dòng, không tính trang hướng dẫn): chỉ phát hiện hai chỗ mất, đã sửa.
| Mất gì | Nguyên nhân | Sửa |
| --- | --- | --- |
| Đề mục "Nguồn dữ liệu" (và nội dung ngay dưới) | luật nhận đề mục in đậm-nghiêng loại nhầm mọi dòng bắt đầu bằng "Nguồn" (định để loại dòng "Nguồn: …"); dòng ngắn (≤ 20 ký tự) lại bị bỏ | chỉ loại "Nguồn:", "Ghi chú:", "Chú thích:", "Hình N", "Bảng N" |
| Cơ quan tiếng Anh ("University of Economics and Law, …") | file ghi tác giả và cơ quan trên **cùng một dòng**; bộ đọc trang tiếng Anh bỏ cả dòng | tách phần cơ quan (từ University/Institute/Hospital/…) làm tên cơ quan tiếng Anh |
Các dòng còn lại không có trong nội dung (nhãn "Ngày nhận bài", "Từ khóa", tác giả, đơn vị, "Tóm tắt", "Tài liệu tham khảo", khối tiếng Anh) đã vào đúng trường siêu dữ liệu. 5 bảng giữ đủ số ô. Trên trình duyệt thật (không thấy treo): nhập 0,3–1 s, mở trình soạn < 2 s, đổi giữa các thẻ < 130 ms, biên dịch PDF 23 s.

### Còn lại / giới hạn đã biết
* Tập, số, trang, DOI không có trong file Word nên in "?" cho tới khi tòa soạn nhập (cố ý, không tự bịa).
* Tiêu đề "MỞ ĐẦU" lấy từ file Word (PDF mẫu của tạp chí ghi "GIỚI THIỆU").
* Huy hiệu "Check for updates" là ảnh, chưa phải liên kết CrossMark.
* Xem trước HTML nhanh không mô phỏng dấu bố cục trang; dùng PDF để kiểm tra.
* Nhập hàng loạt: đọc tệp Word chạy trên luồng chính của trình duyệt nên giao diện có thể khựng khoảng 1 giây khi đọc tệp lớn; trang "Tải file DOCX" riêng (`/upload`) vẫn chỉ nhận một tệp.
