package vn.edu.vnu.structpaper.document;

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

import java.nio.charset.StandardCharsets;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.not;
import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class DocumentControllerTest {

    @Autowired
    private MockMvc mockMvc;
    @Autowired
    private ObjectMapper mapper;

    private String createDoc(String name) throws Exception {
        MvcResult r = mockMvc.perform(post("/api/v1/documents")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"" + name + "\",\"journalId\":\"VNUHCM-HS\",\"doc\":{\"metadata\":{\"title\":\"T\"}}}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name", is(name)))
                .andExpect(jsonPath("$.rev", is(1)))
                .andReturn();
        JsonNode n = mapper.readTree(r.getResponse().getContentAsString(StandardCharsets.UTF_8));
        return n.get("id").asText();
    }

    @Test
    @DisplayName("Tạo tài liệu có tên, mở lại đúng nội dung, hiện trong danh sách Open")
    void createOpenList() throws Exception {
        String id = createDoc("Bài báo SDGs");

        mockMvc.perform(get("/api/v1/documents/" + id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.doc.metadata.title", is("T")));

        mockMvc.perform(get("/api/v1/documents"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[*].id", hasItem(id)))
                // list view never carries the heavy content
                .andExpect(jsonPath("$[0].doc").doesNotExist());
    }

    @Test
    @DisplayName("Tên trống bị từ chối 400")
    void blankNameRejected() throws Exception {
        mockMvc.perform(post("/api/v1/documents")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"   \"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("Tự động lưu tăng rev, đổi tên, và khóa lạc quan trả 412 khi xung đột")
    void autosaveAndConflict() throws Exception {
        String id = createDoc("Draft");

        mockMvc.perform(put("/api/v1/documents/" + id)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Bản mới\",\"baseRev\":1,\"doc\":{\"metadata\":{\"title\":\"Đã sửa\"}}}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.rev", is(2)))
                .andExpect(jsonPath("$.name", is("Bản mới")));

        // stale client (still on rev 1) must not overwrite
        mockMvc.perform(put("/api/v1/documents/" + id)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"baseRev\":1,\"doc\":{\"metadata\":{\"title\":\"Ghi đè\"}}}"))
                .andExpect(status().isPreconditionFailed());

        mockMvc.perform(get("/api/v1/documents/" + id))
                .andExpect(jsonPath("$.doc.metadata.title", is("Đã sửa")));
    }

    @Test
    @DisplayName("PUT lên id chưa tồn tại tạo mới (đồng bộ tài liệu offline)")
    void upsertCreates() throws Exception {
        mockMvc.perform(put("/api/v1/documents/offline_doc-1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Tạo offline\",\"doc\":{\"a\":1}}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.rev", is(1)));
        mockMvc.perform(get("/api/v1/documents/offline_doc-1")).andExpect(status().isOk());
    }

    @Test
    @DisplayName("Id có ký tự path traversal bị từ chối")
    void rejectsBadId() throws Exception {
        mockMvc.perform(put("/api/v1/documents/a.b")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"x\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("Lưu có snapshot ghi tệp vào object storage")
    void snapshotWritten() throws Exception {
        String id = createDoc("Snap");
        mockMvc.perform(put("/api/v1/documents/" + id)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"snapshot\":true,\"doc\":{\"x\":1}}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.snapshotted", is(true)));
    }

    @Test
    @DisplayName("Xóa mềm: biến mất khỏi danh sách và mở trả 404")
    void softDelete() throws Exception {
        String id = createDoc("Xóa tôi");
        mockMvc.perform(delete("/api/v1/documents/" + id)).andExpect(status().isNoContent());
        mockMvc.perform(get("/api/v1/documents/" + id)).andExpect(status().isNotFound());
        mockMvc.perform(get("/api/v1/documents")).andExpect(jsonPath("$[*].id", not(hasItem(id))));
    }

    @Test
    @DisplayName("Lưu và tải lại bản xuất XML; từ chối định dạng lạ")
    void exports() throws Exception {
        String id = createDoc("Export");
        byte[] xml = "<?xml version=\"1.0\"?><article/>".getBytes(StandardCharsets.UTF_8);

        MvcResult r = mockMvc.perform(multipart("/api/v1/documents/" + id + "/exports")
                        .file(new MockMultipartFile("file", "a.xml", "application/xml", xml))
                        .param("format", "xml")
                        .param("fileName", "Bài báo.xml"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.format", is("xml")))
                .andReturn();
        String exportId = mapper.readTree(r.getResponse().getContentAsString(StandardCharsets.UTF_8)).get("id").asText();

        mockMvc.perform(get("/api/v1/documents/" + id + "/exports"))
                .andExpect(jsonPath("$[0].id", is(exportId)));

        MvcResult dl = mockMvc.perform(get("/api/v1/documents/" + id + "/exports/" + exportId))
                .andExpect(status().isOk())
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.header()
                        .string("Content-Disposition", containsString("attachment")))
                .andReturn();
        assertArrayEquals(xml, dl.getResponse().getContentAsByteArray());

        mockMvc.perform(multipart("/api/v1/documents/" + id + "/exports")
                        .file(new MockMultipartFile("file", "a.exe", "application/octet-stream", new byte[]{1}))
                        .param("format", "exe"))
                .andExpect(status().isBadRequest());
    }
}
