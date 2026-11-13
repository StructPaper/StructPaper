package vn.edu.vnu.structpaper.model;

public enum CompilerEngine {
    XELATEX("XeLaTeX"),
    TECTONIC("Tectonic"),
    AUTO("Auto"),
    MOCK("Mock");

    private final String displayName;

    CompilerEngine(String displayName) {
        this.displayName = displayName;
    }

    public String getDisplayName() {
        return displayName;
    }

    public static CompilerEngine fromString(String val) {
        if (val == null || val.isBlank()) {
            return AUTO;
        }
        for (CompilerEngine e : values()) {
            if (e.name().equalsIgnoreCase(val) || e.displayName.equalsIgnoreCase(val)) {
                return e;
            }
        }
        return AUTO;
    }
}
