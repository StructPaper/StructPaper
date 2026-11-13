package vn.edu.vnu.structpaper.dto.request;

import jakarta.validation.constraints.NotBlank;
import java.util.Map;

public class CompileLatexRequest {

    @NotBlank(message = "Nội dung mã nguồn LaTeX không được để trống")
    private String texContent;

    private String engine = "auto";

    private Boolean autoFontFallback = true;

    private String jobName = "document";

    private Map<String, String> images;

    public CompileLatexRequest() {
    }

    public CompileLatexRequest(String texContent) {
        this.texContent = texContent;
    }

    public String getTexContent() {
        return texContent;
    }

    public void setTexContent(String texContent) {
        this.texContent = texContent;
    }

    public String getEngine() {
        return engine;
    }

    public void setEngine(String engine) {
        this.engine = engine;
    }

    public Boolean getAutoFontFallback() {
        return autoFontFallback != null ? autoFontFallback : true;
    }

    public void setAutoFontFallback(Boolean autoFontFallback) {
        this.autoFontFallback = autoFontFallback;
    }

    public String getJobName() {
        return jobName != null && !jobName.isBlank() ? jobName : "document";
    }

    public void setJobName(String jobName) {
        this.jobName = jobName;
    }

    public Map<String, String> getImages() {
        return images;
    }

    public void setImages(Map<String, String> images) {
        this.images = images;
    }
}
