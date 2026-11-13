package vn.edu.vnu.structpaper.manuscript;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.time.Instant;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record RevisionHistoryItem(
        int rev,
        Instant timestamp,
        Instant createdAt,
        String summary,
        String message,
        String author
) {
    public static RevisionHistoryItem fromEntity(RevisionEntity entity) {
        String sum = entity.getSummary() != null ? entity.getSummary() : ("Revision " + entity.getRev());
        return new RevisionHistoryItem(
                entity.getRev(),
                entity.getCreatedAt(),
                entity.getCreatedAt(),
                sum,
                sum,
                "System"
        );
    }
}
