package vn.edu.vnu.structpaper.compile;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.util.Map;

/**
 * Journal artwork every page-1 layout needs, bundled on the classpath (/latex-assets) so a compile
 * never depends on a developer checkout path: the Open Access icon, the "Check for updates" badge
 * and the VNUHCM Press logo. Written under the exact names the LaTeX template looks for.
 * A paper's own figures are never aliased to these names (a figure called image3.jpeg must stay a figure).
 */
public final class LatexAssets {
    private static final Logger log = LoggerFactory.getLogger(LatexAssets.class);

    /** classpath resource -> file names written into the job directory. */
    private static final Map<String, String[]> BUNDLED = Map.of(
            "open-access.png", new String[] {"open-access.png"},
            "check-update.jpeg", new String[] {"check-update.jpeg", "check-update.jpg"},
            "logo-vnuhcmpress-color.png", new String[] {"logo-vnuhcmpress-color.png"}
    );

    private LatexAssets() {}

    public static void copyBundled(File workDir, File imagesDir) {
        for (Map.Entry<String, String[]> e : BUNDLED.entrySet()) {
            try (InputStream in = LatexAssets.class.getResourceAsStream("/latex-assets/" + e.getKey())) {
                if (in == null) {
                    log.warn("Thiếu tài nguyên LaTeX đóng gói: {}", e.getKey());
                    continue;
                }
                byte[] bytes = in.readAllBytes();
                for (String name : e.getValue()) {
                    Files.write(new File(workDir, name).toPath(), bytes);
                    if (imagesDir != null) Files.write(new File(imagesDir, name).toPath(), bytes);
                }
            } catch (IOException ex) {
                log.warn("Không thể sao chép {}: {}", e.getKey(), ex.getMessage());
            }
        }
    }
}
