package vn.edu.vnu.structpaper.service;

import vn.edu.vnu.structpaper.dto.request.CompileLatexRequest;
import vn.edu.vnu.structpaper.dto.response.CompilerStatusResponse;
import vn.edu.vnu.structpaper.model.CompilationResult;

public interface LatexCompilerService {

    /**
     * Compiles a LaTeX document string into a high-quality PDF.
     *
     * @param request The compilation parameters and LaTeX content
     * @return CompilationResult containing PDF bytes, duration, and logs
     */
    CompilationResult compile(CompileLatexRequest request);

    /**
     * Inspects the host environment to determine compiler availability and versions.
     *
     * @return Current system and compiler status
     */
    CompilerStatusResponse getStatus();
}
