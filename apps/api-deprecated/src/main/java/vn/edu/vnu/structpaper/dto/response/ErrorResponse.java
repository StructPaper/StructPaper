package vn.edu.vnu.structpaper.dto.response;

import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record ErrorResponse(
        String code,
        String message,
        Integer status,
        String error,
        String engine,
        Object details,
        String rawLog,
        Long timestamp
) {
    public static ErrorResponse of(int status, String error, String message, String engine, String details, String rawLog) {
        return new ErrorResponse(
                error != null ? error : String.valueOf(status),
                message,
                status,
                error,
                engine,
                details,
                rawLog,
                System.currentTimeMillis()
        );
    }

    public static ErrorResponse of(String code, String message) {
        return new ErrorResponse(code, message, null, null, null, null, null, System.currentTimeMillis());
    }

    public static ErrorResponse of(String code, String message, Object details) {
        return new ErrorResponse(code, message, null, null, null, details, null, System.currentTimeMillis());
    }
}
