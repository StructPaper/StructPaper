# 2.5.2 State machine (vòng đời các thực thể)

## Workflow bản thảo (`manuscripts.status`)

Bảng chuyển trạng thái (`VALID_TRANSITIONS`, `ManuscriptService.changeStatus`). **SuperAdmin có thể bỏ qua bảng**. Chuyển tới `IN_REVIEW`, `ACCEPTED`, `REJECTED`, `PUBLISHED` yêu cầu quyền `manage` (JournalManager/SuperAdmin); `SUBMITTED` và rút lại về `DRAFT` cần quyền sửa.

```mermaid
stateDiagram-v2
    [*] --> DRAFT : tạo bài
    DRAFT --> SUBMITTED : gửi duyệt (tác giả)
    SUBMITTED --> IN_REVIEW : nhận phản biện
    SUBMITTED --> REJECTED
    SUBMITTED --> DRAFT : rút lại
    IN_REVIEW --> PROOFING
    IN_REVIEW --> READY
    IN_REVIEW --> ACCEPTED
    IN_REVIEW --> REJECTED
    IN_REVIEW --> DRAFT
    PROOFING --> READY
    PROOFING --> PUBLISHED
    PROOFING --> IN_REVIEW
    PROOFING --> DRAFT
    READY --> PUBLISHED
    READY --> PROOFING
    READY --> DRAFT
    ACCEPTED --> READY
    ACCEPTED --> PUBLISHED
    ACCEPTED --> DRAFT
    REJECTED --> DRAFT
    PUBLISHED --> ARCHIVED
    PUBLISHED --> DRAFT
    ARCHIVED --> DRAFT
    note right of IN_REVIEW
      IN_REVIEW, PROOFING, READY,
      ACCEPTED, PUBLISHED:
      chủ sở hữu KHÔNG xóa được
    end note
```

Trạng thái ở UI (`workflowStatus` của `ManuscriptInfo`, cục bộ): `draft | in-review | proofing | ready | published` – tương ứng gần đúng với `DRAFT/IN_REVIEW/PROOFING/READY/PUBLISHED` phía server.

## Xóa mềm bản thảo

```mermaid
stateDiagram-v2
    [*] --> Live
    Live --> Trashed : DELETE (deleted_at, deleted_by)
    Trashed --> Live : restore (người xóa / manager)
    Trashed --> Purged : purge thủ công (người xóa / manager)
    Trashed --> Purged : quá 30 ngày (timer 6h)
    Purged --> [*]
```

## Profile version (`profile_versions.state`)

```mermaid
stateDiagram-v2
    [*] --> draft : createDraft
    draft --> draft : updateDraft (sửa config)
    draft --> validated : validate OK
    validated --> draft : sửa config lại
    validated --> published : publish
    published --> archived : bản mới được publish
    published --> [*] : bất biến (trigger chặn sửa config, xóa)
    archived --> [*] : bất biến
    note right of published
      rollback = tạo bản MỚI sao từ bản cũ
      (validated) rồi publish; lịch sử không bị viết lại
    end note
```

## Tài khoản người dùng (`users.status`)

```mermaid
stateDiagram-v2
    [*] --> INVITED : mời (password_hash = null)
    INVITED --> INVITED : gửi lại lời mời
    INVITED --> [*] : thu hồi lời mời
    INVITED --> ACTIVE : kích hoạt (đặt mật khẩu)
    ACTIVE --> SUSPENDED : quản trị khóa
    SUSPENDED --> ACTIVE : mở khóa
    ACTIVE --> ACTIVE : đặt lại mật khẩu
```

## Token một lần & refresh token

```mermaid
stateDiagram-v2
    [*] --> Issued
    Issued --> Consumed : dùng (activate / reset-password)
    Issued --> Expired : quá hạn (mặc định 168 giờ cho one-time)
    Consumed --> [*]
    Expired --> [*]
```

```mermaid
stateDiagram-v2
    [*] --> Active : login
    Active --> Revoked : refresh (xoay vòng) / logout / reset password
    Active --> Expired : quá 7 ngày
    Revoked --> [*]
    Expired --> [*]
```

## Revision (`manuscript_revisions.kind`)

```mermaid
stateDiagram-v2
    direction LR
    [*] --> auto : nghỉ ≥ 5 phút hoặc ≥ 30 phút (bản đầu tiên)
    [*] --> named : người dùng đặt tên / tự tạo khi đổi trạng thái (pinned)
    [*] --> pre_risk : trước đổi tạp chí, đổi loại bài, khôi phục
    [*] --> profile_upgrade : trước khi nâng profile
    [*] --> restore : sau khi khôi phục
    [*] --> import : nhập từ tệp
    [*] --> sync : checkpoint mỗi 20 op (ẩn khỏi lịch sử)
    auto --> pruned : > 300 bản không ghim (xóa cũ trước)
    pre_risk --> pruned : > 90 ngày (giữ ≥ 5 bản gần nhất)
    profile_upgrade --> pruned : > 90 ngày
    named --> kept : ghim, không bao giờ bị dọn
```

## Compile job (`compile_jobs.status`) & Outbox (`outbox_events.status`)

```mermaid
stateDiagram-v2
    [*] --> QUEUED
    QUEUED --> PROCESSING : worker nhận job
    PROCESSING --> COMPLETED : có PDF, pdf_asset_id
    PROCESSING --> FAILED : lỗi TeX / không tìm thấy bài / runner lỗi
    COMPLETED --> [*]
    FAILED --> [*]
```

```mermaid
stateDiagram-v2
    [*] --> PENDING : ghi cùng giao dịch nghiệp vụ
    PENDING --> PROCESSED : dispatch OK
    PENDING --> PENDING : lỗi, retry_count + 1
    PENDING --> FAILED : retry_count ≥ 5
    PROCESSED --> [*]
    FAILED --> [*]
```

## Trạng thái lưu của trình soạn (client – `SaveState`)

```mermaid
stateDiagram-v2
    [*] --> idle
    idle --> dirty : có chỉnh sửa
    dirty --> saving : hết debounce ~1,2 s / Ctrl+S
    saving --> saved : máy + server OK
    saving --> saved_local : server không tới được
    saving --> conflict : 412/409
    saving --> error : không ghi được cả IndexedDB
    saved --> dirty : sửa tiếp
    saved_local --> dirty : sửa tiếp / thử lại
    conflict --> saving : Ghi đè bằng bản của tôi
    error --> saving : thử lại
```

## Journal (`journals.status`) & Article type

```mermaid
stateDiagram-v2
    [*] --> draft : tạo (chưa cho tác giả chọn)
    draft --> published : công bố
    published --> archived : chỉ giữ cho bài cũ
    archived --> published
    state "ArticleType" as AT {
      [*] --> active
      active --> archived_at : lưu trữ
      archived_at --> active
    }
```
