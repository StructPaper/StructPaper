# Fonts for Tectonic (baked into the API image)

Put the TTF/TTC files the LaTeX template needs here (Times New Roman, Arial, Calibri,
Palatino Linotype, Microsoft YaHei). They are copied into the API image at build time
(see `apps/api/Dockerfile`) so Tectonic reads them from the container filesystem.

Do NOT bind-mount `C:\Windows\Fonts` into the container: that mount is ~10x slower
(98s vs ~12s for a full article) because of the Windows->WSL2 file sharing layer.

The font binaries are git-ignored (Microsoft licence). Copy them from `C:\Windows\Fonts`
on a dev machine, or supply licensed/open substitutes for production builds.

`SourceSans3-*.ttf` (SIL Open Font License) stand in for Myriad Pro in the journal template
(headings, abstract, side column). They are open, so unlike the Microsoft fonts they are tracked in git.
