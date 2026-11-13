package vn.edu.vnu.structpaper.storage;

import java.util.Optional;

/**
 * File/blob storage abstraction. Implementations: local filesystem (default, dev) and MinIO (S3).
 * Keys use forward slashes, e.g. "documents/{id}/snapshots/3.json".
 */
public interface ObjectStorage {

    void put(String key, byte[] data, String contentType);

    Optional<byte[]> get(String key);

    void delete(String key);

    /** Human-readable backend name, exposed for diagnostics ("local" | "minio"). */
    String kind();
}
