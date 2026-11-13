package vn.edu.vnu.structpaper.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/templates")
@Tag(name = "Templates", description = "Danh mục chuẩn mẫu tạp chí khoa học ĐHQG-HCM")
public class TemplateController {

    @GetMapping
    @Operation(summary = "Lấy danh sách các mẫu tạp chí hỗ trợ", description = "Trả về danh sách các chuẩn tạp chí ĐHQG-HCM (Health Sciences, Science & Technology, Social Sciences, etc.)")
    public ResponseEntity<List<Map<String, Object>>> getTemplates() {
        return ResponseEntity.ok(List.of(
                Map.of(
                        "id", "VNUHCM-HS",
                        "name", "Tạp chí Phát triển Khoa học và Công nghệ – Health Sciences",
                        "shortName", "STDJ: Health Sciences",
                        "issn", "2734-9349",
                        "eIssn", "2734-9357",
                        "columns", 2,
                        "primaryEngine", "XeLaTeX"
                ),
                Map.of(
                        "id", "VNUHCM-ST",
                        "name", "Tạp chí Phát triển Khoa học và Công nghệ – Khoa học Tự nhiên",
                        "shortName", "STDJ: Natural Sciences",
                        "issn", "1859-4530",
                        "columns", 2,
                        "primaryEngine", "XeLaTeX"
                ),
                Map.of(
                        "id", "VNUHCM-ENG",
                        "name", "Tạp chí Phát triển Khoa học và Công nghệ – Kỹ thuật và Công nghệ",
                        "shortName", "STDJ: Engineering & Technology",
                        "issn", "2615-9619",
                        "columns", 2,
                        "primaryEngine", "XeLaTeX"
                )
        ));
    }
}
