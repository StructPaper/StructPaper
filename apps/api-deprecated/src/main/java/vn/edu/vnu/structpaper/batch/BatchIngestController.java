package vn.edu.vnu.structpaper.batch;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import vn.edu.vnu.structpaper.dto.response.ErrorResponse;

@RestController
@RequestMapping("/api/v1/batches")
@Tag(name = "Batch Ingest", description = "Dịch vụ tiếp nhận và xử lý hàng loạt tài liệu DOCX")
public class BatchIngestController {

    private final BatchService batchService;

    public BatchIngestController(BatchService batchService) {
        this.batchService = batchService;
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Tiếp nhận tệp ZIP chứa nhiều tài liệu DOCX",
            description = "Tải lên tệp nén ZIP chứa các bản thảo DOCX để tiến hành bóc tách, QC và tạo manuscript trong nền")
    @ApiResponses({
            @ApiResponse(responseCode = "202", description = "Batch được chấp nhận để xử lý bất đồng bộ trong nền",
                    content = @Content(mediaType = "application/json", schema = @Schema(implementation = BatchUploadResponse.class))),
            @ApiResponse(responseCode = "400", description = "Tệp ZIP rỗng, bị hỏng hoặc không chứa tài liệu DOCX hợp lệ",
                    content = @Content(mediaType = "application/json", schema = @Schema(implementation = ErrorResponse.class)))
    })
    public ResponseEntity<BatchUploadResponse> submitBatch(
            @Parameter(description = "Tệp nén ZIP chứa các file DOCX", required = true)
            @RequestParam("file") MultipartFile file,

            @Parameter(description = "Mã tạp chí mục tiêu (vd: vnu-tcb, vnu-js)", required = false)
            @RequestParam(value = "journalId", required = false) String journalId,

            @Parameter(description = "Tùy chọn xử lý mở rộng dưới dạng JSON", required = false)
            @RequestParam(value = "options", required = false) String options) {

        BatchUploadResponse response = batchService.submitBatch(file, journalId, options);
        return ResponseEntity.status(HttpStatus.ACCEPTED).body(response);
    }

    @GetMapping("/{batchId}")
    @Operation(summary = "Kiểm tra tiến độ thực thi của batch",
            description = "Trả về trạng thái thời gian thực, tỉ lệ hoàn thành và kết quả từng tệp trong batch")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Trạng thái và tiến độ của batch",
                    content = @Content(mediaType = "application/json", schema = @Schema(implementation = BatchStatusResponse.class))),
            @ApiResponse(responseCode = "404", description = "Không tìm thấy batch với ID tương ứng",
                    content = @Content(mediaType = "application/json", schema = @Schema(implementation = ErrorResponse.class)))
    })
    public ResponseEntity<BatchStatusResponse> getBatchStatus(
            @Parameter(description = "Mã định danh batch (ULID)", required = true)
            @PathVariable("batchId") String batchId) {

        BatchStatusResponse response = batchService.getStatus(batchId);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/{batchId}/report")
    @Operation(summary = "Lấy báo cáo tổng hợp kết quả của batch",
            description = "Trả về thông tin chi tiết, thống kê tỷ lệ thành công và thời gian thực thi của toàn bộ batch")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Báo cáo tổng hợp chi tiết kết quả batch",
                    content = @Content(mediaType = "application/json", schema = @Schema(implementation = BatchReportResponse.class))),
            @ApiResponse(responseCode = "404", description = "Không tìm thấy batch với ID tương ứng",
                    content = @Content(mediaType = "application/json", schema = @Schema(implementation = ErrorResponse.class)))
    })
    public ResponseEntity<BatchReportResponse> getBatchReport(
            @Parameter(description = "Mã định danh batch (ULID)", required = true)
            @PathVariable("batchId") String batchId) {

        BatchReportResponse response = batchService.getReport(batchId);
        return ResponseEntity.ok(response);
    }
}
