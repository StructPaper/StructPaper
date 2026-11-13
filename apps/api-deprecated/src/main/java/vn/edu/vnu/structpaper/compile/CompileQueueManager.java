package vn.edu.vnu.structpaper.compile;

import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import vn.edu.vnu.structpaper.exception.ResourceNotFoundException;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.*;

@Service
public class CompileQueueManager {

    private static final Logger log = LoggerFactory.getLogger(CompileQueueManager.class);

    private final CompileSandboxService sandboxService;
    private final CompileCacheService cacheService;
    private final ExecutorService executorService;

    private final ConcurrentMap<String, CompileJob> jobs = new ConcurrentHashMap<>();
    private final ConcurrentMap<String, String> activePaperJobs = new ConcurrentHashMap<>();

    public CompileQueueManager(CompileSandboxService sandboxService, CompileCacheService cacheService) {
        this.sandboxService = sandboxService;
        this.cacheService = cacheService;
        this.executorService = Executors.newFixedThreadPool(
                Math.max(2, Runtime.getRuntime().availableProcessors()),
                r -> {
                    Thread t = new Thread(r, "compile-worker");
                    t.setDaemon(true);
                    return t;
                }
        );
    }

    public CompileJob submit(CompileJobRequest request) {
        String hash = cacheService.calculateHash(request);
        String paperId = request.getEffectivePaperId();

        // 1. Kiểm tra cache kết quả trước
        Optional<CompileCacheEntry> cached = cacheService.get(hash);
        if (cached.isPresent()) {
            CompileCacheEntry entry = cached.get();
            String jobId = UUID.randomUUID().toString();
            CompileJob cachedJob = new CompileJob(jobId, paperId, hash);
            cachedJob.setStatus(CompileJobStatus.SUCCESS);
            cachedJob.setFromCache(true);
            cachedJob.setPdfBytes(entry.pdfBytes());
            cachedJob.setLogs(entry.logs());
            cachedJob.setDurationMs(entry.durationMs());
            cachedJob.setEngineUsed(entry.engine());
            cachedJob.setCompletedAt(Instant.now());
            jobs.put(jobId, cachedJob);
            log.info("Compile hit cache: jobId={}, hash={}", jobId, hash);
            return cachedJob;
        }

        // 2. Quản lý hàng đợi: Chỉ cho phép 1 job đang biên dịch cho cùng một paperId.
        // Khi có yêu cầu biên dịch mới cho cùng một paperId, tự động hủy job cũ đang chạy/chờ.
        if (paperId != null && !paperId.isBlank()) {
            String oldJobId = activePaperJobs.get(paperId);
            if (oldJobId != null) {
                CompileJob oldJob = jobs.get(oldJobId);
                if (oldJob != null && (oldJob.getStatus() == CompileJobStatus.QUEUED || oldJob.getStatus() == CompileJobStatus.RUNNING)) {
                    log.info("Hủy job cũ {} cho paperId {} do có job mới", oldJobId, paperId);
                    cancelJob(oldJobId);
                }
            }
        }

        // 3. Khởi tạo compile job mới
        String jobId = UUID.randomUUID().toString();
        CompileJob job = new CompileJob(jobId, paperId, hash);
        job.setRequest(request);
        job.setStatus(CompileJobStatus.QUEUED);
        jobs.put(jobId, job);

        if (paperId != null && !paperId.isBlank()) {
            activePaperJobs.put(paperId, jobId);
        }

        // 4. Đẩy job vào ExecutorService bất đồng bộ
        Future<?> future = executorService.submit(() -> processJob(job));
        job.setFuture(future);

        return job;
    }

    private void processJob(CompileJob job) {
        if (job.isCancelled()) {
            log.info("Job {} đã bị hủy trước khi bắt đầu", job.getJobId());
            return;
        }

        job.setStatus(CompileJobStatus.RUNNING);
        job.setStartedAt(Instant.now());
        long startTime = System.currentTimeMillis();

        try {
            CompileSandboxResult result = sandboxService.compile(
                    job.getJobId(),
                    job.getRequest(),
                    process -> job.setRunningProcess(process),
                    () -> job.isCancelled()
            );

            long duration = System.currentTimeMillis() - startTime;

            if (job.isCancelled() || result.isCancelled()) {
                job.setStatus(CompileJobStatus.CANCELLED);
                job.setLogs(result.getLogs());
                job.setDurationMs(duration);
                log.info("Job {} đã bị hủy trong quá trình chạy", job.getJobId());
                return;
            }

            if (result.isSuccess()) {
                job.setStatus(CompileJobStatus.SUCCESS);
                job.setPdfBytes(result.getPdfBytes());
                job.setLogs(result.getLogs());
                job.setDurationMs(duration);
                job.setEngineUsed(result.getEngineUsed());

                // Lưu kết quả vào cache
                CompileCacheEntry entry = new CompileCacheEntry(
                        job.getHash(),
                        result.getPdfBytes(),
                        result.getLogs(),
                        duration,
                        result.getEngineUsed(),
                        Instant.now()
                );
                cacheService.put(job.getHash(), entry);
                log.info("Biên dịch thành công job {} trong {} ms", job.getJobId(), duration);
            } else {
                job.setStatus(CompileJobStatus.FAILED);
                job.setError(result.getError());
                job.setLogs(result.getLogs());
                job.setDurationMs(duration);
                log.warn("Biên dịch thất bại job {}: {}", job.getJobId(), result.getError());
            }
        } catch (Exception e) {
            long duration = System.currentTimeMillis() - startTime;
            log.error("Ngoại lệ khi thực thi compile job {}: ", job.getJobId(), e);
            if (job.isCancelled()) {
                job.setStatus(CompileJobStatus.CANCELLED);
            } else {
                job.setStatus(CompileJobStatus.FAILED);
                job.setError(e.getMessage());
            }
            job.setDurationMs(duration);
        } finally {
            job.setCompletedAt(Instant.now());
            if (job.getPaperId() != null) {
                activePaperJobs.remove(job.getPaperId(), job.getJobId());
            }
        }
    }

    public Optional<CompileJob> getJob(String jobId) {
        if (jobId == null) return Optional.empty();
        return Optional.ofNullable(jobs.get(jobId));
    }

    public boolean cancelJob(String jobId) {
        CompileJob job = jobs.get(jobId);
        if (job == null) {
            return false;
        }

        if (job.getStatus() == CompileJobStatus.SUCCESS ||
                job.getStatus() == CompileJobStatus.FAILED ||
                job.getStatus() == CompileJobStatus.CANCELLED) {
            return true;
        }

        job.setCancelled(true);
        job.setStatus(CompileJobStatus.CANCELLED);

        if (job.getRunningProcess() != null && job.getRunningProcess().isAlive()) {
            try {
                job.getRunningProcess().destroyForcibly();
            } catch (Exception ignored) {}
        }

        if (job.getFuture() != null) {
            job.getFuture().cancel(true);
        }

        if (job.getPaperId() != null) {
            activePaperJobs.remove(job.getPaperId(), jobId);
        }

        log.info("Đã hủy job {}", jobId);
        return true;
    }

    public byte[] getJobPdf(String jobId) {
        CompileJob job = getJob(jobId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy compile job: " + jobId));

        if (job.getStatus() != CompileJobStatus.SUCCESS || job.getPdfBytes() == null) {
            throw new ResourceNotFoundException("File PDF chưa sẵn sàng hoặc biên dịch không thành công cho job: " + jobId);
        }

        return job.getPdfBytes();
    }

    @PreDestroy
    public void shutdown() {
        executorService.shutdownNow();
    }
}
