package vn.edu.vnu.structpaper.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import vn.edu.vnu.structpaper.compile.*;
import vn.edu.vnu.structpaper.dto.request.CompileLatexRequest;
import vn.edu.vnu.structpaper.dto.response.CompileJsonResponse;
import vn.edu.vnu.structpaper.exception.ResourceNotFoundException;
import vn.edu.vnu.structpaper.model.CompilationResult;
import vn.edu.vnu.structpaper.service.LatexCompilerService;

import java.nio.charset.StandardCharsets;
import java.util.Base64;

@RestController
@RequestMapping("/api/v1/compile")
@Tag(name = "LaTeX Compilation", description = "Các API biên dịch mã nguồn LaTeX sang định dạng PDF chuẩn xuất bản")
public class LatexCompilerController {

    private final LatexCompilerService compilerService;
    private final CompileQueueManager queueManager;

    public LatexCompilerController(LatexCompilerService compilerService, CompileQueueManager queueManager) {
        this.compilerService = compilerService;
        this.queueManager = queueManager;
    }

    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    @Operation(summary = "Submit LaTeX compilation job", description = "Submits a compilation manifest. If cached, returns 200 OK; otherwise enqueues and returns 202 Accepted.")
    public ResponseEntity<CompileJobStatusResponse> submitCompileJob(@Valid @RequestBody CompileJobRequest request) {
        CompileJob job = queueManager.submit(request);
        CompileJobStatusResponse response = toStatusResponse(job);

        if (job.isFromCache()) {
            return ResponseEntity.ok(response);
        }
        return ResponseEntity.status(HttpStatus.ACCEPTED).body(response);
    }

    @GetMapping(value = "/{jobId}", produces = MediaType.APPLICATION_JSON_VALUE)
    @Operation(summary = "Get compile job status and artifacts", description = "Polling endpoint for compile job status, generated PDF URL, log URL, and diagnostics.")
    public ResponseEntity<CompileJobStatusResponse> getJobStatus(@PathVariable String jobId) {
        CompileJob job = queueManager.getJob(jobId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy compile job: " + jobId));
        return ResponseEntity.ok(toStatusResponse(job));
    }

    @DeleteMapping(value = "/{jobId}", produces = MediaType.APPLICATION_JSON_VALUE)
    @Operation(summary = "Cancel a queued or running compile job", description = "Aborts the LaTeX engine worker process and cleans up workspace scratch files.")
    public ResponseEntity<CancelJobResponse> cancelCompileJob(@PathVariable String jobId) {
        CompileJob job = queueManager.getJob(jobId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy compile job: " + jobId));
        queueManager.cancelJob(jobId);
        return ResponseEntity.ok(new CancelJobResponse(jobId, "CANCELLED"));
    }

    @GetMapping(value = "/{jobId}/pdf", produces = MediaType.APPLICATION_PDF_VALUE)
    @Operation(summary = "Download compiled PDF file", description = "Returns the binary stream of the generated PDF.")
    public ResponseEntity<byte[]> downloadPdf(@PathVariable String jobId) {
        byte[] pdfBytes = queueManager.getJobPdf(jobId);
        CompileJob job = queueManager.getJob(jobId).orElse(null);
        String filename = "manuscript-" + (job != null && job.getPaperId() != null ? job.getPaperId() : jobId) + ".pdf";

        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_PDF)
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + filename + "\"")
                .header("X-Compile-Job-Id", jobId)
                .header("X-From-Cache", String.valueOf(job != null && job.isFromCache()))
                .body(pdfBytes);
    }

    @PostMapping(value = "/latex", produces = MediaType.APPLICATION_PDF_VALUE)
    @Operation(summary = "Biên dịch LaTeX sang file PDF", description = "Nhận mã nguồn .tex thô và trả về trực tiếp luồng nhị phân PDF (Content-Type: application/pdf)")
    public ResponseEntity<byte[]> compileToPdf(@Valid @RequestBody CompileLatexRequest request) {
        CompilationResult result = compilerService.compile(request);

        String filename = request.getJobName() + ".pdf";

        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_PDF)
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + filename + "\"")
                .header("X-Compiler-Engine", result.engineUsed())
                .header("X-Compilation-Time-Ms", String.valueOf(result.durationMs()))
                .body(result.pdfBytes());
    }

    @PostMapping(value = "/latex/json", produces = MediaType.APPLICATION_JSON_VALUE)
    @Operation(summary = "Biên dịch LaTeX trả về JSON", description = "Trả về chuỗi PDF Base64 cùng đầy đủ nhật ký biên dịch và thời gian thực thi")
    public ResponseEntity<CompileJsonResponse> compileToJson(@Valid @RequestBody CompileLatexRequest request) {
        CompilationResult result = compilerService.compile(request);

        String base64Pdf = Base64.getEncoder().encodeToString(result.pdfBytes());

        CompileJsonResponse response = new CompileJsonResponse(
                true,
                base64Pdf,
                result.engineUsed(),
                result.durationMs(),
                result.pdfBytes().length,
                result.stdoutLog(),
                result.stderrLog()
        );

        return ResponseEntity.ok(response);
    }

    @PostMapping(value = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE, produces = MediaType.APPLICATION_PDF_VALUE)
    @Operation(summary = "Tải file .tex lên để biên dịch", description = "Nhận file .tex được tải lên từ client và trả về file PDF đã biên dịch")
    public ResponseEntity<byte[]> compileUploadedFile(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "engine", defaultValue = "auto") String engine) {

        try {
            String content = new String(file.getBytes(), StandardCharsets.UTF_8);
            String originalName = file.getOriginalFilename() != null ? file.getOriginalFilename() : "document.tex";
            String jobName = originalName.replaceAll("\\.tex$", "");

            CompileLatexRequest request = new CompileLatexRequest(content);
            request.setEngine(engine);
            request.setJobName(jobName);

            return compileToPdf(request);
        } catch (Exception e) {
            throw new RuntimeException("Lỗi đọc file tải lên: " + e.getMessage(), e);
        }
    }

    private CompileJobStatusResponse toStatusResponse(CompileJob job) {
        CompileJobStatusResponse response = new CompileJobStatusResponse();
        response.setJobId(job.getJobId());
        response.setStatus(job.getStatus());
        response.setHash(job.getHash());
        response.setFromCache(job.isFromCache());
        response.setDownloadUrl("/api/v1/compile/" + job.getJobId() + "/pdf");
        response.setDurationMs(job.getDurationMs());
        response.setLogs(job.getLogs());
        response.setError(job.getError());
        return response;
    }
}
