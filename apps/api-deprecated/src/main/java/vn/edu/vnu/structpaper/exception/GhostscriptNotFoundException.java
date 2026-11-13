package vn.edu.vnu.structpaper.exception;

public class GhostscriptNotFoundException extends RuntimeException {
    public GhostscriptNotFoundException(String message) {
        super(message);
    }

    public GhostscriptNotFoundException(String message, Throwable cause) {
        super(message, cause);
    }
}
