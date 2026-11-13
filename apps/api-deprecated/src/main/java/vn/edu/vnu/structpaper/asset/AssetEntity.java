package vn.edu.vnu.structpaper.asset;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "assets")
public class AssetEntity {

    @Id
    @Column(name = "sha256", length = 64, nullable = false)
    private String sha256;

    @Column(name = "mime_type", length = 100)
    private String mimeType;

    @Column(name = "size_bytes", nullable = false)
    private long sizeBytes;

    @Column(name = "file_path", length = 500)
    private String filePath;

    @Column(name = "created_at")
    private Instant createdAt;

    public AssetEntity() {
    }

    public AssetEntity(String sha256, String mimeType, long sizeBytes, String filePath, Instant createdAt) {
        this.sha256 = sha256;
        this.mimeType = mimeType;
        this.sizeBytes = sizeBytes;
        this.filePath = filePath;
        this.createdAt = createdAt;
    }

    public String getSha256() {
        return sha256;
    }

    public void setSha256(String sha256) {
        this.sha256 = sha256;
    }

    public String getMimeType() {
        return mimeType;
    }

    public void setMimeType(String mimeType) {
        this.mimeType = mimeType;
    }

    public long getSizeBytes() {
        return sizeBytes;
    }

    public void setSizeBytes(long sizeBytes) {
        this.sizeBytes = sizeBytes;
    }

    public String getFilePath() {
        return filePath;
    }

    public void setFilePath(String filePath) {
        this.filePath = filePath;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }
}
