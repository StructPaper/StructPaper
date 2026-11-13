package vn.edu.vnu.structpaper.document;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import vn.edu.vnu.structpaper.document.DocumentDtos.CreateRequest;
import vn.edu.vnu.structpaper.document.DocumentDtos.DocumentDto;
import vn.edu.vnu.structpaper.document.DocumentDtos.ExportItem;
import vn.edu.vnu.structpaper.document.DocumentDtos.SaveRequest;
import vn.edu.vnu.structpaper.document.DocumentDtos.SaveResponse;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.List;

@RestController
@RequestMapping("/api/v1/documents")
@Tag(name = "Documents", description = "Tài liệu kiểu Word: tạo mới, mở, tự động lưu, lưu, xuất file")
public class DocumentController {

    private final DocumentService service;

    public DocumentController(DocumentService service) {
        this.service = service;
    }

    @GetMapping
    @Operation(summary = "Danh sách tài liệu đã lưu (cho hộp thoại Open)")
    public List<DocumentDto> list() {
        return service.list();
    }

    @PostMapping
    @Operation(summary = "Tạo tài liệu mới có đặt tên")
    public ResponseEntity<DocumentDto> create(@RequestBody CreateRequest req) {
        return ResponseEntity.status(201).body(service.create(req.name(), req.journalId(), req.doc()));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Mở tài liệu (nội dung đầy đủ)")
    public DocumentDto get(@PathVariable("id") String id) {
        return service.get(id);
    }

    @PutMapping("/{id}")
    @Operation(summary = "Tự động lưu / Lưu tài liệu", description = "Upsert. baseRev để khóa lạc quan; snapshot=true ghi thêm bản chụp vào object storage.")
    public SaveResponse save(@PathVariable("id") String id, @RequestBody SaveRequest req) {
        return service.save(id, req);
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Xóa tài liệu (xóa mềm)")
    public ResponseEntity<Void> delete(@PathVariable("id") String id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping(value = "/{id}/exports", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Lưu bản xuất (docx/pdf/xml) vào kho tệp")
    public ResponseEntity<ExportItem> uploadExport(@PathVariable("id") String id,
                                                   @RequestParam("format") String format,
                                                   @RequestParam(value = "fileName", required = false) String fileName,
                                                   @RequestParam("file") MultipartFile file) throws IOException {
        ExportItem item = service.saveExport(id, format, fileName, file.getBytes(), file.getContentType());
        return ResponseEntity.status(201).body(item);
    }

    @GetMapping("/{id}/exports")
    @Operation(summary = "Danh sách bản xuất của tài liệu")
    public List<ExportItem> listExports(@PathVariable("id") String id) {
        return service.listExports(id);
    }

    @GetMapping("/{id}/exports/{exportId}")
    @Operation(summary = "Tải bản xuất")
    public ResponseEntity<byte[]> downloadExport(@PathVariable("id") String id, @PathVariable("exportId") String exportId) {
        DocumentExportEntity e = service.getExport(id, exportId);
        byte[] bytes = service.readExportBytes(e);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.attachment().filename(e.getFileName(), StandardCharsets.UTF_8).build().toString())
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .body(bytes);
    }
}
