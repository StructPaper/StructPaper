package vn.edu.vnu.structpaper.ai;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.Map;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record AiExtractResponse(
        String action,
        boolean success,
        Map<String, Object> data
) {
    public static AiExtractResponse of(String action, Map<String, Object> data) {
        return new AiExtractResponse(action, true, data);
    }
}
