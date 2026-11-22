# 2.4.3 Class diagram – Client: storage, compiler, platform, web app

## `@structpaper/storage` – kho cục bộ IndexedDB (Dexie)

```mermaid
classDiagram
    direction LR
    class StructPaperDB { <<Dexie v2>> +manuscripts +revisions +assets +assetRefs +ingestSources +outbox +compileCache +settings +profiles +profileIndex }
    class StoredManuscript { +id +doc: Manuscript +displayName +tags +workflowStatus +pinned +archived +syncState +rev +updatedAt +journalId }
    class StoredRevision { +id +manuscriptId +rev +createdAt +snapshot }
    class StoredAsset { +hash +mime +size +width +height +dpi +vector +blob }
    class StoredAssetRef { +manuscriptId +hash }
    class StoredIngestSource { +manuscriptId +blob +fileName +importedAt }
    class StoredOutboxItem { +seq +manuscriptId +attempts +payload }
    class StoredCompileCache { +hash +pdfBlob +logs +cachedAt }
    class StoredSetting { +key +value }
    class StoredProfile { +scopeType +scopeId +version +state +config +fetchedAt }
    class StoredProfileIndex { +scopeType +scopeId +checkedAt +latestVersion }
    class IndexedDbManuscriptRepo
    class IndexedDbAssetRepo
    class AutosaveEngine { +schedule() +flush() }
    class ZipBackup { +export() +import() }
    StructPaperDB *-- StoredManuscript
    StructPaperDB *-- StoredRevision
    StructPaperDB *-- StoredAsset
    StructPaperDB *-- StoredAssetRef
    StructPaperDB *-- StoredIngestSource
    StructPaperDB *-- StoredOutboxItem
    StructPaperDB *-- StoredCompileCache
    StructPaperDB *-- StoredSetting
    StructPaperDB *-- StoredProfile
    StructPaperDB *-- StoredProfileIndex
    IndexedDbManuscriptRepo --> StructPaperDB
    IndexedDbAssetRepo --> StructPaperDB
    AutosaveEngine --> IndexedDbManuscriptRepo
    ZipBackup --> StructPaperDB
```

## `@structpaper/compiler-client` – biên dịch đa môi trường

```mermaid
classDiagram
    direction TB
    class CompilerPort { <<interface>> +capability(req) CapabilityVerdict +compile(req) CompileResult +onProgress(cb) Unsubscribe }
    class WasmCompiler
    class WorkerBridge
    class LatexWasmWorker { <<Web Worker>> }
    class PdfTypesetter
    class VirtualFs
    class LogParser { +parse(log) CompileReport }
    class LocalNextCompiler
    class TauriDesktopCompiler
    class RemoteCompiler { +compile() -> POST /compile/latex }
    class MockCompiler
    class CompilerRouter { +decide(ctx) Decision +compile(req) }
    class Rule { <<interface>> +id +evaluate(ctx) Decision|null }
    class CompileContext { +online +serverReachable +localEnv +localEnvMatches +deviceScore +pageEstimate +assetBytes +recentLocalFailures +userPreference +parity +localDisabledByFlag +saveData }
    class CompileScheduler { +request(req) +cancel() }
    class CompileCache { +get(hash) +put(hash,result) }
    class NetworkMonitor { +online +serverReachable }
    WasmCompiler ..|> CompilerPort
    LocalNextCompiler ..|> CompilerPort
    TauriDesktopCompiler ..|> CompilerPort
    RemoteCompiler ..|> CompilerPort
    MockCompiler ..|> CompilerPort
    WasmCompiler --> WorkerBridge
    WorkerBridge --> LatexWasmWorker
    LatexWasmWorker --> PdfTypesetter
    LatexWasmWorker --> VirtualFs
    WasmCompiler --> LogParser
    CompilerRouter --> CompilerPort : local / server
    CompilerRouter --> Rule : 11 luật có thứ tự
    CompilerRouter ..> CompileContext
    CompileScheduler --> CompilerRouter
    CompileScheduler --> CompileCache
    CompilerRouter --> NetworkMonitor
```

Thứ tự 11 luật (`router/rules`): 01 final→server · 02 kill-switch · 03 prefer-server · 04 offline+local ready→local · 05 offline không env→E1 (HTML nhanh) · 06 substitute fonts · 07 env chưa sẵn sàng→server · 08 thiết bị yếu→server · 09 quá lớn (>40 MB)→server · 10 lỗi cục bộ gần đây (10 phút)→server · 11 mặc định→local.

## `@structpaper/platform*` – trừu tượng hóa nền tảng

```mermaid
classDiagram
    direction LR
    class PlatformServices { +capabilities +config +files +updates +shell +window }
    class Capabilities { +kind: web|desktop +canInstallApp +hasAppUpdater +hasNativeCompiler +hasFileSystem }
    class RuntimeConfig { +apiBaseUrl +appVersion +buildId +channel }
    class FileService { <<interface>> }
    class ShellService { <<interface>> }
    class UpdateService { <<interface>> +check() +downloadAndInstall() +state }
    class WindowService { <<interface>> }
    class WebFileService
    class WebShellService
    class WebUpdateService
    class WebWindowService
    class DesktopFileService
    class DesktopShellService
    class DesktopUpdateService
    class DesktopWindowService
    PlatformServices *-- Capabilities
    PlatformServices *-- RuntimeConfig
    PlatformServices o-- FileService
    PlatformServices o-- ShellService
    PlatformServices o-- UpdateService
    PlatformServices o-- WindowService
    WebFileService ..|> FileService
    WebShellService ..|> ShellService
    WebUpdateService ..|> UpdateService
    WebWindowService ..|> WindowService
    DesktopFileService ..|> FileService
    DesktopShellService ..|> ShellService
    DesktopUpdateService ..|> UpdateService
    DesktopWindowService ..|> WindowService
```

## Ứng dụng web (`apps/web`) – các lớp chính

```mermaid
classDiagram
    direction TB
    class PaperContext { <<React Context>> +paper: CompletePaper +setPaper() +currentJournal +isDirty }
    class StorageContext { <<React Context>> +repo: UnifiedManuscriptRepository }
    class EditorSessionContext
    class AuthStore { <<zustand>> +accessToken +user +capabilities +login() +logout() }
    class UnifiedManuscriptRepository { +save() +load() +list() +syncPending() }
    class DocumentApi { +list() +get() +save(baseRev) +delete() +upload preview }
    class AutosaveController { +notify(paper) +flush() +overwrite() +state: SaveState }
    class useDocumentAutosave
    class useEditorCompilation
    class useEditorExport
    class useServerPdfPreview
    class useBatchImport
    class RunBatch { +run(items, deps) }
    class Limiter { +acquire() }
    class Access { <<lib/access>> +can(capability) +explain() }
    class Gate { <<component>> capability, mode }
    class PaperAccess { <<features/papers/access>> +canView +canEdit +canShare +canDelete +readOnly }
    class CompletePaper { +id +displayName +metadata +sections +references +layoutSettings +templateId +workflowStatus }
    class TemplateEngineSchema { +pageArchitecture +layoutZones +elementRules +floatingRules }
    PaperContext --> CompletePaper
    PaperContext --> UnifiedManuscriptRepository
    StorageContext --> UnifiedManuscriptRepository
    UnifiedManuscriptRepository --> DocumentApi
    useDocumentAutosave --> AutosaveController
    AutosaveController --> UnifiedManuscriptRepository
    AutosaveController --> DocumentApi
    useEditorCompilation ..> CompilerRouter
    useEditorExport ..> LatexExporter
    useBatchImport --> RunBatch
    RunBatch --> Limiter
    Gate --> Access
    Access --> AuthStore
    PaperAccess ..> Access
    CompletePaper ..> TemplateEngineSchema : theo templateId
```

> Mô hình UI hiện tại là `CompletePaper` (v1, `apps/web/src/types/paper.ts`); chuyển đổi hai chiều với `Manuscript` v2 qua `migrateV1toV2` / `adaptV2toV1`.
