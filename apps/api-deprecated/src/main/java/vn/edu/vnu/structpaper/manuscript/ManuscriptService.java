package vn.edu.vnu.structpaper.manuscript;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.vnu.structpaper.exception.PreconditionFailedException;
import vn.edu.vnu.structpaper.exception.ResourceNotFoundException;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
public class ManuscriptService {

    private static final Logger log = LoggerFactory.getLogger(ManuscriptService.class);

    private final ManuscriptRepository manuscriptRepository;
    private final RevisionRepository revisionRepository;
    private final ObjectMapper objectMapper;

    public ManuscriptService(ManuscriptRepository manuscriptRepository,
                             RevisionRepository revisionRepository,
                             ObjectMapper objectMapper) {
        this.manuscriptRepository = manuscriptRepository;
        this.revisionRepository = revisionRepository;
        this.objectMapper = objectMapper;
    }

    @Transactional(readOnly = true)
    public ManuscriptEntity getManuscript(String id) {
        return manuscriptRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Manuscript not found: " + id));
    }

    @Transactional(readOnly = true)
    public Optional<ManuscriptEntity> findManuscript(String id) {
        return manuscriptRepository.findById(id);
    }

    @Transactional
    public SaveManuscriptResponse saveOrUpdate(String id, String ifMatchHeader, String docJson) {
        if (ifMatchHeader == null || ifMatchHeader.isBlank()) {
            throw new PreconditionFailedException("If-Match header is required for optimistic locking");
        }

        String clean = ifMatchHeader.replaceAll("^\"|\"$", "").trim();
        boolean isWildcard = "*".equals(clean);
        int expectedRev = -1;
        if (!isWildcard) {
            try {
                expectedRev = Integer.parseInt(clean);
            } catch (NumberFormatException e) {
                throw new PreconditionFailedException("Invalid If-Match revision format: " + ifMatchHeader);
            }
        }

        String title = null;
        String journalId = null;
        try {
            JsonNode root = objectMapper.readTree(docJson);
            if (root.hasNonNull("title")) {
                title = root.get("title").asText();
                if (title.length() > 500) {
                    title = title.substring(0, 500);
                }
            }
            if (root.hasNonNull("journalId")) {
                journalId = root.get("journalId").asText();
                if (journalId.length() > 64) {
                    journalId = journalId.substring(0, 64);
                }
            }
        } catch (Exception e) {
            log.warn("Không thể bóc tách metadata từ docJson cho manuscript {}: {}", id, e.getMessage());
        }

        Optional<ManuscriptEntity> existingOpt = manuscriptRepository.findById(id);
        Instant now = Instant.now();
        int newRev;
        ManuscriptEntity entity;

        if (existingOpt.isEmpty()) {
            if (!isWildcard && expectedRev > 1) {
                throw new ResourceNotFoundException("Manuscript not found: " + id);
            }
            newRev = 1;
            entity = new ManuscriptEntity(id, title, journalId, newRev, docJson, now, now);
            log.info("Khởi tạo manuscript mới: id={}, rev=1", id);
        } else {
            ManuscriptEntity existing = existingOpt.get();
            if (!isWildcard && existing.getRev() != expectedRev) {
                log.warn("Xung đột phiên bản cho manuscript {}: client rev={}, db rev={}", id, expectedRev, existing.getRev());
                throw new PreconditionFailedException("Revision conflict: expected " + expectedRev + " but current revision is " + existing.getRev());
            }
            newRev = existing.getRev() + 1;
            existing.setRev(newRev);
            existing.setDocJson(docJson);
            if (title != null) existing.setTitle(title);
            if (journalId != null) existing.setJournalId(journalId);
            existing.setUpdatedAt(now);
            entity = existing;
            log.info("Cập nhật manuscript: id={}, rev={}", id, newRev);
        }

        manuscriptRepository.save(entity);

        String revId = id + "-rev-" + newRev + "-" + UUID.randomUUID().toString().substring(0, 8);
        RevisionEntity revision = new RevisionEntity(revId, id, newRev, "Revision " + newRev, docJson, now);
        revisionRepository.save(revision);

        return new SaveManuscriptResponse(id, newRev, now);
    }

    @Transactional(readOnly = true)
    public List<RevisionHistoryItem> getRevisions(String manuscriptId) {
        if (!manuscriptRepository.existsById(manuscriptId)) {
            throw new ResourceNotFoundException("Manuscript not found: " + manuscriptId);
        }
        return revisionRepository.findByManuscriptIdOrderByRevDesc(manuscriptId)
                .stream()
                .map(RevisionHistoryItem::fromEntity)
                .toList();
    }
}
