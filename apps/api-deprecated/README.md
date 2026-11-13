# 🏛️ StructPaper Backend - Hệ Thống Dịch vụ Biên Dịch XeLaTeX & Xuất Bản Báo Cáo Khoa Học (VNUHCM)

Backend chuẩn công nghiệp (**Industry-Standard**) xây dựng trên nền tảng **Java 21 LTS** và **Spring Boot 3.3.4**, chuyên trách xử lý biên dịch mã nguồn LaTeX học thuật sang định dạng PDF vector chất lượng cao theo chuẩn các tạp chí thuộc **Đại học Quốc gia TP.HCM (VNUHCM)**.

---

## 🚀 Tính Năng Cốt Lõi

1. **Biên Dịch Đa Động Cơ (Dual-Engine Architecture)**:
   - **XeLaTeX**: Động cơ chuẩn quốc tế hỗ trợ xử lý font OpenType/TrueType, đa ngữ UTF-8 tiếng Việt và macro học thuật.
   - **Tectonic (Standalone XeTeX)**: Động cơ XeTeX hiện đại, tích hợp sẵn, tự động nạp gói CTAN khi thiếu, không đòi hỏi cấu hình môi trường phức tạp.
   - **Cơ chế tự động phát hiện (Auto Engine Detection)**: Tự động nhận diện động cơ tốt nhất sẵn có trên máy chủ.

2. **Cơ Chế Phục Hồi & Tương Thích Font Thông Minh (Smart Font Fallback)**:
   - Các template tạp chí thường sử dụng font thương mại Adobe (*Minion Pro*, *Myriad Pro*, *Univers LT Std*).
   - Backend tự động nhận diện nếu máy chủ chưa cài đặt font bản quyền và kích hoạt bộ ánh xạ thay thế tương thích học thuật chuẩn (*Times New Roman*, *Arial*, *Courier New*) giúp tài liệu biên dịch thành công 100% mà không bị lỗi `fontspec`.

3. **Xử Lý Lỗi Minh Bạch & Chuẩn RFC (Zero Silent Fallback)**:
   - Báo cáo chi tiết vị trí dòng lỗi LaTeX (`l.XYZ`, tên package, lỗi cú pháp) về cho client thông qua mã HTTP `422 Unprocessable Entity`.

4. **Tài Liệu API Tự Động (Swagger & OpenAPI 3.0)**:
   - Tích hợp sẵn giao diện Swagger UI tương tác trực tiếp tại `/swagger-ui.html`.

---

## 🛠️ Yêu Cầu Môi Trường & Cài Đặt

- **Java**: JDK 21 trở lên (`java -version`).
- **Build tool**: Gradle 8.x/9.x (đã kèm cấu hình nhẹ nhàng, tối ưu RAM).
- **TeX Engine**:
  - `tectonic.exe` (đã có sẵn trong thư mục `bin/` của dự án).
  - Hoặc **MiKTeX / TeX Live** (`xelatex`).

---

## 🏃 Hướng Dẫn Khởi Chạy

### 1. Chạy ở chế độ Development:
```bash
cd struct-paper-backend
gradle bootRun
```

### 2. Đóng gói file JAR thực thi (Production Build):
```bash
gradle bootJar
```
File JAR sẽ được tạo tại: `build/libs/struct-paper-backend-1.0.0-SNAPSHOT.jar`.

### 3. Chạy file JAR độc lập:
```bash
java -Xmx384m -jar build/libs/struct-paper-backend-1.0.0-SNAPSHOT.jar
```
Server sẽ lắng nghe tại cổng `8080`.

---

## 📡 Danh Sách API (RESTful Endpoints)

| Phương thức | Đường dẫn | Mô tả |
|-------------|-----------|-------|
| `POST` | `/api/v1/compile/latex` | Nhận JSON `{ texContent, jobName, autoFontFallback }`, trả về luồng PDF nhị phân (`application/pdf`) |
| `POST` | `/api/v1/compile/latex/json` | Biên dịch và trả về JSON chứa PDF Base64 cùng đầy đủ log thực thi và thời gian |
| `POST` | `/api/v1/compile/upload` | Tải file `.tex` trực tiếp (Multipart) để biên dịch thành PDF |
| `GET` | `/api/v1/system/status` | Kiểm tra tình trạng hoạt động của XeLaTeX, Tectonic, RAM và hệ điều hành |
| `GET` | `/api/v1/system/health` | Kiểm tra độ sẵn sàng của máy chủ (Healthcheck) |
| `GET` | `/api/v1/templates` | Lấy danh mục chuẩn các tạp chí ĐHQG-HCM (Health Sciences, Natural Sciences, ...) |
| `GET` | `/swagger-ui.html` | Giao diện kiểm thử API tương tác trực quan qua trình duyệt |
| `GET` | `/v3/api-docs` | Đặc tả OpenAPI 3.0 định dạng JSON |

---

## 🧪 Kiểm Thử Tự Động (Automated Testing)

Chạy bộ kiểm thử tự động (Unit & Integration tests):
```bash
gradle test
```
Tất cả các bài kiểm thử xác thực cấu hình Spring, ánh xạ font và cơ chế kiểm soát lỗi đều được tự động thực thi.
