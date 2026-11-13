package vn.edu.vnu.structpaper.prepress;

public class PrepressRequest {

    private String pdfBase64;
    private String standard = "PDF/X-1a:2001";
    private String format = "json"; // "json" or "pdf"
    private Integer targetDpi = 300;

    public PrepressRequest() {}

    public PrepressRequest(String pdfBase64) {
        this.pdfBase64 = pdfBase64;
    }

    public PrepressRequest(String pdfBase64, String standard, String format, Integer targetDpi) {
        this.pdfBase64 = pdfBase64;
        this.standard = standard;
        this.format = format;
        this.targetDpi = targetDpi;
    }

    public String getPdfBase64() {
        return pdfBase64;
    }

    public void setPdfBase64(String pdfBase64) {
        this.pdfBase64 = pdfBase64;
    }

    public String getStandard() {
        return standard;
    }

    public void setStandard(String standard) {
        this.standard = standard;
    }

    public String getFormat() {
        return format;
    }

    public void setFormat(String format) {
        this.format = format;
    }

    public Integer getTargetDpi() {
        return targetDpi;
    }

    public void setTargetDpi(Integer targetDpi) {
        this.targetDpi = targetDpi;
    }
}
