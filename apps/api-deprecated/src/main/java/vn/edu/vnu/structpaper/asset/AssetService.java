package vn.edu.vnu.structpaper.asset;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.vnu.structpaper.exception.ResourceNotFoundException;
import vn.edu.vnu.structpaper.exception.Sha256MismatchException;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.HexFormat;
import java.util.Optional;

@Service
public class AssetService {

    private static final Logger log = LoggerFactory.getLogger(AssetService.class);

    private final AssetRepository assetRepository;
    private final Path assetStorageDir;

    public AssetService(AssetRepository assetRepository,
                        @Value("${structpaper.storage.asset-dir:./data/assets}") String assetDir) {
        this.assetRepository = assetRepository;
        this.assetStorageDir = Paths.get(assetDir).toAbsolutePath().normalize();
        try {
            Files.createDirectories(this.assetStorageDir);
        } catch (IOException e) {
            log.error("Không thể khởi tạo thư mục lưu trữ assets: {}", this.assetStorageDir, e);
        }
    }

    @Transactional(readOnly = true)
    public Optional<AssetEntity> findEntity(String sha256) {
        if (sha256 == null) return Optional.empty();
        return assetRepository.findById(sha256.toLowerCase().trim());
    }

    @Transactional(readOnly = true)
    public byte[] readAssetBytes(AssetEntity asset) {
        Path path = Paths.get(asset.getFilePath());
        if (!Files.exists(path)) {
            // Thử tìm trong assetStorageDir nếu đường dẫn cũ thay đổi
            path = assetStorageDir.resolve(asset.getSha256());
            if (!Files.exists(path)) {
                throw new ResourceNotFoundException("Tệp nhị phân không tồn tại trên ổ đĩa: " + asset.getSha256());
            }
        }
        try {
            return Files.readAllBytes(path);
        } catch (IOException e) {
            log.error("Lỗi khi đọc asset từ đĩa {}: {}", path, e.getMessage());
            throw new RuntimeException("Lỗi khi đọc file nhị phân asset", e);
        }
    }

    @Transactional
    public AssetSaveResult saveAsset(String expectedSha256, String contentType, byte[] data) {
        if (expectedSha256 == null || expectedSha256.length() != 64) {
            throw new Sha256MismatchException("Mã băm SHA-256 không hợp lệ (phải đủ 64 ký tự hex): " + expectedSha256);
        }

        String normalizedExpected = expectedSha256.toLowerCase().trim();
        String computedSha256 = calculateSha256(data);

        if (!computedSha256.equalsIgnoreCase(normalizedExpected)) {
            log.warn("Lệch mã SHA-256: expected={}, computed={}", normalizedExpected, computedSha256);
            throw new Sha256MismatchException("Mã băm SHA-256 không khớp: kỳ vọng " + normalizedExpected + " nhưng nội dung là " + computedSha256);
        }

        Optional<AssetEntity> existing = assetRepository.findById(computedSha256);
        if (existing.isPresent()) {
            log.info("Asset đã tồn tại (deduplicated): sha256={}", computedSha256);
            return new AssetSaveResult(existing.get(), false);
        }

        String mime = "application/octet-stream";
        if (contentType != null && !contentType.isBlank()) {
            try {
                org.springframework.http.MediaType mt = org.springframework.http.MediaType.parseMediaType(contentType);
                mime = mt.getType() + "/" + mt.getSubtype();
            } catch (Exception e) {
                mime = contentType.trim();
            }
        }
        Path targetPath = assetStorageDir.resolve(computedSha256);

        try {
            Files.createDirectories(targetPath.getParent());
            Files.write(targetPath, data);
        } catch (IOException e) {
            log.error("Lỗi khi ghi asset vào đĩa {}: {}", targetPath, e.getMessage());
            throw new RuntimeException("Không thể lưu file asset vào ổ đĩa", e);
        }

        AssetEntity entity = new AssetEntity(
                computedSha256,
                mime,
                data.length,
                targetPath.toString(),
                Instant.now()
        );
        assetRepository.save(entity);
        log.info("Lưu thành công asset mới: sha256={}, size={} bytes, mime={}", computedSha256, data.length, mime);

        return new AssetSaveResult(entity, true);
    }

    public static String calculateSha256(byte[] data) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] digest = md.digest(data);
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException("SHA-256 algorithm not available", e);
        }
    }
}
