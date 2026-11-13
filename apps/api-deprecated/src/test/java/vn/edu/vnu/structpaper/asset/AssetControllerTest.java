package vn.edu.vnu.structpaper.asset;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.nio.charset.StandardCharsets;

import static org.hamcrest.Matchers.containsString;
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
public class AssetControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    @DisplayName("HEAD trả về 404 cho asset chưa tồn tại")
    void testHeadNotFound() throws Exception {
        mockMvc.perform(head("/api/v1/assets/e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("GET trả về 404 cho asset chưa tồn tại")
    void testGetNotFound() throws Exception {
        mockMvc.perform(get("/api/v1/assets/e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code", is("NOT_FOUND")));
    }

    @Test
    @DisplayName("Quy trình đầy đủ Asset: PUT -> HEAD -> GET -> PUT Deduplication")
    void testAssetFullLifecycle() throws Exception {
        byte[] pdfBytes = "%PDF-1.7 Test PDF binary asset stream".getBytes(StandardCharsets.UTF_8);
        String sha256 = AssetService.calculateSha256(pdfBytes);

        // Upload PDF asset
        mockMvc.perform(put("/api/v1/assets/" + sha256)
                        .contentType(MediaType.APPLICATION_PDF_VALUE)
                        .content(pdfBytes))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.sha256", is(sha256)))
                .andExpect(jsonPath("$.mimeType", is(MediaType.APPLICATION_PDF_VALUE)))
                .andExpect(jsonPath("$.sizeBytes", is(pdfBytes.length)));

        // HEAD asset
        mockMvc.perform(head("/api/v1/assets/" + sha256))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.CONTENT_LENGTH, String.valueOf(pdfBytes.length)))
                .andExpect(header().string(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_PDF_VALUE))
                .andExpect(header().string(HttpHeaders.ETAG, "\"" + sha256 + "\""));

        // GET asset
        mockMvc.perform(get("/api/v1/assets/" + sha256))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_PDF_VALUE))
                .andExpect(header().string(HttpHeaders.ETAG, "\"" + sha256 + "\""))
                .andExpect(content().bytes(pdfBytes));

        // Deduplication upload
        mockMvc.perform(put("/api/v1/assets/" + sha256)
                        .contentType(MediaType.APPLICATION_PDF_VALUE)
                        .content(pdfBytes))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.sha256", is(sha256)))
                .andExpect(jsonPath("$.sizeBytes", is(pdfBytes.length)));
    }

    @Test
    @DisplayName("PUT asset với hash sai định dạng hoặc không khớp")
    void testSha256DigestMismatch() throws Exception {
        byte[] bytes = "Testing mismatch".getBytes(StandardCharsets.UTF_8);
        String invalidHash = "12345"; // Độ dài không đủ 64

        mockMvc.perform(put("/api/v1/assets/" + invalidHash)
                        .contentType(MediaType.APPLICATION_OCTET_STREAM_VALUE)
                        .content(bytes))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code", is("DIGEST_MISMATCH")))
                .andExpect(jsonPath("$.message", containsString("64 ký tự hex")));
    }
}
