package vn.edu.vnu.structpaper.storage;

import io.minio.BucketExistsArgs;
import io.minio.GetObjectArgs;
import io.minio.GetObjectResponse;
import io.minio.MakeBucketArgs;
import io.minio.MinioClient;
import io.minio.PutObjectArgs;
import io.minio.RemoveObjectArgs;
import io.minio.errors.ErrorResponseException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.io.ByteArrayInputStream;
import java.util.Optional;

/** S3-compatible storage on MinIO. Enabled with structpaper.storage.type=minio. */
@Component
@ConditionalOnProperty(name = "structpaper.storage.type", havingValue = "minio")
public class MinioObjectStorage implements ObjectStorage {

    private final MinioClient client;
    private final String bucket;
    private volatile boolean bucketReady = false;

    public MinioObjectStorage(
            @Value("${structpaper.storage.minio.endpoint}") String endpoint,
            @Value("${structpaper.storage.minio.access-key}") String accessKey,
            @Value("${structpaper.storage.minio.secret-key}") String secretKey,
            @Value("${structpaper.storage.minio.bucket:structpaper}") String bucket) {
        this.client = MinioClient.builder().endpoint(endpoint).credentials(accessKey, secretKey).build();
        this.bucket = bucket;
    }

    private void ensureBucket() throws Exception {
        if (bucketReady) return;
        synchronized (this) {
            if (!bucketReady) {
                if (!client.bucketExists(BucketExistsArgs.builder().bucket(bucket).build())) {
                    client.makeBucket(MakeBucketArgs.builder().bucket(bucket).build());
                }
                bucketReady = true;
            }
        }
    }

    @Override
    public void put(String key, byte[] data, String contentType) {
        try {
            ensureBucket();
            client.putObject(PutObjectArgs.builder()
                    .bucket(bucket)
                    .object(key)
                    .stream(new ByteArrayInputStream(data), data.length, -1)
                    .contentType(contentType == null ? "application/octet-stream" : contentType)
                    .build());
        } catch (Exception e) {
            throw new IllegalStateException("MinIO put failed for " + key + ": " + e.getMessage(), e);
        }
    }

    @Override
    public Optional<byte[]> get(String key) {
        try {
            ensureBucket();
            try (GetObjectResponse res = client.getObject(GetObjectArgs.builder().bucket(bucket).object(key).build())) {
                return Optional.of(res.readAllBytes());
            }
        } catch (ErrorResponseException e) {
            if ("NoSuchKey".equals(e.errorResponse().code())) return Optional.empty();
            throw new IllegalStateException("MinIO get failed for " + key + ": " + e.getMessage(), e);
        } catch (Exception e) {
            throw new IllegalStateException("MinIO get failed for " + key + ": " + e.getMessage(), e);
        }
    }

    @Override
    public void delete(String key) {
        try {
            ensureBucket();
            client.removeObject(RemoveObjectArgs.builder().bucket(bucket).object(key).build());
        } catch (Exception e) {
            throw new IllegalStateException("MinIO delete failed for " + key + ": " + e.getMessage(), e);
        }
    }

    @Override
    public String kind() {
        return "minio";
    }
}
