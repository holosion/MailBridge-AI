# Mail Bridge AI: Product definition (Phase 1)

## MVP
Personal prototype for the owner's Gmail and WhatsApp, structured so multiple users can be added later.

**First milestone:** Connect Gmail → select an email → summarize it → save the result → deliver a WhatsApp notification → display delivery status.

## Confirmed requirements (from the project brief)
- Next.js + TypeScript dashboard/server endpoints, PostgreSQL + Prisma, a separate worker, server-side AI adapter (proposed defaults; one default changed, see A1).
- Gmail OAuth with minimum permissions, encrypted token storage, refresh handling, disconnect, per-user authorization.
- Bounded recent-email list; user picks one; structured summary (subject/sender, main message, required action if present, deadline only if supported, priority + reason, reference to original). Email text is untrusted.
- WhatsApp Business Platform test setup; persist email reference, summary, attempt, provider id, delivery status.
- Dashboard: connection status, email list, summary view, notification history.
- DB: users/auth, connected accounts + encrypted credentials, email records, summaries, verified destinations + consent, preferences/timezone/quiet hours, attempts + delivery events, jobs + checkpoints, usage records; FKs, ownership, unique constraints against duplicate ingestion/jobs; retention + account deletion defined; synthetic seed only; payments deferred.
- Reliability: bounded retries, expired credentials, rate limits, worker restarts, duplicate webhooks, signature verification, uncertain sends never blindly resent, sanitized display.

## Assumptions (NOT confirmed by the owner: please review)
| # | Assumption | Why it matters |
|---|---|---|
| A1 | **Better Auth** replaces the proposed Auth.js. Search results show the Auth.js project is now part of Better Auth, v4 is in maintenance mode, and its own guidance points new projects to Better Auth. The brief asked for a "maintained" library and to document a material deviation. | Better Auth API usage in `src/lib/auth*.ts` was written from knowledge, **not** checked against Better Auth's current docs (only Auth.js docs were read). Verify first. |
| A2 | Gmail scope is `gmail.readonly` (needed to read bodies). It is a *restricted* scope: fine for a personal prototype with the owner as test user, but a public launch needs Google verification/security assessment. In "Testing" mode refresh tokens may expire after ~7 days (handled as NEEDS_REAUTH). | Not verified against current Google docs in this session. |
| A3 | WhatsApp: free-form text only inside the 24h window after the user messages the business number; otherwise an approved **template**. The free test number can message only a small allow-list of recipients (third-party sources said 5, error 131030 otherwise). | Sources read were third-party, **not Meta's official docs**. The brief's "check current official documentation" is **not satisfied** for WhatsApp. |
| A4 | Destination verification = user sends any message to the business number (proves control, opens the window). Dev shortcut `ALLOW_OWNER_ATTEST`. | Product choice. |
| A5 | Graph API version default `v23.0`; Anthropic model default `claude-haiku-5-5`. | Both must be verified before live use. |
| A6 | Phase 1 supports bounded automatic inbox synchronization through the `SYNC_EMAILS` worker job. Users can configure the interval; persisted Gmail cursors and provider-message uniqueness prevent repeated ingestion. | Scope. |
| A7 | One WhatsApp number belongs to one account (global unique). Gmail IDs are unique per user in our table (single mailbox per user in practice). | Prevents cross-account verification via inbound webhooks. |
| A8 | Prisma pinned to 6.x and Next.js to 15.x to avoid Prisma 7 schema/config changes and the Next 16 middleware→proxy rename. | Revisit on upgrade. |
| A9 | A third-party blog claimed Meta banned "general purpose AI" chatbots on the platform from Jan 2026. Mail Bridge is a one-way notification, not a chatbot, but this was not checked in official policy. | Policy risk for live use. |

## Acceptance criteria (Phase 1)
1. User signs up / signs in; unauthenticated users cannot reach the dashboard or APIs.
2. User connects Gmail (read-only), sees a bounded list (≤15) of recent inbox emails, can disconnect (tokens revoked + wiped).
3. Selecting an email produces and persists a structured summary; deadlines/actions only when quoted from the email; prompt-injection text is not obeyed.
4. User adds a WhatsApp number with explicit consent, verifies it, and requests a test or summary notification; the worker sends it once; status moves PENDING → … → DELIVERED/FAILED/UNKNOWN and is visible.
5. Data survives restart (PostgreSQL). Users cannot access each other's records (every query is scoped by `userId`).
6. Demo path works with zero credentials and is labelled DEMO everywhere.
7. **Live acceptance is only met after the steps in `docs/HANDOFF.md` → "Live verification" are executed.**

## Deferred
Payments/subscriptions (quota seam exists, see ARCHITECTURE), "usefulness" classification, multiple mailboxes, Outlook/IMAP, WhatsApp inbound commands, admin UI, privacy policy/terms pages, Google app verification, per-user rate limiting beyond Better Auth's built-ins, observability/alerting.
