# 2.4 Class diagrams

| File | Phạm vi |
|---|---|
| [01-backend-api.md](01-backend-api.md) | `apps/api` (9 module NestJS: Identity, Users, Access, Assets, Manuscripts, Revisions, Sync, Journals, Platform) + `apps/worker` |
| [02-domain-packages.md](02-domain-packages.md) | `doc-model` (Manuscript, Block, Inline), `journal-profiles`, `editor-core`, `qc-engine`, `doc-diff`, `exporters`, `ingest-docx` |
| [03-client-web.md](03-client-web.md) | `storage` (IndexedDB), `compiler-client`, `platform*`, các lớp chính của `apps/web` |

Quy ước: chữ ký rút gọn; `<<abstract>>` = abstract class làm token DI trong NestJS; `<<union>>` = TypeScript union type được vẽ như lớp cha. Mô hình thực thể CSDL xem [3-Database](../../3-Database/README.md); mô hình miền xem [2.5 Domain](../2.5-Domain/README.md).
