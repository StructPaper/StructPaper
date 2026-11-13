package vn.edu.vnu.structpaper.document;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;

@Entity
@Table(name = "document_exports")
public class DocumentExportEntity {

    @Id
    @Column(name = "id", length = 64, nullable = false)
    private String id;

    @Column(name = "document_id", length = 64, nullable = false)
    private String documentId;

    @Column(name = "format", length = 16, nullable = false)
    private String format;

    @Column(name = "file_name", length = 300, nullable = false)
    private String fileName;

    @Column(name = "object_key", length = 400, nullable = false)
    private String objectKey;

    @Column(name = "size_bytes", nullable = false)
    private long sizeBytes;

    @Column(name = "created_at")
    private Instant createdAt;

    public DocumentExportEntity() {
    }

    public DocumentExportEntity(String id, String documentId, String format, String fileName,
                                String objectKey, long sizeBytes, Instant createdAt) {
        this.id = id;
        this.documentId = documentId;
        this.format = format;
        this.fileName = fileName;
        this.objectKey = objectKey;
        this.sizeBytes = sizeBytes;
        this.createdAt = createdAt;
    }

    public String getId() { return id; }
    public String getDocumentId() { return documentId; }
    public String getFormat() { return format; }
    public String getFileName() { return fileName; }
    public String getObjectKey() { return objectKey; }
    public long getSizeBytes() { return sizeBytes; }
    public Instant getCreatedAt() { return createdAt; }
}
