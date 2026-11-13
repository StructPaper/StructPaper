package vn.edu.vnu.structpaper.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import vn.edu.vnu.structpaper.dto.response.CompilerStatusResponse;
import vn.edu.vnu.structpaper.service.LatexCompilerService;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/system")
@Tag(name = "System Status", description = "Kiểm tra trạng thái hoạt động và phát hiện trình biên dịch trên máy chủ")
public class SystemStatusController {

    private final LatexCompilerService compilerService;

    public SystemStatusController(LatexCompilerService compilerService) {
        this.compilerService = compilerService;
    }

    @GetMapping("/status")
    @Operation(summary = "Kiểm tra trạng thái chi tiết hệ thống và trình biên dịch", description = "Trả về thông tin phiên bản XeLaTeX, Tectonic, dung lượng RAM và hệ điều hành")
    public ResponseEntity<CompilerStatusResponse> getStatus() {
        return ResponseEntity.ok(compilerService.getStatus());
    }

    @GetMapping("/health")
    @Operation(summary = "Kiểm tra độ sẵn sàng của máy chủ", description = "Endpoint kiểm tra liveness và readiness đơn giản")
    public ResponseEntity<Map<String, Object>> getHealth() {
        return ResponseEntity.ok(Map.of(
                "status", "UP",
                "service", "struct-paper-backend",
                "timestamp", System.currentTimeMillis()
        ));
    }
}
