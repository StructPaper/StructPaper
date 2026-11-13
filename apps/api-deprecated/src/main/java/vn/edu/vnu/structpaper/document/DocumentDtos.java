package vn.edu.vnu.structpaper.document;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.databind.JsonNode;

import java.time.Instant;

/** Request / response records for /api/v1/documents. */
public final class DocumentDtos {

    private DocumentDtos() {
    }

    /** POST /documents — create a new named document (optionally with initial content). */
    public record CreateRequest(String name, String journalId, JsonNode doc) {
    }

    /**
     * PUT /documents/{id} — autosave / save. {@code baseRev} enables optimistic locking
     * (409/412 when another session saved first); {@code snapshot=true} also writes a
     * versioned snapshot file to object storage (explicit "Save").
     */
    public record SaveRequest(String name, String status, JsonNode doc, Integer baseRev, Boolean snapshot) {
    }

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record DocumentDto(String id, String name, String journalId, String status, int rev,
                              Instant createdAt, Instant updatedAt, JsonNode doc) {
    }

    public record SaveResponse(String id, String name, int rev, Instant updatedAt, boolean snapshotted) {
    }

    public record ExportItem(String id, String format, String fileName, long sizeBytes, Instant createdAt) {
    }
}
