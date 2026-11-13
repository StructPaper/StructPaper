package vn.edu.vnu.structpaper.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.info.License;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI structPaperOpenAPI() {
        return new OpenAPI()
                .info(new Info()
                        .title("StructPaper XeLaTeX Compiler & Publishing API")
                        .description("Hệ thống Backend Spring Boot 3 chuyên trách biên dịch LaTeX/XeLaTeX tiêu chuẩn xuất bản tạp chí Đại học Quốc gia TP.HCM (VNUHCM).")
                        .version("1.0.0")
                        .contact(new Contact()
                                .name("VNUHCM Publishing Team")
                                .url("https://vnuhcm.edu.vn"))
                        .license(new License()
                                .name("Apache 2.0")
                                .url("https://www.apache.org/licenses/LICENSE-2.0.html")));
    }
}
