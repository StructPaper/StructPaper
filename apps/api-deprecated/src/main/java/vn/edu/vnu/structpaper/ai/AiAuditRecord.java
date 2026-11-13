package vn.edu.vnu.structpaper.ai;

import java.time.Instant;

public record AiAuditRecord(
        String action,
        String clientIp,
        int estimatedTokens,
        long durationMs,
        boolean mockMode,
        Instant timestamp
) {}
