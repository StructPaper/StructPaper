package vn.edu.vnu.structpaper.asset;

public record AssetSaveResult(
        AssetEntity entity,
        boolean isCreated
) {
}
