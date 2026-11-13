package vn.edu.vnu.structpaper.batch;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.time.Instant;
import java.util.List;

@JsonInclude(JsonInclude.Include.NON_NULL)
public class BatchReportResponse {
    private String batchId;
    private String status;
    private int totalFiles;
    private int successfulFiles;
    private int failedFiles;
    private int progressPercent;
    private long totalDurationMs;
    private Instant createdAt;
    private Instant completedAt;
    private BatchSummary summary;
    private List<BatchItemStatus> items;

    public BatchReportResponse() {}

    public BatchReportResponse(String batchId, String status, int totalFiles, int successfulFiles,
                               int failedFiles, int progressPercent, long totalDurationMs,
                               Instant createdAt, Instant completedAt, BatchSummary summary,
                               List<BatchItemStatus> items) {
        this.batchId = batchId;
        this.status = status;
        this.totalFiles = totalFiles;
        this.successfulFiles = successfulFiles;
        this.failedFiles = failedFiles;
        this.progressPercent = progressPercent;
        this.totalDurationMs = totalDurationMs;
        this.createdAt = createdAt;
        this.completedAt = completedAt;
        this.summary = summary;
        this.items = items;
    }

    public static BatchReportResponse fromJob(BatchJob job) {
        long totalDuration = 0;
        int completedCount = 0;
        for (BatchItemStatus item : job.getItems()) {
            if (item.getDurationMs() != null) {
                totalDuration += item.getDurationMs();
                completedCount++;
            }
        }

        double successRate = job.getTotalFiles() > 0
                ? Math.round(((double) job.getSuccessfulFiles() / job.getTotalFiles()) * 1000.0) / 10.0
                : 0.0;
        double avgDuration = completedCount > 0
                ? Math.round(((double) totalDuration / completedCount) * 10.0) / 10.0
                : 0.0;

        BatchSummary summary = new BatchSummary(successRate, avgDuration);

        return new BatchReportResponse(
                job.getBatchId(),
                job.getStatus().name(),
                job.getTotalFiles(),
                job.getSuccessfulFiles(),
                job.getFailedFiles(),
                job.getProgressPercent(),
                totalDuration,
                job.getCreatedAt(),
                job.getCompletedAt(),
                summary,
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

    public long getTotalDurationMs() {
        return totalDurationMs;
    }

    public void setTotalDurationMs(long totalDurationMs) {
        this.totalDurationMs = totalDurationMs;
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

    public BatchSummary getSummary() {
        return summary;
    }

    public void setSummary(BatchSummary summary) {
        this.summary = summary;
    }

    public List<BatchItemStatus> getItems() {
        return items;
    }

    public void setItems(List<BatchItemStatus> items) {
        this.items = items;
    }
}
