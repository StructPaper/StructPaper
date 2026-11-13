package vn.edu.vnu.structpaper.document;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

@Repository
public interface DocumentRepository extends JpaRepository<DocumentEntity, String> {

    /** Interface projection: list queries never load the (large) doc_json column. */
    interface Summary {
        String getId();
        String getName();
        String getJournalId();
        String getStatus();
        int getRev();
        Instant getCreatedAt();
        Instant getUpdatedAt();
    }

    List<Summary> findByDeletedFalseOrderByUpdatedAtDesc();

    Optional<DocumentEntity> findByIdAndDeletedFalse(String id);
}
