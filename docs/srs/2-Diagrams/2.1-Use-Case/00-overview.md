# 2.1.0 Use case – Tổng quan hệ thống

Sơ đồ mức cao: các actor và **nhóm** use case. Chi tiết từng nhóm ở các file kế tiếp (01–08). Danh sách UC đầy đủ: [1.1 Use case](../../1-BRD/1.1-Use-case.md).

## Quan hệ giữa các actor

```mermaid
flowchart LR
    Guest([Guest]) --> Viewer([Viewer / Reviewer])
    Viewer --> Author([Author])
    Author --> Editor([Editor])
    Editor --> JM([JournalManager])
    JM --> SA([SuperAdmin])
    classDef a fill:#eef,stroke:#446
    class Guest,Viewer,Author,Editor,JM,SA a
```

> Mũi tên = "được kế thừa/mở rộng quyền". Thực tế quyền do CASL tính từ vai trò hệ thống **và** vai trò thành viên trên từng bài (`OWNER`, `COAUTHOR`, `EDITOR`, `REVIEWER`, `VIEWER`).

## Tổng quan use case theo nhóm

```mermaid
flowchart LR
    Guest([Guest])
    Viewer([Viewer / Reviewer])
    Author([Author])
    Editor([Editor])
    JM([JournalManager])
    SA([SuperAdmin])
    Sys([System / Worker])
    Upd([Desktop Updater])

    subgraph SP["Hệ thống StructPaper"]
        direction TB
        G1(["Xác thực & tài khoản (AUTH)"])
        G2(["Thành viên & vai trò (MEM/ROLE)"])
        G3(["Tạp chí, loại bài, Profile, Template (JRN)"])
        G4(["Quản lý bài báo & Nhập Word (PAP)"])
        G5(["Soạn thảo & QC (EDT)"])
        G6(["Xem trước, biên dịch, xuất bản (PRV/EXP)"])
        G7(["Lịch sử phiên bản (HIS)"])
        G8(["Chia sẻ & Thùng rác (SHR/TRS)"])
        G9(["Đồng bộ, Tài nguyên, Biên dịch nền (SYN/AST/CMP)"])
        G10(["Nền tảng Desktop & Vận hành (PLT)"])
    end

    Guest --> G8
    Viewer --> G1
    Viewer --> G6
    Viewer --> G7
    Author --> G1
    Author --> G4
    Author --> G5
    Author --> G6
    Author --> G7
    Author --> G8
    Editor --> G4
    Editor --> G5
    JM --> G2
    JM --> G3
    JM --> G8
    SA --> G2
    SA --> G3
    Sys --> G9
    Sys --> G8
    Sys --> G7
    Upd --> G10
    Author --> G10
```

## Ma trận actor × nhóm use case

| Nhóm | Guest | Viewer | Author | Editor | JournalManager | SuperAdmin | System |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| AUTH | – | ✔ | ✔ | ✔ | ✔ | ✔ | – |
| MEM / ROLE | – | – | – | – | ✔ (trong phạm vi) | ✔ | – |
| JRN (xem) | ✔ (profile công khai) | ✔ | ✔ | ✔ | ✔ | ✔ | – |
| JRN (quản trị) | – | – | – | – | ✔ | ✔ | – |
| PAP | – | xem | ✔ | ✔ | ✔ (mọi bài tạp chí) | ✔ | – |
| EDT | – | – | ✔ | ✔ (nếu là thành viên EDITOR) | ✔ | ✔ | – |
| PRV / EXP | xem PDF | xem | ✔ | ✔ | ✔ | ✔ | – |
| HIS | – | xem | ✔ | ✔ | ✔ | ✔ | tự động tạo |
| SHR | link `VIEWER` | – | ✔ (Owner) | ✔ | ✔ | ✔ | – |
| TRS | – | – | thùng rác của mình | thùng rác của mình | ✔ (cả tạp chí) | ✔ | tự dọn |
| SYN / AST / CMP | – | đọc | ✔ | ✔ | ✔ | ✔ | worker |
| PLT | – | – | ✔ | ✔ | ✔ | ✔ | outbox, updater |
