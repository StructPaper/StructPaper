# Đối chiếu "Yêu cầu phần mềm.docx" với mã nguồn (2026-11-20)

Nguồn yêu cầu: `docs/Yêu cầu phần mềm, Template, các file mẫu của Tạp chí/Yêu cầu phần mềm.docx`.
Cách làm: đọc yêu cầu, tìm trong mã nguồn (`apps/web`, `apps/api`, `packages/*`). Cột **Trạng thái** được cập nhật khi làm xong
từng mục (xem mục 4 "Nhật ký").

Ký hiệu: ✅ đã đáp ứng · 🟡 đáp ứng một phần · ❌ chưa có · ⏳ đang làm.

## 1. Đã đáp ứng tốt

| Yêu cầu | Ở đâu |
| --- | --- |
| Nhiều journal, mỗi nơi một template, nhiều loại bài | hồ sơ tạp chí + loại bài + phiên bản quy định (`packages/journal-profiles`, `features/journals`) |
| Nhận diện Word: tiêu đề, tác giả, cơ quan, tóm tắt, từ khóa, heading, đoạn văn, trích dẫn khối, tài liệu tham khảo | `lib/docx-parser.ts`, `docx-headings.ts`, `docx-affiliations.ts` |
| Bảng nhiều trang (lặp dòng tiêu đề, "continued"), bảng ngang, bảng trải rộng, kiểm soát ngắt trang | `lib/latex-table.ts`, `TableSettingsModal` |
| Công thức OMML → LaTeX, tự đánh số, tự xuống dòng khi dài | `lib/omml.ts`, `docx-math.ts`, `latex-equation.ts` |
| Tài liệu tham khảo Vancouver: thiếu/không được trích, đánh số lại, sửa chỗ nhắc "Hình 2/Bảng 3" | `lib/validation/numbering.ts` |
| Kiểm tra chất lượng trước khi xuất (metadata, ngày, DOI, email, từ khóa, trùng tác giả, hình thiếu ảnh, công thức lỗi, đánh số) | `lib/validation/*` |
| XML JATS | `lib/jats-export.ts`, `jats-package.ts` |
| Cập nhật bài không dàn lại từ đầu | lịch sử phiên bản, so sánh, khôi phục (`features/history`) |
| Nhập hàng loạt nhiều file Word | `lib/batch-import`, `CreatePaperModal` |

## 2. Chưa đáp ứng hoặc đáp ứng chưa tốt

| # | Yêu cầu | Hiện trạng | Việc cần làm | Trạng thái |
| --- | --- | --- | --- | --- |
| G1 | Word có **Track Changes** | Không xử lý `w:ins` / `w:del` / `w:moveFrom`: chữ đã xóa có thể bị đọc lẫn vào bài | Khi nhập: giữ phần chèn, bỏ phần xóa; báo cho người dùng có bao nhiêu thay đổi đang theo dõi | ✅ xong: giữ phần chèn, bỏ phần xóa/chuyển đi, báo số thay đổi trong báo cáo nhập |
| G2 | File **.doc** | Giao diện nhận đuôi `.doc` nhưng bộ đọc chỉ mở được `.docx` (zip) | Nhận ra .doc nhị phân và báo rõ cách chuyển sang .docx thay vì lỗi khó hiểu | ✅ xong: nhận ra .doc/RTF và báo cách lưu thành .docx |
| G3 | **Footnote / endnote** | Không đọc `word/footnotes.xml`, `endnotes.xml` | Đọc chú thích và đưa vào bài (chú thích cuối trang / cuối bài) | ✅ xong: nhập footnote/endnote thành `[[fn: …]]` tại câu trích dẫn; PDF in ở chân trang; JATS dùng `<fn>` |
| G4 | Hình **EMF/WMF**, công thức **MathType** nhúng dạng đối tượng | EMF/WMF bị bỏ qua khi nhập; MathType OLE không có xử lý | Chuyển được thì chuyển; không thì báo rõ để người dùng thay | 🟡 một phần: báo rõ số hình EMF/WMF và công thức MathType chưa chuyển được; hình thiếu ảnh in khung báo thiếu (không còn gán nhầm ảnh). Chưa chuyển đổi được |
| G5 | Hình **TIFF/EPS/PDF/SVG**, hình vector | Giao diện chỉ nhận `image/*` | Nhận SVG; báo hướng dẫn cho TIFF/EPS/PDF (chuyển sang PNG/SVG) | ❌ chưa làm (ô chọn tệp đã nhận mọi ảnh trình duyệt đọc được, gồm SVG; TIFF/EPS/PDF chưa) |
| G6 | Kiểm tra **độ phân giải / kích thước** hình | Chỉ kiểm tra hình thiếu ảnh | Thêm kiểm tra độ phân giải thấp (so với khổ in) trong cổng kiểm tra | ❌ chưa làm |
| G7 | Hình **nhiều panel** (a, b, c, d) | Không có khái niệm | Ghi chú panel trong chú thích; nhắc trong kiểm tra | ❌ chưa làm |
| G8 | **Tham chiếu chéo** tự cập nhật, bấm được | Chỉ viết lại chữ khi đánh số lại | Liên kết bấm được trong PDF (siêu liên kết tới hình/bảng/công thức) | ❌ chưa làm (ngoài việc đánh số lại chữ "Hình 2/Bảng 3") |
| G9 | **ORCID** | Có ô nhập nhưng không in ra PDF/JATS | In ORCID kèm liên kết trong PDF và trong JATS | 🟡 một phần: ORCID in trong PDF kèm liên kết; JATS chưa |
| G10 | **PDF chuẩn xuất bản**: metadata, bookmark, PDF/X, CrossMark, gắn thẻ truy cập | Có font nhúng và liên kết DOI; không có metadata PDF, bookmark | Thêm `pdftitle/pdfauthor/pdfkeywords/pdfsubject`, bookmark theo heading. PDF/X, CrossMark, gắn thẻ: ghi nhận, cần quyết định | 🟡 một phần: đã thêm metadata PDF (tiêu đề, tác giả, từ khóa, chủ đề) và bookmark theo heading, đã biên dịch thử bằng Tectonic; PDF/X, CrossMark, gắn thẻ truy cập chưa |
| G11 | **Proof** cho Editor/Author | Có trạng thái "Proofing" và chia sẻ; không có bình luận trên bản proof | Cần thiết kế riêng (bình luận, giao việc, xác nhận) | ❌ chờ chỉ thị |
| G12 | Cập nhật bài từ **file Word bản sửa** | Chưa nhập lại vào bài có sẵn rồi so sánh/gộp | Có thể dùng bộ so sánh phiên bản sẵn có | ❌ chờ chỉ thị |
| G13 | **API / webhook** cho tự động hóa | Có nhập hàng loạt; không có khóa API/webhook | Cần quyết định phạm vi và bảo mật | ❌ chờ chỉ thị |
| G14 | Cảnh báo **overfull / thiếu font** từ log biên dịch | Bộ đọc log có; chưa rõ có hiện cho người dùng | Kiểm tra và hiển thị trong cổng kiểm tra | ❌ chưa kiểm tra |
| G15 | Typography nâng cao (tracking, ngắt từ), lề trang | Font, cỡ chữ, giãn dòng có; lề trang cố định trong mẫu | Xem kết quả phân tích mẫu (mục 3) | 🟡 đã phân tích 7 mẫu (xem `PHAN_TICH_MAU_TAP_CHI_2026-11-20.md`); thêm 3 tùy chọn trong bảng cài đặt dàn trang (DOI tài liệu tham khảo, cân bằng cột trang cuối, gạch ngang dài cho khoảng số) |

## 3. Đề xuất ngoài tài liệu

1. Bình luận và duyệt trên bản proof (G11), kèm thông báo email / trong ứng dụng khi đổi trạng thái.
2. Dựng một **số tạp chí**: gom bài sẵn sàng, tự nối số trang đầu/cuối, tạo mục lục.
3. Chuẩn hóa tài liệu tham khảo: tra DOI để điền đủ thông tin, phát hiện tài liệu trùng.
4. Bảo mật phiên: đá phiên cũ khi đăng nhập nơi khác, xác thực hai lớp cho quản trị.
5. Vận hành: nâng cấp CSDL production từ chuỗi migration cũ, sao lưu, giám sát.

## 4. Nhật ký thực hiện (2026-11-20)

Làm thêm ngoài danh sách: sửa lỗi công thức làm bài STD không biên dịch được; nhận tiêu đề mục từ kiểu Heading/dòng đậm (HS, ARNS mất hết tiêu đề cấp 2);
sửa hình bị gán nhầm ảnh; tài liệu tham khảo in DOI "Available from:" và gạch ngang dài; nhận tạp chí từ tên tệp; chuẩn hóa tựa đề tiếng Anh viết HOA;
ô "Ngày đăng" dùng bộ chọn ngày; khối công thức có bảng ký hiệu, cấu trúc, công thức mẫu, dán LaTeX tự làm sạch, sao chép "Công thức (n)".
Chi tiết phân tích ở `PHAN_TICH_MAU_TAP_CHI_2026-11-20.md`.
