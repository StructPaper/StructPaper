package vn.edu.vnu.structpaper.batch;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import vn.edu.vnu.structpaper.manuscript.ManuscriptService;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

import static org.hamcrest.Matchers.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
public class BatchIngestTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private ManuscriptService manuscriptService;

    @Test
    @DisplayName("POST /api/v1/batches và GET /api/v1/batches/{batchId} - Xử lý thành công 3 tệp DOCX hợp lệ")
    void testSubmitBatchSuccessful() throws Exception {
        byte[] docx1 = createMockDocx("Deep Learning for Natural Language Processing", "Nguyen Van A", "First paragraph of deep learning paper.");
        byte[] docx2 = createMockDocx("Microbiome and Human Health Research", "Tran Thi B", "First paragraph of microbiome paper.");
        byte[] docx3 = createMockDocx("Quantum Computing in Cryptography", "Le Van C", "First paragraph of quantum cryptography paper.");

        Map<String, byte[]> files = new LinkedHashMap<>();
        files.put("paper1.docx", docx1);
        files.put("paper2.docx", docx2);
        files.put("paper3.docx", docx3);

        byte[] zipBytes = createMockZip(files);
        MockMultipartFile file = new MockMultipartFile("file", "papers.zip", "application/zip", zipBytes);

        // 1. Submit Batch
        MvcResult submitResult = mockMvc.perform(multipart("/api/v1/batches")
                        .file(file)
                        .param("journalId", "vnu-tcb"))
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.batchId").isNotEmpty())
                .andExpect(jsonPath("$.totalFiles", is(3)))
                .andExpect(jsonPath("$.fileCount", is(3)))
                .andExpect(jsonPath("$.status", is("PENDING")))
                .andExpect(jsonPath("$.createdAt").isNotEmpty())
                .andReturn();

        JsonNode submitNode = objectMapper.readTree(submitResult.getResponse().getContentAsString());
        String batchId = submitNode.get("batchId").asText();

        // 2. Poll tiến độ batch đến khi COMPLETED
        JsonNode statusNode = waitForBatchCompletion(batchId, 10000);

        assertEquals("COMPLETED", statusNode.get("status").asText());
        assertEquals(3, statusNode.get("totalFiles").asInt());
        assertEquals(3, statusNode.get("processedFiles").asInt());
        assertEquals(3, statusNode.get("successfulFiles").asInt());
        assertEquals(0, statusNode.get("failedFiles").asInt());
        assertEquals(100, statusNode.get("progressPercent").asInt());
        assertNotNull(statusNode.get("completedAt"));

        JsonNode items = statusNode.get("items");
        assertEquals(3, items.size());

        for (JsonNode item : items) {
            assertEquals("SUCCESS", item.get("status").asText());
            assertNotNull(item.get("manuscriptId"));
            assertNotNull(item.get("title"));
            assertTrue(item.get("durationMs").asLong() >= 0);
            assertTrue(item.path("error").isMissingNode() || item.get("error").isNull());

            // 3. Kiểm tra bản ghi Manuscript đã được lưu vào database và có thể truy vấn
            String manuscriptId = item.get("manuscriptId").asText();
            mockMvc.perform(get("/api/v1/manuscripts/" + manuscriptId))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.id", is(manuscriptId)))
                    .andExpect(jsonPath("$.journalId", is("vnu-tcb")));
        }

        // 4. GET /api/v1/batches/{batchId}/report
        mockMvc.perform(get("/api/v1/batches/" + batchId + "/report"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.batchId", is(batchId)))
                .andExpect(jsonPath("$.status", is("COMPLETED")))
                .andExpect(jsonPath("$.totalFiles", is(3)))
                .andExpect(jsonPath("$.successfulFiles", is(3)))
                .andExpect(jsonPath("$.failedFiles", is(0)))
                .andExpect(jsonPath("$.progressPercent", is(100)))
                .andExpect(jsonPath("$.summary.successRate", is(100.0)))
                .andExpect(jsonPath("$.summary.averageDurationMs").isNumber())
                .andExpect(jsonPath("$.items", hasSize(3)));
    }

    @Test
    @DisplayName("POST /api/v1/batches - Xử lý tệp ZIP chứa tệp DOCX hỏng và hợp lệ (không crash batch)")
    void testSubmitBatchWithCorruptAndValidDocx() throws Exception {
        byte[] validDocx1 = createMockDocx("Valid Paper Alpha", "Author Alpha", "Valid text content.");
        byte[] corruptDocx = "This is completely corrupt non-zip binary content".getBytes(StandardCharsets.UTF_8);
        byte[] validDocx2 = createMockDocx("Valid Paper Beta", "Author Beta", "Valid text content beta.");

        Map<String, byte[]> files = new LinkedHashMap<>();
        files.put("alpha.docx", validDocx1);
        files.put("corrupt.docx", corruptDocx);
        files.put("beta.docx", validDocx2);

        byte[] zipBytes = createMockZip(files);
        MockMultipartFile file = new MockMultipartFile("file", "mixed.zip", "application/zip", zipBytes);

        MvcResult submitResult = mockMvc.perform(multipart("/api/v1/batches")
                        .file(file)
                        .param("journalId", "vnu-js"))
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.totalFiles", is(3)))
                .andReturn();

        String batchId = objectMapper.readTree(submitResult.getResponse().getContentAsString()).get("batchId").asText();

        // Chờ xử lý hoàn tất
        JsonNode statusNode = waitForBatchCompletion(batchId, 10000);

        assertEquals("COMPLETED", statusNode.get("status").asText());
        assertEquals(3, statusNode.get("totalFiles").asInt());
        assertEquals(3, statusNode.get("processedFiles").asInt());
        assertEquals(2, statusNode.get("successfulFiles").asInt());
        assertEquals(1, statusNode.get("failedFiles").asInt());
        assertEquals(100, statusNode.get("progressPercent").asInt());

        JsonNode items = statusNode.get("items");
        JsonNode corruptItem = null;
        for (JsonNode it : items) {
            if ("corrupt.docx".equals(it.get("fileName").asText())) {
                corruptItem = it;
            }
        }

        assertNotNull(corruptItem, "Phải tìm thấy item corrupt.docx");
        assertEquals("FAILED", corruptItem.get("status").asText());
        assertNotNull(corruptItem.get("error"));
        assertTrue(corruptItem.path("manuscriptId").isMissingNode() || corruptItem.get("manuscriptId").isNull());

        // Kiểm tra báo cáo tổng hợp
        mockMvc.perform(get("/api/v1/batches/" + batchId + "/report"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.successfulFiles", is(2)))
                .andExpect(jsonPath("$.failedFiles", is(1)))
                .andExpect(jsonPath("$.summary.successRate", is(66.7)));
    }

    @Test
    @DisplayName("POST /api/v1/batches - Chặn tệp ZIP rỗng hoặc không chứa file DOCX hợp lệ")
    void testSubmitEmptyOrInvalidZip() throws Exception {
        // 1. Tệp rỗng
        MockMultipartFile emptyFile = new MockMultipartFile("file", "empty.zip", "application/zip", new byte[0]);
        mockMvc.perform(multipart("/api/v1/batches").file(emptyFile))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.details", containsString("rỗng")));

        // 2. Tệp không phải ZIP
        MockMultipartFile textFile = new MockMultipartFile("file", "not-a-zip.txt", "text/plain", "hello plain text".getBytes(StandardCharsets.UTF_8));
        mockMvc.perform(multipart("/api/v1/batches").file(textFile))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code", is("INVALID_ARCHIVE")));

        // 3. ZIP không chứa DOCX nào (chỉ chứa .txt hoặc .pdf)
        Map<String, byte[]> noDocx = Map.of("readme.txt", "Some text".getBytes(StandardCharsets.UTF_8));
        MockMultipartFile zipWithoutDocx = new MockMultipartFile("file", "no-docx.zip", "application/zip", createMockZip(noDocx));
        mockMvc.perform(multipart("/api/v1/batches").file(zipWithoutDocx))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code", is("INVALID_ARCHIVE")))
                .andExpect(jsonPath("$.details", containsString("không chứa bất kỳ tài liệu DOCX")));
    }

    @Test
    @DisplayName("POST /api/v1/batches - Bỏ qua các tệp ẩn macOS (__MACOSX, .DS_Store)")
    void testFilterMacOsArtifacts() throws Exception {
        byte[] docx = createMockDocx("Clean Mac Paper", "Mac User", "Content tested on macOS.");
        byte[] macJunk = "Mac resource fork data".getBytes(StandardCharsets.UTF_8);

        Map<String, byte[]> files = new LinkedHashMap<>();
        files.put("paper.docx", docx);
        files.put("__MACOSX/._paper.docx", macJunk);
        files.put(".DS_Store", macJunk);

        MockMultipartFile file = new MockMultipartFile("file", "mac_archive.zip", "application/zip", createMockZip(files));

        MvcResult result = mockMvc.perform(multipart("/api/v1/batches").file(file))
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.totalFiles", is(1)))
                .andReturn();

        String batchId = objectMapper.readTree(result.getResponse().getContentAsString()).get("batchId").asText();
        JsonNode statusNode = waitForBatchCompletion(batchId, 8000);

        assertEquals("COMPLETED", statusNode.get("status").asText());
        assertEquals(1, statusNode.get("totalFiles").asInt());
        assertEquals(1, statusNode.get("successfulFiles").asInt());
        assertEquals(1, statusNode.get("items").size());
        assertEquals("paper.docx", statusNode.get("items").get(0).get("fileName").asText());
    }

    @Test
    @DisplayName("GET /api/v1/batches/{batchId} - Trả về 404 khi không tìm thấy batch ID")
    void testGetNonExistentBatch() throws Exception {
        mockMvc.perform(get("/api/v1/batches/01NONEXISTENTBATCHID0000000"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code", is("NOT_FOUND")));

        mockMvc.perform(get("/api/v1/batches/01NONEXISTENTBATCHID0000000/report"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code", is("NOT_FOUND")));
    }

    private JsonNode waitForBatchCompletion(String batchId, long timeoutMs) throws Exception {
        long start = System.currentTimeMillis();
        while (System.currentTimeMillis() - start < timeoutMs) {
            MvcResult res = mockMvc.perform(get("/api/v1/batches/" + batchId)).andReturn();
            JsonNode node = objectMapper.readTree(res.getResponse().getContentAsString());
            String status = node.get("status").asText();
            if ("COMPLETED".equals(status) || "FAILED".equals(status)) {
                return node;
            }
            Thread.sleep(100);
        }
        throw new AssertionError("Batch " + batchId + " không hoàn tất sau " + timeoutMs + "ms");
    }

    private byte[] createMockZip(Map<String, byte[]> files) throws IOException {
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        try (ZipOutputStream zos = new ZipOutputStream(baos)) {
            for (Map.Entry<String, byte[]> entry : files.entrySet()) {
                ZipEntry ze = new ZipEntry(entry.getKey());
                zos.putNextEntry(ze);
                zos.write(entry.getValue());
                zos.closeEntry();
            }
        }
        return baos.toByteArray();
    }

    private byte[] createMockDocx(String title, String author, String paragraphText) throws IOException {
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        try (ZipOutputStream zos = new ZipOutputStream(baos)) {
            // 1. [Content_Types].xml
            zos.putNextEntry(new ZipEntry("[Content_Types].xml"));
            zos.write("""
                    <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
                    <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
                      <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
                      <Default Extension="xml" ContentType="application/xml"/>
                      <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
                    </Types>
                    """.getBytes(StandardCharsets.UTF_8));
            zos.closeEntry();

            // 2. docProps/core.xml
            zos.putNextEntry(new ZipEntry("docProps/core.xml"));
            String coreXml = String.format("""
                    <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
                    <cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties"
                                       xmlns:dc="http://purl.org/dc/elements/1.1/">
                      <dc:title>%s</dc:title>
                      <dc:creator>%s</dc:creator>
                    </cp:coreProperties>
                    """, escapeXml(title), escapeXml(author));
            zos.write(coreXml.getBytes(StandardCharsets.UTF_8));
            zos.closeEntry();

            // 3. word/document.xml
            zos.putNextEntry(new ZipEntry("word/document.xml"));
            String docXml = String.format("""
                    <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
                    <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
                      <w:body>
                        <w:p>
                          <w:r>
                            <w:t>%s</w:t>
                          </w:r>
                        </w:p>
                      </w:body>
                    </w:document>
                    """, escapeXml(paragraphText));
            zos.write(docXml.getBytes(StandardCharsets.UTF_8));
            zos.closeEntry();
        }
        return baos.toByteArray();
    }

    private static String escapeXml(String s) {
        if (s == null) return "";
        return s.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&apos;");
    }
}
