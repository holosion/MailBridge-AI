# Architecture

```
Browser ──► Next.js (UI + route handlers) ──► PostgreSQL ◄── Worker (tsx process)
                 │   ▲                                         │
                 │   └── WhatsApp webhooks (signed)            ├─► WhatsApp Cloud API
                 ├─► Google OAuth / Gmail API (read-only)      └─► retention, stuck-attempt sweeper
                 └─► AI provider adapter (mock | anthropic)
```
Two processes share one database: `npm run dev|start` (web) and `npm run worker`. The queue is a table (`background_jobs`), no extra infrastructure.

## Request flow (milestone)
1. **Sign in**: Better Auth (email+password, optional Google identity). Cookie session; `route()` in `src/lib/http.ts` resolves the user and requires same-origin for mutations.
2. **Connect Gmail**: `/api/gmail/connect` → Google (PKCE S256, signed `state` bound to the session user + httpOnly cookie nonce, 10 min expiry) → `/api/gmail/callback` verifies state, exchanges the code, rejects if `gmail.readonly` was not granted, stores **encrypted** tokens in `connected_email_accounts`.
3. **List**: ≤15 inbox messages from the last 14 days, metadata only, fetched live (not stored).
4. **Summarize**: fetch full message → text (plain preferred, HTML stripped, 8k char cap) → upsert `email_records` (unique `(userId, provider, providerMessageId)`) → AI → **validate + ground** → upsert `summaries` → usage++.
5. **Notify**: `POST /api/notifications` creates a `notification_attempts` row (PENDING, unique `requestKey`) and a `background_jobs` row (unique `dedupeKey`) in one transaction. The worker sends and records the result. Webhooks later advance the status.
6. **Display**: dashboard polls (`router.refresh`) while any attempt is non-terminal.

## Summaries: untrusted input
- Prompt wraps the email in `<email>` tags, escapes any attempt to close the tag, and instructs the model to treat it as data.
- Output must be JSON. `requiredAction` and `deadline` each need an **exact quote** (`evidence`) that is found in the email text, otherwise they are dropped with a visible warning. Unknown fields are ignored. One retry only on invalid output.
- Display is plain text only (React escaping; no `dangerouslySetInnerHTML`); HTML is stripped and bidi/zero-width/control characters removed on ingestion.

## Token encryption and key management
- AES-256-GCM, random 96-bit IV per value, format `v1.<keyVersion>.<iv>.<tag>.<ciphertext>`.
- **AAD** = `userId:accountId:access|refresh`, so a ciphertext copied to another row/user fails to decrypt.
- Key ring: `ENCRYPTION_KEYS="1:<b64>,2:<b64>"`, `ENCRYPTION_KEY_CURRENT=2`. New writes use the current key; old versions stay readable. **Rotation:** add the new key, bump CURRENT, (optional) run a re-encrypt script using `needsRotation()`, remove the old key only after all rows are re-encrypted. A re-encrypt script is *not* written yet (Gemini task).
- Keys live only in the environment / secret manager. In production use a KMS-wrapped key or managed secret store; losing the key means users must reconnect Gmail (tokens are not recoverable by design).
- Gmail tokens are **not** stored in Better Auth's `accounts` table (Google sign-in tokens there are identity-only and a separate concern).
- Logs: `src/lib/log.ts` redacts token/secret/body-like keys. Code never logs email bodies or tokens.

## Notification reliability (the important part)
`notification_attempts.status`: `PENDING → SENDING → ACCEPTED → SENT → DELIVERED → READ`, or `FAILED`, or `UNKNOWN`.
- **Claim before send:** worker does `UPDATE … SET status='SENDING' WHERE status='PENDING'`; only the winner calls the provider. Restarts/duplicate jobs see non-PENDING and do nothing.
- **Provider outcomes:** accepted (has `wamid`) → ACCEPTED; definite rejection (4xx) → FAILED; rate limit (HTTP 429 / codes 130429, 131056, 80007) → revert to PENDING and retry with backoff (30s·2ⁿ, ≤15 min, 5 attempts, then FAILED); timeout / network error / 5xx / 200 without an id → **UNKNOWN, never auto-resent** (the Cloud API has no idempotency key). A crash mid-send leaves SENDING; the sweeper marks it UNKNOWN after 2 minutes.
- **Resolving UNKNOWN:** the owner checks WhatsApp and clicks "received" (→ DELIVERED, flagged manual) or "not received" (→ FAILED, re-opens a deliberate resend).
- **No duplicate alerts:** one active attempt per `(user, destination, summary, kind)`; repeat requests return the existing attempt. SUMMARY alerts are also blocked after ACCEPTED+; only FAILED allows another.
- **Webhooks** (`/api/webhooks/whatsapp`): GET handshake with constant-time verify-token compare; POST verifies `X-Hub-Signature-256` (HMAC-SHA256 over the **raw** body) before parsing. Events are deduped by unique `(provider, providerEventId)` (`<wamid>:<status>`); status only moves forward (`shouldAdvance`), so out-of-order/duplicate deliveries are harmless. Handler returns 500 on internal error so Meta retries; handling is idempotent. Message text of inbound messages is not stored.
- **Quiet hours:** SUMMARY jobs inside the user's quiet window are re-queued (without consuming an attempt) to the window's end; TEST messages are exempt.
- **Gmail:** 401 → one forced refresh; `invalid_grant` → connection `NEEDS_REAUTH`; 429/quota → `GmailRateLimitError` surfaced as 429 to the UI.

## WhatsApp messaging rules implemented
- Recipient must be `VERIFIED` and have an unrevoked consent record (text version stored).
- Outside the 24h window only templates are sent. `TEST` uses `WHATSAPP_TEMPLATE_TEST` (`hello_world`). `SUMMARY` uses `WHATSAPP_TEMPLATE_SUMMARY` if set; else free text only if the window is open; else it fails with `NO_TEMPLATE_AND_WINDOW_CLOSED` (no send).
- **Template you must create and get approved** (name e.g. `mail_summary`, category likely Utility, language `en_US`), body with 5 variables:
  `Email from {{1}} - {{2}}: {{3}} Action: {{4}} Priority: {{5}}`
  (variables are single-line, length-capped; see `src/lib/compose.ts`). Category/approval outcome is Meta's call.
- `STOP`/`UNSUBSCRIBE` inbound → destination REVOKED + consent revoked.
- Cloud provider **refuses** any recipient not in `WHATSAPP_LIVE_SEND_ALLOWLIST`: no real send happens without explicit per-number authorization.

## Authorization model
Every query includes `userId` (`where: { id, userId }` / `updateMany` with `userId`). Route handlers get the user only from the session, never from request bodies. Cross-user access returns 404. Webhooks are the one cross-user entry point: they resolve users from provider ids (`wamid`, E.164) and write with that row's own `userId`. `tests/integration/isolation.test.ts` encodes the checks (not yet run, see TESTING).

## Data retention and deletion
| Data | Retention |
|---|---|
| `email_records.bodyText` | nulled after `RETENTION_BODY_DAYS` (7) or on Gmail disconnect |
| `email_records` rows | deleted after `RETENTION_EMAIL_DAYS` (90); summaries survive (denormalized subject/sender/permalink) |
| summaries, attempts (terminal), delivery events | deleted after `RETENTION_HISTORY_DAYS` (180) |
| finished/dead jobs | 30 days |
| expired sessions/verifications | purged daily |
| **Account deletion** (`DELETE /api/account`, must type email) | revoke Google token, then `DELETE users` → FK cascade removes all user-owned rows |
| Gmail disconnect | revoke at Google (best effort), wipe tokens, null stored bodies; summaries kept until retention |

The worker enqueues `PURGE_RETENTION` daily (`dedupeKey purge:<date>`).

## Subscriptions / quotas later
`usage_records(userId, metric, period)` counts `summaries` and `notifications` per month; `assertWithinQuota` reads limits from env. To add billing: add `plans`/`subscriptions` tables, resolve limits per user in `usage.ts`, gate on plan status; payment provider webhooks become another signed webhook route. No payment code exists.

## Known design limits
Quota check-then-increment is not atomic (fine for a personal prototype). Gmail token refresh is not single-flighted (concurrent refreshes are harmless but wasteful). One worker is assumed; multiple workers are safe for jobs (`SKIP LOCKED`) but untested.
