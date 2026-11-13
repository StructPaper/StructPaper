package vn.edu.vnu.structpaper.batch;

import java.time.Instant;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

public class BatchJob {
    private final String batchId;
    private final String journalId;
    private final String options;
    private final Instant createdAt;

    private volatile BatchStatus status;
    private volatile int totalFiles;
    private volatile int processedFiles;
    private volatile int successfulFiles;
    private volatile int failedFiles;
    private volatile int progressPercent;
    private volatile Instant completedAt;
    private volatile String error;

    private final List<BatchItemStatus> items = new CopyOnWriteArrayList<>();

    public BatchJob(String batchId, String journalId, String options, int totalFiles) {
        this.batchId = batchId;
        this.journalId = journalId;
        this.options = options;
        this.totalFiles = totalFiles;
        this.status = BatchStatus.PENDING;
        this.createdAt = Instant.now();
        this.progressPercent = 0;
    }

    public synchronized void updateProgress() {
        this.processedFiles = this.successfulFiles + this.failedFiles;
        if (this.totalFiles > 0) {
            this.progressPercent = Math.min(100, (int) Math.round(((double) this.processedFiles / this.totalFiles) * 100));
        } else {
            this.progressPercent = 100;
        }

        if (this.processedFiles >= this.totalFiles && this.totalFiles > 0) {
            if (this.failedFiles == this.totalFiles) {
                this.status = BatchStatus.FAILED;
            } else {
                this.status = BatchStatus.COMPLETED;
            }
            if (this.completedAt == null) {
                this.completedAt = Instant.now();
            }
        }
    }

    public String getBatchId() {
        return batchId;
    }

    public String getJournalId() {
        return journalId;
    }

    public String getOptions() {
        return options;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public BatchStatus getStatus() {
        return status;
    }

    public void setStatus(BatchStatus status) {
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

    public Instant getCompletedAt() {
        return completedAt;
    }

    public void setCompletedAt(Instant completedAt) {
        this.completedAt = completedAt;
    }

    public String getError() {
        return error;
    }

    public void setError(String error) {
        this.error = error;
    }

    public List<BatchItemStatus> getItems() {
        return items;
    }
}
