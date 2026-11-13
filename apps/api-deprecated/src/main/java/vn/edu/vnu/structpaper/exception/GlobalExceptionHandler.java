package vn.edu.vnu.structpaper.exception;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;
import vn.edu.vnu.structpaper.ai.InvalidActionException;
import vn.edu.vnu.structpaper.ai.PayloadTooLargeException;
import vn.edu.vnu.structpaper.dto.response.ErrorResponse;

import java.util.stream.Collectors;

@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(LatexCompilationException.class)
    public ResponseEntity<ErrorResponse> handleCompilationException(LatexCompilationException ex) {
        log.warn("Lỗi biên dịch LaTeX với engine {}: {}", ex.getEngine(), ex.getMessage());
        ErrorResponse error = ErrorResponse.of(
                HttpStatus.UNPROCESSABLE_ENTITY.value(),
                "Lỗi biên dịch LaTeX (" + ex.getEngine() + ")",
                ex.getMessage(),
                ex.getEngine(),
                ex.getDetails(),
                ex.getRawLog()
        );
        return ResponseEntity.status(HttpStatus.UNPROCESSABLE_ENTITY).body(error);
    }

    @ExceptionHandler(CompilerNotFoundException.class)
    public ResponseEntity<ErrorResponse> handleCompilerNotFound(CompilerNotFoundException ex) {
        log.error("Không tìm thấy compiler: {}", ex.getMessage());
        ErrorResponse error = ErrorResponse.of(
                HttpStatus.SERVICE_UNAVAILABLE.value(),
                "TeX Engine Chưa Khả Dụng",
                ex.getMessage(),
                ex.getEngineRequested(),
                "Vui lòng kiểm tra cài đặt XeLaTeX hoặc Tectonic trong môi trường hệ thống.",
                ""
        );
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(error);
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> handleValidationException(MethodArgumentNotValidException ex) {
        String details = ex.getBindingResult().getFieldErrors().stream()
                .map(FieldError::getDefaultMessage)
                .collect(Collectors.joining("; "));
        ErrorResponse error = ErrorResponse.of(
                HttpStatus.BAD_REQUEST.value(),
                "Dữ liệu đầu vào không hợp lệ",
                details,
                "Validation",
                details,
                ""
        );
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(error);
    }

    @ExceptionHandler(PreconditionFailedException.class)
    public ResponseEntity<ErrorResponse> handlePreconditionFailed(PreconditionFailedException ex) {
        log.warn("Xung đột phiên bản (Precondition Failed): {}", ex.getMessage());
        ErrorResponse error = ErrorResponse.of(
                HttpStatus.PRECONDITION_FAILED.value(),
                "PRECONDITION_FAILED",
                ex.getMessage(),
                "ManuscriptService",
                ex.getMessage(),
                ""
        );
        return ResponseEntity.status(HttpStatus.PRECONDITION_FAILED).body(error);
    }

    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<ErrorResponse> handleResourceNotFound(ResourceNotFoundException ex) {
        log.warn("Không tìm thấy tài nguyên: {}", ex.getMessage());
        ErrorResponse error = ErrorResponse.of(
                HttpStatus.NOT_FOUND.value(),
                "NOT_FOUND",
                ex.getMessage(),
                "Repository",
                ex.getMessage(),
                ""
        );
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(error);
    }

    @ExceptionHandler(Sha256MismatchException.class)
    public ResponseEntity<ErrorResponse> handleSha256Mismatch(Sha256MismatchException ex) {
        log.warn("Sai lệch mã băm SHA-256: {}", ex.getMessage());
        ErrorResponse error = ErrorResponse.of(
                HttpStatus.BAD_REQUEST.value(),
                "DIGEST_MISMATCH",
                ex.getMessage(),
                "AssetService",
                ex.getMessage(),
                ""
        );
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(error);
    }

    @ExceptionHandler(InvalidActionException.class)
    public ResponseEntity<ErrorResponse> handleInvalidAction(InvalidActionException ex) {
        log.warn("Hành động AI không hợp lệ: {}", ex.getMessage());
        ErrorResponse error = ErrorResponse.of(
                HttpStatus.BAD_REQUEST.value(),
                "INVALID_ACTION",
                ex.getMessage(),
                "AiProxy",
                ex.getMessage(),
                ""
        );
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(error);
    }

    @ExceptionHandler(PayloadTooLargeException.class)
    public ResponseEntity<ErrorResponse> handlePayloadTooLarge(PayloadTooLargeException ex) {
        log.warn("Payload AI vượt quá kích thước cho phép: {}", ex.getMessage());
        ErrorResponse error = ErrorResponse.of(
                HttpStatus.PAYLOAD_TOO_LARGE.value(),
                "PAYLOAD_TOO_LARGE",
                ex.getMessage(),
                "AiProxy",
                ex.getMessage(),
                ""
        );
        return ResponseEntity.status(HttpStatus.PAYLOAD_TOO_LARGE).body(error);
    }

    @ExceptionHandler(InvalidPdfException.class)
    public ResponseEntity<ErrorResponse> handleInvalidPdf(InvalidPdfException ex) {
        log.warn("Tệp PDF không hợp lệ: {}", ex.getMessage());
        ErrorResponse error = ErrorResponse.of(
                HttpStatus.BAD_REQUEST.value(),
                "INVALID_PDF",
                ex.getMessage(),
                "PrepressService",
                ex.getMessage(),
                ""
        );
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(error);
    }

    @ExceptionHandler(GhostscriptNotFoundException.class)
    public ResponseEntity<ErrorResponse> handleGhostscriptNotFound(GhostscriptNotFoundException ex) {
        log.error("Không tìm thấy Ghostscript: {}", ex.getMessage());
        ErrorResponse error = ErrorResponse.of(
                HttpStatus.SERVICE_UNAVAILABLE.value(),
                "GHOSTSCRIPT_NOT_FOUND",
                ex.getMessage(),
                "PrepressService",
                "Ghostscript binary chưa được cài đặt trong môi trường hệ thống.",
                ""
        );
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(error);
    }

    @ExceptionHandler(InvalidArchiveException.class)
    public ResponseEntity<ErrorResponse> handleInvalidArchive(InvalidArchiveException ex) {
        log.warn("Tệp ZIP lưu trữ không hợp lệ: {}", ex.getMessage());
        ErrorResponse error = ErrorResponse.of(
                HttpStatus.BAD_REQUEST.value(),
                "INVALID_ARCHIVE",
                ex.getMessage(),
                "BatchService",
                ex.getMessage(),
                ""
        );
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(error);
    }

    /** Keep the status chosen by services that throw ResponseStatusException (e.g. 400 validation). */
    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<ErrorResponse> handleResponseStatus(ResponseStatusException ex) {
        HttpStatus status = HttpStatus.resolve(ex.getStatusCode().value());
        if (status == null) status = HttpStatus.INTERNAL_SERVER_ERROR;
        log.warn("Yêu cầu bị từ chối ({}): {}", status.value(), ex.getReason());
        ErrorResponse error = ErrorResponse.of(
                status.value(),
                status.name(),
                ex.getReason(),
                "Request",
                ex.getReason(),
                ""
        );
        return ResponseEntity.status(status).body(error);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleGenericException(Exception ex) {
        log.error("Lỗi hệ thống không mong muốn: ", ex);
        ErrorResponse error = ErrorResponse.of(
                HttpStatus.INTERNAL_SERVER_ERROR.value(),
                "Lỗi máy chủ nội bộ",
                ex.getMessage(),
                "System",
                ex.getClass().getSimpleName(),
                ""
        );
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error);
    }
}
