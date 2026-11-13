package vn.edu.vnu.structpaper.document;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import vn.edu.vnu.structpaper.batch.UlidGenerator;
import vn.edu.vnu.structpaper.document.DocumentDtos.DocumentDto;
import vn.edu.vnu.structpaper.document.DocumentDtos.ExportItem;
import vn.edu.vnu.structpaper.document.DocumentDtos.SaveRequest;
import vn.edu.vnu.structpaper.document.DocumentDtos.SaveResponse;
import vn.edu.vnu.structpaper.exception.PreconditionFailedException;
import vn.edu.vnu.structpaper.exception.ResourceNotFoundException;
import vn.edu.vnu.structpaper.storage.ObjectStorage;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.List;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Word-like document lifecycle: create (named) -> autosave while editing -> explicit save
 * (adds a versioned snapshot file) -> export artifacts. Content + metadata live in the DB;
 * snapshots and exports are files in object storage (MinIO or local disk).
 */
@Service
public class DocumentService {

    private static final Logger log = LoggerFactory.getLogger(DocumentService.class);
    private static final Pattern ID_PATTERN = Pattern.compile("^[A-Za-z0-9_-]{1,64}$");
    private static final Set<String> EXPORT_FORMATS = Set.of("docx", "pdf", "xml");
    private static final int NAME_MAX = 200;

    private final DocumentRepository documents;
    private final DocumentExportRepository exports;
    private final ObjectStorage storage;
    private final ObjectMapper mapper;

    public DocumentService(DocumentRepository documents, DocumentExportRepository exports,
                           ObjectStorage storage, ObjectMapper mapper) {
        this.documents = documents;
        this.exports = exports;
        this.storage = storage;
        this.mapper = mapper;
    }

    private static ResponseStatusException bad(String msg) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, msg);
    }

    static String cleanName(String name) {
        String n = name == null ? "" : name.trim().replaceAll("\\s+", " ");
        if (n.isEmpty()) throw bad("Tên tài liệu không được để trống");
        if (n.length() > NAME_MAX) throw bad("Tên tài liệu tối đa " + NAME_MAX + " ký tự");
        return n;
    }

    private static void checkId(String id) {
        if (id == null || !ID_PATTERN.matcher(id).matches()) throw bad("Mã tài liệu không hợp lệ");
    }

    private String serialize(JsonNode doc) {
        return doc == null || doc.isNull() ? null : doc.toString();
    }

    private JsonNode parse(String json) {
        if (json == null) return null;
        try {
            return mapper.readTree(json);
        } catch (Exception e) {
            log.warn("Stored document JSON is not parseable: {}", e.getMessage());
            return null;
        }
    }

    private DocumentDto toDto(DocumentEntity e, boolean withDoc) {
        return new DocumentDto(e.getId(), e.getName(), e.getJournalId(), e.getStatus(), e.getRev(),
                e.getCreatedAt(), e.getUpdatedAt(), withDoc ? parse(e.getDocJson()) : null);
    }

    @Transactional(readOnly = true)
    public List<DocumentDto> list() {
        return documents.findByDeletedFalseOrderByUpdatedAtDesc().stream()
                .map(s -> new DocumentDto(s.getId(), s.getName(), s.getJournalId(), s.getStatus(), s.getRev(),
                        s.getCreatedAt(), s.getUpdatedAt(), null))
                .toList();
    }

    @Transactional
    public DocumentDto create(String name, String journalId, JsonNode doc) {
        return createWithId(UlidGenerator.nextUlid(), name, journalId, "draft", doc);
    }

    private DocumentDto createWithId(String id, String name, String journalId, String status, JsonNode doc) {
        Instant now = Instant.now();
        DocumentEntity e = new DocumentEntity();
        e.setId(id);
        e.setName(cleanName(name));
        e.setJournalId(journalId == null || journalId.isBlank() ? null : journalId.trim());
        e.setStatus(status == null || status.isBlank() ? "draft" : status.trim());
        e.setRev(1);
        e.setDocJson(serialize(doc));
        e.setCreatedAt(now);
        e.setUpdatedAt(now);
        documents.save(e);
        log.info("Created document id={} name={}", id, e.getName());
        return toDto(e, true);
    }

    @Transactional(readOnly = true)
    public DocumentDto get(String id) {
        return toDto(find(id), true);
    }

    private DocumentEntity find(String id) {
        return documents.findByIdAndDeletedFalse(id)
                .orElseThrow(() -> new ResourceNotFoundException("Document not found: " + id));
    }

    /** Upsert: PUT on an unknown id creates it (offline-first clients sync local documents). */
    @Transactional
    public SaveResponse save(String id, SaveRequest req) {
        checkId(id);
        DocumentEntity existing = documents.findById(id).orElse(null);
        if (existing == null) {
            DocumentDto created = createWithId(id, req.name(), null, req.status(), req.doc());
            return new SaveResponse(created.id(), created.name(), created.rev(), created.updatedAt(), false);
        }
        if (existing.isDeleted()) throw new ResourceNotFoundException("Document not found: " + id);
        if (req.baseRev() != null && req.baseRev() != existing.getRev()) {
            throw new PreconditionFailedException(
                    "Revision conflict: client has " + req.baseRev() + " but server is at " + existing.getRev());
        }
        if (req.name() != null) existing.setName(cleanName(req.name()));
        if (req.status() != null && !req.status().isBlank()) existing.setStatus(req.status().trim());
        if (req.doc() != null) existing.setDocJson(serialize(req.doc()));
        existing.setRev(existing.getRev() + 1);
        existing.setUpdatedAt(Instant.now());

        boolean snapshotted = false;
        if (Boolean.TRUE.equals(req.snapshot()) && existing.getDocJson() != null) {
            String key = "documents/" + id + "/snapshots/" + existing.getRev() + ".json";
            storage.put(key, existing.getDocJson().getBytes(StandardCharsets.UTF_8), "application/json");
            existing.setSnapshotKey(key);
            snapshotted = true;
        }
        documents.save(existing);
        return new SaveResponse(id, existing.getName(), existing.getRev(), existing.getUpdatedAt(), snapshotted);
    }

    @Transactional
    public void delete(String id) {
        DocumentEntity e = find(id);
        e.setDeleted(true);
        e.setUpdatedAt(Instant.now());
        documents.save(e);
    }

    // ---- exports (files in object storage) ----

    @Transactional
    public ExportItem saveExport(String documentId, String format, String fileName, byte[] data, String contentType) {
        find(documentId);
        String fmt = format == null ? "" : format.toLowerCase();
        if (!EXPORT_FORMATS.contains(fmt)) throw bad("Định dạng xuất không hỗ trợ: " + format);
        if (data == null || data.length == 0) throw bad("Tệp xuất trống");
        String safeName = (fileName == null || fileName.isBlank() ? "document." + fmt : fileName)
                .replaceAll("[\\\\/:*?\"<>|\\p{Cntrl}]", "_");
        String exportId = UlidGenerator.nextUlid();
        String key = "documents/" + documentId + "/exports/" + exportId + "." + fmt;
        storage.put(key, data, contentType);
        DocumentExportEntity entity = new DocumentExportEntity(exportId, documentId, fmt, safeName, key, data.length, Instant.now());
        exports.save(entity);
        return toItem(entity);
    }

    @Transactional(readOnly = true)
    public List<ExportItem> listExports(String documentId) {
        find(documentId);
        return exports.findByDocumentIdOrderByCreatedAtDesc(documentId).stream().map(DocumentService::toItem).toList();
    }

    @Transactional(readOnly = true)
    public DocumentExportEntity getExport(String documentId, String exportId) {
        find(documentId);
        return exports.findById(exportId)
                .filter(x -> x.getDocumentId().equals(documentId))
                .orElseThrow(() -> new ResourceNotFoundException("Export not found: " + exportId));
    }

    public byte[] readExportBytes(DocumentExportEntity e) {
        return storage.get(e.getObjectKey())
                .orElseThrow(() -> new ResourceNotFoundException("Export file missing in storage: " + e.getId()));
    }

    private static ExportItem toItem(DocumentExportEntity e) {
        return new ExportItem(e.getId(), e.getFormat(), e.getFileName(), e.getSizeBytes(), e.getCreatedAt());
    }
}
