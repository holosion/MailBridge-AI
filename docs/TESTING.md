# Testing

## Current verification environment
Windows, Node v22.23.2, npm 10.9.8, installed dependencies, and a migrated local PostgreSQL database loaded from `.env`.

## What was actually run

### Unit tests: `npm test`: **29 passed, 0 failed**
Run with Node's built-in runner. The worker entrypoint is guarded so importing scheduling helpers does not start a background loop during tests.

| Area | Tests (all passing) |
|---|---|
| Encryption | round trip + AAD binding; tampered ciphertext rejected; key rotation (old data readable, `needsRotation`); bad key material rejected |
| Webhook signature | valid, wrong secret, modified body, missing header, malformed hex, empty secret |
| OAuth state / PKCE | signed, expiring, tamper-evident; PKCE verifier/challenge |
| Phone | E.164 validation and masking |
| Content safety | HTML/script/bidi/zero-width stripping; MIME body extraction (plain preferred, attachments skipped); From parsing |
| Summary validation | grounded deadline/action kept; fabricated ones dropped with warnings; malformed output rejected; unknown fields ignored; JSON extraction from chatter |
| AI core (demo provider) | deadline+action extracted; newsletter yields no action/deadline; **prompt-injection email not obeyed**; a lying model's deadline is dropped; one retry on invalid JSON; `<email>` delimiter cannot be closed by email text |
| Reliability helpers | backoff growth/cap/jitter; delivery-status monotonicity (dup/out-of-order); quiet hours incl. overnight + timezone + disabled; next-end calculation |
| WhatsApp composition | template params single-line/bounded; text omits unsupported fields |

### Static and integration checks
- `npm run typecheck`: **passed**
- `npm run build`: **passed** (`next build`; Prisma client generated successfully)
- `npm run test:integration`: **1 passed, 0 failed** (user isolation)
- `npx prisma validate`: **passed**
- `npm run worker:once`: **passed** (no due jobs; housekeeping completed)
- `npm run db:drift-check`: **blocked** because the current `SHADOW_DATABASE_URL` is a relative/invalid URL; set a valid PostgreSQL shadow URL and rerun before release.

## Provider and release checks not verified locally
| Item | Command |
|---|---|
| Migration ↔ schema drift | `npm run db:drift-check` (needs `SHADOW_DATABASE_URL`) |
| Worker end-to-end (demo) | `npm run worker:once` after queuing from the UI |
| Browser run of every screen | manual |
| **Any live Gmail / AI / WhatsApp call** | see HANDOFF |

## Manual test checklist (demo)
1. Sign up/in/out; hitting `/dashboard` or `/api/emails` signed-out → redirect / 401.
2. Summarize `demo-0001`: deadline "Friday 7 November" shown. `demo-0002`: "None found". `demo-0004`: LOW priority, no deadline, warning-free but mentions embedded instructions.
3. Add number without consent → blocked. With consent → PENDING. Attest (dev) → VERIFIED.
4. Send summary twice quickly → second reports "Already queued or sent". Worker running → DELIVERED + DEMO badge. Restart everything → history persists.
5. Set quiet hours to include "now" → summary notification stays PENDING until the window ends; test message still sends.
6. Sign up a second user → sees none of the first user's data; `POST /api/notifications` with the first user's destination id → 404.
7. `DELETE /api/account` → all rows gone (check psql).

## Manual test checklist (webhook, once live)
Use a tunnel + Meta's webhook test: wrong/absent signature → 401; correct → 200; replay same payload → no duplicate `delivery_events`; status `delivered` before `sent` → status stays DELIVERED.
