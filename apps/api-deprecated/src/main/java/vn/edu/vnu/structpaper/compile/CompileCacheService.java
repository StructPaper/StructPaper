package vn.edu.vnu.structpaper.compile;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class CompileCacheService {

    private static final Logger log = LoggerFactory.getLogger(CompileCacheService.class);

    private final Map<String, CompileCacheEntry> cache = new ConcurrentHashMap<>();

    public String calculateHash(CompileJobRequest request) {
        if (request == null) {
            return "";
        }
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");

            // 1. Raw LaTeX text content
            if (request.getTex() != null) {
                md.update(request.getTex().getBytes(StandardCharsets.UTF_8));
            }

            // 2. Asset hashes deterministically sorted
            List<String> assets = request.getEffectiveAssets();
            if (assets != null && !assets.isEmpty()) {
                List<String> sortedAssets = new ArrayList<>(assets);
                Collections.sort(sortedAssets);
                for (String asset : sortedAssets) {
                    if (asset != null) {
                        md.update((byte) 0);
                        md.update(asset.getBytes(StandardCharsets.UTF_8));
                    }
                }
            }

            // 3. Custom embedded images deterministically sorted
            if (request.getImages() != null && !request.getImages().isEmpty()) {
                List<String> sortedKeys = new ArrayList<>(request.getImages().keySet());
                Collections.sort(sortedKeys);
                for (String key : sortedKeys) {
                    md.update((byte) 0);
                    md.update(key.getBytes(StandardCharsets.UTF_8));
                    String val = request.getImages().get(key);
                    if (val != null) {
                        md.update(val.getBytes(StandardCharsets.UTF_8));
                    }
                }
            }

            // 4. Journal profile ID if present
            if (request.getProfileId() != null) {
                md.update((byte) 0);
                md.update(request.getProfileId().getBytes(StandardCharsets.UTF_8));
            }

            return HexFormat.of().formatHex(md.digest());
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException("Thuật toán SHA-256 không khả dụng trong môi trường runtime", e);
        }
    }

    public Optional<CompileCacheEntry> get(String hash) {
        if (hash == null || hash.isBlank()) {
            return Optional.empty();
        }
        return Optional.ofNullable(cache.get(hash.toLowerCase().trim()));
    }

    public void put(String hash, CompileCacheEntry entry) {
        if (hash == null || hash.isBlank() || entry == null) {
            return;
        }
        cache.put(hash.toLowerCase().trim(), entry);
        log.debug("Đã lưu kết quả biên dịch vào cache: hash={}", hash);
    }

    public void evict(String hash) {
        if (hash != null) {
            cache.remove(hash.toLowerCase().trim());
        }
    }

    public void clear() {
        cache.clear();
    }

    public int size() {
        return cache.size();
    }
}
