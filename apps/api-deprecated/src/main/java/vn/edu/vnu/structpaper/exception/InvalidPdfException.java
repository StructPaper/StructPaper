package vn.edu.vnu.structpaper.exception;

public class InvalidPdfException extends RuntimeException {
    public InvalidPdfException(String message) {
        super(message);
    }

    public InvalidPdfException(String message, Throwable cause) {
        super(message, cause);
    }
}
