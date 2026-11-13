package vn.edu.vnu.structpaper.manuscript;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Lob;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "revisions")
public class RevisionEntity {

    @Id
    @Column(name = "id", length = 64, nullable = false)
    private String id;

    @Column(name = "manuscript_id", length = 64, nullable = false)
    private String manuscriptId;

    @Column(name = "rev", nullable = false)
    private int rev;

    @Column(name = "summary", length = 500)
    private String summary;

    @Lob
    @Column(name = "doc_json", columnDefinition = "LONGTEXT")
    private String docJson;

    @Column(name = "created_at")
    private Instant createdAt;

    public RevisionEntity() {
    }

    public RevisionEntity(String id, String manuscriptId, int rev, String summary, String docJson, Instant createdAt) {
        this.id = id;
        this.manuscriptId = manuscriptId;
        this.rev = rev;
        this.summary = summary;
        this.docJson = docJson;
        this.createdAt = createdAt;
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getManuscriptId() {
        return manuscriptId;
    }

    public void setManuscriptId(String manuscriptId) {
        this.manuscriptId = manuscriptId;
    }

    public int getRev() {
        return rev;
    }

    public void setRev(int rev) {
        this.rev = rev;
    }

    public String getSummary() {
        return summary;
    }

    public void setSummary(String summary) {
        this.summary = summary;
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
}
