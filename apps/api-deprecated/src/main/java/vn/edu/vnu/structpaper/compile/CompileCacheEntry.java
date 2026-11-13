package vn.edu.vnu.structpaper.compile;

import java.time.Instant;
import java.util.List;

public record CompileCacheEntry(
        String hash,
        byte[] pdfBytes,
        List<String> logs,
        long durationMs,
        String engine,
        Instant cachedAt
) {}
