package vn.edu.vnu.structpaper.manuscript;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Lob;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "manuscripts")
public class ManuscriptEntity {

    @Id
    @Column(name = "id", length = 64, nullable = false)
    private String id;

    @Column(name = "title", length = 500)
    private String title;

    @Column(name = "journal_id", length = 64)
    private String journalId;

    @Column(name = "rev", nullable = false)
    private int rev = 1;

    @Lob
    @Column(name = "doc_json", columnDefinition = "LONGTEXT")
    private String docJson;

    @Column(name = "created_at")
    private Instant createdAt;

    @Column(name = "updated_at")
    private Instant updatedAt;

    public ManuscriptEntity() {
    }

    public ManuscriptEntity(String id, String title, String journalId, int rev, String docJson, Instant createdAt, Instant updatedAt) {
        this.id = id;
        this.title = title;
        this.journalId = journalId;
        this.rev = rev;
        this.docJson = docJson;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getJournalId() {
        return journalId;
    }

    public void setJournalId(String journalId) {
        this.journalId = journalId;
    }

    public int getRev() {
        return rev;
    }

    public void setRev(int rev) {
        this.rev = rev;
    }

    public String getDocJson() {
        return docJson;
    }

    public void setDocJson(String docJson) {
        this.docJson = docJson;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }
}
