package vn.edu.vnu.structpaper.compile;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.Collections;
import java.util.List;
import java.util.Map;

@JsonInclude(JsonInclude.Include.NON_NULL)
public class CompileJobStatusResponse {

    private String jobId;
    private CompileJobStatus status;
    private String hash;
    private boolean fromCache;
    private String downloadUrl;
    private Long durationMs;
    private List<String> logs;
    private String error;
    private Map<String, Object> report;

    public CompileJobStatusResponse() {}

    public String getJobId() {
        return jobId;
    }

    public void setJobId(String jobId) {
        this.jobId = jobId;
    }

    public CompileJobStatus getStatus() {
        return status;
    }

    public void setStatus(CompileJobStatus status) {
        this.status = status;
    }

    public String getHash() {
        return hash;
    }

    public void setHash(String hash) {
        this.hash = hash;
    }

    public boolean isFromCache() {
        return fromCache;
    }

    public void setFromCache(boolean fromCache) {
        this.fromCache = fromCache;
    }

    @JsonProperty("cached")
    public boolean isCached() {
        return fromCache;
    }

    public String getDownloadUrl() {
        return downloadUrl;
    }

    public void setDownloadUrl(String downloadUrl) {
        this.downloadUrl = downloadUrl;
    }

    @JsonProperty("pdfUrl")
    public String getPdfUrl() {
        return downloadUrl;
    }

    @JsonProperty("logUrl")
    public String getLogUrl() {
        if (jobId == null) return null;
        return "/api/v1/compile/" + jobId + "/logs";
    }

    public Long getDurationMs() {
        return durationMs;
    }

    public void setDurationMs(Long durationMs) {
        this.durationMs = durationMs;
    }

    public List<String> getLogs() {
        return logs;
    }

    public void setLogs(List<String> logs) {
        this.logs = logs;
    }

    public String getError() {
        return error;
    }

    public void setError(String error) {
        this.error = error;
    }

    public Map<String, Object> getReport() {
        if (report != null) {
            return report;
        }
        if (status == CompileJobStatus.FAILED && error != null) {
            return Map.of(
                    "pages", 0,
                    "warnings", Collections.emptyList(),
                    "errors", List.of(error)
            );
        }
        if (status == CompileJobStatus.SUCCESS) {
            return Map.of(
                    "pages", 1,
                    "warnings", Collections.emptyList(),
                    "errors", Collections.emptyList()
            );
        }
        return Collections.emptyMap();
    }

    public void setReport(Map<String, Object> report) {
        this.report = report;
    }
}
