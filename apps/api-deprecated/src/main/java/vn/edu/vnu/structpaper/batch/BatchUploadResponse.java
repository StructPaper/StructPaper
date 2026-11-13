package vn.edu.vnu.structpaper.batch;

import java.time.Instant;

public class BatchUploadResponse {
    private String batchId;
    private int totalFiles;
    private int fileCount;
    private String status;
    private Instant createdAt;

    public BatchUploadResponse() {}

    public BatchUploadResponse(String batchId, int totalFiles, String status, Instant createdAt) {
        this.batchId = batchId;
        this.totalFiles = totalFiles;
        this.fileCount = totalFiles;
        this.status = status;
        this.createdAt = createdAt;
    }

    public String getBatchId() {
        return batchId;
    }

    public void setBatchId(String batchId) {
        this.batchId = batchId;
    }

    public int getTotalFiles() {
        return totalFiles;
    }

    public void setTotalFiles(int totalFiles) {
        this.totalFiles = totalFiles;
        this.fileCount = totalFiles;
    }

    public int getFileCount() {
        return fileCount;
    }

    public void setFileCount(int fileCount) {
        this.fileCount = fileCount;
        this.totalFiles = fileCount;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }
}
