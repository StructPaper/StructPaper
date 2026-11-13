package vn.edu.vnu.structpaper.prepress;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonInclude;

import java.util.ArrayList;
import java.util.Base64;
import java.util.List;

@JsonInclude(JsonInclude.Include.NON_NULL)
public class PrepressReport {

    @JsonIgnore
    private byte[] pdfBytes;

    private String pdfBase64;
    private boolean pdfXCompliant;
    private boolean allFontsEmbedded;
    private String colorSpace; // 'CMYK' | 'RGB'
    private long durationMs;
    private List<String> warnings = new ArrayList<>();
    private boolean mock;
    private String standard = "PDF/X-1a:2001";
    private int dpi = 300;
    private boolean dpiCompliant = true;
    private long outputSizeBytes;

    public PrepressReport() {}

    public PrepressReport(byte[] pdfBytes,
                          boolean pdfXCompliant,
                          boolean allFontsEmbedded,
                          String colorSpace,
                          long durationMs,
                          List<String> warnings,
                          boolean mock) {
        this.pdfBytes = pdfBytes;
        this.outputSizeBytes = pdfBytes != null ? pdfBytes.length : 0;
        this.pdfBase64 = pdfBytes != null ? Base64.getEncoder().encodeToString(pdfBytes) : null;
        this.pdfXCompliant = pdfXCompliant;
        this.allFontsEmbedded = allFontsEmbedded;
        this.colorSpace = colorSpace != null ? colorSpace : "CMYK";
        this.durationMs = durationMs;
        this.warnings = warnings != null ? new ArrayList<>(warnings) : new ArrayList<>();
        this.mock = mock;
    }

    public byte[] getPdfBytes() {
        if (pdfBytes == null && pdfBase64 != null) {
            try {
                pdfBytes = Base64.getDecoder().decode(pdfBase64);
            } catch (Exception ignored) {}
        }
        return pdfBytes;
    }

    public void setPdfBytes(byte[] pdfBytes) {
        this.pdfBytes = pdfBytes;
        if (pdfBytes != null) {
            this.outputSizeBytes = pdfBytes.length;
            this.pdfBase64 = Base64.getEncoder().encodeToString(pdfBytes);
        }
    }

    public String getPdfBase64() {
        return pdfBase64;
    }

    public void setPdfBase64(String pdfBase64) {
        this.pdfBase64 = pdfBase64;
        if (pdfBase64 != null) {
            try {
                this.pdfBytes = Base64.getDecoder().decode(pdfBase64);
                this.outputSizeBytes = this.pdfBytes.length;
            } catch (Exception ignored) {}
        }
    }

    public boolean isPdfXCompliant() {
        return pdfXCompliant;
    }

    public void setPdfXCompliant(boolean pdfXCompliant) {
        this.pdfXCompliant = pdfXCompliant;
    }

    public boolean isAllFontsEmbedded() {
        return allFontsEmbedded;
    }

    public void setAllFontsEmbedded(boolean allFontsEmbedded) {
        this.allFontsEmbedded = allFontsEmbedded;
    }

    public String getColorSpace() {
        return colorSpace;
    }

    public void setColorSpace(String colorSpace) {
        this.colorSpace = colorSpace;
    }

    public long getDurationMs() {
        return durationMs;
    }

    public void setDurationMs(long durationMs) {
        this.durationMs = durationMs;
    }

    public List<String> getWarnings() {
        return warnings;
    }

    public void setWarnings(List<String> warnings) {
        this.warnings = warnings != null ? new ArrayList<>(warnings) : new ArrayList<>();
    }

    public boolean isMock() {
        return mock;
    }

    public void setMock(boolean mock) {
        this.mock = mock;
    }

    public String getStandard() {
        return standard;
    }

    public void setStandard(String standard) {
        this.standard = standard;
    }

    public int getDpi() {
        return dpi;
    }

    public void setDpi(int dpi) {
        this.dpi = dpi;
    }

    public boolean isDpiCompliant() {
        return dpiCompliant;
    }

    public void setDpiCompliant(boolean dpiCompliant) {
        this.dpiCompliant = dpiCompliant;
    }

    public long getOutputSizeBytes() {
        return outputSizeBytes;
    }

    public void setOutputSizeBytes(long outputSizeBytes) {
        this.outputSizeBytes = outputSizeBytes;
    }
}
