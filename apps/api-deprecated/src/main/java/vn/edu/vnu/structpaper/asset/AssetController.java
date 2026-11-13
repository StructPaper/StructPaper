package vn.edu.vnu.structpaper.asset;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RestController;
import vn.edu.vnu.structpaper.exception.ResourceNotFoundException;

@RestController
@RequestMapping("/api/v1/assets")
@Tag(name = "Assets", description = "Quản lý kho tệp nhị phân nội dung (CAS) theo mã băm SHA-256")
public class AssetController {

    private final AssetService assetService;

    public AssetController(AssetService assetService) {
        this.assetService = assetService;
    }

    @RequestMapping(value = "/{sha256}", method = RequestMethod.HEAD)
    @Operation(summary = "Kiểm tra sự tồn tại của tệp nhị phân theo SHA-256", description = "Trả về 200 OK cùng Content-Length, Content-Type, ETag nếu tệp đã có; 404 nếu chưa có")
    public ResponseEntity<Void> checkAssetExists(@PathVariable("sha256") String sha256) {
        var assetOpt = assetService.findEntity(sha256);
        if (assetOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        AssetEntity asset = assetOpt.get();
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_LENGTH, String.valueOf(asset.getSizeBytes()))
                .header(HttpHeaders.CONTENT_TYPE, asset.getMimeType() != null ? asset.getMimeType() : MediaType.APPLICATION_OCTET_STREAM_VALUE)
                .header(HttpHeaders.ETAG, "\"" + asset.getSha256() + "\"")
                .build();
    }

    @GetMapping("/{sha256}")
    @Operation(summary = "Tải tệp nhị phân theo SHA-256", description = "Truyền trực tiếp luồng byte của tệp với đúng Content-Type và ETag")
    public ResponseEntity<byte[]> downloadAsset(@PathVariable("sha256") String sha256) {
        AssetEntity asset = assetService.findEntity(sha256)
                .orElseThrow(() -> new ResourceNotFoundException("Asset not found: " + sha256));
        byte[] data = assetService.readAssetBytes(asset);

        MediaType mediaType;
        try {
            mediaType = MediaType.parseMediaType(asset.getMimeType());
        } catch (Exception e) {
            mediaType = MediaType.APPLICATION_OCTET_STREAM;
        }

        return ResponseEntity.ok()
                .contentType(mediaType)
                .header(HttpHeaders.ETAG, "\"" + asset.getSha256() + "\"")
                .header(HttpHeaders.CONTENT_LENGTH, String.valueOf(asset.getSizeBytes()))
                .body(data);
    }

    @PutMapping(value = "/{sha256}")
    @Operation(summary = "Tải lên tệp nhị phân theo SHA-256", description = "Kiểm tra tính toàn vẹn SHA-256 của payload so với URL. Lưu trữ khử trùng lặp (CAS).")
    public ResponseEntity<AssetUploadResponse> uploadAsset(
            @PathVariable("sha256") String sha256,
            @RequestHeader(value = HttpHeaders.CONTENT_TYPE, required = false) String contentType,
            @RequestBody byte[] data) {
        AssetSaveResult result = assetService.saveAsset(sha256, contentType, data);
        AssetUploadResponse response = new AssetUploadResponse(
                result.entity().getSha256(),
                result.entity().getSizeBytes(),
                result.entity().getMimeType()
        );
        if (result.isCreated()) {
            return ResponseEntity.status(HttpStatus.CREATED).body(response);
        } else {
            return ResponseEntity.ok(response);
        }
    }
}
