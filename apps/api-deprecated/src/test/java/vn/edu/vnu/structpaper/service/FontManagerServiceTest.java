package vn.edu.vnu.structpaper.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.io.File;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class FontManagerServiceTest {

    private final FontManagerService fontManager = new FontManagerService();

    @Test
    @DisplayName("Nên thay thế MinionPro bằng Times New Roman khi không có file font")
    void shouldSubstituteMinionProWhenMissing() {
        String input = """
                \\setmainfont{MinionPro-Regular.otf}[
                BoldFont=MinionPro-Bold.otf,
                ItalicFont=MinionPro-It.otf,
                BoldItalicFont=MinionPro-BoldIt.otf]
                """;

        File tempDir = new File(System.getProperty("java.io.tmpdir"));
        String result = fontManager.sanitizeForAvailableFonts(input, tempDir);

        assertFalse(result.contains("MinionPro-Regular.otf"));
        assertTrue(result.contains("Times New Roman"));
    }

    @Test
    @DisplayName("Nên thay thế MyriadPro bằng Calibri khi không có file font")
    void shouldSubstituteMyriadProWhenMissing() {
        String input = """
                \\setsansfont{MyriadPro-Regular.otf}[
                BoldFont=MyriadPro-Bold.otf]
                """;

        File tempDir = new File(System.getProperty("java.io.tmpdir"));
        String result = fontManager.sanitizeForAvailableFonts(input, tempDir);

        assertFalse(result.contains("MyriadPro-Regular.otf"));
        assertTrue(result.contains("Calibri"));
    }
}
