package vn.edu.vnu.structpaper.exception;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ResponseStatus;

@ResponseStatus(HttpStatus.BAD_REQUEST)
public class Sha256MismatchException extends RuntimeException {
    public Sha256MismatchException(String message) {
        super(message);
    }
}
