package vn.edu.vnu.structpaper.ai;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "structpaper.ai")
public class AiProperties {

    private String openaiApiKey = "";
    private String model = "gpt-4o-mini";
    private String baseUrl = "https://api.openai.com/v1";
    private int timeoutSeconds = 30;

    public String getOpenaiApiKey() {
        return openaiApiKey;
    }

    public void setOpenaiApiKey(String openaiApiKey) {
        this.openaiApiKey = openaiApiKey;
    }

    public String getModel() {
        return model;
    }

    public void setModel(String model) {
        this.model = model;
    }

    public String getBaseUrl() {
        return baseUrl;
    }

    public void setBaseUrl(String baseUrl) {
        this.baseUrl = baseUrl;
    }

    public int getTimeoutSeconds() {
        return timeoutSeconds;
    }

    public void setTimeoutSeconds(int timeoutSeconds) {
        this.timeoutSeconds = timeoutSeconds;
    }

    public String getResolvedApiKey() {
        if (openaiApiKey != null && !openaiApiKey.isBlank()) {
            return openaiApiKey.trim();
        }
        String envKey = System.getenv("OPENAI_API_KEY");
        if (envKey != null && !envKey.isBlank()) {
            return envKey.trim();
        }
        return "";
    }

    public boolean isMockMode() {
        String key = getResolvedApiKey();
        return key.isEmpty() || key.equalsIgnoreCase("mock") || key.equalsIgnoreCase("none");
    }
}
