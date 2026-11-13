package vn.edu.vnu.structpaper.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "structpaper.latex")
public class LatexCompilerProperties {

    /**
     * Engine to use: "auto", "xelatex", or "tectonic"
     */
    private String engine = "auto";

    /**
     * Path or executable name for XeLaTeX
     */
    private String xelatexPath = "xelatex";

    /**
     * Path or executable name for Tectonic
     */
    private String tectonicPath = "";

    /**
     * Compilation timeout in seconds
     */
    private int timeoutSeconds = 60;

    /**
     * Base directory for temporary compilation files (null/empty means system temp)
     */
    private String workDir = "";

    /**
     * Automatically apply safe font fallbacks if commercial Adobe fonts (MinionPro, MyriadPro) are missing
     */
    private boolean autoFontFallback = true;

    /**
     * Fallback to mock compilation engine if no TeX binary (XeLaTeX or Tectonic) is installed.
     * Useful for CI and lightweight local environments.
     */
    private boolean mockFallbackEnabled = true;

    // Getters and Setters
    public boolean isMockFallbackEnabled() {
        return mockFallbackEnabled;
    }

    public void setMockFallbackEnabled(boolean mockFallbackEnabled) {
        this.mockFallbackEnabled = mockFallbackEnabled;
    }

    public String getEngine() {
        return engine;
    }

    public void setEngine(String engine) {
        this.engine = engine;
    }

    public String getXelatexPath() {
        return xelatexPath;
    }

    public void setXelatexPath(String xelatexPath) {
        this.xelatexPath = xelatexPath;
    }

    public String getTectonicPath() {
        return tectonicPath;
    }

    public void setTectonicPath(String tectonicPath) {
        this.tectonicPath = tectonicPath;
    }

    public int getTimeoutSeconds() {
        return timeoutSeconds;
    }

    public void setTimeoutSeconds(int timeoutSeconds) {
        this.timeoutSeconds = timeoutSeconds;
    }

    public String getWorkDir() {
        return workDir;
    }

    public void setWorkDir(String workDir) {
        this.workDir = workDir;
    }

    public boolean isAutoFontFallback() {
        return autoFontFallback;
    }

    public void setAutoFontFallback(boolean autoFontFallback) {
        this.autoFontFallback = autoFontFallback;
    }
}
