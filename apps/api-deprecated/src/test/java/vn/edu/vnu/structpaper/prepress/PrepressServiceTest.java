package vn.edu.vnu.structpaper.prepress;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import vn.edu.vnu.structpaper.exception.GhostscriptNotFoundException;
import vn.edu.vnu.structpaper.exception.InvalidPdfException;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Base64;

import static org.hamcrest.Matchers.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
public class PrepressServiceTest {

    @Autowired
    private PrepressService prepressService;

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    /**
     * Mẫu PDF tối thiểu hợp lệ theo chuẩn định dạng PDF
     */
    private byte[] createSampleValidPdf() {
        String pdf = "%PDF-1.7\n" +
                "1 0 obj\n" +
                "<< /Type /Catalog /Pages 2 0 R >>\n" +
                "endobj\n" +
                "2 0 obj\n" +
                "<< /Type /Pages /Kids [3 0 R] /Count 1 >>\n" +
                "endobj\n" +
                "3 0 obj\n" +
                "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> /ColorSpace << /Cs1 /DeviceRGB >> >> >>\n" +
                "endobj\n" +
                "4 0 obj\n" +
                "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /FontDescriptor 5 0 R >>\n" +
                "endobj\n" +
                "5 0 obj\n" +
                "<< /Type /FontDescriptor /FontName /Helvetica /FontFile 6 0 R >>\n" +
                "endobj\n" +
                "6 0 obj\n" +
                "<< /Length 10 >>\n" +
                "stream\n" +
                "dummy-font\n" +
                "endstream\n" +
                "endobj\n" +
                "xref\n" +
                "0 7\n" +
                "0000000000 65535 f \n" +
                "0000000009 00000 n \n" +
                "0000000056 00000 n \n" +
                "0000000111 00000 n \n" +
                "0000000250 00000 n \n" +
                "0000000336 00000 n \n" +
                "0000000411 00000 n \n" +
                "trailer\n" +
                "<< /Size 7 /Root 1 0 R >>\n" +
                "startxref\n" +
                "480\n" +
                "%%EOF\n";
        return pdf.getBytes(StandardCharsets.ISO_8859_1);
    }

    @Test
    @DisplayName("Chuyển đổi PDF mẫu sang PDF/X hợp lệ và kiểm tra header chuẩn hóa %PDF-1.4")
    void testSamplePdfConversionToPdfX() {
        byte[] inputPdf = createSampleValidPdf();

        PrepressReport report = prepressService.processPdf(inputPdf);

        assertNotNull(report, "Báo cáo prepress không được null");
        assertTrue(report.isPdfXCompliant(), "Phải đạt chuẩn tuân thủ PDF/X");
        assertTrue(report.isAllFontsEmbedded(), "100% font chữ phải được nhúng");
        assertEquals("CMYK", report.getColorSpace(), "Hệ màu chuẩn prepress phải là CMYK");
        assertEquals("PDF/X-1a:2001", report.getStandard());
        assertTrue(report.getDurationMs() >= 0, "Thời gian thực thi phải >= 0");
        assertNotNull(report.getPdfBytes(), "Byte PDF sau chuyển đổi không được null");
        assertTrue(report.getPdfBytes().length > 0, "Byte PDF sau chuyển đổi phải lớn hơn 0");

        // Kiểm tra header được chuẩn hóa về %PDF-1.4 (chuẩn PDF/X-1a:2001)
        String outputContent = new String(report.getPdfBytes(), StandardCharsets.ISO_8859_1);
        assertTrue(outputContent.startsWith("%PDF-1.4"), "Header phải được chuẩn hóa thành %PDF-1.4");
        assertTrue(outputContent.contains("%%EOF"), "PDF phải có marker kết thúc %%EOF");
    }

    @Test
    @DisplayName("Kiểm tra 100% font chữ nhúng và tự động chuyển đổi hệ màu từ RGB sang CMYK")
    void testFontEmbeddingAndColorSpaceInspection() {
        byte[] inputPdf = createSampleValidPdf();

        PrepressOptions options = new PrepressOptions("PDF/X-1a:2001", 300, "CMYK");
        PrepressReport report = prepressService.processPdf(inputPdf, options);

        assertTrue(report.isAllFontsEmbedded());
        assertEquals("CMYK", report.getColorSpace());

        String outputContent = new String(report.getPdfBytes(), StandardCharsets.ISO_8859_1);
        // Kiểm tra /DeviceRGB đã được chuyển đổi thành /DeviceCMYK
        assertFalse(outputContent.contains("/DeviceRGB"), "Không được còn tồn tại /DeviceRGB trong PDF/X");
        assertTrue(outputContent.contains("/DeviceCMYK"), "Phải chứa hệ màu /DeviceCMYK");
        assertTrue(outputContent.contains("GTS_PDFXVersion"), "Phải chứa siêu dữ liệu GTS_PDFXVersion");
    }

    @Test
    @DisplayName("Xử lý ngoại lệ an toàn khi dữ liệu PDF đầu vào không hợp lệ (null, rỗng hoặc sai cú pháp)")
    void testInvalidPdfHandling() {
        // 1. Dữ liệu null
        assertThrows(InvalidPdfException.class, () -> prepressService.processPdf(null));

        // 2. Dữ liệu rỗng
        assertThrows(InvalidPdfException.class, () -> prepressService.processPdf(new byte[0]));

        // 3. Tệp ngắn hơn kích thước tối thiểu
        assertThrows(InvalidPdfException.class, () -> prepressService.processPdf("short".getBytes()));

        // 4. Tệp không có header %PDF-
        assertThrows(InvalidPdfException.class, () -> prepressService.processPdf("This is plain text not a pdf document at all".getBytes()));
    }

    @Test
    @DisplayName("Ném GhostscriptNotFoundException khi Ghostscript vắng mặt và cấm Mock Fallback")
    void testGhostscriptNotFoundWhenMockFallbackDisabled() {
        if (!prepressService.isGhostscriptAvailable()) {
            byte[] inputPdf = createSampleValidPdf();
            PrepressOptions strictOptions = new PrepressOptions("PDF/X-1a:2001");
            strictOptions.setMockFallbackEnabled(false);

            assertThrows(GhostscriptNotFoundException.class, () -> prepressService.processPdf(inputPdf, strictOptions));
        }
    }

    @Test
    @DisplayName("Chuyển đổi qua tệp Path trên ổ đĩa thành công")
    void testPathBasedProcessing() throws Exception {
        Path tempIn = Files.createTempFile("prepress-test-in-", ".pdf");
        Path tempOut = Files.createTempFile("prepress-test-out-", ".pdf");

        try {
            Files.write(tempIn, createSampleValidPdf());
            PrepressReport report = prepressService.processPdf(tempIn, tempOut, PrepressOptions.defaultOptions());

            assertTrue(Files.exists(tempOut));
            assertTrue(Files.size(tempOut) > 0);
            assertTrue(report.isPdfXCompliant());
        } finally {
            Files.deleteIfExists(tempIn);
            Files.deleteIfExists(tempOut);
        }
    }

    @Test
    @DisplayName("Endpoint POST /api/v1/prepress với Multipart upload trả về file PDF chuẩn")
    void testPrepressEndpointMultipartPdfDownload() throws Exception {
        byte[] inputPdf = createSampleValidPdf();
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "sample_manuscript.pdf",
                MediaType.APPLICATION_PDF_VALUE,
                inputPdf
        );

        mockMvc.perform(multipart("/api/v1/prepress")
                        .file(file)
                        .param("format", "pdf")
                        .param("standard", "PDF/X-1a:2001"))
                .andExpect(status().isOk())
                .andExpect(content().contentType(MediaType.APPLICATION_PDF))
                .andExpect(header().string("X-Prepress-Compliant", "true"))
                .andExpect(header().string("X-Prepress-ColorSpace", "CMYK"))
                .andExpect(header().string("X-Prepress-Fonts-Embedded", "true"))
                .andExpect(header().string(HttpHeaders.CONTENT_DISPOSITION, containsString("prepress_sample_manuscript.pdf")));
    }

    @Test
    @DisplayName("Endpoint POST /api/v1/prepress với Multipart upload và format=json trả về PrepressReport")
    void testPrepressEndpointMultipartJsonResponse() throws Exception {
        byte[] inputPdf = createSampleValidPdf();
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "sample_paper.pdf",
                MediaType.APPLICATION_PDF_VALUE,
                inputPdf
        );

        mockMvc.perform(multipart("/api/v1/prepress")
                        .file(file)
                        .param("format", "json"))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.pdfXCompliant", is(true)))
                .andExpect(jsonPath("$.allFontsEmbedded", is(true)))
                .andExpect(jsonPath("$.colorSpace", is("CMYK")))
                .andExpect(jsonPath("$.standard", is("PDF/X-1a:2001")))
                .andExpect(jsonPath("$.dpiCompliant", is(true)))
                .andExpect(jsonPath("$.pdfBase64", notNullValue()));
    }

    @Test
    @DisplayName("Endpoint POST /api/v1/prepress với Binary Stream application/pdf trả về tệp PDF chuyển đổi")
    void testPrepressEndpointBinaryPdf() throws Exception {
        byte[] inputPdf = createSampleValidPdf();

        mockMvc.perform(post("/api/v1/prepress")
                        .contentType(MediaType.APPLICATION_PDF)
                        .content(inputPdf))
                .andExpect(status().isOk())
                .andExpect(content().contentType(MediaType.APPLICATION_PDF))
                .andExpect(header().string("X-Prepress-Compliant", "true"))
                .andExpect(header().string("X-Prepress-ColorSpace", "CMYK"));
    }

    @Test
    @DisplayName("Endpoint POST /api/v1/prepress với JSON payload trả về JSON PrepressReport")
    void testPrepressEndpointJsonPayload() throws Exception {
        byte[] inputPdf = createSampleValidPdf();
        String b64 = Base64.getEncoder().encodeToString(inputPdf);

        PrepressRequest request = new PrepressRequest(b64, "PDF/X-1a:2001", "json", 300);

        mockMvc.perform(post("/api/v1/prepress")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.pdfXCompliant", is(true)))
                .andExpect(jsonPath("$.colorSpace", is("CMYK")))
                .andExpect(jsonPath("$.outputSizeBytes", greaterThan(0)));
    }

    @Test
    @DisplayName("Endpoint POST /api/v1/prepress chặn tệp không hợp lệ trả về 400 INVALID_PDF")
    void testPrepressEndpointInvalidPdfReturnsBadRequest() throws Exception {
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "invalid.txt",
                MediaType.TEXT_PLAIN_VALUE,
                "Just plain text string".getBytes(StandardCharsets.UTF_8)
        );

        mockMvc.perform(multipart("/api/v1/prepress")
                        .file(file))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code", is("INVALID_PDF")))
                .andExpect(jsonPath("$.engine", is("PrepressService")));
    }
}
