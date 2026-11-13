package vn.edu.vnu.structpaper.manuscript;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface RevisionRepository extends JpaRepository<RevisionEntity, String> {
    List<RevisionEntity> findByManuscriptIdOrderByRevDesc(String manuscriptId);
}
