package vn.edu.vnu.structpaper.document;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface DocumentExportRepository extends JpaRepository<DocumentExportEntity, String> {

    List<DocumentExportEntity> findByDocumentIdOrderByCreatedAtDesc(String documentId);
}
