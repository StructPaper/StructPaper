package vn.edu.vnu.structpaper.batch;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PreDestroy;
import org.apache.commons.io.FileUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import vn.edu.vnu.structpaper.manuscript.ManuscriptService;

import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.*;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.zip.ZipEntry;
import java.util.zip.ZipFile;
import java.util.zip.ZipInputStream;

@Component
public class BatchWorker {

    private static final Logger log = LoggerFactory.getLogger(BatchWorker.class);

    private static final Pattern TITLE_PATTERN = Pattern.compile("<dc:title\\b[^>]*>(.*?)</dc:title>", Pattern.DOTALL);
    private static final Pattern CREATOR_PATTERN = Pattern.compile("<dc:creator\\b[^>]*>(.*?)</dc:creator>", Pattern.DOTALL);
    private static final Pattern PARAGRAPH_PATTERN = Pattern.compile("<w:p\\b[^>]*>(.*?)</w:p>", Pattern.DOTALL);
    private static final Pattern TEXT_PATTERN = Pattern.compile("<w:t\\b[^>]*>(.*?)</w:t>", Pattern.DOTALL);

    private final ManuscriptService manuscriptService;
    private final ObjectMapper objectMapper;
    private final ExecutorService executorService;

    public BatchWorker(ManuscriptService manuscriptService, ObjectMapper objectMapper) {
        this.manuscriptService = manuscriptService;
        this.objectMapper = objectMapper;
        this.executorService = Executors.newFixedThreadPool(
                Math.max(2, Runtime.getRuntime().availableProcessors()),
                r -> {
                    Thread t = new Thread(r, "batch-worker");
                    t.setDaemon(true);
                    return t;
                }
        );
    }

    @PreDestroy
    public void shutdown() {
        executorService.shutdown();
        try {
            if (!executorService.awaitTermination(3, TimeUnit.SECONDS)) {
                executorService.shutdownNow();
            }
        } catch (InterruptedException e) {
            executorService.shutdownNow();
            Thread.currentThread().interrupt();
        }
    }

    public void processBatchAsync(BatchJob job, byte[] zipBytes) {
        executorService.submit(() -> doProcessBatch(job, zipBytes));
    }

    void doProcessBatch(BatchJob job, byte[] zipBytes) {
        Path tempDir = null;
        log.info("Bắt đầu xử lý batch: id={}", job.getBatchId());
        job.setStatus(BatchStatus.PROCESSING);

        try {
            tempDir = Files.createTempDirectory("structpaper-batch-" + job.getBatchId());

            // 1. Giải nén ZIP an toàn và lọc các file DOCX hợp lệ
            List<Path> docxFiles = extractAndFilterDocxFiles(zipBytes, tempDir);

            if (docxFiles.isEmpty()) {
                log.warn("Batch {} không chứa tệp DOCX hợp lệ nào", job.getBatchId());
                job.setStatus(BatchStatus.FAILED);
                job.setError("No valid DOCX files found in archive");
                job.updateProgress();
                return;
            }

            // Cập nhật lại totalFiles theo số lượng DOCX thực tế
            job.setTotalFiles(docxFiles.size());

            // Khởi tạo danh sách items ở trạng thái PENDING
            Map<String, BatchItemStatus> itemMap = new LinkedHashMap<>();
            for (Path docxPath : docxFiles) {
                String fileName = docxPath.getFileName().toString();
                BatchItemStatus item = BatchItemStatus.pending(fileName);
                job.getItems().add(item);
                itemMap.put(fileName, item);
            }

            // 2. Xử lý tuần tự từng file DOCX
            for (Path docxPath : docxFiles) {
                String fileName = docxPath.getFileName().toString();
                BatchItemStatus item = itemMap.get(fileName);
                item.setStatus(BatchItemState.PROCESSING.name());

                long startTime = System.currentTimeMillis();
                try {
                    DocxExtractResult extractResult = extractDocx(docxPath);
                    String manuscriptId = UlidGenerator.nextUlid();

                    String journalId = job.getJournalId() != null && !job.getJournalId().isBlank()
                            ? job.getJournalId()
                            : "vnu-tcb";

                    String docJson = buildManuscriptJson(manuscriptId, journalId, extractResult);

                    // Lưu vào Manuscript repository
                    manuscriptService.saveOrUpdate(manuscriptId, "*", docJson);

                    long duration = System.currentTimeMillis() - startTime;
                    item.setStatus(BatchItemState.SUCCESS.name());
                    item.setManuscriptId(manuscriptId);
                    item.setTitle(extractResult.title());
                    item.setDurationMs(duration);
                    item.setError(null);

                    job.setSuccessfulFiles(job.getSuccessfulFiles() + 1);
                    log.info("Batch {}: Đã xử lý thành công file {} -> manuscriptId={}, duration={}ms",
                            job.getBatchId(), fileName, manuscriptId, duration);

                } catch (Exception e) {
                    long duration = System.currentTimeMillis() - startTime;
                    log.warn("Batch {}: Thất bại khi xử lý file {}: {}", job.getBatchId(), fileName, e.getMessage());
                    item.setStatus(BatchItemState.FAILED.name());
                    item.setDurationMs(duration);
                    item.setError(e.getMessage() != null ? e.getMessage() : e.getClass().getSimpleName());

                    job.setFailedFiles(job.getFailedFiles() + 1);
                } finally {
                    job.updateProgress();
                }
            }

            log.info("Batch {} hoàn tất: total={}, success={}, failed={}, percent={}%",
                    job.getBatchId(), job.getTotalFiles(), job.getSuccessfulFiles(), job.getFailedFiles(), job.getProgressPercent());

        } catch (Exception e) {
            log.error("Batch {} gặp sự cố hệ thống nghiêm trọng: {}", job.getBatchId(), e.getMessage(), e);
            job.setStatus(BatchStatus.FAILED);
            job.setError("Batch processing error: " + e.getMessage());
            job.updateProgress();
        } finally {
            // 3. Tự động dọn dẹp thư mục tạm an toàn
            if (tempDir != null && Files.exists(tempDir)) {
                try {
                    FileUtils.deleteDirectory(tempDir.toFile());
                    log.debug("Đã dọn dẹp sạch thư mục tạm batch: {}", tempDir);
                } catch (Exception e) {
                    log.warn("Không thể xóa thư mục tạm {}: {}", tempDir, e.getMessage());
                }
            }
        }
    }

    List<Path> extractAndFilterDocxFiles(byte[] zipBytes, Path targetDir) throws Exception {
        List<Path> docxFiles = new ArrayList<>();

        try (ZipInputStream zis = new ZipInputStream(new ByteArrayInputStream(zipBytes))) {
            ZipEntry entry;
            while ((entry = zis.getNextEntry()) != null) {
                String name = entry.getName();

                // Bỏ qua thư mục
                if (entry.isDirectory()) {
                    continue;
                }

                // Bỏ qua các file ẩn macOS, __MACOSX, .DS_Store
                if (name.contains("__MACOSX") || name.startsWith(".") || name.contains("/.") || name.contains("\\.")) {
                    continue;
                }

                // Zip Slip Protection
                Path resolvedPath = targetDir.resolve(name).normalize();
                if (!resolvedPath.startsWith(targetDir.normalize())) {
                    throw new SecurityException("Phát hiện nguy cơ Zip Slip tại tệp: " + name);
                }

                // Lọc file có đuôi .docx (không phân biệt hoa thường)
                if (name.toLowerCase().endsWith(".docx")) {
                    Files.createDirectories(resolvedPath.getParent());
                    Files.copy(zis, resolvedPath, StandardCopyOption.REPLACE_EXISTING);
                    docxFiles.add(resolvedPath);
                }
            }
        }

        return docxFiles;
    }

    DocxExtractResult extractDocx(Path docxFile) throws Exception {
        String title = null;
        String author = null;
        List<String> paragraphs = new ArrayList<>();
        boolean hasDocumentXml = false;

        try (ZipFile zip = new ZipFile(docxFile.toFile())) {
            // Đọc metadata từ docProps/core.xml nếu có
            ZipEntry coreEntry = zip.getEntry("docProps/core.xml");
            if (coreEntry != null) {
                try (InputStream is = zip.getInputStream(coreEntry)) {
                    String coreXml = new String(is.readAllBytes(), StandardCharsets.UTF_8);
                    Matcher titleMatcher = TITLE_PATTERN.matcher(coreXml);
                    if (titleMatcher.find()) {
                        title = unescapeXml(titleMatcher.group(1).trim());
                    }
                    Matcher authorMatcher = CREATOR_PATTERN.matcher(coreXml);
                    if (authorMatcher.find()) {
                        author = unescapeXml(authorMatcher.group(1).trim());
                    }
                }
            }

            // Đọc nội dung văn bản từ word/document.xml
            ZipEntry docEntry = zip.getEntry("word/document.xml");
            if (docEntry != null) {
                hasDocumentXml = true;
                try (InputStream is = zip.getInputStream(docEntry)) {
                    String docXml = new String(is.readAllBytes(), StandardCharsets.UTF_8);
                    Matcher pMatcher = PARAGRAPH_PATTERN.matcher(docXml);
                    while (pMatcher.find()) {
                        String pContent = pMatcher.group(1);
                        Matcher tMatcher = TEXT_PATTERN.matcher(pContent);
                        StringBuilder sb = new StringBuilder();
                        while (tMatcher.find()) {
                            sb.append(unescapeXml(tMatcher.group(1)));
                        }
                        String text = sb.toString().trim();
                        if (!text.isEmpty()) {
                            paragraphs.add(text);
                        }
                    }
                }
            }
        }

        if (!hasDocumentXml) {
            throw new IllegalArgumentException("File DOCX không hợp lệ: thiếu cấu trúc word/document.xml");
        }

        // Nếu title chưa có từ metadata core.xml, lấy paragraph đầu tiên hoặc tên tệp
        if (title == null || title.isBlank()) {
            if (!paragraphs.isEmpty()) {
                title = paragraphs.get(0);
                if (title.length() > 300) {
                    title = title.substring(0, 300) + "...";
                }
            } else {
                String baseName = docxFile.getFileName().toString();
                if (baseName.toLowerCase().endsWith(".docx")) {
                    baseName = baseName.substring(0, baseName.length() - 5);
                }
                title = baseName;
            }
        }

        if (author == null || author.isBlank()) {
            author = "Unknown Author";
        }

        return new DocxExtractResult(title, author, paragraphs);
    }

    String buildManuscriptJson(String manuscriptId, String journalId, DocxExtractResult extractResult) throws Exception {
        Map<String, Object> root = new LinkedHashMap<>();
        root.put("id", manuscriptId);
        root.put("schemaVersion", 2);
        root.put("title", extractResult.title());
        root.put("journalId", journalId);

        Map<String, Object> authorObj = new LinkedHashMap<>();
        authorObj.put("name", extractResult.author());
        authorObj.put("affiliations", List.of());
        root.put("authors", List.of(authorObj));

        List<Map<String, Object>> blocks = new ArrayList<>();
        List<String> paras = extractResult.paragraphs();
        if (paras.isEmpty()) {
            paras = List.of("No text paragraphs found in DOCX file.");
        }

        for (int i = 0; i < paras.size(); i++) {
            Map<String, Object> block = new LinkedHashMap<>();
            block.put("id", "blk-" + (i + 1));
            block.put("kind", "paragraph");

            Map<String, Object> inline = new LinkedHashMap<>();
            inline.put("t", "text");
            inline.put("v", paras.get(i));

            block.put("inlines", List.of(inline));
            blocks.add(block);
        }
        root.put("blocks", blocks);

        return objectMapper.writeValueAsString(root);
    }

    private static String unescapeXml(String xml) {
        if (xml == null) return "";
        return xml.replace("&amp;", "&")
                .replace("&lt;", "<")
                .replace("&gt;", ">")
                .replace("&quot;", "\"")
                .replace("&apos;", "'");
    }

    public record DocxExtractResult(String title, String author, List<String> paragraphs) {}
}
