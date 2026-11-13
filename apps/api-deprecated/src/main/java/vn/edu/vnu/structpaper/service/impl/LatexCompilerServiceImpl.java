package vn.edu.vnu.structpaper.service.impl;

import org.apache.commons.io.FileUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import vn.edu.vnu.structpaper.config.LatexCompilerProperties;
import vn.edu.vnu.structpaper.dto.request.CompileLatexRequest;
import vn.edu.vnu.structpaper.dto.response.CompilerStatusResponse;
import vn.edu.vnu.structpaper.exception.CompilerNotFoundException;
import vn.edu.vnu.structpaper.exception.LatexCompilationException;
import vn.edu.vnu.structpaper.model.CompilationResult;
import vn.edu.vnu.structpaper.model.CompilerEngine;
import vn.edu.vnu.structpaper.service.FontManagerService;
import vn.edu.vnu.structpaper.service.LatexCompilerService;

import java.io.BufferedReader;
import java.io.File;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class LatexCompilerServiceImpl implements LatexCompilerService {

    private static final Logger log = LoggerFactory.getLogger(LatexCompilerServiceImpl.class);

    private final LatexCompilerProperties properties;
    private final FontManagerService fontManagerService;

    public LatexCompilerServiceImpl(LatexCompilerProperties properties, FontManagerService fontManagerService) {
        this.properties = properties;
        this.fontManagerService = fontManagerService;
    }

    @Override
    public CompilationResult compile(CompileLatexRequest request) {
        long startTime = System.currentTimeMillis();
        Path tempDir = null;

        try {
            // 1. Create isolated temporary workspace
            Path baseTemp = (properties.getWorkDir() != null && !properties.getWorkDir().isBlank())
                    ? Paths.get(properties.getWorkDir())
                    : null;

            if (baseTemp != null && Files.exists(baseTemp)) {
                tempDir = Files.createTempDirectory(baseTemp, "structpaper-compile-");
            } else {
                tempDir = Files.createTempDirectory("structpaper-compile-");
            }

            File workDir = tempDir.toFile();
            log.info("Khởi tạo thư mục biên dịch tạm: {}", workDir.getAbsolutePath());

            // 2. Determine compiler engine to use
            CompilerEngine requestedEngine = CompilerEngine.fromString(request.getEngine());
            ResolvedEngine engine = resolveEngine(requestedEngine);
            log.info("Sử dụng engine: {} (Binary: {})", engine.engineName(), engine.executablePath());

            // 3. Pre-process LaTeX content (Font fallback if commercial fonts missing)
            String rawTex = request.getTexContent();
            String finalTex = request.getAutoFontFallback()
                    ? fontManagerService.sanitizeForAvailableFonts(rawTex, workDir)
                    : rawTex;

            // 4. Write .tex file
            String jobName = (request.getJobName() != null && !request.getJobName().isBlank())
                    ? request.getJobName().replaceAll("[^a-zA-Z0-9_-]", "")
                    : "document";
            if (jobName.isBlank()) jobName = "document";

            File texFile = new File(workDir, jobName + ".tex");
            FileUtils.writeStringToFile(texFile, finalTex, StandardCharsets.UTF_8);

            // 5. Copy project demo images and assets if referenced
            copyProjectAssets(workDir);

            // 5.1 Write custom images provided in request (decoding Base64, take absolute priority)
            if (request.getImages() != null && !request.getImages().isEmpty()) {
                File imagesDir = new File(workDir, "images");
                if (!imagesDir.exists()) imagesDir.mkdirs();
                for (Map.Entry<String, String> entry : request.getImages().entrySet()) {
                    String filename = entry.getKey();
                    String b64 = entry.getValue();
                    if (filename != null && b64 != null && !b64.isBlank()) {
                        try {
                            byte[] imgData = Base64.getDecoder().decode(b64.trim());
                            FileUtils.writeByteArrayToFile(new File(workDir, filename), imgData);
                            FileUtils.writeByteArrayToFile(new File(imagesDir, filename), imgData);
                            log.info("Đã ghi ảnh client tùy biến: {} ({} bytes)", filename, imgData.length);
                        } catch (Exception ex) {
                            log.warn("Lỗi khi ghi ảnh client {}: {}", filename, ex.getMessage());
                        }
                    }
                }
            }

            // 6. Build compilation command
            List<String> command = buildCompileCommand(engine, jobName, texFile);

            // 7. Execute compilation process with timeout
            ProcessBuilder processBuilder = new ProcessBuilder(command);
            processBuilder.directory(workDir);
            processBuilder.redirectErrorStream(true);

            // XeLaTeX needs two passes to resolve \cite / \ref (otherwise they print as "?").
            // Tectonic re-runs by itself, so it only gets one.
            int passes = !engine.isTectonic() && (finalTex.contains("\\cite{") || finalTex.contains("\\ref{")) ? 2 : 1;
            StringBuilder logOutput = new StringBuilder();
            Process process = null;
            boolean finished = true;
            for (int pass = 1; pass <= passes && finished; pass++) {
                logOutput.setLength(0);
                process = processBuilder.start();
                try (BufferedReader reader = new BufferedReader(
                        new InputStreamReader(process.getInputStream(), StandardCharsets.UTF_8))) {
                    String line;
                    while ((line = reader.readLine()) != null) {
                        logOutput.append(line).append("\n");
                    }
                }
                finished = process.waitFor(properties.getTimeoutSeconds(), TimeUnit.SECONDS);
                if (finished && process.exitValue() != 0) {
                    break;
                }
            }
            if (!finished) {
                process.destroyForcibly();
                throw new LatexCompilationException(
                        "Quá thời gian biên dịch (Timeout " + properties.getTimeoutSeconds() + " giây)",
                        engine.engineName(),
                        "Quá trình biên dịch vượt quá giới hạn thời gian cho phép.",
                        logOutput.toString(),
                        -1
                );
            }

            int exitCode = process.exitValue();
            long duration = System.currentTimeMillis() - startTime;
            File pdfFile = new File(workDir, jobName + ".pdf");

            if (exitCode != 0 || !pdfFile.exists() || pdfFile.length() == 0) {
                String errorDetails = extractLatexError(logOutput.toString());
                throw new LatexCompilationException(
                        "Lỗi biên dịch mã LaTeX qua " + engine.engineName() + " (Mã lỗi: " + exitCode + ")",
                        engine.engineName(),
                        errorDetails,
                        logOutput.toString(),
                        exitCode
                );
            }

            // 8. Read generated PDF bytes
            byte[] pdfBytes = FileUtils.readFileToByteArray(pdfFile);
            log.info("Biên dịch thành công qua {} trong {} ms! Kích thước PDF: {} bytes",
                    engine.engineName(), duration, pdfBytes.length);

            return CompilationResult.success(pdfBytes, engine.engineName(), duration, logOutput.toString());

        } catch (LatexCompilationException ex) {
            throw ex;
        } catch (CompilerNotFoundException ex) {
            throw ex;
        } catch (Exception ex) {
            long duration = System.currentTimeMillis() - startTime;
            log.error("Lỗi ngoại lệ trong quá trình biên dịch: ", ex);
            throw new LatexCompilationException(
                    "Lỗi hệ thống khi biên dịch LaTeX: " + ex.getMessage(),
                    "Unknown",
                    ex.toString(),
                    "",
                    -1
            );
        } finally {
            // Clean up temporary workspace directory
            if (tempDir != null) {
                try {
                    FileUtils.deleteDirectory(tempDir.toFile());
                } catch (Exception e) {
                    log.warn("Không thể xóa thư mục tạm {}: {}", tempDir, e.getMessage());
                }
            }
        }
    }

    @Override
    public CompilerStatusResponse getStatus() {
        EngineDetection xelatex = detectXeLatex();
        EngineDetection tectonic = detectTectonic();

        String activeEngine = "None";
        if (xelatex.available()) {
            activeEngine = "XeLaTeX";
        } else if (tectonic.available()) {
            activeEngine = "Tectonic (XeTeX)";
        }

        Runtime runtime = Runtime.getRuntime();
        long maxMemoryMb = runtime.maxMemory() / (1024 * 1024);
        long freeMemoryMb = runtime.freeMemory() / (1024 * 1024);

        return new CompilerStatusResponse(
                xelatex.available(),
                xelatex.version(),
                xelatex.path(),
                tectonic.available(),
                tectonic.version(),
                tectonic.path(),
                activeEngine,
                System.getProperty("os.name") + " " + System.getProperty("os.arch"),
                System.getProperty("java.version"),
                maxMemoryMb,
                freeMemoryMb
        );
    }

    // --- Helper Methods ---

    private record ResolvedEngine(String engineName, String executablePath, boolean isTectonic) {}

    private ResolvedEngine resolveEngine(CompilerEngine requested) {
        EngineDetection xelatex = detectXeLatex();
        EngineDetection tectonic = detectTectonic();

        if (requested == CompilerEngine.XELATEX) {
            if (xelatex.available()) {
                return new ResolvedEngine("XeLaTeX", xelatex.path(), false);
            }
            throw new CompilerNotFoundException(
                    "Không tìm thấy trình biên dịch XeLaTeX trên hệ thống máy chủ.", "XeLaTeX");
        }

        if (requested == CompilerEngine.TECTONIC) {
            if (tectonic.available()) {
                return new ResolvedEngine("Tectonic", tectonic.path(), true);
            }
            throw new CompilerNotFoundException(
                    "Không tìm thấy trình biên dịch Tectonic trên hệ thống máy chủ.", "Tectonic");
        }

        // AUTO: Prefer xelatex if available, fallback to tectonic
        if (xelatex.available()) {
            return new ResolvedEngine("XeLaTeX", xelatex.path(), false);
        }
        if (tectonic.available()) {
            return new ResolvedEngine("Tectonic", tectonic.path(), true);
        }

        throw new CompilerNotFoundException(
                "Không tìm thấy bất kỳ TeX engine nào (XeLaTeX hoặc Tectonic). Vui lòng cài đặt MiKTeX / TeXLive hoặc Tectonic.",
                "Auto"
        );
    }

    private List<String> buildCompileCommand(ResolvedEngine engine, String jobName, File texFile) {
        List<String> cmd = new ArrayList<>();
        cmd.add(engine.executablePath());

        if (engine.isTectonic()) {
            cmd.add(texFile.getAbsolutePath());
            cmd.add("--outdir");
            cmd.add(texFile.getParentFile().getAbsolutePath());
        } else {
            // XeLaTeX standard flags
            cmd.add("-interaction=nonstopmode");
            cmd.add("-halt-on-error");
            cmd.add("-jobname=" + jobName);
            cmd.add(texFile.getName());
        }
        return cmd;
    }

    private void copyProjectAssets(File workDir) {
        try {
            // Create images subfolder in work directory
            File imagesDir = new File(workDir, "images");
            if (!imagesDir.exists()) imagesDir.mkdirs();

            // Look for project demo images and media
            List<String> possibleSources = List.of(
                    "../struct-paper-app/public/demo-images",
                    "../../struct-paper-app/public/demo-images",
                    "c:/Users/OWNER/source/StructPaper/struct-paper-app/public/demo-images",
                    "../struct-paper-app/public/media",
                    "../../struct-paper-app/public/media",
                    "c:/Users/OWNER/source/StructPaper/struct-paper-app/public/media",
                    "../struct-paper-app/public/sample-media",
                    "../../struct-paper-app/public/sample-media",
                    "c:/Users/OWNER/source/StructPaper/struct-paper-app/public/sample-media"
            );

            for (String src : possibleSources) {
                File srcDir = new File(src);
                if (srcDir.exists() && srcDir.isDirectory()) {
                    File[] files = srcDir.listFiles();
                    if (files != null) {
                        for (File f : files) {
                            if (f.isFile()) {
                                FileUtils.copyFileToDirectory(f, workDir);
                                FileUtils.copyFileToDirectory(f, imagesDir);
                            }
                        }
                    }
                }
            }

            // Journal artwork (Open Access icon, Check for updates badge, VNUHCM Press logo) from the classpath.
            // The QR code is drawn in TeX from the DOI; paper figures (image2/3/4…) are never aliased to artwork.
            vn.edu.vnu.structpaper.compile.LatexAssets.copyBundled(workDir, imagesDir);
            for (String stale : new String[] {"qr-code.png", "qr-code", "article-qr.png"}) {
                new File(workDir, stale).delete();
                new File(imagesDir, stale).delete();
            }

            // Figure 1 stomach anatomy aliases (image5.jpeg) - only fallback if not already provided
            File fig1Source = new File(workDir, "image5.jpeg");
            if (!fig1Source.exists()) fig1Source = new File(workDir, "hs630_fig_1.jpg");
            if (fig1Source.exists()) {
                FileUtils.copyFile(fig1Source, new File(workDir, "hs630_fig_1.jpg"));
                FileUtils.copyFile(fig1Source, new File(workDir, "21b96d08-b05f-46d2-b278-a27112337f5fimage1.png"));
                FileUtils.copyFile(fig1Source, new File(imagesDir, "hs630_fig_1.jpg"));
                FileUtils.copyFile(fig1Source, new File(imagesDir, "21b96d08-b05f-46d2-b278-a27112337f5fimage1.png"));
                File targetFig1 = new File(workDir, "fig1.png");
                if (!targetFig1.exists()) {
                    FileUtils.copyFile(fig1Source, targetFig1);
                    FileUtils.copyFile(fig1Source, new File(imagesDir, "fig1.png"));
                }
            }

        } catch (Exception e) {
            log.warn("Lỗi khi sao chép tài nguyên hình ảnh phụ trợ: {}", e.getMessage());
        }
    }

    private String extractLatexError(String log) {
        if (log == null || log.isBlank()) return "Không có thông tin log.";
        Pattern p = Pattern.compile("!(?:\\s+Package)?\\s+([^\n]+(\n[^\n]+){0,3})", Pattern.MULTILINE);
        Matcher m = p.matcher(log);
        if (m.find()) {
            return m.group(0).trim();
        }
        if (log.contains("error:")) {
            int idx = log.indexOf("error:");
            return log.substring(idx, Math.min(idx + 300, log.length())).trim();
        }
        return "Quá trình biên dịch không thành công. Vui lòng xem log chi tiết bên dưới.";
    }

    private record EngineDetection(boolean available, String version, String path) {}

    private EngineDetection detectXeLatex() {
        List<String> candidatePaths = new ArrayList<>();
        if (properties.getXelatexPath() != null && !properties.getXelatexPath().isBlank()) {
            candidatePaths.add(properties.getXelatexPath());
        }
        candidatePaths.add("xelatex");

        String userHome = System.getProperty("user.home", "");
        candidatePaths.add(userHome + "\\AppData\\Local\\Programs\\MiKTeX\\miktex\\bin\\x64\\xelatex.exe");
        candidatePaths.add("C:\\Program Files\\MiKTeX\\miktex\\bin\\x64\\xelatex.exe");
        candidatePaths.add("C:\\texlive\\2024\\bin\\windows\\xelatex.exe");
        candidatePaths.add("C:\\texlive\\2025\\bin\\windows\\xelatex.exe");

        for (String candidate : candidatePaths) {
            try {
                ProcessBuilder pb = new ProcessBuilder(candidate, "-version");
                pb.redirectErrorStream(true);
                Process p = pb.start();
                try (BufferedReader r = new BufferedReader(new InputStreamReader(p.getInputStream()))) {
                    String line = r.readLine();
                    if (p.waitFor(5, TimeUnit.SECONDS) && line != null && line.toLowerCase().contains("xetex")) {
                        return new EngineDetection(true, line.trim(), candidate);
                    }
                }
            } catch (Exception ignored) {
            }
        }
        return new EngineDetection(false, "Không khả dụng", "");
    }

    private EngineDetection detectTectonic() {
        List<String> candidatePaths = new ArrayList<>();
        if (properties.getTectonicPath() != null && !properties.getTectonicPath().isBlank()) {
            candidatePaths.add(properties.getTectonicPath());
        }
        candidatePaths.add("tectonic");
        candidatePaths.add("c:/Users/OWNER/source/StructPaper/bin/tectonic.exe");
        candidatePaths.add("c:/Users/OWNER/source/StructPaper/struct-paper-app/bin/tectonic.exe");
        candidatePaths.add("../bin/tectonic.exe");
        candidatePaths.add("bin/tectonic.exe");

        for (String candidate : candidatePaths) {
            try {
                ProcessBuilder pb = new ProcessBuilder(candidate, "--version");
                pb.redirectErrorStream(true);
                Process p = pb.start();
                try (BufferedReader r = new BufferedReader(new InputStreamReader(p.getInputStream()))) {
                    String line = r.readLine();
                    if (p.waitFor(5, TimeUnit.SECONDS) && line != null && line.toLowerCase().contains("tectonic")) {
                        return new EngineDetection(true, line.trim(), candidate);
                    }
                }
            } catch (Exception ignored) {
            }
        }
        return new EngineDetection(false, "Không khả dụng", "");
    }
}
