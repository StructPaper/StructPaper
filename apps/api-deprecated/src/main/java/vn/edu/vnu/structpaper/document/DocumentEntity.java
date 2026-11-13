package vn.edu.vnu.structpaper.document;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Lob;
import jakarta.persistence.Table;

import java.time.Instant;

@Entity
@Table(name = "documents")
public class DocumentEntity {

    @Id
    @Column(name = "id", length = 64, nullable = false)
    private String id;

    @Column(name = "name", length = 200, nullable = false)
    private String name;

    @Column(name = "journal_id", length = 64)
    private String journalId;

    @Column(name = "status", length = 32, nullable = false)
    private String status = "draft";

    @Column(name = "rev", nullable = false)
    private int rev = 1;

    @Lob
    @Column(name = "doc_json", columnDefinition = "LONGTEXT")
    private String docJson;

    @Column(name = "snapshot_key", length = 300)
    private String snapshotKey;

    @Column(name = "deleted", nullable = false)
    private boolean deleted = false;

    @Column(name = "created_at")
    private Instant createdAt;

    @Column(name = "updated_at")
    private Instant updatedAt;

    public DocumentEntity() {
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getJournalId() { return journalId; }
    public void setJournalId(String journalId) { this.journalId = journalId; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public int getRev() { return rev; }
    public void setRev(int rev) { this.rev = rev; }
    public String getDocJson() { return docJson; }
    public void setDocJson(String docJson) { this.docJson = docJson; }
    public String getSnapshotKey() { return snapshotKey; }
    public void setSnapshotKey(String snapshotKey) { this.snapshotKey = snapshotKey; }
    public boolean isDeleted() { return deleted; }
    public void setDeleted(boolean deleted) { this.deleted = deleted; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
