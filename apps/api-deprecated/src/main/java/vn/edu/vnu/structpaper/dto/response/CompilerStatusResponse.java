package vn.edu.vnu.structpaper.dto.response;

public record CompilerStatusResponse(
        boolean xelatexAvailable,
        String xelatexVersion,
        String xelatexPath,
        boolean tectonicAvailable,
        String tectonicVersion,
        String tectonicPath,
        String activeEngine,
        String osName,
        String javaVersion,
        long maxMemoryMb,
        long freeMemoryMb
) {
}
