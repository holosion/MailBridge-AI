# Security Specification — MailBridge AI

## 1. Data Invariants
1. **Strict Ownership & PII Isolation**: Every user document, preference record, WhatsApp phone configuration, email insight, alert log, and reminder resides under `/users/{userId}` and can ONLY be read, created, updated, or deleted when `request.auth != null`, `request.auth.token.email_verified == true`, and `request.auth.uid == userId`.
2. **No Cross-User Leakage**: Blanket `list` or `get` queries across `/users` are strictly denied. Every `allow list` on subcollections verifies `resource.data.uid == request.auth.uid`.
3. **Immutable Identity & Creation Timestamps**: On `update`, `uid`, `createdAt`, `analyzedAt`, and `messageId` cannot be altered.
4. **Temporal Integrity**: `createdAt`, `analyzedAt`, and `updatedAt` are strictly validated against `request.time`.
5. **Bounded Volumetrics**: All strings have explicit `.size()` ceilings and arrays (`focusCategories` <= 10, `prioritySenders` <= 25) have explicit `.size()` guards to prevent Denial-of-Wallet attacks.
6. **Minimal Retention**: Full email bodies are never stored in Firestore; only minimal metadata (`subject`, `snippet`, `senderName`, `senderEmail`) and structured Gemini summaries are persisted.

## 2. The "Dirty Dozen" Adversarial Test Payloads
1. Unauthenticated read of `/users/userA/emailInsights/msg1` -> `PERMISSION_DENIED`
2. Cross-user read of `/users/userA` while authenticated as `userB` -> `PERMISSION_DENIED`
3. Email spoofing (`email_verified == false`) attempting write to `/users/userA` -> `PERMISSION_DENIED`
4. Shadow field injection (`{ ...validProfile, isAdmin: true }`) -> `PERMISSION_DENIED` via `hasOnly()`
5. Identity spoofing (`{ ...validInsight, uid: "userB" }` under `/users/userA`) -> `PERMISSION_DENIED`
6. Oversized ID poisoning (`messageId` > 128 chars or invalid regex characters) -> `PERMISSION_DENIED`
7. Client-forged timestamp (`createdAt` != `request.time`) -> `PERMISSION_DENIED`
8. Unbounded array injection (`focusCategories` with 15 items) -> `PERMISSION_DENIED`
9. Invalid enum value (`priority: "super_critical"`) -> `PERMISSION_DENIED`
10. Immutable field mutation on update (changing `messageId` or `createdAt`) -> `PERMISSION_DENIED`
11. Value poisoning on allowed update key (`actionCompleted: "yes"` instead of `bool`) -> `PERMISSION_DENIED`
12. Root collection list attempt on `/users` -> `PERMISSION_DENIED`
