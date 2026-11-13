package vn.edu.vnu.structpaper.compile;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotBlank;

import java.util.Collections;
import java.util.List;
import java.util.Map;

@JsonIgnoreProperties(ignoreUnknown = true)
public class CompileJobRequest {

    @NotBlank(message = "Nội dung mã nguồn LaTeX (tex) không được để trống")
    private String tex;

    @JsonAlias({"manuscriptId", "documentId"})
    private String paperId;

    private String profileId;

    private String engine = "auto";

    @JsonAlias({"asset_hashes"})
    private List<String> assets;

    private List<String> assetHashes;

    private Map<String, String> images;

    private Map<String, Object> options;

    public CompileJobRequest() {}

    public CompileJobRequest(String tex, String paperId) {
        this.tex = tex;
        this.paperId = paperId;
    }

    public String getTex() {
        return tex;
    }

    public void setTex(String tex) {
        this.tex = tex;
    }

    public String getPaperId() {
        return paperId;
    }

    public void setPaperId(String paperId) {
        this.paperId = paperId;
    }

    public String getProfileId() {
        return profileId;
    }

    public void setProfileId(String profileId) {
        this.profileId = profileId;
    }

    public String getEngine() {
        return engine;
    }

    public void setEngine(String engine) {
        this.engine = engine;
    }

    public List<String> getAssets() {
        return assets;
    }

    public void setAssets(List<String> assets) {
        this.assets = assets;
    }

    public List<String> getAssetHashes() {
        return assetHashes;
    }

    public void setAssetHashes(List<String> assetHashes) {
        this.assetHashes = assetHashes;
    }

    public Map<String, String> getImages() {
        return images;
    }

    public void setImages(Map<String, String> images) {
        this.images = images;
    }

    public Map<String, Object> getOptions() {
        return options;
    }

    public void setOptions(Map<String, Object> options) {
        this.options = options;
    }

    @JsonIgnore
    public String getEffectivePaperId() {
        if (paperId != null && !paperId.isBlank()) {
            return paperId;
        }
        if (profileId != null && !profileId.isBlank()) {
            return profileId;
        }
        return null;
    }

    @JsonIgnore
    public List<String> getEffectiveAssets() {
        if (assets != null && !assets.isEmpty()) {
            return assets;
        }
        if (assetHashes != null && !assetHashes.isEmpty()) {
            return assetHashes;
        }
        return Collections.emptyList();
    }
}
