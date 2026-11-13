package vn.edu.vnu.structpaper.asset;

public record AssetUploadResponse(
        String sha256,
        long sizeBytes,
        String mimeType
) {
}
