package vn.edu.vnu.structpaper.compile;

import org.apache.commons.io.FileUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import vn.edu.vnu.structpaper.asset.AssetEntity;
import vn.edu.vnu.structpaper.asset.AssetService;
import vn.edu.vnu.structpaper.config.LatexCompilerProperties;
import vn.edu.vnu.structpaper.exception.CompilerNotFoundException;
import vn.edu.vnu.structpaper.exception.LatexCompilationException;
import vn.edu.vnu.structpaper.model.CompilerEngine;
import vn.edu.vnu.structpaper.service.FontManagerService;

import java.io.BufferedReader;
import java.io.File;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.*;
import java.util.concurrent.TimeUnit;
import java.util.function.BooleanSupplier;
import java.util.function.Consumer;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class CompileSandboxService {

    private static final Logger log = LoggerFactory.getLogger(CompileSandboxService.class);
    private static final long MAX_TIMEOUT_SECONDS = 30;

    private final LatexCompilerProperties properties;
    private final AssetService assetService;
    private final FontManagerService fontManagerService;

    public CompileSandboxService(LatexCompilerProperties properties,
                                 AssetService assetService,
                                 FontManagerService fontManagerService) {
        this.properties = properties;
        this.assetService = assetService;
        this.fontManagerService = fontManagerService;
    }

    public CompileSandboxResult compile(String jobId,
                                        CompileJobRequest request,
                                        Consumer<Process> onProcessStarted,
                                        BooleanSupplier isCancelled) {
        long startTime = System.currentTimeMillis();
        Path jobDir = null;

        try {
            // 1. Tạo thư mục tạm độc lập cho mỗi job trong thư mục java.io.tmpdir/structpaper-jobs/<jobId>
            Path baseJobsDir = Paths.get(System.getProperty("java.io.tmpdir"), "structpaper-jobs");
            Files.createDirectories(baseJobsDir);
            jobDir = baseJobsDir.resolve(jobId);
            Files.createDirectories(jobDir);
            File workDir = jobDir.toFile();
            log.info("Khởi tạo sandbox biên dịch cách ly cho job {}: {}", jobId, workDir.getAbsolutePath());

            // 2. Sao chép tài nguyên ảnh (từ asset CAS hoặc request) vào thư mục tạm
            copyAssetsToSandbox(workDir, request);

            // 3. Chuẩn bị mã nguồn LaTeX và áp dụng font fallback nếu cần
            String rawTex = request.getTex() != null ? request.getTex() : "";
            String finalTex = properties.isAutoFontFallback()
                    ? fontManagerService.sanitizeForAvailableFonts(rawTex, workDir)
                    : rawTex;

            File texFile = new File(workDir, "document.tex");
            FileUtils.writeStringToFile(texFile, finalTex, StandardCharsets.UTF_8);

            // 4. Xác định compiler engine phù hợp
            CompilerEngine requestedEngine = CompilerEngine.fromString(request.getEngine());
            ResolvedEngine engine = resolveEngine(requestedEngine);
            log.info("Job {} sử dụng engine: {}", jobId, engine.engineName());

            // 5. Tính toán timeout (tối đa 30 giây)
            long timeoutSeconds = calculateTimeoutSeconds(request);

            // 6. Xử lý Mock Engine (dành cho môi trường test hoặc khi không có binary LaTeX)
            if (engine.isMock()) {
                return executeMockCompilation(workDir, finalTex, request, timeoutSeconds, startTime, isCancelled);
            }

            // 7. Xây dựng lệnh biên dịch an toàn với --no-shell-escape
            List<String> command = buildCompileCommand(engine, workDir, texFile);

            if (isCancelled != null && isCancelled.getAsBoolean()) {
                return CompileSandboxResult.cancelled("Job bị hủy trước khi chạy process", System.currentTimeMillis() - startTime);
            }

            // 8. Thực thi tiến trình biên dịch cách ly
            ProcessBuilder pb = new ProcessBuilder(command);
            pb.directory(workDir);
            pb.redirectErrorStream(true);

            Process process = pb.start();
            if (onProcessStarted != null) {
                onProcessStarted.accept(process);
            }

            StringBuilder logOutput = new StringBuilder();
            try (BufferedReader reader = new BufferedReader(
                    new InputStreamReader(process.getInputStream(), StandardCharsets.UTF_8))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    logOutput.append(line).append("\n");
                    if (isCancelled != null && isCancelled.getAsBoolean()) {
                        process.destroyForcibly();
                        return CompileSandboxResult.cancelled("Job đã bị hủy khi đang thực thi", System.currentTimeMillis() - startTime);
                    }
                }
            }

            boolean finished = process.waitFor(timeoutSeconds, TimeUnit.SECONDS);
            long durationMs = System.currentTimeMillis() - startTime;

            if (!finished) {
                process.destroyForcibly();
                String err = "Quá thời gian biên dịch (Timeout " + timeoutSeconds + " giây)";
                return CompileSandboxResult.failure(
                        extractLogLines(logOutput.toString()),
                        err,
                        -1,
                        durationMs
                );
            }

            int exitCode = process.exitValue();
            File pdfFile = new File(workDir, "document.pdf");

            if (exitCode != 0 || !pdfFile.exists() || pdfFile.length() == 0) {
                String errorDetails = extractLatexError(logOutput.toString());
                return CompileSandboxResult.failure(
                        extractLogLines(logOutput.toString()),
                        errorDetails != null ? errorDetails : "Biên dịch thất bại với mã lỗi " + exitCode,
                        exitCode,
                        durationMs
                );
            }

            byte[] pdfBytes = FileUtils.readFileToByteArray(pdfFile);
            return CompileSandboxResult.success(pdfBytes, extractLogLines(logOutput.toString()), durationMs, engine.engineName());

        } catch (Exception ex) {
            long durationMs = System.currentTimeMillis() - startTime;
            log.error("Lỗi ngoại lệ trong sandbox biên dịch cho job {}: ", jobId, ex);
            return CompileSandboxResult.failure(
                    List.of(ex.getMessage() != null ? ex.getMessage() : ex.toString()),
                    "Lỗi hệ thống trong sandbox: " + ex.getMessage(),
                    -1,
                    durationMs
            );
        } finally {
            // Tự động dọn dẹp thư mục tạm sau khi hoàn tất hoặc lỗi
            if (jobDir != null) {
                try {
                    FileUtils.deleteDirectory(jobDir.toFile());
                    log.info("Đã dọn dẹp thư mục sandbox tạm: {}", jobDir);
                } catch (Exception e) {
                    log.warn("Không thể dọn dẹp thư mục tạm {}: {}", jobDir, e.getMessage());
                }
            }
        }
    }

    private void copyAssetsToSandbox(File workDir, CompileJobRequest request) {
        File imagesDir = new File(workDir, "images");
        if (!imagesDir.exists()) {
            imagesDir.mkdirs();
        }

        // 1. Sao chép tài nguyên ảnh từ CAS thông qua AssetService
        List<String> assetHashes = request.getEffectiveAssets();
        if (assetHashes != null && !assetHashes.isEmpty()) {
            for (String hash : assetHashes) {
                if (hash == null || hash.isBlank()) continue;
                try {
                    Optional<AssetEntity> assetOpt = assetService.findEntity(hash);
                    if (assetOpt.isPresent()) {
                        AssetEntity asset = assetOpt.get();
                        byte[] data = assetService.readAssetBytes(asset);
                        String fileName = hash;

                        FileUtils.writeByteArrayToFile(new File(workDir, fileName), data);
                        FileUtils.writeByteArrayToFile(new File(imagesDir, fileName), data);
                        if (asset.getMimeType() != null) {
                            if (asset.getMimeType().contains("png")) {
                                FileUtils.writeByteArrayToFile(new File(workDir, fileName + ".png"), data);
                                FileUtils.writeByteArrayToFile(new File(imagesDir, fileName + ".png"), data);
                            } else if (asset.getMimeType().contains("jpeg") || asset.getMimeType().contains("jpg")) {
                                FileUtils.writeByteArrayToFile(new File(workDir, fileName + ".jpg"), data);
                                FileUtils.writeByteArrayToFile(new File(imagesDir, fileName + ".jpg"), data);
                            }
                        }
                        log.debug("Đã sao chép CAS asset {} ({} bytes) vào sandbox", fileName, data.length);
                    }
                } catch (Exception ex) {
                    log.warn("Không thể sao chép asset CAS {}: {}", hash, ex.getMessage());
                }
            }
        }

        // 2. Sao chép tài nguyên ảnh Base64 từ request (nếu có)
        if (request.getImages() != null && !request.getImages().isEmpty()) {
            for (Map.Entry<String, String> entry : request.getImages().entrySet()) {
                String filename = entry.getKey();
                String b64 = entry.getValue();
                if (filename != null && b64 != null && !b64.isBlank()) {
                    try {
                        byte[] imgData = Base64.getDecoder().decode(b64.trim());
                        FileUtils.writeByteArrayToFile(new File(workDir, filename), imgData);
                        FileUtils.writeByteArrayToFile(new File(imagesDir, filename), imgData);
                    } catch (Exception ex) {
                        log.warn("Lỗi ghi ảnh Base64 {}: {}", filename, ex.getMessage());
                    }
                }
            }
        }

        // 3. Sao chép các asset demo chuẩn nếu có
        copyDemoAssets(workDir, imagesDir);
        // 4. Biểu tượng/huy hiệu/logo của tạp chí đóng gói sẵn (không phụ thuộc đường dẫn máy dev)
        LatexAssets.copyBundled(workDir, imagesDir);
    }

    private void copyDemoAssets(File workDir, File imagesDir) {
        List<String> possibleSources = List.of(
                "../struct-paper-app/public/demo-images",
                "../../struct-paper-app/public/demo-images",
                "struct-paper-app/public/demo-images"
        );
        for (String src : possibleSources) {
            File srcDir = new File(src);
            if (srcDir.exists() && srcDir.isDirectory()) {
                File[] files = srcDir.listFiles();
                if (files != null) {
                    for (File f : files) {
                        if (f.isFile()) {
                            try {
                                FileUtils.copyFileToDirectory(f, workDir);
                                FileUtils.copyFileToDirectory(f, imagesDir);
                            } catch (Exception ignored) {}
                        }
                    }
                }
            }
        }
    }

    private long calculateTimeoutSeconds(CompileJobRequest request) {
        long timeout = MAX_TIMEOUT_SECONDS;
        if (request.getOptions() != null) {
            Object toMs = request.getOptions().get("timeoutMs");
            if (toMs instanceof Number num) {
                timeout = Math.max(1, num.longValue() / 1000);
            }
            Object toSec = request.getOptions().get("timeoutSeconds");
            if (toSec instanceof Number num) {
                timeout = Math.max(1, num.longValue());
            }
        }
        return Math.min(MAX_TIMEOUT_SECONDS, timeout);
    }

    private List<String> buildCompileCommand(ResolvedEngine engine, File workDir, File texFile) {
        List<String> cmd = new ArrayList<>();
        cmd.add(engine.executablePath());

        if (engine.isTectonic()) {
            // Tectonic: biên dịch an toàn vào output directory
            cmd.add(texFile.getAbsolutePath());
            cmd.add("--outdir");
            cmd.add(workDir.getAbsolutePath());
        } else {
            // XeLaTeX: bắt buộc có cờ an toàn --no-shell-escape
            cmd.add("-no-shell-escape");
            cmd.add("-interaction=nonstopmode");
            cmd.add("-halt-on-error");
            cmd.add("-jobname=document");
            cmd.add(texFile.getName());
        }
        return cmd;
    }

    private CompileSandboxResult executeMockCompilation(File workDir,
                                                        String tex,
                                                        CompileJobRequest request,
                                                        long timeoutSeconds,
                                                        long startTime,
                                                        BooleanSupplier isCancelled) {
        log.info("Đang thực thi Mock Compilation Sandbox");

        // 1. Kiểm tra lỗi cú pháp
        if (tex.contains("\\syntaxerror") ||
                tex.contains("SYNTAX_ERROR") ||
                (request.getOptions() != null && Boolean.TRUE.equals(request.getOptions().get("shouldFail")))) {
            long durationMs = System.currentTimeMillis() - startTime;
            List<String> logs = List.of(
                    "! LaTeX Error: Undefined control sequence \\syntaxerror",
                    "l.5 \\syntaxerror",
                    "? Emergency stop."
            );
            return CompileSandboxResult.failure(
                    logs,
                    "LaTeX Error: Undefined control sequence \\syntaxerror",
                    1,
                    durationMs
            );
        }

        // 2. Giả lập độ trễ / timeout nếu có cấu hình
        long delayMs = 100;
        if (request.getOptions() != null && request.getOptions().get("delayMs") instanceof Number num) {
            delayMs = num.longValue();
        } else if (tex.contains("\\simulateTimeout")) {
            delayMs = (timeoutSeconds + 2) * 1000;
        }

        long elapsed = 0;
        while (elapsed < delayMs) {
            if (isCancelled != null && isCancelled.getAsBoolean()) {
                return CompileSandboxResult.cancelled("Job đã bị hủy khi đang thực thi", System.currentTimeMillis() - startTime);
            }
            if (elapsed >= timeoutSeconds * 1000) {
                return CompileSandboxResult.failure(
                        List.of("Timeout exceeded in sandbox"),
                        "Quá thời gian biên dịch (Timeout " + timeoutSeconds + " giây)",
                        -1,
                        System.currentTimeMillis() - startTime
                );
            }
            try {
                Thread.sleep(Math.min(50, delayMs - elapsed));
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                return CompileSandboxResult.cancelled("Job bị gián đoạn", System.currentTimeMillis() - startTime);
            }
            elapsed += 50;
        }

        if (isCancelled != null && isCancelled.getAsBoolean()) {
            return CompileSandboxResult.cancelled("Job đã bị hủy khi đang thực thi", System.currentTimeMillis() - startTime);
        }

        // 3. Tạo file PDF giả lập chuẩn cấu trúc PDF
        try {
            String mockPdfContent = "%PDF-1.7\n" +
                    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n" +
                    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n" +
                    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>\nendobj\n" +
                    "xref\n0 4\n0000000000 65535 f \n0000000010 00000 n \n0000000060 00000 n \n0000000117 00000 n \n" +
                    "trailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n185\n%%EOF\n";

            byte[] pdfBytes = mockPdfContent.getBytes(StandardCharsets.UTF_8);
            File pdfFile = new File(workDir, "document.pdf");
            FileUtils.writeByteArrayToFile(pdfFile, pdfBytes);

            long durationMs = System.currentTimeMillis() - startTime;
            List<String> logs = List.of(
                    "Tectonic / XeLaTeX Sandbox Mock Compilation",
                    "Input file: document.tex",
                    "Generated: document.pdf (" + pdfBytes.length + " bytes)",
                    "Compilation completed successfully in " + durationMs + " ms"
            );
            return CompileSandboxResult.success(pdfBytes, logs, durationMs, "Tectonic (Sandbox)");
        } catch (Exception e) {
            long durationMs = System.currentTimeMillis() - startTime;
            return CompileSandboxResult.failure(
                    List.of(e.getMessage()),
                    "Lỗi tạo tệp PDF trong sandbox: " + e.getMessage(),
                    -1,
                    durationMs
            );
        }
    }

    private record ResolvedEngine(String engineName, String executablePath, boolean isTectonic, boolean isMock) {}

    private ResolvedEngine resolveEngine(CompilerEngine requested) {
        if (requested == CompilerEngine.MOCK) {
            return new ResolvedEngine("MockEngine", "mock", false, true);
        }

        EngineDetection tectonic = detectTectonic();
        EngineDetection xelatex = detectXeLatex();

        // Ưu tiên Tectonic theo thứ tự: tectonic (hoặc xelatex nếu có, fallback tectonic)
        if (requested == CompilerEngine.TECTONIC) {
            if (tectonic.available()) {
                return new ResolvedEngine("Tectonic", tectonic.path(), true, false);
            }
            if (properties.isMockFallbackEnabled()) {
                return new ResolvedEngine("MockEngine", "mock", false, true);
            }
            throw new CompilerNotFoundException("Không tìm thấy Tectonic trên hệ thống.", "Tectonic");
        }

        if (requested == CompilerEngine.XELATEX) {
            if (xelatex.available()) {
                return new ResolvedEngine("XeLaTeX", xelatex.path(), false, false);
            }
            if (properties.isMockFallbackEnabled()) {
                return new ResolvedEngine("MockEngine", "mock", false, true);
            }
            throw new CompilerNotFoundException("Không tìm thấy XeLaTeX trên hệ thống.", "XeLaTeX");
        }

        // AUTO: ưu tiên Tectonic rồi XeLaTeX
        if (tectonic.available()) {
            return new ResolvedEngine("Tectonic", tectonic.path(), true, false);
        }
        if (xelatex.available()) {
            return new ResolvedEngine("XeLaTeX", xelatex.path(), false, false);
        }

        if (properties.isMockFallbackEnabled()) {
            return new ResolvedEngine("MockEngine", "mock", false, true);
        }

        throw new CompilerNotFoundException("Không tìm thấy bất kỳ TeX engine nào (Tectonic hoặc XeLaTeX).", "Auto");
    }

    private record EngineDetection(boolean available, String version, String path) {}

    private EngineDetection detectXeLatex() {
        String xelatexCmd = properties.getXelatexPath();
        try {
            Process process = new ProcessBuilder(xelatexCmd, "--version")
                    .redirectErrorStream(true)
                    .start();
            boolean finished = process.waitFor(5, TimeUnit.SECONDS);
            if (finished && process.exitValue() == 0) {
                try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()))) {
                    String firstLine = reader.readLine();
                    return new EngineDetection(true, firstLine != null ? firstLine : "XeLaTeX", xelatexCmd);
                }
            }
        } catch (Exception ignored) {}
        return new EngineDetection(false, "Not Found", null);
    }

    private EngineDetection detectTectonic() {
        String customPath = properties.getTectonicPath();
        String command = (customPath != null && !customPath.isBlank()) ? customPath : "tectonic";
        try {
            Process process = new ProcessBuilder(command, "--version")
                    .redirectErrorStream(true)
                    .start();
            boolean finished = process.waitFor(5, TimeUnit.SECONDS);
            if (finished && process.exitValue() == 0) {
                try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()))) {
                    String firstLine = reader.readLine();
                    return new EngineDetection(true, firstLine != null ? firstLine : "Tectonic", command);
                }
            }
        } catch (Exception ignored) {}
        return new EngineDetection(false, "Not Found", null);
    }

    private List<String> extractLogLines(String rawLog) {
        if (rawLog == null || rawLog.isBlank()) {
            return Collections.emptyList();
        }
        return Arrays.asList(rawLog.split("\\r?\\n"));
    }

    private String extractLatexError(String log) {
        if (log == null || log.isBlank()) return "Lỗi không xác định";
        Pattern pattern = Pattern.compile("!(.+?)(?=\\n\\n|\\n!|\\nl\\.|\\Z)", Pattern.DOTALL);
        Matcher matcher = pattern.matcher(log);
        if (matcher.find()) {
            return matcher.group(1).trim().replaceAll("\\s+", " ");
        }
        return "Xem chi tiết nhật ký biên dịch để biết thêm thông tin";
    }
}
