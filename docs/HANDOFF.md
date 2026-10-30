# Handoff: Claude (Phase 1) → Gemini → Codex

**Read this first.** Phase 1 code is written but has **never been installed, compiled, migrated or run end-to-end**, and **no live integration (Gmail, AI, WhatsApp) has been tested**. The live milestone is **NOT complete**. Only the pure logic modules have executed tests (25/25 pass, see `docs/TESTING.md`).

## Situation when work started
No repository existed at `C:\Users\AKENA\Desktop\mailBridge-AI` (path unavailable in the authoring environment, which was a Linux sandbox without network). A fresh project was created; all source is in the delivered zip. Extract it to the project path.

## Completed (code written; verification level in brackets)
- Next.js 15/TS app: login/signup, protected dashboard, API routes [UNRUN]
- Better Auth + Prisma adapter, same-origin CSRF check on mutations [UNRUN, API unverified vs docs]
- Gmail OAuth (PKCE, signed state, minimum read-only scope, encrypted tokens, refresh, `invalid_grant` → reconnect, revoke+wipe on disconnect) [UNRUN]
- Bounded email list, selection, structured summaries with grounded actions/deadlines, injection-resistant prompt, mock + Anthropic adapters [grounding/validation/mock TESTED; Anthropic call UNRUN]
- WhatsApp Cloud API sender, allow-list guard, template/text selection by 24h window, webhook GET/POST with signature verification, idempotent events, STOP opt-out [signature TESTED; rest UNRUN]
- Notification state machine with claim-before-send, UNKNOWN handling, manual resolve, stuck sweeper [UNRUN; helper logic TESTED]
- Postgres queue (`FOR UPDATE SKIP LOCKED`, leases, backoff, dedupe keys), worker with quiet-hours deferral, housekeeping, retention purge [UNRUN]
- Schema + hand-written migration + synthetic seed + isolation/cascade integration test [UNRUN]
- Docs: PRODUCT, ARCHITECTURE, TESTING, README, this file
- Demo path (synthetic emails, heuristic summaries, mock WhatsApp) clearly labelled DEMO in UI and DB (`isDemo`)

## Incomplete / not implemented
- **No `package-lock.json`** (no network). Run `npm install` and commit it.
- `SYNC_EMAILS` jobs and `sync_checkpoints` usage (modelled only; Phase 1 is user-selected emails)
- Key re-encryption script for rotation (`needsRotation()` exists)
- Rate limiting of our own endpoints (Better Auth has its own for auth routes)
- Privacy policy / terms pages (needed for Google verification and Meta)
- Single-flight token refresh; atomic quota counters; structured metrics/alerting
- Payments (deferred by design)

## Blockers (need the owner)
1. Google Cloud project + OAuth client (Web), test user = owner's Gmail, redirect `{APP_URL}/api/gmail/callback`.
2. Meta developer app + WhatsApp test number: access token, phone number ID, app secret, verify token; owner's number added as an allowed recipient.
3. A **template** for summaries (`mail_summary`, body in ARCHITECTURE) created and approved, or accept test-only/window-only text.
4. AI API key (`ANTHROPIC_API_KEY`) and a confirmed model id.
5. Explicit written authorization of the recipient number(s) and test plan before any real message (enforced by `WHATSAPP_LIVE_SEND_ALLOWLIST`).
6. A public HTTPS URL (tunnel) for the Meta webhook.

## Gemini: next tasks (in order)
1. `npm install`; commit lockfile. Run `npx prisma validate`, `npm run typecheck`, fix errors. Expect issues in Better Auth / Prisma call sites.
2. **Verify against OFFICIAL docs** (not done): Better Auth (config, `toNextJsHandler`, `nextCookies`, client API, schema field names), Meta WhatsApp Cloud API (current Graph version, send/template payloads, error codes, webhook payload shapes, test-number limits, AI/chatbot policy: assumption A9), Google OAuth (restricted scope rules, Testing-mode token expiry), Anthropic model id/endpoint.
3. Create DB, `npm run db:migrate`, `npm run db:drift-check`. If drift: regenerate the init migration with `prisma migrate dev`.
4. `npm run build`, then run the demo path and every item in the TESTING manual checklist; fix defects.
5. Run `npm run test:integration`; add tests for webhook handler (idempotency, ordering), job claim/lease/crash recovery, and `processSendJob` outcomes with a stubbed sender.
6. Fix UX issues found in the browser (the UI has never been rendered).
7. Then Live verification below.

## Live verification (all steps must pass before declaring the milestone done)
1. Set `DEMO_MODE=false` + Google vars; Connect Gmail → status "Connected"; list shows real recent emails; Disconnect → tokens gone in DB, Google shows access revoked; reconnect.
2. `AI_PROVIDER=anthropic`; summarize a real email (and a crafted test email containing "ignore previous instructions… deadline tomorrow"); confirm summary fields, no fabricated deadline, row persisted.
3. `WHATSAPP_PROVIDER=cloud`, `WHATSAPP_LIVE_SEND_ALLOWLIST=<owner number>`; register webhook; owner sends a message to the business number → destination VERIFIED, `lastInboundAt` set.
4. Send **test** notification → arrives on phone; history shows ACCEPTED → SENT → DELIVERED (→ READ) from real webhooks; `provider_message_id` stored.
5. Send **summary** notification (template if approved, else within 24h window) → arrives; history updated.
6. Failure drills: unlisted number → FAILED `RECIPIENT_NOT_AUTHORIZED` with no network call; bad token → FAILED, no retry storm; kill worker mid-send → UNKNOWN + resolve flow; replay a webhook → no duplicate event; bad signature → 401.
7. Restart web + worker + DB → data intact; second user cannot see the first user's data.

## Codex (final integration / release prep): after Gemini
Pin versions/lockfile review, CI (typecheck, unit, integration with a Postgres service), production env/secret handling (KMS), HTTPS + cookie flags check, Docker/hosting, migration runbook, privacy/terms, Google verification and Meta business verification checklist, monitoring.

## Key decisions and deviations
- **Better Auth instead of Auth.js** (maintenance-mode finding; see PRODUCT A1).
- Gmail OAuth implemented directly (small, auditable) instead of through the auth library so tokens/scopes/encryption are fully controlled.
- Prisma 6 / Next 15 pinned (A8). Column names are camelCase (raw SQL in `jobs.ts` depends on this).
- Uncertain sends are never auto-resent (UNKNOWN + manual resolution).
- One WhatsApp number ↔ one account globally.

## Changed / created files
- `.env.example`
- `.gitignore`
- `README.md`
- `docs/ARCHITECTURE.md`
- `docs/PRODUCT.md`
- `docs/TESTING.md`
- `next.config.mjs`
- `package.json`
- `prisma/migrations/20261030000000_init/migration.sql`
- `prisma/migrations/migration_lock.toml`
- `prisma/schema.prisma`
- `prisma/seed.ts`
- `src/app/api/account/route.ts`
- `src/app/api/auth/[...all]/route.ts`
- `src/app/api/destinations/[id]/attest/route.ts`
- `src/app/api/destinations/[id]/revoke/route.ts`
- `src/app/api/destinations/route.ts`
- `src/app/api/emails/route.ts`
- `src/app/api/gmail/callback/route.ts`
- `src/app/api/gmail/connect/route.ts`
- `src/app/api/gmail/disconnect/route.ts`
- `src/app/api/health/route.ts`
- `src/app/api/notifications/[id]/resolve/route.ts`
- `src/app/api/notifications/route.ts`
- `src/app/api/preferences/route.ts`
- `src/app/api/summaries/route.ts`
- `src/app/api/webhooks/whatsapp/route.ts`
- `src/app/dashboard/page.tsx`
- `src/app/globals.css`
- `src/app/layout.tsx`
- `src/app/login/page.tsx`
- `src/app/page.tsx`
- `src/components/panels.tsx`
- `src/lib/ai-core.ts`
- `src/lib/ai.ts`
- `src/lib/auth-client.ts`
- `src/lib/auth.ts`
- `src/lib/compose.ts`
- `src/lib/crypto.ts`
- `src/lib/db.ts`
- `src/lib/demo-data.ts`
- `src/lib/env.ts`
- `src/lib/errors.ts`
- `src/lib/gmail-parse.ts`
- `src/lib/gmail.ts`
- `src/lib/http.ts`
- `src/lib/jobs.ts`
- `src/lib/log.ts`
- `src/lib/notify.ts`
- `src/lib/oauth-state.ts`
- `src/lib/phone.ts`
- `src/lib/quiet-hours.ts`
- `src/lib/retention.ts`
- `src/lib/retry.ts`
- `src/lib/sanitize.ts`
- `src/lib/session.ts`
- `src/lib/summarize.ts`
- `src/lib/summary-validate.ts`
- `src/lib/usage.ts`
- `src/lib/webhook-signature.ts`
- `src/lib/webhook.ts`
- `src/lib/whatsapp.ts`
- `src/worker/index.ts`
- `tests/integration/isolation.test.ts`
- `tests/unit/ai.test.ts`
- `tests/unit/content.test.ts`
- `tests/unit/reliability.test.ts`
- `tests/unit/security.test.ts`
- `tsconfig.json`
- `tsconfig.tsbuildinfo`

## Verification update (2026-10-31)

The local implementation was run rather than accepted from the original handoff. PostgreSQL persistence is active from `.env`; the Next.js app served the login page and returned `{"ok":true}` from `/api/health`.

### Requirement checklist

| Requirement | Status | Evidence / remaining work |
|---|---|---|
| Phase 1 completion | Implemented and verified | Demo flow, API routes, PostgreSQL schema, migrations, typecheck, build, and tests pass. |
| Responsive accessible dashboard | Implemented and verified locally | Dashboard includes onboarding, Gmail, destination/consent, preferences, summaries, history, usage, account deletion, demo/error states. Browser accessibility review remains manual. |
| Incremental Gmail sync | Implemented but unverified against Gmail | Persisted checkpoints, bounded batches, unique provider message protection, refresh/reconnect handling are in `gmail-sync.ts`; needs Google OAuth credentials. |
| Durable jobs and scheduling | Implemented and verified by unit/build checks | Queue leases, retries, quiet hours, timezone scheduling, rate/quota checks, and dead-job visibility are implemented; live worker delivery is not provider-verified. |
| Priority filtering and daily digests | Implemented and verified | Priority tests and digest formatting/scheduling tests pass; live WhatsApp delivery is not verified. |
| Grounded, injection-resistant AI | Implemented and verified with deterministic/mocked providers | Validation and prompt-injection tests pass; Anthropic API behavior remains unverified. |
| Signed delivery webhooks | Implemented and verified for pure signature/state logic | Live Meta webhook registration and payload verification remain blocked on Meta credentials/public HTTPS. |
| Usage tracking and limits | Implemented and verified by integration/build checks | No pricing or payments implemented by design; atomic subscription billing is future work. |
| Disconnect, retention, account deletion | Implemented and verified by code/build/integration coverage | Live Google token revocation requires a real OAuth account. |
| Meaningful isolation/sync/retry/scheduling/notification tests | Implemented and verified | `npm test`: 28 passed; `npm run test:integration`: 1 passed. |

### Commands run

- `npm test` — 28 passed, 0 failed.
- `npm run typecheck` — passed.
- `npm run build` — passed.
- `npm run test:integration` — 1 passed, 0 failed.
- App check — `/api/health` returned HTTP 200 and `/login` returned HTTP 200.
- `npx prisma validate` — passed.
- `npm run worker:once` — passed; no due jobs remained.
- `npm run db:drift-check` — blocked by the local invalid relative `SHADOW_DATABASE_URL`; this must be corrected before release.

### Unresolved issues and precise next steps for Codex

1. Configure `SHADOW_DATABASE_URL` and run `npm run db:drift-check` before release.
2. Perform the manual demo checklist in `docs/TESTING.md` through a browser, including worker delivery and account deletion.
3. Configure Google OAuth and verify connect, incremental sync, reconnect, revoke, and disconnect with a test Gmail account.
4. Configure Anthropic and verify a real summary plus the prompt-injection fixture; do not treat mock-provider tests as live AI verification.
5. Configure Meta WhatsApp, approved templates, allow-listed test number, and an HTTPS webhook; verify send/status/replay/failure drills. Never remove the allow-list without explicit authorization.
6. Add CI with PostgreSQL for typecheck, unit, migration, drift, integration, and build checks; add production secret/KMS and HTTPS deployment runbooks.

The previous “never installed/compiled/run” statements above describe the original handoff state and are superseded by this verification update. Live-provider claims remain intentionally unverified.
