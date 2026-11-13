package vn.edu.vnu.structpaper.batch;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import vn.edu.vnu.structpaper.exception.InvalidArchiveException;
import vn.edu.vnu.structpaper.exception.ResourceNotFoundException;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

@Service
public class BatchService {

    private static final Logger log = LoggerFactory.getLogger(BatchService.class);

    private final BatchWorker batchWorker;
    private final ConcurrentMap<String, BatchJob> jobs = new ConcurrentHashMap<>();

    public BatchService(BatchWorker batchWorker) {
        this.batchWorker = batchWorker;
    }

    public BatchUploadResponse submitBatch(MultipartFile file, String journalId, String options) {
        if (file == null || file.isEmpty()) {
            throw new InvalidArchiveException("Tệp lưu trữ tải lên bị rỗng hoặc không tồn tại");
        }

        byte[] bytes;
        try {
            bytes = file.getBytes();
        } catch (IOException e) {
            throw new InvalidArchiveException("Không thể đọc nội dung tệp tải lên: " + e.getMessage(), e);
        }

        // Kiểm tra magic bytes ZIP (PK\u0003\u0004 hoặc PK\u0005\u0006)
        if (bytes.length < 4 || bytes[0] != 0x50 || bytes[1] != 0x4B) {
            throw new InvalidArchiveException("Tệp tải lên không phải là định dạng nén ZIP hợp lệ");
        }

        // Đếm trước số lượng file DOCX hợp lệ trong ZIP
        int docxCount = countValidDocxInZip(bytes);
        if (docxCount == 0) {
            throw new InvalidArchiveException("Tệp ZIP không chứa bất kỳ tài liệu DOCX hợp lệ nào để xử lý");
        }

        String batchId = UlidGenerator.nextUlid();
        BatchJob job = new BatchJob(batchId, journalId, options, docxCount);
        jobs.put(batchId, job);

        log.info("Tiếp nhận batch mới: id={}, docxCount={}, journalId={}", batchId, docxCount, journalId);

        // Kích hoạt worker bất đồng bộ
        batchWorker.processBatchAsync(job, bytes);

        return new BatchUploadResponse(batchId, docxCount, "PENDING", job.getCreatedAt());
    }

    public BatchStatusResponse getStatus(String batchId) {
        BatchJob job = jobs.get(batchId);
        if (job == null) {
            throw new ResourceNotFoundException("Không tìm thấy batch với ID: " + batchId);
        }
        return BatchStatusResponse.fromJob(job);
    }

    public BatchReportResponse getReport(String batchId) {
        BatchJob job = jobs.get(batchId);
        if (job == null) {
            throw new ResourceNotFoundException("Không tìm thấy batch với ID: " + batchId);
        }
        return BatchReportResponse.fromJob(job);
    }

    public BatchJob getJob(String batchId) {
        return jobs.get(batchId);
    }

    int countValidDocxInZip(byte[] zipBytes) {
        int count = 0;
        try (ZipInputStream zis = new ZipInputStream(new ByteArrayInputStream(zipBytes))) {
            ZipEntry entry;
            while ((entry = zis.getNextEntry()) != null) {
                String name = entry.getName();
                if (entry.isDirectory()) {
                    continue;
                }
                if (name.contains("__MACOSX") || name.startsWith(".") || name.contains("/.") || name.contains("\\.")) {
                    continue;
                }
                if (name.toLowerCase().endsWith(".docx")) {
                    count++;
                }
            }
        } catch (Exception e) {
            throw new InvalidArchiveException("Tệp ZIP bị hỏng hoặc lỗi định dạng: " + e.getMessage(), e);
        }
        return count;
    }
}
