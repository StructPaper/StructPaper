# Fonts for Tectonic (baked into the api and worker images)

Every TTF/TTC file in this folder is **committed to git** and copied into the api and worker images at
build time (`apps/api/Dockerfile`, `apps/worker/Dockerfile`), so Tectonic reads them from the container
filesystem. CI builds the images from a git checkout, so a font that is not committed here does not exist in
the deployed image: the LaTeX template's main font (Times New Roman, else Palatino Linotype) would be missing
and every compile would fail.

What the template uses: Times New Roman (body), Source Sans 3 / Calibri (headings, abstract, side column),
Arial, Palatino Linotype (last resort for the body), SimSun (Han characters, as the printed journal sets them) and Microsoft YaHei (CJK fallback).

`SourceSans3-*.ttf` (SIL Open Font License) stand in for Myriad Pro in the journal template.

Do NOT bind-mount `C:\Windows\Fonts` into the container: that mount is ~10x slower (98s vs ~12s for a full
article) because of the Windows->WSL2 file sharing layer. Add a font by copying it into this folder and committing it.
