package vn.edu.vnu.structpaper.manuscript;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface ManuscriptRepository extends JpaRepository<ManuscriptEntity, String> {
}
