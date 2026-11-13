package vn.edu.vnu.structpaper.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.io.File;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Service to manage font requirements for XeLaTeX compilation.
 * Gracefully provides safe academic font fallbacks if commercial Adobe fonts
 * (e.g. MinionPro, MyriadPro, UniversLTStd) are not present in the compile directory.
 */
@Service
public class FontManagerService {

    private static final Logger log = LoggerFactory.getLogger(FontManagerService.class);

    private static final Pattern MINION_FONT_PATTERN = Pattern.compile(
            "\\\\setmainfont\\{MinionPro-Regular\\.otf\\}\\[[^\\]]*\\]", Pattern.DOTALL
    );

    private static final Pattern MYRIAD_FONT_PATTERN = Pattern.compile(
            "\\\\setsansfont\\{MyriadPro-Regular\\.otf\\}\\[[^\\]]*\\]", Pattern.DOTALL
    );

    private static final Pattern MONO_FONT_PATTERN = Pattern.compile(
            "\\\\setmonofont\\{UniversLTStd-Light\\.otf\\}\\[[^\\]]*\\]", Pattern.DOTALL
    );

    private static final Pattern PROLIGHT_PATTERN = Pattern.compile(
            "\\\\newfontfamily\\\\prolight\\{MyriadPro-Light\\.otf\\}\\[[^\\]]*\\]", Pattern.DOTALL
    );

    /**
     * Sanitizes or enhances TeX code with font fallbacks if proprietary fonts are missing.
     *
     * @param rawTex            Original LaTeX content
     * @param compileWorkingDir Directory where compilation takes place
     * @return Safe LaTeX code guaranteed to compile with fontspec
     */
    public String sanitizeForAvailableFonts(String rawTex, File compileWorkingDir) {
        if (rawTex == null || rawTex.isBlank()) {
            return rawTex;
        }

        // Check if MinionPro exists in working directory
        boolean hasMinionInDir = new File(compileWorkingDir, "MinionPro-Regular.otf").exists();
        if (hasMinionInDir) {
            log.info("Tìm thấy font MinionPro-Regular.otf tại thư mục biên dịch, giữ nguyên cấu hình font gốc.");
            return rawTex;
        }

        String processed = rawTex;

        // Replace MinionPro with Times New Roman / TeX Gyre Termes
        if (processed.contains("MinionPro-Regular.otf")) {
            log.info("Không tìm thấy MinionPro-Regular.otf, tự động kích hoạt font chuẩn học thuật (Times New Roman).");
            processed = MINION_FONT_PATTERN.matcher(processed).replaceAll(
                    "\\\\setmainfont{Times New Roman}[Ligatures=TeX]"
            );
        }

        // Replace MyriadPro with Calibri
        if (processed.contains("MyriadPro-Regular.otf")) {
            processed = MYRIAD_FONT_PATTERN.matcher(processed).replaceAll(
                    "\\\\setsansfont{Calibri}[Ligatures=TeX]"
            );
        }

        // Replace UniversLTStd with Calibri Light
        if (processed.contains("UniversLTStd-Light.otf")) {
            processed = MONO_FONT_PATTERN.matcher(processed).replaceAll(
                    "\\\\setmonofont{Calibri Light}[Ligatures=TeX]"
            );
        }

        // Replace \prolight macro with Calibri Light
        if (processed.contains("MyriadPro-Light.otf")) {
            processed = PROLIGHT_PATTERN.matcher(processed).replaceAll(
                    "\\\\newfontfamily\\\\prolight{Calibri Light}[Ligatures=TeX]"
            );
        }

        // Handle \IfFontExistsTF wrappers if present
        processed = processed.replaceAll(
                "\\\\IfFontExistsTF\\{MinionPro-Regular\\.otf\\}\\{[^}]*\\}\\{[^}]*\\}",
                "\\\\setmainfont{Times New Roman}[Ligatures=TeX]"
        );
        processed = processed.replaceAll(
                "\\\\IfFontExistsTF\\{MyriadPro-Regular\\.otf\\}\\{[^}]*\\}\\{[^}]*\\}",
                "\\\\setsansfont{Calibri}[Ligatures=TeX]"
        );
        processed = processed.replaceAll(
                "\\\\IfFontExistsTF\\{UniversLTStd-Light\\.otf\\}\\{[^}]*\\}\\{[^}]*\\}",
                "\\\\setmonofont{Calibri Light}[Ligatures=TeX]"
        );
        processed = processed.replaceAll(
                "\\\\IfFontExistsTF\\{MyriadPro-Light\\.otf\\}\\{[^}]*\\}\\{[^}]*\\}",
                "\\\\newfontfamily\\\\prolight{Calibri Light}[Ligatures=TeX]"
        );

        // Handle custom missing publisher packages (tabcaptionwidth.sty and size9-edited.clo)
        if (processed.contains("\\usepackage{tabcaptionwidth}")) {
            processed = processed.replace(
                    "\\usepackage{tabcaptionwidth}",
                    "\\IfFileExists{tabcaptionwidth.sty}{\\usepackage{tabcaptionwidth}}{\\providecommand{\\tabularWidth}{\\linewidth}}"
            );
        }
        if (processed.contains("\\input{size9-edited.clo}")) {
            processed = processed.replace(
                    "\\input{size9-edited.clo}",
                    "\\IfFileExists{size9-edited.clo}{\\input{size9-edited.clo}}{}"
            );
        }
        if (processed.contains("\\usepackage{multirow-custom}")) {
            processed = processed.replace(
                    "\\usepackage{multirow-custom}",
                    "\\IfFileExists{multirow-custom.sty}{\\usepackage{multirow-custom}}{}"
            );
        }
        // Handle title parbox width calibration for Calibri metrics (ensures line 1 ends at 'cập nhật' and line 2 starts with 'trong điều trị')
        if (processed.contains("\\parbox{\\dimexpr(\\linewidth+4.8cm)}")) {
            processed = processed.replace(
                    "\\parbox{\\dimexpr(\\linewidth+4.8cm)}",
                    "\\parbox{\\dimexpr(\\linewidth+3.9cm)}"
            );
        }

        // Protect compound term in Heading 1 so 'TÁ TRÀNG:' wraps together onto line 2
        processed = processed.replace("T\\'{A} TR\\`{A}NG:", "T\\'{A}~TR\\`{A}NG:");
        processed = processed.replace("TÁ TRÀNG:", "TÁ~TRÀNG:");

        // Tighten author asterisk and comma kerning
        processed = processed.replace("\\textsuperscript{*},", "\\textsuperscript{*}\\!,");

        // Ensure sidebar width does not overflow into Column 1 / Abstract
        if (processed.contains("\\parbox{.27\\textwidth}")) {
            processed = processed.replace("\\parbox{.27\\textwidth}", "\\parbox{4.4cm}");
            processed = processed.replace("\\rule{0.27\\textwidth}{.5pt}", "\\rule{4.4cm}{.5pt}");
        }
        if (processed.contains("\\begin{textblock*}{3cm}(-4.8cm,-2.3cm)")) {
            processed = processed.replace(
                    "\\begin{textblock*}{3cm}(-4.8cm,-2.3cm)\n\\begin{minipage}[b][.93\\paperheight]{3cm}",
                    "\\begin{textblock*}{4.4cm}(-4.8cm,-2.3cm)\n\\begin{minipage}[b][.93\\paperheight]{4.4cm}"
            );
        }

        if (processed.contains("\\Xbox")) {
            processed = "\\providecommand{\\Xbox}[1]{#1}\n" + processed;
        }
        // Safely provide articletype and saythanks without conflicting with packages like abstract.sty
        processed = "\\AtBeginDocument{\\makeatletter\\providecommand{\\articletype}[1]{}\\providecommand{\\saythanks}{}\\makeatother}\n" + processed;

        return processed;
    }
}
