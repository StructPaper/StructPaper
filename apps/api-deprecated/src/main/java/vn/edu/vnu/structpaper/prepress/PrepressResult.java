package vn.edu.vnu.structpaper.prepress;

import java.util.List;

public class PrepressResult extends PrepressReport {

    public PrepressResult() {
        super();
    }

    public PrepressResult(byte[] pdfBytes,
                          boolean pdfXCompliant,
                          boolean allFontsEmbedded,
                          String colorSpace,
                          long durationMs,
                          List<String> warnings,
                          boolean mock) {
        super(pdfBytes, pdfXCompliant, allFontsEmbedded, colorSpace, durationMs, warnings, mock);
    }
}
