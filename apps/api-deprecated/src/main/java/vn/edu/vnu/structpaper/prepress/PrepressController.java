package vn.edu.vnu.structpaper.prepress;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import vn.edu.vnu.structpaper.exception.InvalidPdfException;

import java.io.IOException;
import java.util.Base64;

@RestController
@RequestMapping("/api/v1/prepress")
@Tag(name = "Prepress", description = "Pipeline tiền xuất bản (Prepress) chuẩn PDF/X-1a hoặc PDF/A qua Ghostscript")
public class PrepressController {

    private static final Logger log = LoggerFactory.getLogger(PrepressController.class);

    private final PrepressService prepressService;

    public PrepressController(PrepressService prepressService) {
        this.prepressService = prepressService;
    }

    /**
     * Nhận file PDF upload qua multipart/form-data
     */
    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Tiền xử lý file PDF xuất bản qua Multipart upload")
    public ResponseEntity<?> prepressMultipart(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "format", required = false) String format,
            @RequestParam(value = "standard", required = false, defaultValue = "PDF/X-1a:2001") String standard,
            @RequestParam(value = "targetDpi", required = false, defaultValue = "300") int targetDpi,
            @RequestHeader(value = HttpHeaders.ACCEPT, required = false) String acceptHeader) {

        if (file == null || file.isEmpty()) {
            throw new InvalidPdfException("Tệp tải lên không được để trống.");
        }

        byte[] bytes;
        try {
            bytes = file.getBytes();
        } catch (IOException e) {
            throw new InvalidPdfException("Không thể đọc nội dung tệp tải lên: " + e.getMessage(), e);
        }

        PrepressOptions options = new PrepressOptions(standard, targetDpi, "CMYK");
        PrepressReport report = prepressService.processPdf(bytes, options);

        return buildResponse(report, format, acceptHeader, file.getOriginalFilename());
    }

    /**
     * Nhận file PDF qua binary stream (application/pdf)
     */
    @PostMapping(consumes = MediaType.APPLICATION_PDF_VALUE)
    @Operation(summary = "Tiền xử lý file PDF xuất bản qua Binary stream")
    public ResponseEntity<?> prepressBinary(
            @RequestBody byte[] pdfBytes,
            @RequestParam(value = "format", required = false) String format,
            @RequestParam(value = "standard", required = false, defaultValue = "PDF/X-1a:2001") String standard,
            @RequestParam(value = "targetDpi", required = false, defaultValue = "300") int targetDpi,
            @RequestHeader(value = HttpHeaders.ACCEPT, required = false) String acceptHeader) {

        if (pdfBytes == null || pdfBytes.length == 0) {
            throw new InvalidPdfException("Dữ liệu PDF nhị phân không được để trống.");
        }

        PrepressOptions options = new PrepressOptions(standard, targetDpi, "CMYK");
        PrepressReport report = prepressService.processPdf(pdfBytes, options);

        return buildResponse(report, format, acceptHeader, "document.pdf");
    }

    /**
     * Nhận payload JSON chứa chuỗi Base64 PDF
     */
    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE)
    @Operation(summary = "Tiền xử lý file PDF xuất bản qua JSON payload")
    public ResponseEntity<?> prepressJson(
            @RequestBody PrepressRequest request,
            @RequestParam(value = "format", required = false) String queryFormat,
            @RequestHeader(value = HttpHeaders.ACCEPT, required = false) String acceptHeader) {

        if (request == null || request.getPdfBase64() == null || request.getPdfBase64().isBlank()) {
            throw new InvalidPdfException("Thuộc tính pdfBase64 trong payload JSON không được để trống.");
        }

        byte[] pdfBytes;
        try {
            pdfBytes = Base64.getDecoder().decode(request.getPdfBase64().trim());
        } catch (IllegalArgumentException e) {
            throw new InvalidPdfException("Chuỗi pdfBase64 không phải là mã hóa Base64 hợp lệ: " + e.getMessage(), e);
        }

        String standard = request.getStandard() != null ? request.getStandard() : "PDF/X-1a:2001";
        int targetDpi = request.getTargetDpi() != null ? request.getTargetDpi() : 300;
        PrepressOptions options = new PrepressOptions(standard, targetDpi, "CMYK");

        PrepressReport report = prepressService.processPdf(pdfBytes, options);

        String desiredFormat = queryFormat != null ? queryFormat : request.getFormat();
        return buildResponse(report, desiredFormat, acceptHeader, "document.pdf");
    }

    /**
     * Xây dựng HTTP Response dựa trên format yêu cầu hoặc header Accept
     */
    private ResponseEntity<?> buildResponse(PrepressReport report,
                                            String format,
                                            String acceptHeader,
                                            String originalFilename) {
        boolean preferJson = "json".equalsIgnoreCase(format) ||
                (format == null && acceptHeader != null && acceptHeader.contains(MediaType.APPLICATION_JSON_VALUE));

        if (preferJson) {
            return ResponseEntity.ok(report);
        }

        // Mặc định trả về file PDF tải về
        String outputFilename = "prepress_" + (originalFilename != null ? originalFilename : "output.pdf");
        if (!outputFilename.toLowerCase().endsWith(".pdf")) {
            outputFilename += ".pdf";
        }

        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_PDF)
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + outputFilename + "\"")
                .header("X-Prepress-Compliant", String.valueOf(report.isPdfXCompliant()))
                .header("X-Prepress-Mock", String.valueOf(report.isMock()))
                .header("X-Prepress-ColorSpace", report.getColorSpace())
                .header("X-Prepress-Fonts-Embedded", String.valueOf(report.isAllFontsEmbedded()))
                .body(report.getPdfBytes());
    }
}
