package vn.edu.vnu.structpaper.compile;

import java.util.List;

public class CompileSandboxResult {
    private final boolean success;
    private final boolean cancelled;
    private final byte[] pdfBytes;
    private final List<String> logs;
    private final String error;
    private final int exitCode;
    private final long durationMs;
    private final String engineUsed;

    private CompileSandboxResult(boolean success, boolean cancelled, byte[] pdfBytes,
                                 List<String> logs, String error, int exitCode,
                                 long durationMs, String engineUsed) {
        this.success = success;
        this.cancelled = cancelled;
        this.pdfBytes = pdfBytes;
        this.logs = logs != null ? logs : List.of();
        this.error = error;
        this.exitCode = exitCode;
        this.durationMs = durationMs;
        this.engineUsed = engineUsed;
    }

    public static CompileSandboxResult success(byte[] pdfBytes, List<String> logs, long durationMs, String engineUsed) {
        return new CompileSandboxResult(true, false, pdfBytes, logs, null, 0, durationMs, engineUsed);
    }

    public static CompileSandboxResult failure(List<String> logs, String error, int exitCode, long durationMs) {
        return new CompileSandboxResult(false, false, null, logs, error, exitCode, durationMs, "None");
    }

    public static CompileSandboxResult cancelled(String reason, long durationMs) {
        return new CompileSandboxResult(false, true, null, List.of(reason), "Job was cancelled", -1, durationMs, "None");
    }

    public boolean isSuccess() {
        return success;
    }

    public boolean isCancelled() {
        return cancelled;
    }

    public byte[] getPdfBytes() {
        return pdfBytes;
    }

    public List<String> getLogs() {
        return logs;
    }

    public String getError() {
        return error;
    }

    public int getExitCode() {
        return exitCode;
    }

    public long getDurationMs() {
        return durationMs;
    }

    public String getEngineUsed() {
        return engineUsed;
    }
}
