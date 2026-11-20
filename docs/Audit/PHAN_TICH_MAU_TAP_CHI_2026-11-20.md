# Phân tích 7 mẫu tạp chí: bản Word thô so với PDF chuẩn (2026-11-20)

Nguồn: `docs/Yêu cầu phần mềm, Template, các file mẫu của Tạp chí/Mẫu VNUHCM-{HS, EBL, EES, SSH, STD, ARNS}` và `Mẫu VNUHCMJ-ET`
(mỗi thư mục một bài Word thô và một PDF chuẩn của tòa soạn).

Cách làm: đọc cấu trúc XML của từng file Word; đo từng PDF chuẩn (khổ giấy, lề, chiều cao hai cột mỗi trang, vị trí và bề rộng hình,
tài liệu tham khảo, phông chữ); rồi cho **chính bộ nhập Word và bộ dàn trang LaTeX của dự án** chạy trên bảy bài Word, biên dịch bằng
Tectonic thật, và so PDF của ta với PDF chuẩn (số trang, số ký tự, trang cuối, nhãn DOI, tiêu đề, hình).

## 1. Quy tắc rút ra từ PDF chuẩn

| # | Quy tắc quan sát được (7/7 mẫu trừ khi ghi khác) | Dự án |
| --- | --- | --- |
| P1 | Khổ 8,51 × 11 inch (613 × 792 pt), hai cột, trang đầu tách khối tiêu đề; trang cuối là trang tóm tắt tiếng Anh | ✅ đã có |
| P2 | Tiêu đề chạy ở đầu mỗi trang từ trang 2: `VNUHCM Journal of … 2026, 7(1):990-1011`; số trang ở chân (trang lẻ bên phải) | ✅ đã có |
| P3 | Hai cột của mọi trang đầy kết thúc **cùng một độ cao** (714 pt) | 🟡 lệch tối đa một dòng (12 pt) ở trang có hình trải 2 cột; là hệ quả của luật không để dòng góa/dòng mồ côi, giống bản in |
| P4 | Trang cuối của phần thân và tài liệu tham khảo **cân bằng hai cột** (chênh ≤ 9 pt ở 5/6 mẫu) | ✅ đã có (`\balance` trước tài liệu tham khảo); thêm công tắc tắt/bật |
| P5 | Hình chỉ có hai bề rộng: **một cột (170 pt)** hoặc **trải 2 cột (372 pt)**; nằm đầu hoặc cuối trang, không bao giờ chen giữa đoạn; hình lớn có thể chiếm trọn trang | ✅ đã có |
| P6 | Bảng rộng (> 9.500 twips, thường nằm trong "section ngang" của Word) in ngang; bảng dài lặp dòng tiêu đề và có "Table N continued" | ✅ đã có (nhập: bảng trong section ngang tự được xoay) |
| P7 | Tài liệu tham khảo: số thứ tự, cỡ chữ nhỏ, **khoảng trang và năm dùng gạch ngang dài** (`268–9`) dù Word gõ gạch nối | ✅ đã làm trong đợt này |
| P8 | DOI ở **cuối mỗi tài liệu tham khảo**: `… Available from: https://doi.org/…` (HS 22, ARNS 22, ET 18, EES 15 chỗ); riêng STD in liên kết trần | ✅ đã làm trong đợt này |
| P9 | Tiêu đề mục: H1 chữ HOA đậm màu tạp chí, H2 đậm chữ thường màu tạp chí; "Hóa chất", "Thiết bị", "Quá trình lựa chọn nghiên cứu" là H2 | ✅ đã làm trong đợt này (xem 2.1) |
| P10 | Chú thích cuối trang nằm ở chân cột chứa câu trích dẫn (SSH có 9) | ✅ đã làm trong đợt này |
| P11 | Tên tạp chí, năm, tập, số, trang và DOI chạy ở đầu trang và trích dẫn "Cite this article" | ✅ đã có |

## 2. Chỗ bộ nhập và dàn trang của ta trước đây làm sai hoặc thiếu (đã sửa)

### 2.1 Tiêu đề mục bị mất (HS, ARNS)
- **HS**: tiêu đề dùng kiểu Heading 2 của Word nhưng bộ nhập chỉ nhìn chữ, nên "Quá trình lựa chọn nghiên cứu…", "Đánh giá chất lượng"…
  biến mất (HS từ 0 lên 17 tiêu đề cấp 2). **ARNS**: tiêu đề chỉ là dòng đậm ngắn không có kiểu ("VẬT LIỆU VÀ PHƯƠNG PHÁP", "Hóa chất",
  "Thiết bị"…), bị coi là đoạn văn.
- **Quy tắc mới** (`lib/docx-headings.ts`): (1) kiểu Heading 1–3 hoặc mức đề cương (kể cả tên kiểu tiếng Việt "Tiêu đề 2"); (2) số tự động
  của danh sách; (3) đậm và nghiêng gõ tay; (4) dòng ngắn (≤ 90 ký tự) in đậm toàn dòng, không kết thúc bằng dấu câu: viết HOA thì cấp 1,
  còn lại cấp 2. Chú thích hình, bảng, "Nguồn:" và câu hoàn chỉnh vẫn là văn bản.

### 2.2 Hình bị gán nhầm ảnh (ARNS)
Hình không có ảnh (do EMF/WMF không hiển thị được) nhận nhầm ảnh của hình khác vì tên tệp thay thế theo vị trí (`fig2`) trùng với số hình.
Nay: tên thay thế theo vị trí không bao giờ lấy số của một hình trong bài; hình không có ảnh in khung "Chưa có ảnh cho Hình N" thay vì
logo Open Access hay ảnh của hình khác.

### 2.3 Công thức làm hỏng cả bài (STD)
`λ_ν z_ν` được chuyển thành `\lambda_\nuz_\nu` (lệnh `\nuz` không tồn tại), nên bài STD (57 công thức) **không biên dịch được**. Đã sửa ở
`lib/omml.ts` (lệnh Hy Lạp đứng một mình làm chỉ số phải có dấu cách theo sau).

### 2.4 Tài liệu tham khảo
- Bản Word của tòa soạn không có DOI ở cuối (ARNS, HS) hoặc ghi `DOI: https://doi.org/…` (EES). Nay: `DOI:` / `Available from:` ở cuối được
  tách vào trường DOI của tài liệu; PDF in `Available from: <liên kết>.` (STD in liên kết trần); khoảng số dùng gạch ngang dài.
- Bản PDF chuẩn có DOI cho các tài liệu mà Word không có: tòa soạn tra cứu (Crossref). **Chưa làm** (xem 4).

### 2.5 Nhận diện tạp chí
Tên tệp dạng `VNUHCM - HS ID 722`, `VNUHCM-EES ID850`, `[SSH]` nay được coi là dấu hiệu rõ ràng của tạp chí (trước đó bị bỏ qua và
mọi bài rơi về tạp chí chung).

## 3. Kết quả so PDF của ta với PDF chuẩn sau khi sửa

| Tạp chí | Trang chuẩn | Trang của ta | Ghi chú |
| --- | --- | --- | --- |
| EBL | 11 | 11 | bằng nhau |
| ET | 11 | 11 | bằng nhau; thiếu 4 hình EMF/WMF |
| EES | 10 | 11 | "Available from" 18 chỗ (chuẩn 15) |
| ARNS | 16 | 15 | thiếu 3 hình EMF/WMF |
| SSH | 15 | 14 | 9 chú thích cuối trang đã vào bài |
| STD | 9 | 8 | trước đây không biên dịch được (mục 2.3) |
| HS | 22 | 15 | các bảng phụ lục rộng in xoay trên trang đứng thay vì trang ngang riêng; số ký tự ít hơn ~12% |

## 4. Chưa làm hoặc cần chỉ thị

1. **HS: bảng rộng phải in trên trang ngang thật** (chuẩn dùng 13 trang ngang). Ta đang xoay nội dung bảng trên trang đứng. Cần xem lại
   từng bảng để chắc chắn không mất hàng.
2. **Hình EMF/WMF** (ARNS 3, ET 4): trình duyệt không đọc được; cần chuyển đổi phía máy chủ (ví dụ LibreOffice/Inkscape) hoặc nhờ người dùng
   thay bằng PNG/SVG. Hiện bộ nhập báo rõ số hình và hiện khung báo thiếu ảnh.
3. **Tra DOI tự động** (Crossref) để điền "Available from:" cho tài liệu chưa có DOI.
4. **Cân cột đúng từng pt** ở mọi trang: chuẩn đạt bằng chỉnh tay; ta lệch tối đa một dòng.
5. Phông chữ: PDF chuẩn dùng MinionPro/MyriadPro (bản quyền); máy chủ dùng Source Sans 3 / Times thay thế nên hình dáng chữ khác.
