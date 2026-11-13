package vn.edu.vnu.structpaper.exception;

public class LatexCompilationException extends RuntimeException {

    private final String engine;
    private final String details;
    private final String rawLog;
    private final int exitCode;

    public LatexCompilationException(String message, String engine, String details, String rawLog, int exitCode) {
        super(message);
        this.engine = engine;
        this.details = details;
        this.rawLog = rawLog;
        this.exitCode = exitCode;
    }

    public String getEngine() {
        return engine;
    }

    public String getDetails() {
        return details;
    }

    public String getRawLog() {
        return rawLog;
    }

    public int getExitCode() {
        return exitCode;
    }
}
