package vn.edu.vnu.structpaper.storage;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Optional;

@Component
@ConditionalOnProperty(name = "structpaper.storage.type", havingValue = "local", matchIfMissing = true)
public class LocalObjectStorage implements ObjectStorage {

    private final Path root;

    public LocalObjectStorage(@Value("${structpaper.storage.object-dir:./data/objects}") String dir) {
        this.root = Paths.get(dir).toAbsolutePath().normalize();
    }

    private Path resolve(String key) {
        Path p = root.resolve(key).normalize();
        if (!p.startsWith(root)) {
            throw new IllegalArgumentException("Invalid object key: " + key);
        }
        return p;
    }

    @Override
    public void put(String key, byte[] data, String contentType) {
        Path p = resolve(key);
        try {
            Files.createDirectories(p.getParent());
            Files.write(p, data);
        } catch (IOException e) {
            throw new UncheckedIOException("Cannot write object " + key, e);
        }
    }

    @Override
    public Optional<byte[]> get(String key) {
        Path p = resolve(key);
        if (!Files.isRegularFile(p)) {
            return Optional.empty();
        }
        try {
            return Optional.of(Files.readAllBytes(p));
        } catch (IOException e) {
            throw new UncheckedIOException("Cannot read object " + key, e);
        }
    }

    @Override
    public void delete(String key) {
        try {
            Files.deleteIfExists(resolve(key));
        } catch (IOException e) {
            throw new UncheckedIOException("Cannot delete object " + key, e);
        }
    }

    @Override
    public String kind() {
        return "local";
    }
}
