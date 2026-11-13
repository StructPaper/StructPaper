package vn.edu.vnu.structpaper.dto.response;

public record CompileJsonResponse(
        boolean success,
        String pdfBase64,
        String engineUsed,
        long durationMs,
        long pdfSizeBytes,
        String stdoutLog,
        String stderrLog
) {
}
