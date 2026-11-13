package vn.edu.vnu.structpaper.batch;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.time.Instant;
import java.util.List;

@JsonInclude(JsonInclude.Include.NON_NULL)
public class BatchStatusResponse {
    private String batchId;
    private String status;
    private int totalFiles;
    private int processedFiles;
    private int successfulFiles;
    private int failedFiles;
    private int progressPercent;
    private Instant createdAt;
    private Instant completedAt;
    private List<BatchItemStatus> items;

    public BatchStatusResponse() {}

    public BatchStatusResponse(String batchId, String status, int totalFiles, int processedFiles,
                               int successfulFiles, int failedFiles, int progressPercent,
                               Instant createdAt, Instant completedAt, List<BatchItemStatus> items) {
        this.batchId = batchId;
        this.status = status;
        this.totalFiles = totalFiles;
        this.processedFiles = processedFiles;
        this.successfulFiles = successfulFiles;
        this.failedFiles = failedFiles;
        this.progressPercent = progressPercent;
        this.createdAt = createdAt;
        this.completedAt = completedAt;
        this.items = items;
    }

    public static BatchStatusResponse fromJob(BatchJob job) {
        return new BatchStatusResponse(
                job.getBatchId(),
                job.getStatus().name(),
                job.getTotalFiles(),
                job.getProcessedFiles(),
                job.getSuccessfulFiles(),
                job.getFailedFiles(),
                job.getProgressPercent(),
                job.getCreatedAt(),
                job.getCompletedAt(),
                job.getItems()
        );
    }

    public String getBatchId() {
        return batchId;
    }

    public void setBatchId(String batchId) {
        this.batchId = batchId;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public int getTotalFiles() {
        return totalFiles;
    }

    public void setTotalFiles(int totalFiles) {
        this.totalFiles = totalFiles;
    }

    public int getProcessedFiles() {
        return processedFiles;
    }

    public void setProcessedFiles(int processedFiles) {
        this.processedFiles = processedFiles;
    }

    public int getSuccessfulFiles() {
        return successfulFiles;
    }

    public void setSuccessfulFiles(int successfulFiles) {
        this.successfulFiles = successfulFiles;
    }

    public int getFailedFiles() {
        return failedFiles;
    }

    public void setFailedFiles(int failedFiles) {
        this.failedFiles = failedFiles;
    }

    public int getProgressPercent() {
        return progressPercent;
    }

    public void setProgressPercent(int progressPercent) {
        this.progressPercent = progressPercent;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public Instant getCompletedAt() {
        return completedAt;
    }

    public void setCompletedAt(Instant completedAt) {
        this.completedAt = completedAt;
    }

    public List<BatchItemStatus> getItems() {
        return items;
    }

    public void setItems(List<BatchItemStatus> items) {
        this.items = items;
    }
}
