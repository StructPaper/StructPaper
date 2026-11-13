package vn.edu.vnu.structpaper.model;

public record CompilationResult(
        boolean success,
        byte[] pdfBytes,
        String engineUsed,
        long durationMs,
        String stdoutLog,
        String stderrLog,
        int exitCode
) {
    public static CompilationResult success(byte[] pdfBytes, String engineUsed, long durationMs, String stdoutLog) {
        return new CompilationResult(true, pdfBytes, engineUsed, durationMs, stdoutLog, "", 0);
    }

    public static CompilationResult failure(String engineUsed, long durationMs, String stdoutLog, String stderrLog, int exitCode) {
        return new CompilationResult(false, new byte[0], engineUsed, durationMs, stdoutLog, stderrLog, exitCode);
    }
}
