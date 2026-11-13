package vn.edu.vnu.structpaper.compile;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Future;
import java.util.concurrent.atomic.AtomicBoolean;

public class CompileJob {

    private final String jobId;
    private final String paperId;
    private final String hash;
    private volatile CompileJobStatus status;
    private volatile boolean fromCache;
    private volatile byte[] pdfBytes;
    private volatile List<String> logs = new ArrayList<>();
    private volatile String error;
    private volatile long durationMs;
    private volatile String engineUsed;
    private final Instant createdAt;
    private volatile Instant startedAt;
    private volatile Instant completedAt;

    private final AtomicBoolean cancelled = new AtomicBoolean(false);
    private volatile Process runningProcess;
    private volatile Future<?> future;
    private volatile CompileJobRequest request;

    public CompileJob(String jobId, String paperId, String hash) {
        this.jobId = jobId;
        this.paperId = paperId;
        this.hash = hash;
        this.status = CompileJobStatus.QUEUED;
        this.createdAt = Instant.now();
    }

    public String getJobId() {
        return jobId;
    }

    public String getPaperId() {
        return paperId;
    }

    public String getHash() {
        return hash;
    }

    public CompileJobStatus getStatus() {
        return status;
    }

    public void setStatus(CompileJobStatus status) {
        this.status = status;
    }

    public boolean isFromCache() {
        return fromCache;
    }

    public void setFromCache(boolean fromCache) {
        this.fromCache = fromCache;
    }

    public byte[] getPdfBytes() {
        return pdfBytes;
    }

    public void setPdfBytes(byte[] pdfBytes) {
        this.pdfBytes = pdfBytes;
    }

    public List<String> getLogs() {
        return logs;
    }

    public void setLogs(List<String> logs) {
        this.logs = logs != null ? logs : new ArrayList<>();
    }

    public String getError() {
        return error;
    }

    public void setError(String error) {
        this.error = error;
    }

    public long getDurationMs() {
        return durationMs;
    }

    public void setDurationMs(long durationMs) {
        this.durationMs = durationMs;
    }

    public String getEngineUsed() {
        return engineUsed;
    }

    public void setEngineUsed(String engineUsed) {
        this.engineUsed = engineUsed;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getStartedAt() {
        return startedAt;
    }

    public void setStartedAt(Instant startedAt) {
        this.startedAt = startedAt;
    }

    public Instant getCompletedAt() {
        return completedAt;
    }

    public void setCompletedAt(Instant completedAt) {
        this.completedAt = completedAt;
    }

    public boolean isCancelled() {
        return cancelled.get();
    }

    public void setCancelled(boolean value) {
        this.cancelled.set(value);
    }

    public Process getRunningProcess() {
        return runningProcess;
    }

    public void setRunningProcess(Process runningProcess) {
        this.runningProcess = runningProcess;
    }

    public Future<?> getFuture() {
        return future;
    }

    public void setFuture(Future<?> future) {
        this.future = future;
    }

    public CompileJobRequest getRequest() {
        return request;
    }

    public void setRequest(CompileJobRequest request) {
        this.request = request;
    }
}
