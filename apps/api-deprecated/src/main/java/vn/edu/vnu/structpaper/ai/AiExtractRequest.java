package vn.edu.vnu.structpaper.ai;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.util.Map;

public record AiExtractRequest(
        @NotBlank(message = "Action không được để trống")
        String action,

        @NotNull(message = "Payload không được để trống")
        Map<String, Object> payload,

        Map<String, Object> options
) {}
