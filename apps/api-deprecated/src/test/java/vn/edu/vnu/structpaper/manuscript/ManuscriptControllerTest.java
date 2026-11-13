package vn.edu.vnu.structpaper.manuscript;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import vn.edu.vnu.structpaper.asset.AssetService;

import java.nio.charset.StandardCharsets;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.is;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.head;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class ManuscriptControllerTest {

    @Autowired
    private MockMvc mockMvc;

    private static final String MANUSCRIPT_ID = "01ARZ3NDEKTSV4RRFFQ69G5FAV";

    private static final String INITIAL_DOC_JSON = """
            {
              "id": "01ARZ3NDEKTSV4RRFFQ69G5FAV",
              "schemaVersion": 2,
              "title": "A Benchmark Study of StructPaper Modular Monolith",
              "journalId": "vnu-tcb",
              "authors": [
                {
                  "name": "Nguyen Van A",
                  "affiliations": ["VNU University of Engineering and Technology"]
                }
              ],
              "blocks": [
                {
                  "id": "blk-1",
                  "kind": "paragraph",
                  "inlines": [
                    {
                      "t": "text",
                      "v": "This is an automated test manuscript for Spring Boot OpenAPI Gate 2."
                    }
                  ]
                }
              ]
            }
            """;

    private static final String UPDATED_DOC_JSON = """
            {
              "id": "01ARZ3NDEKTSV4RRFFQ69G5FAV",
              "schemaVersion": 2,
              "title": "A Benchmark Study of StructPaper Modular Monolith - Updated Title",
              "journalId": "vnu-tcb",
              "authors": [
                {
                  "name": "Nguyen Van A",
                  "affiliations": ["VNU University of Engineering and Technology"]
                }
              ],
              "blocks": [
                {
                  "id": "blk-1",
                  "kind": "paragraph",
                  "inlines": [
                    {
                      "t": "text",
                      "v": "Updated content with second revision."
                    }
                  ]
                }
              ]
            }
            """;

    @Test
    @Order(1)
    @DisplayName("PUT /api/v1/manuscripts/{id} - Tạo manuscript mới với If-Match: 0 hoặc 1")
    void testCreateManuscript() throws Exception {
        mockMvc.perform(put("/api/v1/manuscripts/" + MANUSCRIPT_ID)
                        .header("If-Match", "0")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(INITIAL_DOC_JSON))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.ETAG, "\"1\""))
                .andExpect(jsonPath("$.id", is(MANUSCRIPT_ID)))
                .andExpect(jsonPath("$.rev", is(1)))
                .andExpect(jsonPath("$.updatedAt").isNotEmpty());
    }

    @Test
    @Order(2)
    @DisplayName("GET /api/v1/manuscripts/{id} - Đọc manuscript và kiểm tra ETag rev")
    void testGetManuscript() throws Exception {
        mockMvc.perform(get("/api/v1/manuscripts/" + MANUSCRIPT_ID))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.ETAG, "\"1\""))
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.id", is(MANUSCRIPT_ID)))
                .andExpect(jsonPath("$.title", is("A Benchmark Study of StructPaper Modular Monolith")));
    }

    @Test
    @Order(3)
    @DisplayName("PUT /api/v1/manuscripts/{id} - Cập nhật manuscript với If-Match đúng, rev tăng +1")
    void testUpdateManuscriptSuccess() throws Exception {
        mockMvc.perform(put("/api/v1/manuscripts/" + MANUSCRIPT_ID)
                        .header("If-Match", "\"1\"")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(UPDATED_DOC_JSON))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.ETAG, "\"2\""))
                .andExpect(jsonPath("$.id", is(MANUSCRIPT_ID)))
                .andExpect(jsonPath("$.rev", is(2)))
                .andExpect(jsonPath("$.updatedAt").isNotEmpty());
    }

    @Test
    @Order(4)
    @DisplayName("PUT /api/v1/manuscripts/{id} - Chặn 412 Precondition Failed khi rev không khớp")
    void testUpdateManuscriptConflict412() throws Exception {
        // Gửi If-Match: 1 trong khi phiên bản hiện tại đã là 2
        mockMvc.perform(put("/api/v1/manuscripts/" + MANUSCRIPT_ID)
                        .header("If-Match", "1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(UPDATED_DOC_JSON))
                .andExpect(status().isPreconditionFailed())
                .andExpect(jsonPath("$.code", is("PRECONDITION_FAILED")))
                .andExpect(jsonPath("$.message", containsString("Revision conflict")));
    }

    @Test
    @Order(5)
    @DisplayName("GET /api/v1/manuscripts/{id} - Kiểm tra 404 khi manuscript không tồn tại")
    void testGetNonExistentManuscript() throws Exception {
        mockMvc.perform(get("/api/v1/manuscripts/01HNOTFOUND00000000000000"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code", is("NOT_FOUND")));
    }

    @Test
    @Order(6)
    @DisplayName("GET /api/v1/manuscripts/{id}/revisions - Lấy danh sách lịch sử phiên bản")
    void testGetManuscriptRevisions() throws Exception {
        mockMvc.perform(get("/api/v1/manuscripts/" + MANUSCRIPT_ID + "/revisions"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(2)))
                .andExpect(jsonPath("$[0].rev", is(2)))
                .andExpect(jsonPath("$[0].timestamp").isNotEmpty())
                .andExpect(jsonPath("$[0].createdAt").isNotEmpty())
                .andExpect(jsonPath("$[1].rev", is(1)))
                .andExpect(jsonPath("$[1].timestamp").isNotEmpty());
    }

    @Test
    @Order(7)
    @DisplayName("Asset CAS: PUT, HEAD, GET asset theo SHA-256")
    void testAssetOperations() throws Exception {
        byte[] payload = "Hello StructPaper CAS Asset Storage Content 123456789".getBytes(StandardCharsets.UTF_8);
        String sha256 = AssetService.calculateSha256(payload);

        // 1. Kiểm tra HEAD ban đầu: 404
        mockMvc.perform(head("/api/v1/assets/" + sha256))
                .andExpect(status().isNotFound());

        // 2. Tải lên PUT asset lần đầu: 201 Created
        mockMvc.perform(put("/api/v1/assets/" + sha256)
                        .contentType("image/png")
                        .content(payload))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.sha256", is(sha256)))
                .andExpect(jsonPath("$.sizeBytes", is(payload.length)))
                .andExpect(jsonPath("$.mimeType", is("image/png")));

        // 3. Tải lên lại (deduplication): 200 OK
        mockMvc.perform(put("/api/v1/assets/" + sha256)
                        .contentType("image/png")
                        .content(payload))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.sha256", is(sha256)))
                .andExpect(jsonPath("$.sizeBytes", is(payload.length)));

        // 4. Kiểm tra HEAD: 200 OK cùng Content-Length, Content-Type, ETag
        mockMvc.perform(head("/api/v1/assets/" + sha256))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.CONTENT_LENGTH, String.valueOf(payload.length)))
                .andExpect(header().string(HttpHeaders.CONTENT_TYPE, "image/png"))
                .andExpect(header().string(HttpHeaders.ETAG, "\"" + sha256 + "\""));

        // 5. GET tải về dữ liệu nhị phân: 200 OK
        mockMvc.perform(get("/api/v1/assets/" + sha256))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.CONTENT_TYPE, "image/png"))
                .andExpect(header().string(HttpHeaders.ETAG, "\"" + sha256 + "\""))
                .andExpect(content().bytes(payload));
    }

    @Test
    @Order(8)
    @DisplayName("Asset CAS: PUT với mã băm SHA-256 sai lệch trả về 400 Bad Request")
    void testAssetSha256Mismatch() throws Exception {
        byte[] payload = "Mismatched content bytes".getBytes(StandardCharsets.UTF_8);
        String fakeSha256 = "0000000000000000000000000000000000000000000000000000000000000000";

        mockMvc.perform(put("/api/v1/assets/" + fakeSha256)
                        .contentType(MediaType.APPLICATION_OCTET_STREAM)
                        .content(payload))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code", is("DIGEST_MISMATCH")))
                .andExpect(jsonPath("$.message", containsString("không khớp")));
    }
}
