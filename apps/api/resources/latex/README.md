# Branding images used by the journal LaTeX template

Extracted from the journals' own published PDFs (docs/Yêu cầu phần mềm, Template, các file mẫu của Tạp chí):

- `open-access.png` – the Open Access padlock on the first page header
- `check-update.jpeg` – the "Check for updates" badge in the first page side column
- `logo-vnuhcmpress-color.png` – VNUHCM PRESS logo (side column, when there is room)

`CompileService` copies every file of this folder next to the `.tex` before compiling, so the template's
`\IncludeGraphics`/`\IfFileExists` calls find them. All seven journals use the same three images.
