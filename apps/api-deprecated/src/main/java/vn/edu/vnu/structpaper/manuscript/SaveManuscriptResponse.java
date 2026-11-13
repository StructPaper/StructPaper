package vn.edu.vnu.structpaper.manuscript;

import java.time.Instant;

public record SaveManuscriptResponse(
        String id,
        int rev,
        Instant updatedAt
) {
}
