package vn.edu.vnu.structpaper.exception;

public class CompilerNotFoundException extends RuntimeException {

    private final String engineRequested;

    public CompilerNotFoundException(String message, String engineRequested) {
        super(message);
        this.engineRequested = engineRequested;
    }

    public String getEngineRequested() {
        return engineRequested;
    }
}
