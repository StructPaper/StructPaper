package vn.edu.vnu.structpaper;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import vn.edu.vnu.structpaper.config.LatexCompilerProperties;

@SpringBootApplication
@EnableConfigurationProperties(LatexCompilerProperties.class)
public class StructPaperApplication {

    public static void main(String[] args) {
        SpringApplication.run(StructPaperApplication.class, args);
    }
}
