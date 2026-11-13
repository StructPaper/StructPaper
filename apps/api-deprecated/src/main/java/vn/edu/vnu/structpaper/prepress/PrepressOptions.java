package vn.edu.vnu.structpaper.prepress;

public class PrepressOptions {

    private String standard = "PDF/X-1a:2001";
    private int targetDpi = 300;
    private String colorSpace = "CMYK";
    private Boolean mockFallbackEnabled;

    public PrepressOptions() {}

    public PrepressOptions(String standard) {
        this.standard = standard != null && !standard.isBlank() ? standard : "PDF/X-1a:2001";
    }

    public PrepressOptions(String standard, int targetDpi, String colorSpace) {
        this.standard = standard != null && !standard.isBlank() ? standard : "PDF/X-1a:2001";
        this.targetDpi = targetDpi > 0 ? targetDpi : 300;
        this.colorSpace = colorSpace != null && !colorSpace.isBlank() ? colorSpace : "CMYK";
    }

    public static PrepressOptions defaultOptions() {
        return new PrepressOptions();
    }

    public String getStandard() {
        return standard;
    }

    public void setStandard(String standard) {
        this.standard = standard;
    }

    public int getTargetDpi() {
        return targetDpi;
    }

    public void setTargetDpi(int targetDpi) {
        this.targetDpi = targetDpi;
    }

    public String getColorSpace() {
        return colorSpace;
    }

    public void setColorSpace(String colorSpace) {
        this.colorSpace = colorSpace;
    }

    public Boolean getMockFallbackEnabled() {
        return mockFallbackEnabled;
    }

    public void setMockFallbackEnabled(Boolean mockFallbackEnabled) {
        this.mockFallbackEnabled = mockFallbackEnabled;
    }
}
