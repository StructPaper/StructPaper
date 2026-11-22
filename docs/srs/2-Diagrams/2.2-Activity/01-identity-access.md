# 2.2.1 Activity – Danh tính, thành viên, phân quyền (AD-01 … AD-07)

Sequence tương ứng: [2.3.1](../2.3-Sequence/01-identity-access.md) (SD-01 … SD-07).

## AD-01 Đăng nhập (UC-AUTH-01)

```mermaid
flowchart TD
    S([Bắt đầu]) --> I[/Nhập email + mật khẩu tại /login/]
    I --> V{Zod hợp lệ?}
    V -- Không --> E1[Hiện lỗi định dạng] --> I
    V -- Có --> F[API tìm user theo email citext]
    F --> U{Tìm thấy?}
    U -- Không --> E2[401 Invalid email or password]
    U -- Có --> ST{status = SUSPENDED?}
    ST -- Có --> E3[401 Account suspended]
    ST -- Không --> PH{Có passwordHash?}
    PH -- Không --> E4[401 Chưa kích hoạt]
    PH -- Có --> PW{Argon2id verify OK? - hoặc scrypt cũ}
    PW -- Không --> E2
    PW -- Có --> T1[Ký access token JWT sub, pv, 900 s]
    T1 --> T2[Sinh refresh token, lưu băm vào refresh_tokens]
    T2 --> C[Set cookie refreshToken httpOnly, 7 ngày]
    C --> R[Trả TokenResponse + user]
    R --> W[Web lưu access token vào auth-store, gọi GET /auth/me]
    W --> CAP[Nạp roles + capabilities -> dựng menu]
    CAP --> X([Kết thúc])
    E1 --> X
    E2 --> I
    E3 --> X
    E4 --> X
```

## AD-02 Làm mới phiên (UC-AUTH-02)

```mermaid
flowchart TD
    S([Access token hết hạn / 401 / khởi động]) --> G{Có refreshToken cookie hoặc body?}
    G -- Không --> L[Chuyển /login]
    G -- Có --> H[Băm token, tìm refresh_tokens]
    H --> A{Tồn tại, chưa revoked, chưa hết hạn?}
    A -- Không --> L
    A -- Có --> RV[Đặt revoked_at cho token cũ]
    RV --> N[Sinh cặp access + refresh mới]
    N --> IN[Insert refresh_tokens mới]
    IN --> CK[Set cookie mới]
    CK --> RT[Trả TokenResponse]
    RT --> RP[Web phát lại request thất bại]
    RP --> E([Kết thúc])
    L --> E
```

## AD-03 Kích hoạt tài khoản từ lời mời (UC-AUTH-04)

```mermaid
flowchart TD
    S([Mở link /activate?token=...]) --> P[/Nhập mật khẩu mới/]
    P --> C{Mật khẩu đạt chính sách?}
    C -- Không --> P
    C -- Có --> T[POST /auth/activate]
    T --> Q[Băm token, claim user_tokens INVITATION: chưa consumed, còn hạn]
    Q --> OK{Claim thành công?}
    OK -- Không --> ERR[400 token không hợp lệ / hết hạn / đã dùng]
    OK -- Có --> TX[Giao dịch: set password_hash, status INVITED->ACTIVE, consumed_at]
    TX --> MSG[Trả success]
    MSG --> LG[Chuyển /login]
    LG --> E([Kết thúc])
    ERR --> E
```

## AD-04 Đặt lại mật khẩu (UC-AUTH-05)

```mermaid
flowchart TD
    S([Có token PASSWORD_RESET]) --> P[/Nhập mật khẩu mới/]
    P --> T[POST /auth/reset-password]
    T --> Q{Token hợp lệ, chưa dùng, còn hạn?}
    Q -- Không --> ERR[400 lỗi token]
    Q -- Có --> TX[Giao dịch: cập nhật password_hash, consumed_at]
    TX --> RV[Thu hồi mọi refresh token của user]
    RV --> OK[Trả success -> /login]
    OK --> E([Kết thúc])
    ERR --> E
```

## AD-05 Mời thành viên (UC-MEM-02)

```mermaid
flowchart TD
    S([Manager mở /permissions > Mời]) --> F[/Nhập email, vai trò, phạm vi tạp chí/]
    F --> A{assertCanAssign: Manager chỉ trong phạm vi của mình, không cấp SuperAdmin?}
    A -- Không --> E1[403]
    A -- Có --> EX{Email đã tồn tại?}
    EX -- ACTIVE --> E2[409 đã active]
    EX -- khác INVITED --> E3[409 không thể mời]
    EX -- INVITED hoặc mới --> TX[Giao dịch: tạo/lấy user INVITED, tạo user_tokens INVITATION, gán user_roles]
    TX --> M[MailService gửi email kèm link /invite]
    M --> OK[Trả InviteUserResponse]
    OK --> L[Danh sách Lời mời cập nhật PENDING]
    L --> E([Kết thúc])
    E1 --> E
    E2 --> E
    E3 --> E
```

## AD-06 Gán / gỡ vai trò (UC-ROLE-02/03/04)

```mermaid
flowchart TD
    S([Chọn người dùng + vai trò + phạm vi]) --> ACT{Gán hay gỡ?}
    ACT -- Gán --> CK1{canAssignRoles và trong phạm vi?}
    CK1 -- Không --> E1[403]
    CK1 -- Có --> SA1{Vai trò = SuperAdmin?}
    SA1 -- Có --> CK2{canGrantSuperAdmin?}
    CK2 -- Không --> E1
    CK2 -- Có --> INS[Insert user_roles]
    SA1 -- Không --> INS
    ACT -- Gỡ --> CK3{canAssignRoles?}
    CK3 -- Không --> E1
    CK3 -- Có --> INV{Gỡ SuperAdmin cuối cùng?}
    INV -- Có --> E2[409 invariant: phải còn >= 1 SuperAdmin]
    INV -- Không --> DEL[Delete user_roles]
    INS --> PV[Tăng users.permissions_version, xóa ability cache]
    DEL --> PV
    PV --> OK[Trả kết quả]
    OK --> E([Kết thúc])
    E1 --> E
    E2 --> E
```

## AD-07 Kiểm tra quyền mỗi request (CASL)

```mermaid
flowchart TD
    S([Request đến API]) --> PUB{Route @Public?}
    PUB -- Có --> H[Chạy handler]
    PUB -- Không --> TK{Có Bearer token hợp lệ?}
    TK -- Không --> OA{@OptionalAuth?}
    OA -- Có --> GU[Coi như Guest, ability rỗng]
    OA -- Không --> E1[401]
    TK -- Có --> PV{pv trong token == permissions_version?}
    PV -- Không --> E1
    PV -- Có --> AC{Ability trong cache?}
    AC -- Có --> POL
    AC -- Không --> LD[Nạp roles + manuscript_members, build AbilityFactory, ghi cache]
    LD --> POL
    GU --> POL
    POL{@CheckPolicies đạt?}
    POL -- Không --> E2[403]
    POL -- Có --> H
    H --> SV[Service kiểm tra ability.can theo từng bản ghi subject]
    SV --> OK[Trả response + access flags]
    OK --> E([Kết thúc])
    E1 --> E
    E2 --> E
```
