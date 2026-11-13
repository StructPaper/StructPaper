package vn.edu.vnu.structpaper.batch;

public class BatchSummary {
    private double successRate;
    private double averageDurationMs;

    public BatchSummary() {}

    public BatchSummary(double successRate, double averageDurationMs) {
        this.successRate = successRate;
        this.averageDurationMs = averageDurationMs;
    }

    public double getSuccessRate() {
        return successRate;
    }

    public void setSuccessRate(double successRate) {
        this.successRate = successRate;
    }

    public double getAverageDurationMs() {
        return averageDurationMs;
    }

    public void setAverageDurationMs(double averageDurationMs) {
        this.averageDurationMs = averageDurationMs;
    }
}
