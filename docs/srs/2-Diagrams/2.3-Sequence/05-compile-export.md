# 2.3.5 Sequence – Biên dịch, QC, xuất bản (SD-25 … SD-29)

Activity tương ứng: [2.2.5](../2.2-Activity/05-compile-export.md).

## SD-25 Biên dịch PDF với router

```mermaid
sequenceDiagram
    participant Ed as Editor (useEditorCompilation)
    participant Sch as CompileScheduler
    participant Ex as LatexExporter
    participant Ca as compile-cache (IndexedDB)
    participant Ro as CompilerRouter (11 rules)
    participant Lo as WasmCompiler / TauriDesktopCompiler
    participant Re as RemoteCompiler
    participant API as CompileController
    participant CS as CompileService
    participant Q as CompileQueue
    participant TX as tectonic / xelatex
    Ed->>Sch: request(paper, mode)
    Sch->>Ex: export(manuscript, profile)
    Ex-->>Sch: tex + images
    Sch->>Ca: get(hash)
    alt cache hit
        Ca-->>Ed: pdfBlob
    else miss
        Sch->>Ro: decide(context)
        Ro-->>Sch: Decision {server | local | html-preview}
        alt local
            Sch->>Lo: compile(request)
            Lo-->>Sch: pdf | lỗi (OOM/Timeout/Crash)
            opt lỗi cục bộ
                Sch->>Ro: ghi recentLocalFailures
                Sch->>Re: compile(request)
            end
        else server
            Sch->>Re: compile(request)
            Re->>API: POST /compile/latex (Bearer)
            API->>CS: compile(body, userId)
            CS->>CS: kiểm cache 30 phút
            CS->>Q: run(userId, job)
            Q->>TX: spawn (timeout 300s)
            TX-->>CS: PDF buffer
            CS-->>API: {pdfBuffer, engine}
            API-->>Re: 200 application/pdf (X-Compiler-Engine)
        end
        Sch->>Ca: put(hash, pdf)
        Sch-->>Ed: pdf
    end
    Ed->>Ed: hiển thị PdfInteractiveViewer
```

## SD-26 Worker biên dịch nền & outbox

```mermaid
sequenceDiagram
    participant DB as PostgreSQL
    participant OD as OutboxDispatcherProcessor
    participant PB as pg-boss
    participant W as LatexCompileProcessor
    participant EX as LatexExporter
    participant R as LatexRunner (local-process / docker-sandbox)
    participant S3 as S3 / MinIO
    OD->>DB: SELECT outbox_events WHERE status='PENDING' LIMIT 50
    loop mỗi sự kiện
        OD->>PB: send('compile.latex', payload)
        alt gửi OK
            OD->>DB: UPDATE status='PROCESSED', processed_at
        else lỗi
            OD->>DB: UPDATE retry_count+1 (>=5 → FAILED)
        end
    end
    PB->>W: job compile.latex
    W->>DB: UPDATE compile_jobs SET status='PROCESSING'
    W->>DB: SELECT manuscripts, manuscript_docs/revisions
    W->>EX: export(manuscript) → .tex
    W->>R: run(tex, engine)
    R-->>W: pdf buffer + log
    W->>S3: PutObject(pdf)
    W->>DB: INSERT assets
    W->>DB: UPDATE compile_jobs SET status='COMPLETED', pdf_asset_id, duration_ms
```

## SD-27 QC & cổng xuất

```mermaid
sequenceDiagram
    actor A as Author
    participant UI as PreflightQCTab / ValidationModals
    participant W as preflight-wrapper
    participant Q as QcEngine
    participant Ru as Rules (metadata, structure, numbering, reference, float)
    participant Sc as scoring
    A->>UI: Mở QC / Xuất
    UI->>W: runPreflight(paper, profile)
    W->>Q: run(manuscript, ruleset)
    loop từng luật
        Q->>Ru: check(manuscript)
        Ru-->>Q: issues[]
    end
    Q->>Sc: score(issues, weights)
    Sc-->>Q: score
    Q-->>UI: report
    alt xuất & có vấn đề
        UI-->>A: Hộp thoại (Sửa / Vẫn xuất)
        A->>UI: Vẫn xuất
    end
```

## SD-28 Xuất PDF / DOCX / JATS / zip

```mermaid
sequenceDiagram
    actor A as Author
    participant Dk as DockDownloadMenu
    participant Ex as useEditorExport
    participant V as Cổng kiểm tra
    participant L as LatexExporter + compile (SD-25)
    participant D as DocxExporter
    participant J as JatsExporter
    participant Z as ZipPackager
    participant API as API
    A->>Dk: Chọn định dạng
    Dk->>Ex: export(format)
    Ex->>V: validate (cảnh báo)
    V-->>Ex: ok / Vẫn xuất
    alt PDF
        Ex->>L: compile
        L-->>Ex: PDF | lỗi
    else DOCX
        Ex->>D: build(paper, layout)
        D-->>Ex: Blob .docx
    else XML
        Ex->>J: build(manuscript)
        J-->>Ex: XML JATS 1.2
    else XML + hình
        Ex->>J: build
        Ex->>Z: pack(xml, images theo articles/…)
        Z-->>Ex: .zip
    end
    Ex-->>A: tải tệp
    Ex->>API: lưu bản xuất / PDF (nếu có server)
```

## SD-29 Tương tác PDF & xoay trang

```mermaid
sequenceDiagram
    actor A as Author
    participant V as PdfInteractiveViewer (pdf.js)
    participant CT as pdf-click-target
    participant SM as pdf-section-map
    participant Ed as Editor tabs
    participant PT as page-turn
    participant Cm as useEditorCompilation
    A->>V: Nhấp đúp vào đoạn
    V->>CT: lấy văn bản/điểm nhấp
    CT->>SM: match(text, paper.sections)
    SM-->>Ed: sectionId
    Ed->>Ed: mở tab + cuộn + tô sáng thẻ
    Ed-->>V: tô dòng vài giây
    A->>V: Trang này: Ngang
    V->>PT: turnPage(pageIndex, orientation)
    PT->>PT: gắn pageLayout{turned:true} cho mục đầu trang, dấu đóng cho trang kế
    PT-->>Ed: paper cập nhật
    Ed->>Cm: biên dịch lại
    Cm-->>V: PDF mới
    V-->>A: Cảnh báo trang trống (nếu < 55%) + Hoàn tác
```
