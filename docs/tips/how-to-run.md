# Cẩm Nang Chi Tiết Các Cách Khởi Chạy Dự Án StructPaper

Tài liệu này tổng hợp đầy đủ và chi tiết các phương thức khởi chạy hệ thống **StructPaper** (bao gồm Next.js 14 Frontend, NestJS 10 Fastify Backend, pg-boss Background Worker, PostgreSQL 16, MinIO S3 Object Storage, và Tauri v2 Desktop). 

Tùy vào cấu hình máy tính và mục đích làm việc (phát triển tính năng, debug nhanh, thiết kế UI, hoặc kiểm thử sản phẩm), bạn có thể lựa chọn 1 trong 4 phương thức dưới đây.

---

## 🗺️ Bảng Lựa Chọn Phương Thức Khởi Chạy

| Phương thức | Khi nào nên dùng? | Yêu cầu tài nguyên | Lệnh chính |
| :--- | :--- | :--- | :--- |
| **1. Full-Stack Docker Dev** | Muốn chạy đầy đủ hệ sinh thái backend, frontend, worker với hot-reload tự động. | Trung bình - Cao (RAM $\ge$ 8GB, ổ cứng $\ge$ 10GB trống). | `pnpm docker:dev` |
| **2. Hybrid (Docker Hạ tầng + Local Apps)** | Máy ít RAM, muốn tốc độ build nhanh nhất, dễ đặt Breakpoint debug code bằng IDE. | Nhẹ - Trung bình (Docker chỉ chạy DB & S3, app chạy trực tiếp trên máy). | `docker compose ... up -d postgres minio`<br/>`pnpm dev:api` / `pnpm dev:web` |
| **3. Frontend Standalone (Mock Mode)** | Chỉ muốn chỉnh sửa UI/UX, Editor, dàn trang, không cần backend hoặc khi đang offline. | Rất nhẹ (Không cần cài/chạy Docker). | `pnpm dev:web` |
| **4. Desktop App (Tauri v2)** | Phát triển và đóng gói bản ứng dụng máy tính (.exe Windows, .dmg macOS). | Cần cài Rust toolchain & WebView2. | `pnpm --filter @structpaper/web tauri:dev` |

---

## 1. Phương Thức 1: Full-Stack Docker Dev (Khuyên dùng chuẩn hóa ⭐)

Toàn bộ dịch vụ (Cơ sở dữ liệu, MinIO, Backend, Worker, Frontend) sẽ được đóng gói và khởi chạy trong các container tách biệt. File code trên máy thật được gắn kết (bind-mount) trực tiếp vào container, khi sửa code thì server sẽ tự động **Hot-Reload**.

### Các bước thực hiện:

Mở Terminal tại thư mục gốc `StructPaper/`:

```bash
# 1. Khởi động toàn bộ hệ thống ở chế độ Hot-Reload
pnpm docker:dev
```

> [!NOTE]
> **Chạy ngầm (Background / Detached):**  
> Nếu bạn muốn nhường cửa sổ Terminal để làm việc khác mà không sợ lỡ tay tắt Docker:
> ```bash
> docker compose -f docker-compose.dev.yml up -d
> ```

### Hệ thống tự động làm gì cho bạn?
1. Khởi chạy **PostgreSQL 16** (`postgres:16-alpine`) tại cổng `5432`.
2. Khởi chạy **MinIO S3** (`cgr.dev/chainguard/minio`) tại cổng `9000` (API) và `9001` (Web Console).
3. Container **`minio-init`** tự tạo sẵn bucket `structpaper-dev` và cấp quyền truy cập.
4. Container **`db-init`** tự động chạy `pnpm db:migrate` (18 bảng CSDL) và `pnpm db:seed` tạo sẵn tài khoản Admin.
5. Khởi chạy **NestJS Fastify API** tại cổng `3001` và **Next.js Web** tại cổng `3000`.

### Các lệnh quản lý Docker hữu ích:
```bash
# Xem log trực tiếp của một service cụ thể (ví dụ: api hoặc worker)
docker compose -f docker-compose.dev.yml logs -f api

# Tắt toàn bộ hệ thống
pnpm docker:dev:down
# hoặc:
docker compose -f docker-compose.dev.yml down

# Tắt và XÓA SẠCH dữ liệu database/storage để reset về trắng tinh ban đầu:
docker compose -f docker-compose.dev.yml down -v
```

---

## 2. Phương Thức 2: Chế Độ Hybrid (Docker Hạ Tầng + Ứng Dụng Trên Host)

Phương thức này kết hợp ưu điểm của cả hai: Dùng Docker để chạy nhẹ nhàng các dịch vụ hạ tầng khó cài đặt (PostgreSQL, MinIO), trong khi chạy mã nguồn Node.js/TypeScript trực tiếp trên máy thật bằng `pnpm`.

### Ưu điểm vượt trội:
* Tiết kiệm RAM đáng kể so với việc chạy tất cả trong container.
* Tốc độ biên dịch TypeScript cực nhanh do tận dụng trực tiếp CPU của máy thật.
* Dễ dàng đặt breakpoint debug trực tiếp trong VS Code / WebStorm.

### Các bước thực hiện:

#### Bước 2.1: Bật hạ tầng phụ trợ bằng Docker (chạy ngầm)
```bash
docker compose -f docker-compose.dev.yml up -d postgres minio minio-init
```

#### Bước 2.2: Khởi tạo schema và nạp dữ liệu mẫu
```bash
pnpm db:migrate
pnpm db:seed
```

#### Bước 2.3: Chạy các ứng dụng trên các tab Terminal riêng biệt
* **Tab 1 — Backend API (NestJS Fastify):**
  ```bash
  pnpm dev:api
  ```
  *(Server lắng nghe tại `http://localhost:3001`)*

* **Tab 2 — Background Worker (LaTeX & Job Queue):**
  ```bash
  pnpm dev:worker
  ```

* **Tab 3 — Frontend Web (Next.js 14):**
  ```bash
  pnpm dev:web
  ```
  *(Truy cập tại `http://localhost:3000`)*

---

## 3. Phương Thức 3: Frontend Standalone (Mock Offline Mode)

Nếu bạn chỉ phụ trách giao diện (UI), chỉnh sửa TipTap Editor, làm việc với Template bài báo, hoặc khi đang đi công tác không có mạng internet: bạn **hoàn toàn không cần bật Docker hay Database**.

### Các bước thực hiện:
```bash
pnpm dev:web
```

1. Mở trình duyệt vào `http://localhost:3000`.
2. Hệ thống sử dụng cơ chế **Mock Adapter** tích hợp:
   - Dữ liệu bài báo, bảng, công thức, metadata được lưu tạm trong trình duyệt qua **IndexedDB**.
   - Tại trang đăng nhập `/login`, có nút bấm bật/tắt nhanh:  
     `🟡 Mock Offline Mode` $\leftrightarrow$ `🟢 Live Cloud API`.

---

## 4. Phương Thức 4: Chạy Bản Production Thật (Production Docker)

Dùng để kiểm thử ứng dụng trước khi triển khai lên máy chủ thật hoặc bàn giao:
* Mã nguồn được build tối ưu đa tầng (Multi-stage build).
* Frontend Next.js sử dụng chế độ `standalone` siêu gọn (~150MB thay vì hàng GB node_modules).
* Mã nguồn biên dịch sẵn ra JavaScript thuần, chạy ở chế độ hiệu năng cao nhất.

### Lệnh khởi chạy:
```bash
# Build và khởi chạy môi trường Production
pnpm docker:prod

# Tắt môi trường Production
pnpm docker:prod:down
```

---

## 5. Phương Thức 5: Ứng Dụng Desktop (Tauri v2)

StructPaper hỗ trợ chạy dưới dạng phần mềm cài đặt độc lập trên máy tính (Windows `.exe`, macOS `.dmg`) với engine LaTeX Tectonic offline nhúng sẵn.

### Yêu cầu tiên quyết:
- Đã cài đặt **Rust** (`rustc`, `cargo` từ [rustup.rs](https://rustup.rs/)).
- Trên Windows: Đã có **Microsoft Visual C++ Build Tools** và **WebView2**.

### Lệnh chạy:
```bash
# Chạy ứng dụng Desktop ở chế độ phát triển (Hot-reload cửa sổ Desktop)
pnpm --filter @structpaper/web tauri:dev

# Đóng gói bộ cài đặt Release (.exe / .msi)
pnpm --filter @structpaper/web tauri:build
```
*(File cài đặt sau khi đóng gói sẽ nằm tại `apps/web/src-tauri/target/release/bundle/`)*.

---

## 📋 Danh Sách Cổng Mạng (Ports) & Tài Khoản Mặc Định

### 1. Bảng Port Dịch Vụ
| Dịch vụ | Địa chỉ URL | Cổng (Port) | Mô tả |
| :--- | :--- | :--- | :--- |
| **Web Frontend** | `http://localhost:3000` | `3000` | Giao diện người dùng Next.js 14 |
| **Backend API** | `http://localhost:3001` | `3001` | API Platform NestJS Fastify (Swagger docs tại `/docs`) |
| **MinIO API** | `http://localhost:9000` | `9000` | Endpoint lưu trữ file S3 tương thích |
| **MinIO Console** | `http://localhost:9001` | `9001` | Giao diện web quản lý bucket và file tải lên |
| **PostgreSQL** | `localhost:5432` | `5432` | CSDL chính (Database: `structpaper`) |

---

### 2. Bảng Tài Khoản Đăng Nhập Mẫu (Seed Data)
Tại trang đăng nhập `http://localhost:3000/login`, bạn có thể bấm trực tiếp các nút điền nhanh (Quick-fill) hoặc nhập tay thông tin sau:

| Vai trò | Email đăng nhập | Mật khẩu mặc định | Quyền hạn trong hệ thống |
| :--- | :--- | :--- | :--- |
| **SuperAdmin** | `admin@structpaper.org` | `AdminPassword123!` | Toàn quyền hệ thống, quản lý phân quyền thành viên (`/permissions`), duyệt và thu hồi vai trò tức thì. |
| **Tác giả (Author)** | `author@structpaper.org` | `Author123!@#` | Tạo mới bản thảo, tải lên DOCX, chỉnh sửa nội dung bài báo khoa học chuẩn ĐHQG-HCM. |
| **MinIO Console** | `minioadmin` | `minioadmin` | Tài khoản quản trị giao diện lưu trữ file S3 (`http://localhost:9001`). |

---

## 🛠️ Một Số Lỗi Thường Gặp & Cách Khắc Phục Nhanh

### 1. Lỗi cổng bị chiếm dụng (Port already in use)
* **Triệu chứng:** Báo lỗi `bind: address already in use` tại cổng `5432` hoặc `3000`, `3001`.
* **Khắc phục:** Thường do bạn đang có sẵn dịch vụ PostgreSQL hoặc một ứng dụng Node khác cài trực tiếp trên máy đang chiếm cổng:
  ```powershell
  # Tìm tiến trình đang chiếm cổng (ví dụ cổng 5432):
  Get-Process -Id (Get-NetTCPConnection -LocalPort 5432).OwningProcess
  ```
  Bạn có thể tắt dịch vụ đó hoặc sửa port map trong file `docker-compose.dev.yml` (ví dụ `5433:5432`).

### 2. Ổ đĩa C bị đầy khi chạy Docker
* **Khắc phục:** 
  1. Xóa cache và container rác: Mở Docker Desktop $\rightarrow$ icon Con bọ (Troubleshoot) $\rightarrow$ **Clean / Purge data**.
  2. Hoặc chuyển phân vùng lưu trữ của Docker sang ổ khác (ví dụ ổ D): Docker Desktop $\rightarrow$ **Settings** $\rightarrow$ **Resources** $\rightarrow$ **Advanced** $\rightarrow$ **Disk image location** chọn `D:\Docker\data`.

### 3. Kiểm tra tính toàn vẹn của mã nguồn (Verification Script)
Trước khi commit hoặc push code lên Git, luôn chạy bộ công cụ kiểm tra tự động 4 tầng kiến trúc:
```bash
# Chạy kiểm tra quy tắc kiến trúc dependency-cruiser, typecheck và toàn bộ unit tests:
pnpm verify
```
