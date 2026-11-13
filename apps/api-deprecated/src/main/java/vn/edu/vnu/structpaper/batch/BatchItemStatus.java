package vn.edu.vnu.structpaper.batch;

import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_NULL)
public class BatchItemStatus {
    private String fileName;
    private String status;
    private String manuscriptId;
    private String title;
    private Long durationMs;
    private String error;

    public BatchItemStatus() {}

    public BatchItemStatus(String fileName, String status, String manuscriptId, String title, Long durationMs, String error) {
        this.fileName = fileName;
        this.status = status;
        this.manuscriptId = manuscriptId;
        this.title = title;
        this.durationMs = durationMs;
        this.error = error;
    }

    public static BatchItemStatus pending(String fileName) {
        return new BatchItemStatus(fileName, BatchItemState.PENDING.name(), null, null, null, null);
    }

    public static BatchItemStatus processing(String fileName) {
        return new BatchItemStatus(fileName, BatchItemState.PROCESSING.name(), null, null, null, null);
    }

    public static BatchItemStatus success(String fileName, String manuscriptId, String title, long durationMs) {
        return new BatchItemStatus(fileName, BatchItemState.SUCCESS.name(), manuscriptId, title, durationMs, null);
    }

    public static BatchItemStatus failed(String fileName, String error, long durationMs) {
        return new BatchItemStatus(fileName, BatchItemState.FAILED.name(), null, null, durationMs, error);
    }

    public String getFileName() {
        return fileName;
    }

    public void setFileName(String fileName) {
        this.fileName = fileName;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getManuscriptId() {
        return manuscriptId;
    }

    public void setManuscriptId(String manuscriptId) {
        this.manuscriptId = manuscriptId;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public Long getDurationMs() {
        return durationMs;
    }

    public void setDurationMs(Long durationMs) {
        this.durationMs = durationMs;
    }

    public String getError() {
        return error;
    }

    public void setError(String error) {
        this.error = error;
    }
}
