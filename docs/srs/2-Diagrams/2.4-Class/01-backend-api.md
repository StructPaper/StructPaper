# 2.4.1 Class diagram – Backend API (`apps/api`) & Worker (`apps/worker`)

> Chữ ký phương thức được **rút gọn**; tên class/phương thức chính đã đối chiếu với mã nguồn. `<<abstract>>` = abstract class dùng làm token DI (`domain/*.ts`), triển khai ở `infrastructure/`.

Backend là **NestJS 10 + Fastify**; mỗi module chia 3 lớp: `presentation` (controller, guard, decorator) → `application` (service/use case) → `domain` (quy tắc thuần) + `infrastructure` (adapter S3, mail, cache). Dữ liệu qua **Drizzle ORM** (`@structpaper/db`, token DI `DRIZZLE`).

## Module và phụ thuộc

```mermaid
classDiagram
    direction LR
    class AppModule
    class PlatformModule
    class IdentityModule
    class UsersModule
    class AccessModule
    class AssetsModule
    class ManuscriptsModule
    class RevisionsModule
    class SyncModule
    class JournalsModule
    AppModule --> PlatformModule
    AppModule --> IdentityModule
    AppModule --> UsersModule
    AppModule --> AccessModule
    AppModule --> AssetsModule
    AppModule --> ManuscriptsModule
    AppModule --> SyncModule
    AppModule --> JournalsModule
    ManuscriptsModule --> RevisionsModule
    ManuscriptsModule --> JournalsModule
    ManuscriptsModule --> AccessModule
    SyncModule --> AccessModule
    UsersModule --> AccessModule
    IdentityModule --> AccessModule
    AppModule ..> JwtAuthGuard : APP_GUARD
```

## Identity & Access

```mermaid
classDiagram
    direction TB
    class AuthController {
      +login(body, res) TokenResponse
      +refreshGet(req,res)
      +refreshPost(req,body,res)
      +logout(req,body,res)
      +activate(body)
      +resetPassword(body)
      +me(req)
      +account(req)
    }
    class AuthService {
      +login(dto) TokenResponse
      +refresh(raw) TokenResponse
      +logout(raw)
      +activate(dto)
      +resetPassword(dto)
      +verifyTokenWithPermissions(token)
      +me(userId)
    }
    class PasswordService { +hash(pw) +verify(hash,pw) }
    class TokenService { +signAccessToken(payload) +verifyAccessToken(token) +generateRefreshToken() +generateOneTimeToken(hours) +hashToken(token) }
    class MailService { <<abstract>> +sendInvitation(email,token,url) +sendPasswordReset(email,token,url) }
    class JwtAuthGuard { +canActivate(ctx) }
    class PoliciesGuard { +canActivate(ctx) }
    class AbilityFactory {
      +createForUser(userIdOrCtx) AppAbility
      -buildAbility(ctx)
      -loadContextFromDatabase(userId)
    }
    class AbilityCacheService { <<abstract>> +get(userId,pv) +set(userId,pv,ability,ttl) +invalidate(userId) }
    class AccessService { +getRoles() +getPermissions() +assignRole() +revokeRole() }
    class AccessController
    class SuperAdminInvariant { +assertNotLastSuperAdmin() }
    class UserController
    class UserService {
      +list(query, actor)
      +invite(dto, actor)
      +resendInvite(id)
      +revokeInvitation(id)
      +update(id, updates, actor)
      +editability(actor,target)
    }
    AuthController --> AuthService
    AuthService --> PasswordService
    AuthService --> TokenService
    AuthService ..> MailService
    JwtAuthGuard --> AuthService
    JwtAuthGuard --> AbilityCacheService
    AbilityCacheService --> AbilityFactory
    PoliciesGuard --> AbilityFactory
    AccessController --> AccessService
    AccessService --> SuperAdminInvariant
    UserController --> UserService
    UserService --> MailService
    UserService --> SuperAdminInvariant
```

## Manuscripts, Revisions, Sync, Assets

```mermaid
classDiagram
    direction TB
    class ManuscriptController
    class ManuscriptService {
      +createManuscript(dto,userId,ability)
      +listManuscripts(query,ability,userId)
      +getManuscript(id,ability)
      +updateManuscript(id,dto,userId,ability)
      +deleteManuscript(id,ability,userId)
      +changeStatus(id,dto,userId,ability)
      +changeArticleType()
      +upgradeProfile()
      +duplicateFromRevision()
    }
    class RevisionService {
      +beforeSave(manuscript,next,userId,now)
      +list() +get() +createNamed() +update() +remove()
      +restore(id,rid,userId,ability)
      +snapshotCurrent(kind,label)
    }
    class TrashService {
      +list() +preview() +restore() +purge() +bulk()
      +purgeExpired(now)
    }
    class ManuscriptSharingService {
      +getMembers() +addMember() +removeMember()
      +setGeneralAccess() +searchPeople() +recordVisit()
    }
    class ManuscriptPreviewService { +save(id,body,ability) +read(id,ability) }
    class ManuscriptDuplicatesService { +findByTitle(title,userId) }
    class ProfileResolveService { +getPublished() +resolve(journalRef,typeCode,pin) +pinFor(journal,articleType,pin) }
    class SyncController
    class SyncService {
      +submitOps(id,dto,userId,ability)
      +findMissingOps(id,sinceRev)
      +getDoc(id)
    }
    class PatchApplier { <<static>> +apply(docTree,patches) docTree+checksum }
    class SseManagerService { <<abstract>> +addClient(id,reply,req) +removeClient(id,client) +broadcast(id,event,data) +getConnectedCount(id) }
    class AssetController
    class AssetService {
      +createUploadIntent(dto,userId)
      +completeUpload(dto,userId)
      +getAssetById(id)
      -validateMagicBytes(buf,mime)
    }
    class StorageService { <<abstract>> +getPresignedPutUrl() +headObject() +getObjectBuffer() +putObject() +deleteObject() }
    class S3StorageService
    class ManuscriptAccess { <<function>> accessOf(ability,manuscript) }
    ManuscriptController --> ManuscriptService
    ManuscriptController --> RevisionService
    ManuscriptController --> TrashService
    ManuscriptController --> ManuscriptSharingService
    ManuscriptController --> ManuscriptPreviewService
    ManuscriptController --> ManuscriptDuplicatesService
    ManuscriptService --> RevisionService
    ManuscriptService --> ProfileResolveService
    ManuscriptService ..> ManuscriptAccess
    SyncController --> SyncService
    SyncService --> PatchApplier
    SyncService --> SseManagerService
    AssetController --> AssetService
    AssetService --> StorageService
    S3StorageService ..|> StorageService
    ManuscriptPreviewService --> StorageService
```

## Journals & Profiles, Platform

```mermaid
classDiagram
    direction TB
    class JournalController { +list() +get(id) +articleTypes(id) +published() +resolve() }
    class JournalAdminController { +create() +update() +access() +addArticleType() +updateArticleType() +applyProfile() +versions() +createDraft() +updateDraft() +validate() +publish() +rollback() }
    class JournalService { +listJournals() +getJournalById(idOrSlug) +findRow() +mapToDto() }
    class JournalAdminService
    class ArticleTypeService
    class ProfileService {
      +onModuleInit()
      +ensureBaseBaseline() +ensureJournalBaseline() +ensureArticleTypeBaseline()
      +listVersions() +createDraft() +updateDraft()
      +validate() +publish() +rollback()
    }
    class ProfileResolveService
    class ProfileBulkService { +applyToPapers(journalId) }
    class ProfileTiers { <<module: profile-tiers.ts>> +builtInBase() +builtInTier() +builtInArticleTier() +withIdentity() +validateTier() }
    JournalController --> JournalService
    JournalController --> ArticleTypeService
    JournalController --> ProfileResolveService
    JournalAdminController --> JournalAdminService
    JournalAdminController --> ProfileService
    JournalAdminController --> ProfileBulkService
    JournalAdminService --> ProfileService
    ProfileResolveService --> ProfileService
    ProfileService ..> ProfileTiers

    class CompileController { +status(req) +compileLatex(body,req,reply) }
    class CompileService {
      +compile(options,userId) CompileLatexResult
      -compileUncached()
      +generateFallbackPdf()$
    }
    class CompileQueue {
      +concurrency
      +run(userId,job)
      +status(userId)
    }
    class HealthController { +get() }
    class Rfc9457ExceptionFilter
    class ZodValidationPipe
    CompileController --> CompileService
    CompileService --> CompileQueue
```

## Worker (`apps/worker`)

```mermaid
classDiagram
    direction LR
    class WorkerModule { +provides DB_CLIENT, PG_BOSS, S3_CLIENT, S3_BUCKET, LATEX_RUNNER }
    class OutboxDispatcherProcessor {
      +register(boss)
      +processPendingEvents(batchSize=50)
    }
    class LatexCompileProcessor {
      +register(boss)
      +processJob(data) CompileJobResult
    }
    class LatexRunner { <<interface>> +run(tex, engine, assets) RunResult }
    class LocalProcessRunner
    class DockerSandboxRunner
    class LatexExporter
    WorkerModule --> OutboxDispatcherProcessor
    WorkerModule --> LatexCompileProcessor
    LatexCompileProcessor --> LatexRunner
    LocalProcessRunner ..|> LatexRunner
    DockerSandboxRunner ..|> LatexRunner
    LatexCompileProcessor ..> LatexExporter : "@structpaper/exporters"
```
