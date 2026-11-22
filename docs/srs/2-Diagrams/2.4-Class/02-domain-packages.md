# 2.4.2 Class diagram – Các package lõi (`packages/*`)

Các package thuần TypeScript, không phụ thuộc framework, dùng chung cho web, api, worker.

## `@structpaper/doc-model` – Mô hình tài liệu bài báo (Canonical Schema v2)

```mermaid
classDiagram
    direction TB
    class ManuscriptRecord { +info: ManuscriptInfo +doc: Manuscript +revision?: number }
    class ManuscriptInfo {
      +id +displayName +submissionId +note
      +tags[] +workflowStatus +pinned +archived +color
      +source +ownerId +createdAt +updatedAt +lastOpenedAt
    }
    class Manuscript {
      +schemaVersion: 2
      +id +lang: vi|en +journalId +articleType
      +body: Section[]
      +back: BackMatterItem[]
      +references: Reference[]
      +assets: Record~string,AssetMeta~
      +profilePin?: ProfilePin
      +layoutOverrides?
    }
    class FrontMatter {
      +title: Inline[]
      +translations?
      +abstract: Inline[][]
      +keywords: string[]
      +dates: Dates
      +doi? +volume? +issue? +pages?
    }
    class Author { +id +name +affiliationIds[] +email? +isCorresponding? +orcid? }
    class Affiliation { +id +institution +department? +city? +country? }
    class Dates { +received? +revised? +accepted? +published? }
    class Section { +id +level: 1|2|3 +title: Inline[] +blocks: Block[] +children: Section[] }
    class BackMatterItem { +id +type +title? +content: Block[] }
    class Reference { +id +raw +csl? +doi? +url? +parse: ok|partial|failed }
    class AssetMeta { +id +sha256 +mimeType +fileName? +sizeBytes? +width? +height? +dpi? }
    class ProfilePin { +base +journal +articleType +environmentId }
    class Block { <<union>> }
    class ParagraphBlock { +content: Inline[] }
    class ListBlock { +ordered +items: Block[][] }
    class QuoteBlock { +content: Block[] }
    class BoxBlock { +content: Block[] }
    class EquationBlock { +latex +omml? +numbered +label? +status }
    class FigureBlock { +assetId +caption +source? +panels? +layout }
    class TableBlock { +caption +grid: Cell[][] +headerRows +notes? +source? +layout }
    class PageBreakBlock
    class Cell { +content: Inline[] +rowSpan +colSpan +align? +header? }
    class Inline { <<union>> }
    class TextInline { +v +marks: b|i|sup|sub|code }
    class CiteInline { +refIds[] }
    class XrefInline { +target +kind }
    class MathInline { +latex }
    class FootnoteInline { +blocks: Block[] }
    class LinkInline { +href +content: Inline[] }
    ManuscriptRecord *-- ManuscriptInfo
    ManuscriptRecord *-- Manuscript
    Manuscript *-- FrontMatter : meta
    Manuscript *-- Section : body 1..*
    Manuscript *-- BackMatterItem
    Manuscript *-- Reference
    Manuscript *-- AssetMeta
    Manuscript o-- ProfilePin
    FrontMatter *-- Author
    FrontMatter *-- Affiliation
    FrontMatter *-- Dates
    Author --> Affiliation : affiliationIds
    Section *-- Section : children
    Section *-- Block
    Block <|-- ParagraphBlock
    Block <|-- ListBlock
    Block <|-- QuoteBlock
    Block <|-- BoxBlock
    Block <|-- EquationBlock
    Block <|-- FigureBlock
    Block <|-- TableBlock
    Block <|-- PageBreakBlock
    TableBlock *-- Cell
    ParagraphBlock *-- Inline
    Inline <|-- TextInline
    Inline <|-- CiteInline
    Inline <|-- XrefInline
    Inline <|-- MathInline
    Inline <|-- FootnoteInline
    Inline <|-- LinkInline
    CiteInline ..> Reference
    FigureBlock ..> AssetMeta
```

Hỗ trợ trong `doc-model`: `schemas/*` (Zod), `adapters/migrate-v1-to-v2` ↔ `adapt-v2-to-v1` (giữa `CompletePaper` v1 của UI và `Manuscript` v2), `numbering/compute-numbering` (`ComputedNumbering`), `interfaces/{command,repository}`.

```mermaid
classDiagram
    class ManuscriptRepository { <<interface>> +getById() +save() +delete() +listRecent() +updateInfo?() +getRecord?() +listRecords?() }
    class AssetRepository { <<interface>> +getByHash() +save() +has() }
    class Command~P~ { <<interface>> +type +payload? +undoable? +timestamp? }
    class Patch { +op: add|remove|replace|move|copy|test +path[] +value? }
    class ComputedNumbering { +figures +tables +equations +citations +citationOrder +bibliographyOrder +uncitedRefs +danglingCites +xrefBroken +firstMentionBeforeFloat }
    class IndexedDbManuscriptRepo
    class IndexedDbAssetRepo
    IndexedDbManuscriptRepo ..|> ManuscriptRepository
    IndexedDbAssetRepo ..|> AssetRepository
```

## `@structpaper/journal-profiles` – Profile 3 tầng

```mermaid
classDiagram
    direction LR
    class JournalProfile {
      +id +version +names +color +languages +articleTypes
      +frontMatter: JournalFrontMatterConfig
      +citation: JournalCitationConfig
      +layout: JournalLayoutConfig
      +typography: JournalTypographyConfig
      +latex: JournalLatexConfig
      +qc: JournalQcConfig
      +publication: JournalPublicationConfig
      +styleMap
    }
    class JournalTierProfile
    class ArticleTypeProfile
    class ResolvedProfile { +articleType? }
    class ProfileTiers { +base +journal +articleType? +overrides? }
    class resolveFromTiers { <<function>> +deepMerge theo thứ tự tầng }
    class ProfileRegistry { <<resolver/registry>> +registerRemoteProfiles() +getRemoteJournalTier(id) +getRemoteArticleType(j,code) }
    JournalTierProfile --|> JournalProfile : partial
    ArticleTypeProfile ..> JournalProfile : partial override
    ResolvedProfile --|> JournalProfile
    ProfileTiers --> JournalTierProfile
    ProfileTiers --> ArticleTypeProfile
    resolveFromTiers ..> ProfileTiers
    resolveFromTiers ..> ResolvedProfile : tạo ra
    ProfileRegistry ..> JournalTierProfile
```

## `@structpaper/editor-core`, `@structpaper/qc-engine`, `@structpaper/doc-diff`

```mermaid
classDiagram
    direction TB
    class CommandBus {
      +registerHandler(type, handler)
      +dispatch(command)
      +onPatch(listener)
      +getDocument() +setDocument(doc)
    }
    class ManuscriptStore { <<zustand>> +doc +setDoc() +apply(patches) }
    class HistoryManager {
      +attach(commandBus, store)
      +record(patches, inversePatches)
      +undo(doc) +redo(doc) +clear()
    }
    class BaseCommands
    class BlockCommands
    CommandBus --> ManuscriptStore
    HistoryManager --> CommandBus
    BaseCommands ..> CommandBus : đăng ký
    BlockCommands ..> CommandBus : đăng ký

    class QcEngine { +registerRule(rule) +getRules() +quickFix(issueId) +run(doc, profile) }
    class QcRule { <<interface>> +id +name +category +check(doc, profile, ctx) QcIssue[] }
    class QcIssue { +id +ruleId +severity +message +pillar +targetId? +fix?: Command +fixTab? }
    class MetadataRules
    class StructureRules
    class NumberingRules
    class ReferenceRules
    class FloatRules
    class Scoring { +score(issues, weights) }
    QcEngine --> QcRule
    QcEngine --> Scoring
    QcRule --> QcIssue
    MetadataRules ..|> QcRule
    StructureRules ..|> QcRule
    NumberingRules ..|> QcRule
    ReferenceRules ..|> QcRule
    FloatRules ..|> QcRule
    QcIssue ..> Command : fix

    class DocDiffModule { <<functions>> +diffDocs(before,after) DocDiff +contentFingerprintSource(doc) +flattenLayout() }
    class DocDiff { +fields: FieldChange[] +items: ItemChange[] +blocks: BlockChange[] +stats: DiffStats }
    DocDiffModule ..> DocDiff
```

## `@structpaper/exporters` & `@structpaper/ingest-docx`

```mermaid
classDiagram
    direction LR
    class LatexExporter { +export(manuscript, profile, options) +getTemplateCls()$ }
    class BlockDispatcher
    class FigureToLatex
    class TableToLatex
    class EquationToLatex
    class InlinesToLatex
    class EscapeTex
    class DocxExporter { +exportToDocument(manuscript, options) +exportToBuffer(manuscript, options) }
    class JatsExporter { +export(manuscript, options) xml }
    class ZipPackager { +buildZip(...) +package(...) }
    class CslFormatter { +formatReference(csl) }
    LatexExporter --> BlockDispatcher
    BlockDispatcher --> FigureToLatex
    BlockDispatcher --> TableToLatex
    BlockDispatcher --> EquationToLatex
    BlockDispatcher --> InlinesToLatex
    InlinesToLatex --> EscapeTex
    DocxExporter ..> CslFormatter
    JatsExporter ..> CslFormatter

    class IngestPipeline { +ingest(buffer, options) IngestPipelineResult }
    class DocxPackage { +load(input)$ +getXml(partPath) +getMedia(key) +getMediaByRId(rId) +getRelationship(rId) }
    class RawDocVisitor
    class StyleResolver
    class RecognizerChain { +addRecognizer(r) +recognizeBlock(block,ctx) +recognizeAll(blocks,ctx) }
    class StyleMapRecognizer
    class StructureRecognizer
    class DocAssembler
    class FrontMatterAssembler
    class SectionTreeAssembler
    class TableAssembler
    class FigureAssembler
    class EquationAssembler
    class ReferenceAssembler
    class BackmatterAssembler
    class Normalizers { +unicodeNfc +vietnameseSpacing +captionNumberStripper +citationLinker }
    class Confidence { +calculateConfidence() }
    IngestPipeline --> DocxPackage
    IngestPipeline --> RawDocVisitor
    IngestPipeline --> StyleResolver
    IngestPipeline --> RecognizerChain
    IngestPipeline --> DocAssembler
    IngestPipeline --> Normalizers
    IngestPipeline --> Confidence
    RecognizerChain --> StyleMapRecognizer
    RecognizerChain --> StructureRecognizer
    DocAssembler --> FrontMatterAssembler
    DocAssembler --> SectionTreeAssembler
    DocAssembler --> TableAssembler
    DocAssembler --> FigureAssembler
    DocAssembler --> EquationAssembler
    DocAssembler --> ReferenceAssembler
    DocAssembler --> BackmatterAssembler
```

> Lưu ý: luồng nhập Word đang chạy trong web chủ yếu qua `apps/web/src/lib/docx-*.ts` (bộ đọc cũ v1, `CompletePaper`); `packages/ingest-docx` là pipeline v2 đăng ký bộ đọc cũ làm fallback (`registerLegacyFallbackParser`).
