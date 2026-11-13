package vn.edu.vnu.structpaper.prepress;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "structpaper.prepress")
public class PrepressProperties {

    /**
     * Bật/tắt dịch vụ prepress
     */
    private boolean enabled = true;

    /**
     * Đường dẫn tùy chỉnh tới Ghostscript binary (e.g. C:\Program Files\gs\bin\gswin64c.exe hoặc /usr/bin/gs)
     */
    private String ghostscriptPath = "";

    /**
     * Tự động chuyển sang Mock Software Fallback khi môi trường chưa cài Ghostscript (CI / Dev)
     */
    private boolean mockFallbackEnabled = true;

    /**
     * Chuẩn xuất bản mặc định (PDF/X-1a:2001, PDF/X-3, PDF/A-1b, v.v.)
     */
    private String defaultStandard = "PDF/X-1a:2001";

    /**
     * Thời gian chờ tối đa cho tác vụ Ghostscript (giây)
     */
    private int timeoutSeconds = 60;

    /**
     * Độ phân giải DPI mục tiêu tối thiểu cho ảnh trong tài liệu (chuẩn nhà in: >= 300 DPI)
     */
    private int targetDpi = 300;

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    public String getGhostscriptPath() {
        return ghostscriptPath;
    }

    public void setGhostscriptPath(String ghostscriptPath) {
        this.ghostscriptPath = ghostscriptPath;
    }

    public boolean isMockFallbackEnabled() {
        return mockFallbackEnabled;
    }

    public void setMockFallbackEnabled(boolean mockFallbackEnabled) {
        this.mockFallbackEnabled = mockFallbackEnabled;
    }

    public String getDefaultStandard() {
        return defaultStandard;
    }

    public void setDefaultStandard(String defaultStandard) {
        this.defaultStandard = defaultStandard;
    }

    public int getTimeoutSeconds() {
        return timeoutSeconds;
    }

    public void setTimeoutSeconds(int timeoutSeconds) {
        this.timeoutSeconds = timeoutSeconds;
    }

    public int getTargetDpi() {
        return targetDpi;
    }

    public void setTargetDpi(int targetDpi) {
        this.targetDpi = targetDpi;
    }
}
