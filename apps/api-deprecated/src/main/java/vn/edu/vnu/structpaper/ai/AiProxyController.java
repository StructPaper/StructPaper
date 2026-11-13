package vn.edu.vnu.structpaper.ai;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vn.edu.vnu.structpaper.dto.response.ErrorResponse;

@RestController
@RequestMapping("/api/v1/ai")
@Tag(name = "AI Proxy", description = "Dịch vụ AI Proxy kiểm soát nghiêm ngặt phía máy chủ")
public class AiProxyController {

    private final AiService aiService;

    public AiProxyController(AiService aiService) {
        this.aiService = aiService;
    }

    @PostMapping(
            value = "/extract",
            consumes = MediaType.APPLICATION_JSON_VALUE,
            produces = MediaType.APPLICATION_JSON_VALUE
    )
    @Operation(
            summary = "Thực hiện hành động AI được cấp phép (Whitelisted AI Action)",
            description = "Tiếp nhận và xử lý các hành động AI trong danh sách whitelist: " +
                    "extractFrontMatter, extractMetadata, suggestKeywords, refineAbstract, fixGrammar. " +
                    "Giới hạn payload tối đa 15KB. Nghiêm cấm free-form prompt."
    )
    @ApiResponses({
            @ApiResponse(
                    responseCode = "200",
                    description = "Xử lý AI thành công",
                    content = @Content(schema = @Schema(implementation = AiExtractResponse.class))
            ),
            @ApiResponse(
                    responseCode = "400",
                    description = "Hành động không nằm trong whitelist hoặc chứa prompt tự do",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))
            ),
            @ApiResponse(
                    responseCode = "413",
                    description = "Kích thước payload vượt quá giới hạn 15KB (15,360 bytes)",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))
            )
    })
    public ResponseEntity<AiExtractResponse> extract(
            @Valid @RequestBody AiExtractRequest request,
            HttpServletRequest httpServletRequest
    ) {
        // Kiểm tra Content-Length header nếu có
        long contentLength = httpServletRequest.getContentLengthLong();
        if (contentLength > AiService.MAX_PAYLOAD_BYTES) {
            throw new PayloadTooLargeException(
                    "Kích thước yêu cầu vượt quá giới hạn tối đa 15KB (" + contentLength + " bytes > " +
                            AiService.MAX_PAYLOAD_BYTES + " bytes)"
            );
        }

        String clientIp = resolveClientIp(httpServletRequest);
        AiExtractResponse response = aiService.execute(request, clientIp);
        return ResponseEntity.ok(response);
    }

    private String resolveClientIp(HttpServletRequest request) {
        if (request == null) {
            return "127.0.0.1";
        }
        String xForwardedFor = request.getHeader("X-Forwarded-For");
        if (xForwardedFor != null && !xForwardedFor.isBlank()) {
            return xForwardedFor.split(",")[0].trim();
        }
        String xRealIp = request.getHeader("X-Real-IP");
        if (xRealIp != null && !xRealIp.isBlank()) {
            return xRealIp.trim();
        }
        String remoteAddr = request.getRemoteAddr();
        return (remoteAddr != null && !remoteAddr.isBlank()) ? remoteAddr : "127.0.0.1";
    }
}
