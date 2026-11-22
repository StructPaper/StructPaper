# 2.3.1 Sequence – Danh tính, thành viên, phân quyền (SD-01 … SD-07)

Activity tương ứng: [2.2.1](../2.2-Activity/01-identity-access.md).

## SD-01 Đăng nhập

```mermaid
sequenceDiagram
    actor U as Người dùng
    participant W as Web (login page, auth-store)
    participant C as AuthController
    participant S as AuthService
    participant P as PasswordService
    participant T as TokenService
    participant DB as PostgreSQL
    U->>W: Nhập email + mật khẩu
    W->>C: POST /api/v1/auth/login
    C->>C: ZodValidationPipe(LoginRequestSchema)
    C->>S: login(dto)
    S->>DB: SELECT users WHERE email
    DB-->>S: user
    S->>S: kiểm tra SUSPENDED / passwordHash
    S->>P: verify(hash, password)
    P-->>S: true
    S->>T: signAccessToken({sub, pv})
    S->>T: generateRefreshToken()
    S->>DB: INSERT refresh_tokens(tokenHash, expiresAt)
    S-->>C: TokenResponse
    C-->>W: 200 + Set-Cookie refreshToken (httpOnly)
    W->>C: GET /auth/me (Bearer)
    C-->>W: user, roles, capabilities
    W-->>U: Vào /papers
```

## SD-02 Làm mới phiên

```mermaid
sequenceDiagram
    participant W as Web (api-client interceptor)
    participant C as AuthController
    participant S as AuthService
    participant DB as PostgreSQL
    W->>C: request -> 401
    W->>C: POST /auth/refresh (cookie refreshToken)
    C->>S: refresh(rawToken)
    S->>DB: SELECT refresh_tokens WHERE token_hash
    alt hợp lệ
        S->>DB: UPDATE revoked_at (token cũ)
        S->>DB: INSERT refresh_tokens (token mới)
        S-->>C: TokenResponse
        C-->>W: 200 + Set-Cookie mới
        W->>C: phát lại request ban đầu
    else hết hạn / đã thu hồi
        S-->>C: 401
        C-->>W: 401
        W->>W: xóa phiên, chuyển /login
    end
```

## SD-03 Kích hoạt tài khoản

```mermaid
sequenceDiagram
    actor I as Người được mời
    participant W as Web /activate
    participant C as AuthController
    participant S as AuthService
    participant DB as PostgreSQL
    I->>W: Mở link (token) + nhập mật khẩu
    W->>C: POST /auth/activate {token, password}
    C->>S: activate(dto)
    S->>DB: claimToken(INVITATION) WHERE chưa consumed AND expires_at > now
    alt claim được
        S->>DB: BEGIN
        S->>DB: UPDATE users SET password_hash, status='ACTIVE'
        S->>DB: UPDATE user_tokens SET consumed_at
        S->>DB: COMMIT
        S-->>W: success
        W-->>I: Chuyển /login
    else không claim được
        S-->>W: 400 token không hợp lệ
    end
```

## SD-04 Đặt lại mật khẩu

```mermaid
sequenceDiagram
    actor U as Người dùng
    participant W as Web
    participant C as AuthController
    participant S as AuthService
    participant DB as PostgreSQL
    U->>W: Nhập mật khẩu mới (kèm token)
    W->>C: POST /auth/reset-password
    C->>S: resetPassword(dto)
    S->>DB: SELECT user_tokens (PASSWORD_RESET)
    S->>DB: BEGIN, UPDATE users.password_hash, UPDATE user_tokens.consumed_at
    S->>DB: UPDATE refresh_tokens SET revoked_at WHERE user_id
    S->>DB: COMMIT
    S-->>W: success
```

## SD-05 Mời thành viên

```mermaid
sequenceDiagram
    actor M as Manager
    participant W as Web (InviteMemberModal)
    participant C as UserController
    participant G as PoliciesGuard
    participant S as UserService
    participant DB as PostgreSQL
    participant Mail as MailService
    M->>W: Nhập email, vai trò, phạm vi
    W->>C: POST /users/invite
    C->>G: canManageMembers(ability)
    G-->>C: ok
    C->>S: invite(dto, actor)
    S->>S: assertCanAssign(actor, role, journalId)
    S->>DB: BEGIN
    S->>DB: SELECT/INSERT users (INVITED)
    S->>DB: INSERT user_tokens (INVITATION, băm token, hạn)
    S->>DB: INSERT user_roles (scope_journal_id)
    S->>DB: COMMIT
    S->>Mail: gửi email chứa link /invite?token
    S-->>W: InviteUserResponse
    W-->>M: Tab Lời mời hiện PENDING
```

## SD-06 Gán / gỡ vai trò

```mermaid
sequenceDiagram
    actor M as Manager/SuperAdmin
    participant W as Web (UserRoleAssignmentTab)
    participant C as AccessController
    participant S as AccessService
    participant INV as super-admin-invariant
    participant DB as PostgreSQL
    participant AC as AbilityCache
    M->>W: Chọn người + vai trò
    W->>C: POST /roles/assign (hoặc DELETE)
    C->>C: CheckPolicies(canAssignRoles)
    C->>S: assign/revoke(dto, actor)
    opt gỡ vai trò
        S->>INV: kiểm tra còn >= 1 SuperAdmin
        INV-->>S: ok / 409
    end
    S->>DB: INSERT/DELETE user_roles
    S->>DB: UPDATE users SET permissions_version = permissions_version+1
    S->>AC: invalidate(userId)
    S-->>W: kết quả
```

## SD-07 Kiểm tra quyền mỗi request

```mermaid
sequenceDiagram
    participant Cl as Client
    participant JG as JwtAuthGuard (APP_GUARD)
    participant AS as AuthService
    participant AC as AbilityCacheService
    participant AF as AbilityFactory
    participant PG as PoliciesGuard
    participant H as Controller/Service
    participant DB as PostgreSQL
    Cl->>JG: HTTP request (+ Bearer)
    JG->>JG: route @Public / @OptionalAuth ?
    JG->>AS: verifyTokenWithPermissions(token)
    AS->>DB: users.permissions_version
    AS-->>JG: user (nếu pv khớp)
    JG->>AC: get(userId, pv)
    alt cache miss
        AC->>AF: createForUser(userId)
        AF->>DB: user_roles + roles + manuscript_members
        AF-->>AC: AppAbility
    end
    AC-->>JG: ability (gắn vào req)
    JG->>PG: @CheckPolicies(...)
    PG-->>H: cho qua / 403
    H->>H: ability.can(action, subject('Manuscript', row))
    H-->>Cl: response + access {canEdit, canShare, canDelete}
```
