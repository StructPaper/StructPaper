package vn.edu.vnu.structpaper.manuscript;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/manuscripts")
@Tag(name = "Manuscripts", description = "Quản lý tài liệu Manuscript và lịch sử phiên bản tài liệu")
public class ManuscriptController {

    private final ManuscriptService manuscriptService;

    public ManuscriptController(ManuscriptService manuscriptService) {
        this.manuscriptService = manuscriptService;
    }

    @GetMapping(value = "/{id}", produces = MediaType.APPLICATION_JSON_VALUE)
    @Operation(summary = "Lấy dữ liệu tài liệu Manuscript theo ULID", description = "Trả về JSON mô hình tài liệu cùng header ETag đại diện cho phiên bản hiện tại")
    public ResponseEntity<String> getManuscript(@PathVariable("id") String id) {
        ManuscriptEntity entity = manuscriptService.getManuscript(id);
        return ResponseEntity.ok()
                .header(HttpHeaders.ETAG, "\"" + entity.getRev() + "\"")
                .contentType(MediaType.APPLICATION_JSON)
                .body(entity.getDocJson());
    }

    @PutMapping(value = "/{id}", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    @Operation(summary = "Lưu hoặc cập nhật bản thảo", description = "Lưu mô hình tài liệu với khóa lạc quan qua header If-Match. Sinh snapshot revision và tăng rev.")
    public ResponseEntity<SaveManuscriptResponse> updateManuscript(
            @PathVariable("id") String id,
            @RequestHeader(name = "If-Match", required = true) String ifMatch,
            @RequestBody String docJson) {
        SaveManuscriptResponse response = manuscriptService.saveOrUpdate(id, ifMatch, docJson);
        return ResponseEntity.ok()
                .header(HttpHeaders.ETAG, "\"" + response.rev() + "\"")
                .body(response);
    }

    @GetMapping(value = "/{id}/revisions", produces = MediaType.APPLICATION_JSON_VALUE)
    @Operation(summary = "Lấy lịch sử các phiên bản của bản thảo", description = "Trả về danh sách snapshot lịch sử thay đổi để theo dõi hoặc khôi phục")
    public ResponseEntity<List<RevisionHistoryItem>> getRevisions(@PathVariable("id") String id) {
        List<RevisionHistoryItem> revisions = manuscriptService.getRevisions(id);
        return ResponseEntity.ok(revisions);
    }
}
