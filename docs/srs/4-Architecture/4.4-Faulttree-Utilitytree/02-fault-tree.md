# 4.4.2 Fault tree (cây lỗi)

Mỗi cây phân tích một **sự kiện đỉnh (top event)** không mong muốn bằng cổng logic: **OR** (một nguyên nhân là đủ), **AND** (cần đồng thời). Ký hiệu: hình chữ nhật = sự kiện trung gian, hình tròn = sự kiện cơ bản (nguyên nhân gốc), hình thoi = cổng. Cột "Biện pháp hiện có/đề xuất" liên kết kiến trúc đã có hoặc còn thiếu.

## FT-01 Người dùng mất chỉnh sửa (mất dữ liệu bài)

```mermaid
flowchart TD
    TOP["TOP: Mất chỉnh sửa của người dùng"]
    G1{{OR}}
    TOP --- G1
    E1["Ghi IndexedDB thất bại"]
    E2["Ghi đè nhầm bản của người khác"]
    E3["Bài bị xóa không khôi phục được"]
    E4["Khôi phục sai phiên bản"]
    G1 --- E1
    G1 --- E2
    G1 --- E3
    G1 --- E4

    G2{{OR}}
    E1 --- G2
    B1(("Hết dung lượng trình duyệt / chế độ riêng tư"))
    B2(("Xóa dữ liệu site / profile trình duyệt"))
    B3(("Lỗi nâng cấp schema Dexie v1→v2"))
    G2 --- B1
    G2 --- B2
    G2 --- B3

    G3{{AND}}
    E2 --- G3
    C1(("Hai phiên cùng sửa một bài"))
    C2(("Người dùng bấm 'Ghi đè bằng bản của tôi' mà không xem"))
    G3 --- C1
    G3 --- C2

    G4{{OR}}
    E3 --- G4
    D1(("Xóa vĩnh viễn thủ công"))
    D2(("Quá 30 ngày trong thùng rác (tự dọn)"))
    D3(("Manager xóa hàng loạt nhầm"))
    G4 --- D1
    G4 --- D2
    G4 --- D3

    G5{{AND}}
    E4 --- G5
    F1(("Chọn nhầm phiên bản"))
    F2(("Bản an toàn pre-risk đã bị dọn (>90 ngày, chỉ giữ 5)"))
    G5 --- F1
    G5 --- F2
```

| Nguyên nhân gốc | Biện pháp hiện có | Còn thiếu / đề xuất |
|---|---|---|
| B1, B2 | Đồng bộ server khi online; sao lưu zip kho cục bộ | Cảnh báo dung lượng sắp hết; nhắc sao lưu; `navigator.storage.persist()` |
| B3 | Hàm `upgrade` Dexie bù trường thiếu; test storage | Test migration với dữ liệu thật |
| C1+C2 | Khóa lạc quan 412/409, trạng thái `conflict`, bản an toàn `pre-risk` trước khôi phục | Hiển thị diff khi ghi đè (có sẵn `doc-diff`) |
| D1–D3 | Thùng rác 30 ngày, xác nhận trước xóa vĩnh viễn, audit `manuscript.purge*` | Thông báo trước khi tự dọn; xác nhận 2 bước cho thao tác hàng loạt |
| F1+F2 | Khôi phục tạo thêm revision `restore` (không phá lịch sử); bản có tên được ghim | Giữ bản an toàn lâu hơn nếu bài đã `PUBLISHED` |

## FT-02 PDF xuất ra sai quy định tạp chí hoặc không biên dịch được

```mermaid
flowchart TD
    TOP["TOP: PDF sai mẫu / không có PDF"]
    G1{{OR}}
    TOP --- G1
    E1["PDF sai định dạng so với mẫu"]
    E2["Không sinh được PDF"]
    G1 --- E1
    G1 --- E2

    G2{{OR}}
    E1 --- G2
    A1(("Dùng profile sai phiên bản (không ghim / nâng nhầm)"))
    A2(("Font thay thế ở môi trường cục bộ ≠ server"))
    A3(("Dữ liệu nhập Word bị mất/sai (hình, bảng, công thức)"))
    A4(("Công thức/bảng quá rộng tràn lề"))
    G2 --- A1
    G2 --- A2
    G2 --- A3
    G2 --- A4

    G3{{OR}}
    E2 --- G3
    B1["Lỗi TeX"]
    B2["Hết thời gian / quá tải"]
    B3["Thiếu font/gói"]
    G3 --- B1
    G3 --- B2
    G3 --- B3

    G4{{OR}}
    B1 --- G4
    C1(("LaTeX không hợp lệ do ký tự đặc biệt/công thức sai"))
    C2(("Hình thiếu ảnh / định dạng EMF-WMF"))
    G4 --- C1
    G4 --- C2

    G5{{OR}}
    B2 --- G5
    D1(("Hàng đợi đầy: 60 chờ / 12 mỗi người → 429"))
    D2(("Bài quá lớn trên WASM (OOM)"))
    D3(("COMPILE_TIMEOUT_MS 300 s"))
    G5 --- D1
    G5 --- D2
    G5 --- D3

    G6{{OR}}
    B3 --- G6
    F1(("Font bản quyền không có trong image"))
    F2(("Cache Tectonic trống + không có mạng để tải gói"))
    G6 --- F1
    G6 --- F2
```

| Nguyên nhân gốc | Biện pháp hiện có | Còn thiếu / đề xuất |
|---|---|---|
| A1 | Pin profile + snapshot; nâng cấp chủ động; revision `profile-upgrade` | — |
| A2 | Luật router 01 (final→server), 06 (`parity` substitute) | Hiển thị cảnh báo "bản nháp dùng font thay thế" |
| A3 | Báo cáo nhập, cổng kiểm tra đầu vào, golden snapshot, "Hình trống" thay vì gán nhầm | Chuyển đổi EMF/WMF; kiểm DPI hình |
| A4 | `latex-math-width`, hộp `\fiteq`, ngắt tại `=`/`+` | Hiển thị cảnh báo overfull từ log trong cổng kiểm tra (G14) |
| C1 | `escape-tex`, làm sạch theme, kiểm cú pháp công thức, `CompileErrorModal` | Fuzz test escape |
| C2 | "Hình trống" + cảnh báo | Chuyển đổi định dạng |
| D1–D3 | `CompileQueue` công bằng, luật router 08–10, limiter nhập lô, hủy/thử lại | Hàng đợi bền (pg-boss) khi scale ngang |
| F1, F2 | Font commit vào `docker/fonts`; volume cache Tectonic; `pnpm warmup:latex` | Kiểm tra font ở bước build image; mirror gói Tectonic nội bộ |

## FT-03 Người dùng truy cập trái phép bài báo

```mermaid
flowchart TD
    TOP["TOP: Người không có quyền đọc/sửa được bài"]
    G1{{OR}}
    TOP --- G1
    E1["Chiếm phiên người dùng khác"]
    E2["Vượt kiểm soát truy cập (logic)"]
    E3["Lộ qua link/preview"]
    G1 --- E1
    G1 --- E2
    G1 --- E3

    G2{{OR}}
    E1 --- G2
    A1(("Đoán/lộ mật khẩu (không rate-limit, không 2FA)"))
    A2(("Lộ refresh token (cookie, XSS)"))
    A3(("JWT_SECRET mặc định ở môi trường thật"))
    G2 --- A1
    G2 --- A2
    G2 --- A3

    G3{{OR}}
    E2 --- G3
    B1(("Route quên gắn guard / @Public sai"))
    B2(("Ability cache cũ sau khi đổi quyền"))
    B3(("Điều kiện CASL theo hàng bị bỏ (subject không kèm bản ghi)"))
    G3 --- B1
    G3 --- B2
    G3 --- B3

    G4{{AND}}
    E3 --- G4
    C1(("general_access = VIEWER/EDITOR"))
    C2(("Link bị chia sẻ ngoài ý muốn"))
    G4 --- C1
    G4 --- C2
```

| Nguyên nhân gốc | Biện pháp hiện có | Còn thiếu |
|---|---|---|
| A1 | Argon2id (tốn tài nguyên khi dò) | Rate limit đăng nhập, khóa tạm, 2FA |
| A2 | Cookie httpOnly + sameSite lax; refresh xoay vòng, thu hồi khi dùng/đăng xuất | Phát hiện tái sử dụng refresh token đã thu hồi → thu hồi cả họ |
| A3 | Compose prod bắt buộc `JWT_SECRET` (`:?`) | Từ chối khởi động nếu secret mặc định khi `NODE_ENV=production` |
| B1 | `JwtAuthGuard` toàn cục; test "route-audit" ghim route mở (`@OptionalAuth`) | — |
| B2 | `permissions_version` trong JWT + invalidate cache | Test đồng thời nhiều bản sao API (cache RAM từng bản sao) |
| B3 | `accessOf(ability, row)`, `subject('Manuscript', row)`; test persona | — |
| C1+C2 | Mặc định `RESTRICTED`; khách chỉ đọc khi `VIEWER`; chỉ owner đổi | Thời hạn link / liệt kê người đã mở (`manuscript_visits`) |

## FT-04 Hệ thống không phản hồi / API không khả dụng

```mermaid
flowchart TD
    TOP["TOP: API không phản hồi"]
    G1{{OR}}
    TOP --- G1
    E1["Tiến trình API chết / treo"]
    E2["Mất kết nối CSDL"]
    E3["Quá tải CPU/RAM do biên dịch"]
    G1 --- E1
    G1 --- E2
    G1 --- E3

    G2{{OR}}
    E1 --- G2
    A1(("Migration lỗi nên db-init thất bại → api không khởi động"))
    A2(("Thiếu biến môi trường bắt buộc"))
    A3(("Ngoại lệ không bắt trong tiến trình"))
    G2 --- A1
    G2 --- A2
    G2 --- A3

    G3{{OR}}
    E2 --- G3
    B1(("PostgreSQL chết / hết kết nối pool 10"))
    B2(("Mất VPN tới DB staging"))
    G3 --- B1
    G3 --- B2

    G4{{AND}}
    E3 --- G4
    C1(("Nhiều biên dịch đồng thời vượt concurrency"))
    C2(("Không có hàng đợi / giới hạn"))
    G4 --- C1
    G4 --- C2
```

| Nguyên nhân gốc | Biện pháp hiện có | Còn thiếu |
|---|---|---|
| A1 | `depends_on: db-init service_completed_successfully`; thất bại thì dừng sớm | Cảnh báo/thông báo khi `db-init` lỗi |
| A2 | `${VAR:?}` ở compose prod | — |
| A3 | `restart: always`, healthcheck 15 s, `init: true` | Báo động khi restart liên tục |
| B1, B2 | `GET /health` kiểm DB; client vẫn làm việc offline (IndexedDB) | Pool/timeout cấu hình theo tải; metrics |
| C1+C2 | `CompileQueue` (concurrency, 60 chờ, 12/người), timeout 300 s, router đẩy việc nặng về local | Tách worker biên dịch riêng, giới hạn CPU/RAM container |

## FT-05 Hai nguồn lưu nội dung bị lệch (rủi ro kiến trúc D1)

```mermaid
flowchart TD
    TOP["TOP: manuscripts.metadata ≠ manuscript_docs.doc_tree"]
    G1{{AND}}
    TOP --- G1
    A1(("Một client ghi qua PUT metadata"))
    A2(("Một client khác ghi qua POST sync/patches"))
    A3(("Không có cầu nối đồng bộ hai kênh"))
    G1 --- A1
    G1 --- A2
    G1 --- A3
```

Hiện **chỉ kênh `metadata`** được web dùng nên nguy cơ thấp; nếu bật `sync` trong web mà không cầu nối, cây sẽ lệch (xem [ADR-11](../4.1-ADD/01-decisions-core.md), [SAD D1](../4.2-SAD/09-risks-and-technical-debt.md)).
