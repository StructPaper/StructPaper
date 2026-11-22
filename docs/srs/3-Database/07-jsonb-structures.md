# 3.7 Cấu trúc JSON trong các cột JSONB

Các cột `jsonb` chứa dữ liệu có cấu trúc nhưng không chuẩn hóa thành bảng. Tài liệu này mô tả hình dạng của từng cột. Nguồn kiểu: `packages/doc-model`, `packages/journal-profiles`, `packages/doc-diff`, `packages/contracts`.

| Bảng.cột | Mô tả ngắn | Ai ghi |
|---|---|---|
| `profile_versions.config` | Quy tắc profile một tầng | Manager (tab Layout/FrontMatter/…) |
| `article_types.labels` | Tên loại bài vi/en | Manager |
| `manuscripts.profile_pin` | Phiên bản profile đã ghim | Server khi tạo/nâng |
| `manuscripts.metadata` | **Nội dung bài** (CompletePaper) | Client autosave |
| `manuscript_profile_snapshots.pin / resolved` | Profile đã gộp | Server |
| `manuscript_docs.doc_tree` | Cây tài liệu đồng bộ | `PatchApplier` |
| `manuscript_ops.patches` | Danh sách patch | Client sync |
| `manuscript_revisions.snapshot / stats` | Bản chụp bài + thống kê thay đổi | `RevisionService` |
| `permissions.conditions` | Điều kiện CASL | Quản trị |
| `audit_logs.payload` | Chi tiết sự kiện kiểm toán | Server |
| `outbox_events.payload` | Nội dung sự kiện | Server |
| `idempotency_keys.response_body` | Phản hồi lưu lại | (chưa dùng) |

## `profile_versions.config` – quy tắc profile

Một tầng chỉ chứa **phần ghi đè**; tầng `base` đầy đủ. `ResolvedProfile = deepMerge(base, journal, articleType, overrides)`; `id` của tạp chí được giữ lại, thêm `articleType`.

> **Các giá trị dưới đây chỉ để minh họa hình dạng dữ liệu.** Kiểu chính xác: `packages/journal-profiles/src/types/profile.ts`; giá trị thật của từng tạp chí: `packages/journal-profiles/src/profiles/*` và `profile_versions.config` trong DB.

```jsonc
{
  "id": "hs",                       // định danh tầng
  "version": "1.0.0",
  "names": { "vi": "…", "en": "…", "short": "VNUHCM-HS" },
  "color": "#2B74B7",
  "languages": ["vi", "en"],
  "articleTypes": [ { "id": "research", "labels": {"vi":"…","en":"…"} } ],

  "frontMatter": {
    "abstract": { "minWords": 275, "maxWords": 500, "structured": true },
    "keywords": { "min": 3, "max": 5, "separator": ";" },
    "dateFormat": "YYYY-MM-DD",
    "doiPattern": "^10\\.32508/vnuhcm-[a-z]+\\.\\d+$"
  },
  "citation": { "style": "vancouver", "inText": "bracket", "rangeDash": "-" },
  "styleMap": { "ArticleTitle": "title", "Heading1": "h1", "TableCaption": "table.caption", "…": "…" },

  "layout": {
    "paperSize": "A4", "columns": 2,
    "margins": { "top": 20, "bottom": 20, "left": 17, "right": 13, "unit": "mm" },
    "columnGap": 6, "headerHeight": 12, "footerHeight": 10
  },
  "typography": {
    "fontFamilies": { "main": "Times New Roman", "heading": "Calibri", "mono": "Courier New" },
    "fontSizes": { "title": 18, "heading1": 11, "heading2": 10, "heading3": 9, "body": 9, "caption": 8, "table": 8, "reference": 8 },
    "leading": { "body": 11 },
    "widowOrphan": { "widows": 2, "orphans": 2 }
  },
  "latex": { "cls": "structpaper-hs.cls", "engine": "xelatex", "fonts": { "main": "…", "sans": "…", "mono": "…", "math": "…" } },
  "qc": { "ruleset": ["meta-title", "meta-abstract", "num-dangling-cites", "…"], "weights": { "imrad": 20, "figures": 15 } },
  "publication": { "publisher": "…", "issn": "2734-9276", "doiPrefix": "10.32508/stdjhs", "headerText": "…" }
}
```

`styleMap` ánh xạ **tên style Word → vai trò cấu trúc** (dùng khi nhập DOCX; `Instruction`, `Guide*` → `ignore`). `qc.ruleset` liệt kê id luật QC (`meta-*`, `struct-*`, `num-*`, `ref-*`, `float-*`).

## `manuscripts.profile_pin` / `manuscript_profile_snapshots.pin`

```json
{ "base": 1, "journal": 3, "articleType": 2 }
```
Mỗi khóa là số `profile_versions.version` của tầng tương ứng; thiếu khóa = tầng không áp dụng.

## `manuscripts.metadata` – nội dung bài (`CompletePaper`)

Hai dạng, `docFromStored`/`storedFromDoc` (`packages/doc-diff/src/stored.ts`) đọc cả hai:

* **Bọc (wrapped):** `{ "doc": { metadata, sections, references, layoutSettings, displayName }, …khác }`.
* **Phẳng (flat):** các trường của `metadata` nằm trực tiếp ở gốc, kèm `displayName`, `sections`, `references`, `layoutSettings`, `templateId`, `templateName`.

```jsonc
{
  "displayName": "Tên tài liệu",
  "templateId": "hs", "templateName": "VNUHCM-HS",
  "metadata": {                    // PaperMetadata
    "title": "…", "titleEn": "…", "articleType": "research", "articleTypeEn": "Research Article",
    "journalId": "hs", "journalName": "…", "journalAbbv": "HS",
    "authors": [ { "id":"…", "name":"…", "affiliationIds":["…"], "email":"…", "isCorresponding": true, "orcid":"…" } ],
    "affiliations": [ { "id":"…", "institution":"…", "department":"…", "city":"…", "country":"…" } ],
    "abstract": "…", "abstractEn": "…", "keywords": ["…"], "keywordsEn": ["…"],
    "dates": { "received":"dd/mm/yyyy", "revised":"…", "accepted":"…", "published":"…" },
    "doi": "…", "volume": "…", "issue": "…", "year": "…", "firstPage": "…", "lastPage": "…",
    "publication": { /* PublicationInfo */ }
  },
  "sections": [                    // danh sách phẳng, theo thứ tự
    { "id":"…", "type":"h1|h2|h3|paragraph|figure|table|quote|box|citation|equation",
      "content":"…", "figure":{…}, "table":{ "grid": [[…]], "columnSpan":"1-column|2-column", … },
      "equation":{ "latex":"…", "columnSpan":"…", "numbered": true },
      "pageBreakAfter": false, "pageLayout": { "columns": 1, "orientation": "landscape", "turned": true } }
  ],
  "references": [ { "id":"…", "raw":"…", "authors":"…", "title":"…", "journal":"…", "year":"…", "doi":"…", "isCited": true, "citationCount": 2 } ],
  "layoutSettings": {                // LayoutSettings (apps/web/src/types/paper.ts)
    "paperSize": "a4",               // custom | a4 | letter | b5
    "columnLayout": "2-column",      // 1-column | 2-column
    "orientation": "portrait",       // portrait | landscape (cả thân bài; trang 1 luôn dọc)
    "fontSize": "9pt",               // 9pt | 10pt | 11pt
    "columnSep": "1pc",              // 1pc | 1.5pc | 2pc
    "lineSpacing": "1.13",           // 1.13 | 1.2 | 1.3
    "pageNumbering": { },            // PageNumberingSettings
    "referenceDoi": "journal",       // journal | available | link | none
    "balanceColumns": true,
    "rangeDash": true,
    "theme": {                       // ThemeSettings (types/paper-extensions.ts), mọi trường tùy chọn
      "titleColor": "#2B74B7", "tableHeaderColor": "#E5E5E5", "tableZebraColor": "#E7ECF7",
      "bodyFont": "Times New Roman", "headingFont": "Calibri",
      "bodyFontSizePt": 9, "lineHeight": 1.13,
      "margins": { "top": 1.8, "bottom": 2, "left": 1.7, "right": 1.3 },   // cm
      "repeatTableHeader": true, "longTableRowThreshold": 12,
      "keepSectionNumbers": false, "englishSummaryPage": true,
      "continuedTitleText": "Table {n} continued", "continuedFootText": "Continued on next page"
    }
  }
}
```

Hình ảnh không nhúng base64: `figure.src`/`assetId` dạng `asset:<sha256>`.

## Canonical Manuscript v2 (`doc-model`)

Dùng cho adapter `migrateV1toV2`/`adaptV2toV1` và các package (editor-core, exporters, qc). Cấu trúc: `Manuscript { schemaVersion:2, id, lang, journalId, articleType, meta: FrontMatter, body: Section[], back, references: Reference[], assets: Record<sha256|id, AssetMeta>, profilePin, layoutOverrides }`; khối `Block` (8 loại) và `Inline` (6 loại) xem [2.4.2](../2-Diagrams/2.4-Class/02-domain-packages.md).

## `manuscript_docs.doc_tree` và `manuscript_ops.patches`

```jsonc
// doc_tree
{ "type": "doc", "content": [ /* nút tài liệu */ ] }
// patches (kiểu JSON-Patch rút gọn)
[ { "op": "replace", "path": ["content", 3, "text"], "value": "…" },
  { "op": "add",     "path": ["content", 4], "value": { … } } ]
```
`PatchApplier.apply` áp bất biến rồi tính SHA-256 xác định của cây ⇒ `checksum`.

## `manuscript_revisions.snapshot` và `stats`

* `snapshot`: một `DocLike` `{ metadata, sections, references, layoutSettings, displayName }` – chính là `metadata.doc` lúc chụp.
* `stats` (`DiffStats` so với bản liền trước):

```json
{ "blocksAdded": 2, "blocksRemoved": 0, "blocksModified": 5, "blocksMoved": 1,
  "wordsDelta": 120, "refsDelta": 1, "fieldsChanged": 3, "itemsChanged": 0, "layoutChanged": false }
```

## `outbox_events.payload`

```jsonc
// ManuscriptStatusChanged
{ "manuscriptId":"…", "previousStatus":"DRAFT", "newStatus":"SUBMITTED",
  "changedBy":"<userId>", "reason":null, "note":null, "timestamp":"ISO-8601" }
// OP_APPLIED
{ "manuscriptId":"…", "serverRev": 42, "opId":"…", "checksum":"…" }
// compile.requested / compile.latex  (CompileLatexJobData)
{ "jobId":"…", "manuscriptId":"…", "revisionId":null, "serverRev":0, "engine":"XELATEX" }
```

## `audit_logs.payload` (ví dụ)

```json
{ "title": "Bài A", "journalId": "…" }
```
