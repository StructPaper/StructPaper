package vn.edu.vnu.structpaper.compile;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.io.File;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;
import java.util.Map;

import static org.hamcrest.Matchers.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
public class CompileQueueTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private CompileQueueManager queueManager;

    @Autowired
    private CompileCacheService cacheService;

    @Test
    @DisplayName("Hàng đợi tự động hủy job cũ khi có job mới cho cùng paperId")
    void testQueueCancelsOldJobWhenNewJobSubmittedForSamePaperId() throws Exception {
        String paperId = "paper-queue-replace-test";

        // Job 1 với độ trễ để nó đang chạy trong hàng đợi
        CompileJobRequest req1 = new CompileJobRequest();
        req1.setTex("\\documentclass{article}\\begin{document}Job 1 running\\end{document}");
        req1.setPaperId(paperId);
        req1.setEngine("mock");
        req1.setOptions(Map.of("delayMs", 1500));

        MvcResult result1 = mockMvc.perform(post("/api/v1/compile")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req1)))
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.jobId", notNullValue()))
                .andExpect(jsonPath("$.status", anyOf(is("QUEUED"), is("RUNNING"))))
                .andReturn();

        String jobId1 = objectMapper.readTree(result1.getResponse().getContentAsString()).get("jobId").asText();

        // Chờ ngắn để job 1 chuyển sang RUNNING
        Thread.sleep(100);

        // Job 2 cho cùng paperId
        CompileJobRequest req2 = new CompileJobRequest();
        req2.setTex("\\documentclass{article}\\begin{document}Job 2 superseded\\end{document}");
        req2.setPaperId(paperId);
        req2.setEngine("mock");
        req2.setOptions(Map.of("delayMs", 200));

        MvcResult result2 = mockMvc.perform(post("/api/v1/compile")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req2)))
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.jobId", not(is(jobId1))))
                .andReturn();

        String jobId2 = objectMapper.readTree(result2.getResponse().getContentAsString()).get("jobId").asText();

        // Kiểm tra ngay Job 1 đã bị đánh dấu CANCELLED
        mockMvc.perform(get("/api/v1/compile/" + jobId1))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status", is("CANCELLED")));

        // Chờ Job 2 hoàn thành
        Thread.sleep(400);

        mockMvc.perform(get("/api/v1/compile/" + jobId2))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status", is("SUCCESS")));
    }

    @Test
    @DisplayName("Cache trả về kết quả tức thì (HTTP 200 OK, fromCache: true) khi trùng hash")
    void testCacheReturnsInstantResultOnMatchingHash() throws Exception {
        String uniqueTex = "\\documentclass{article}\\begin{document}Cache Test " + System.nanoTime() + "\\end{document}";

        CompileJobRequest req = new CompileJobRequest();
        req.setTex(uniqueTex);
        req.setPaperId("paper-cache-test");
        req.setEngine("mock");
        req.setAssets(List.of("dummy-asset-hash-12345"));

        // Lần 1: Chưa có trong cache, trả về 202 Accepted
        MvcResult res1 = mockMvc.perform(post("/api/v1/compile")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.fromCache", is(false)))
                .andReturn();

        String jobId1 = objectMapper.readTree(res1.getResponse().getContentAsString()).get("jobId").asText();

        // Chờ job 1 hoàn thành để nạp vào cache
        boolean completed = false;
        for (int i = 0; i < 20; i++) {
            Thread.sleep(100);
            MvcResult check = mockMvc.perform(get("/api/v1/compile/" + jobId1)).andReturn();
            String st = objectMapper.readTree(check.getResponse().getContentAsString()).get("status").asText();
            if ("SUCCESS".equals(st)) {
                completed = true;
                break;
            }
        }
        assertTrue(completed, "Job 1 phải hoàn thành thành công trước khi test cache");

        // Lần 2: Request giống hệt -> Trả về 200 OK ngay lập tức với fromCache = true
        mockMvc.perform(post("/api/v1/compile")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status", is("SUCCESS")))
                .andExpect(jsonPath("$.fromCache", is(true)))
                .andExpect(jsonPath("$.cached", is(true)))
                .andExpect(jsonPath("$.downloadUrl", containsString("/pdf")))
                .andExpect(jsonPath("$.hash", notNullValue()));
    }

    @Test
    @DisplayName("Hủy job thủ công qua DELETE request")
    void testManualJobCancellationViaDelete() throws Exception {
        CompileJobRequest req = new CompileJobRequest();
        req.setTex("\\documentclass{article}\\begin{document}Manual Cancel Test " + System.nanoTime() + "\\end{document}");
        req.setPaperId("paper-manual-cancel");
        req.setEngine("mock");
        req.setOptions(Map.of("delayMs", 2500));

        MvcResult submitResult = mockMvc.perform(post("/api/v1/compile")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isAccepted())
                .andReturn();

        String jobId = objectMapper.readTree(submitResult.getResponse().getContentAsString()).get("jobId").asText();

        // Gửi lệnh hủy DELETE /api/v1/compile/{jobId}
        mockMvc.perform(delete("/api/v1/compile/" + jobId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.jobId", is(jobId)))
                .andExpect(jsonPath("$.status", is("CANCELLED")));

        // Kiểm tra lại trạng thái qua GET /api/v1/compile/{jobId}
        mockMvc.perform(get("/api/v1/compile/" + jobId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status", is("CANCELLED")));

        // Hủy job không tồn tại trả về 404
        mockMvc.perform(delete("/api/v1/compile/non-existent-job-id"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code", is("NOT_FOUND")));
    }

    @Test
    @DisplayName("Xử lý lỗi cú pháp TeX và ghi nhận status FAILED với log lỗi")
    void testSyntaxErrorHandling() throws Exception {
        CompileJobRequest req = new CompileJobRequest();
        req.setTex("\\documentclass{article}\\begin{document}\\syntaxerror\\end{document}");
        req.setPaperId("paper-syntax-error");
        req.setEngine("mock");

        MvcResult submitResult = mockMvc.perform(post("/api/v1/compile")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isAccepted())
                .andReturn();

        String jobId = objectMapper.readTree(submitResult.getResponse().getContentAsString()).get("jobId").asText();

        // Chờ job hoàn thành thất bại
        boolean failed = false;
        JsonNode statusNode = null;
        for (int i = 0; i < 20; i++) {
            Thread.sleep(100);
            MvcResult check = mockMvc.perform(get("/api/v1/compile/" + jobId)).andReturn();
            statusNode = objectMapper.readTree(check.getResponse().getContentAsString());
            String st = statusNode.get("status").asText();
            if ("FAILED".equals(st)) {
                failed = true;
                break;
            }
        }

        assertTrue(failed, "Job có lỗi cú pháp phải chuyển sang trạng thái FAILED");
        assertNotNull(statusNode);
        assertTrue(statusNode.has("error") && !statusNode.get("error").isNull());
        assertTrue(statusNode.get("error").asText().contains("syntaxerror"));
        assertTrue(statusNode.has("logs") && statusNode.get("logs").size() > 0);
    }

    @Test
    @DisplayName("Xử lý timeout khi biên dịch vượt quá giới hạn thời gian")
    void testTimeoutHandling() throws Exception {
        CompileJobRequest req = new CompileJobRequest();
        req.setTex("\\documentclass{article}\\begin{document}\\simulateTimeout\\end{document}");
        req.setPaperId("paper-timeout-test");
        req.setEngine("mock");
        req.setOptions(Map.of(
                "timeoutSeconds", 1,
                "delayMs", 2000
        ));

        MvcResult submitResult = mockMvc.perform(post("/api/v1/compile")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isAccepted())
                .andReturn();

        String jobId = objectMapper.readTree(submitResult.getResponse().getContentAsString()).get("jobId").asText();

        // Chờ quá thời gian timeout
        boolean failed = false;
        JsonNode statusNode = null;
        for (int i = 0; i < 30; i++) {
            Thread.sleep(100);
            MvcResult check = mockMvc.perform(get("/api/v1/compile/" + jobId)).andReturn();
            statusNode = objectMapper.readTree(check.getResponse().getContentAsString());
            String st = statusNode.get("status").asText();
            if ("FAILED".equals(st)) {
                failed = true;
                break;
            }
        }

        assertTrue(failed, "Job quá thời gian phải chuyển sang trạng thái FAILED");
        assertNotNull(statusNode);
        assertTrue(statusNode.get("error").asText().contains("Timeout") || statusNode.get("error").asText().contains("thời gian"));
    }

    @Test
    @DisplayName("Tải file PDF kết quả thành công và trả về 404 nếu chưa sẵn sàng")
    void testDownloadPdfEndpoint() throws Exception {
        CompileJobRequest req = new CompileJobRequest();
        req.setTex("\\documentclass{article}\\begin{document}Download PDF Test " + System.nanoTime() + "\\end{document}");
        req.setPaperId("paper-download-pdf");
        req.setEngine("mock");

        MvcResult submitResult = mockMvc.perform(post("/api/v1/compile")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isAccepted())
                .andReturn();

        String jobId = objectMapper.readTree(submitResult.getResponse().getContentAsString()).get("jobId").asText();

        // Chờ hoàn thành
        for (int i = 0; i < 20; i++) {
            Thread.sleep(100);
            MvcResult check = mockMvc.perform(get("/api/v1/compile/" + jobId)).andReturn();
            if ("SUCCESS".equals(objectMapper.readTree(check.getResponse().getContentAsString()).get("status").asText())) {
                break;
            }
        }

        // Tải PDF thành công
        byte[] pdfBytes = mockMvc.perform(get("/api/v1/compile/" + jobId + "/pdf"))
                .andExpect(status().isOk())
                .andExpect(content().contentType(MediaType.APPLICATION_PDF))
                .andExpect(header().string("X-Compile-Job-Id", jobId))
                .andReturn().getResponse().getContentAsByteArray();

        assertTrue(pdfBytes.length > 0);
        assertTrue(new String(pdfBytes).startsWith("%PDF"));

        // Thử tải PDF của job không tồn tại -> 404
        mockMvc.perform(get("/api/v1/compile/non-existent-pdf/pdf"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code", is("NOT_FOUND")));
    }

    @Test
    @DisplayName("Tự động dọn dẹp thư mục tạm sandbox sau khi biên dịch xong")
    void testTempSandboxDirectoryCleanedUp() throws Exception {
        CompileJobRequest req = new CompileJobRequest();
        req.setTex("\\documentclass{article}\\begin{document}Cleanup Test\\end{document}");
        req.setPaperId("paper-cleanup-test");
        req.setEngine("mock");

        MvcResult submitResult = mockMvc.perform(post("/api/v1/compile")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isAccepted())
                .andReturn();

        String jobId = objectMapper.readTree(submitResult.getResponse().getContentAsString()).get("jobId").asText();

        // Chờ job hoàn thành
        for (int i = 0; i < 20; i++) {
            Thread.sleep(100);
            MvcResult check = mockMvc.perform(get("/api/v1/compile/" + jobId)).andReturn();
            if ("SUCCESS".equals(objectMapper.readTree(check.getResponse().getContentAsString()).get("status").asText())) {
                break;
            }
        }

        // Kiểm tra thư mục tạm java.io.tmpdir/structpaper-jobs/<jobId> không còn tồn tại
        Path jobDir = Paths.get(System.getProperty("java.io.tmpdir"), "structpaper-jobs", jobId);
        assertFalse(jobDir.toFile().exists(), "Thư mục tạm sandbox của job phải được tự động dọn dẹp");
    }
}
