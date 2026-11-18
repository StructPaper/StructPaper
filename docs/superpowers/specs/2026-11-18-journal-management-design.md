# Quản lý tạp chí (Journal management): thiết kế & hiện trạng

Căn cứ: `docs/Architecture/Kiến trúc Backend (NestJS, PostgreSQL) — Thiết kế chi tiết (1).pdf`
(mục 5.4 bảng `journals` / `article_types` / `profile_versions` / `manuscripts.profile_pin` / `manuscript_profile_snapshots`,
7.3 quyền `journal:*` & `profile:*`, 9.5 vòng đời profile), `docs/superpowers/plans/2026-11-15-journals-module-and-auth-activation.md`.

## 1. Vấn đề trước đây

Thông tin tạp chí nằm ở **ba nơi không đồng bộ**: bảng `journals` (tên, màu, ISSN trong một cột JSON `settings`), gói
`@structpaper/journal-profiles` (quy tắc dàn trang, hằng số trong code) và `apps/web/src/lib/templates.ts` (tiêu đề đầu trang, tên chính
thức, DOI…). Thêm tạp chí hay sửa quy tắc đều phải sửa code; trình soạn mẫu chỉ lưu `localStorage`; sửa quy tắc làm đổi cả bài cũ.

## 2. Mô hình dữ liệu (migration `0000_init`, đã gộp)

| Bảng | Lưu gì |
|---|---|
| `journals` | Danh tính: `slug`, `code` (duy nhất), `name`, `name_en`, `short_name`, `color`, `issn`, `latex_cls`, `status` (`draft/published/archived`), `sort_order`, `version` (ETag). Ràng buộc CHECK cho màu, ISSN, trạng thái. Không còn cột JSON `settings`. |
| `article_types` | Loại bài của một tạp chí: `journal_id`, `code`, `labels {vi,en}`, `status` (`active/archived`), `sort_order`. Duy nhất `(journal_id, code)`. |
| `profile_versions` | Quy tắc có phiên bản, 3 phạm vi: `base` (dùng chung), `journal`, `article_type`. `state` = `draft → validated → published → archived`, `config` JSON, `change_note`. Mỗi phạm vi có tối đa một bản `published` (chỉ mục duy nhất từng phần). Trigger DB cấm sửa nội dung / xoá bản đã `published` hoặc `archived`. |
| `manuscripts` | Thêm `article_type_id`, `profile_pin` (`{base, journal, articleType}`, NOT NULL, CHECK là object). |
| `manuscript_profile_snapshots` | Bản chụp profile đã ghép của bài tại lúc ghim (`reason`: `create` / `profile_upgrade`), kèm `hash`. |

Danh tính (tên, màu, mã, ISSN, danh sách loại bài) được **phủ lên** quy tắc khi phục vụ (`withIdentity`): đổi tên/màu/ISSN, đổi tên hay lưu trữ
một loại bài **không** tạo phiên bản quy tắc mới. Đổi quy tắc thì có.

### Các tầng khi ghép profile
`base → journal → article_type → overrides`, bằng hàm thuần `resolveFromTiers` (client và server dùng chung). Tầng 1-3 đọc từ `profile_versions`
(đã xuất bản, hoặc đúng phiên bản được ghim). Dàn trang **của bài** là một lớp ghi đè nữa (xem §5).

## 3. API (`apps/api/src/modules/journals`)

| Endpoint | Quyền |
|---|---|
| `GET /journals`, `/journals/:id`, `/journals/:id/article-types`, `/profiles/published` (ETag/304), `/profiles/resolve?journal=&type=&pin=base:1,journal:2,type:3` | công khai |
| `GET /journals/:id/access` | đăng nhập: `{canEdit, canCreate}` (giao diện hỏi API thay vì đoán) |
| `POST /journals` | tạo tạp chí (quản lý toàn hệ thống) |
| `PATCH /journals/:id` | sửa danh tính, `If-Match` (412 khi cũ); quyền theo từng tạp chí |
| `POST /journals/:id/article-types`, `PATCH …/:code` | thêm / đổi tên / sắp xếp / lưu trữ loại bài |
| `GET /profiles/{base\|journal\|article_type}/:id/versions`, `POST …/drafts`, `PATCH …/drafts/:v`, `POST …/drafts/:v/validate`, `…/publish`, `…/rollback` | `update Journal` của tạp chí (phạm vi `base`: chỉ quản lý toàn hệ thống). Loại bài đánh địa chỉ `hs:research`. |
| `POST /journals/:id/apply-profile-to-papers` `{password}` | `update Journal` của tạp chí **và** mật khẩu của người gọi (sai: 403 `Incorrect password`, không phải 401). Chuyển **mọi** bài của tạp chí sang các phiên bản đang xuất bản, ghi snapshot `profile_upgrade_all` + audit; không đổi `version` của bài; không hoàn tác được |
| `POST /manuscripts/:id/profile/upgrade` | chủ bài / người sửa được bài |
| `PUT /manuscripts/:id/article-type` `{articleType: code\|null}` | như trên; loại bài phải thuộc tạp chí (loại đã lưu trữ chỉ giữ được nếu bài đã có) |

Mỗi publish/rollback ghi `audit_logs` trong cùng transaction. `ProfileService.onModuleInit` xuất bản v1 cho base, mỗi tạp chí và mỗi loại bài
chưa có phiên bản (idempotent).

## 4. Ghim phiên bản vào bài
Pin và loại bài là của server, không nằm trong thứ client lưu, nên **không làm đổi `version` (ETag)** của bài: một lần tự lưu đang bay vẫn hợp lệ.
Tạo bài: server tính `profile_pin` = các phiên bản đang xuất bản (hoặc đúng pin client gửi, được kiểm tra), lưu `article_type_id` và một
snapshot. **Bài không tự đổi khi tạp chí xuất bản quy tắc mới.** Tác giả bấm "Nâng cấp quy tắc" (`profile/upgrade`) thì pin chuyển sang bản mới,
ghi snapshot `profile_upgrade`. Mở bài: client gọi `/profiles/resolve` với đúng pin (cache vĩnh viễn vì phiên bản bất biến).

## 5. Dàn trang của bài: kế thừa + ghi đè
`CompletePaper.layoutSettings` chỉ lưu **phần tác giả đã đổi**. Dàn trang thực = `layoutFromProfile(profile ghim)` ← `layoutSettings` của bài
(`resolvePaperLayout`). Bài cũ lưu bản đầy đủ coi như tập ghi đè đầy đủ nên PDF không đổi. Ánh xạ: khổ giấy, số cột, cỡ chữ (9/10/11pt), khoảng cột
(1/1.5/2pc), giãn dòng (1.13/1.2/1.3). Quy tắc **base** được đặt khớp trang VNUHCM thật (`custom`, 2 cột, 9pt, 1.13, 1pc) để kế thừa không đổi PDF nào.
Nhóm thuộc tính còn lại của quy tắc (lề, kiểu chữ chi tiết…) vẫn chưa tác động bộ dựng LaTeX (khung LaTeX cứng).

## 6. Web
- `PublishedProfilesSync` (root) → `GET /profiles/published` → `registerRemoteProfiles` (base, tạp chí, loại bài): `resolveProfile` đồng bộ dùng dữ liệu server.
- `lib/templates.ts`: `findJournalTemplate / getJournalTemplate / listJournalTemplates` ưu tiên dữ liệu đã xuất bản (tạp chí admin thêm cũng được parser/PDF nhận).
- Thanh tiêu đề (title bar) ở trang một tạp chí: trái = mã + tên tạp chí (theo ngôn ngữ đang chọn), phải = chọn ngôn ngữ (dùng chung `pdfLanguage` nên bản xem trước PDF đổi theo: trang đầu ngôn ngữ chính, trang cuối ngôn ngữ kia) + nút **Lịch sử** kèm nhãn phiên bản đang xem (`v3 · bản cũ` / `v5 · hiện hành`).
- Lịch sử phiên bản là một modal: xem một bản cũ (trình soạn chuyển sang chỉ đọc, banner "Đang xem v3", PDF dựng theo quy tắc bản đó), khôi phục (tạo bản mới từ bản cũ), và **Áp dụng cho mọi bài** (chỉ ở bản đang áp dụng): cảnh báo → cảnh báo không hoàn tác → nhập mật khẩu.
- Bấm Lưu: modal so sánh kiểu diff (dòng − đỏ / + xanh) chia nhóm "Nhận diện" (lưu ngay) và các nhóm quy tắc (phiên bản mới). Rời trang khi chưa lưu: hộp thoại cảnh báo (liên kết nội bộ, nút quay lại; đóng/tải lại tab dùng cảnh báo của trình duyệt; nút Back của trình duyệt chưa chặn được).
- Editor bài: thông báo quy tắc mới là toast không tự tắt (đóng = bỏ qua lần này, mở lại bài sẽ hiện lại); nút **?** cạnh Chia sẻ mở modal các phiên bản quy tắc đang áp dụng, nâng cấp, và liên kết sang trang tạp chí.
- Trình soạn mẫu: lưu = cập nhật danh tính (`If-Match`) + xuất bản phiên bản mới nếu quy tắc đổi; tab **Loại bài** (thêm/đổi tên/sắp xếp/lưu trữ, bật tắt "phải có tóm tắt"
  = phiên bản mới của loại bài), **Thông tin in & trích dẫn**, **Lịch sử phiên bản**; chu trình trạng thái published → draft → archived; chỉ-đọc khi API nói không được sửa.
- Trang `/templates/base`: xem/xuất bản quy tắc dùng chung (JSON, kiểm tra phía server) và lịch sử.
- Editor bài: `usePaperProfile` lấy profile theo pin, dựng lại PDF khi dàn trang theo pin khác bản mới nhất.
- Ô loại bài chọn từ **danh sách loại bài của chính tạp chí** (lấy từ server, gồm cả loại admin vừa thêm); không gõ tay. Chọn một loại lưu `metadata.articleTypeCode` (kèm tên Việt/Anh của loại đó), `useArticleTypeSync` gọi `PUT /manuscripts/:id/article-type` và nhận pin mới: bài chuyển sang quy tắc của loại mới, giữ pin base/journal. Tên đã lưu không thuộc loại nào của tạp chí vẫn hiển thị cho tới khi chọn loại khác.

## 7. Kiểm thử
- `apps/api/test/journals/*.integration.spec.ts`, `journal-management.http.spec.ts` chạy trên **Postgres thật** khi có `TEST_DATABASE_URL`
  (chỉ nhận localhost; khoá advisory để các spec không chạy chồng). Không có biến → bỏ qua.
- `packages/journal-profiles/tests`, `apps/web/test/journals/*`, `apps/web/test/layout/*`.

## 8. Chưa làm / giới hạn đã biết
- `profile_files` (tải lên `.cls`, font, logo cho từng tạp chí): chưa có. Tạp chí mới dùng `structpaper-std.cls`.
- Bài cũ chưa có mã loại bài: lúc tạo server khớp tên đã lưu với loại bài của tạp chí; không khớp thì bài không thuộc loại nào cho tới khi tác giả chọn.
- Một số thuộc tính quy tắc (lề, kiểu chữ chi tiết) chưa nối vào bộ dựng LaTeX.
- Bản desktop build tĩnh không có trang chi tiết cho tạp chí thêm sau lúc build.
