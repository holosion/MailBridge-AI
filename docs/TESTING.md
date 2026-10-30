# Testing

## Environment where this was authored
Linux sandbox, Node v22.22.2, **no network** (`npm install` impossible), no PostgreSQL, no Prisma/Next installed. Therefore only code that has no third-party imports could be executed.

## What was actually run

### Unit tests: `npm test` (equivalent: `node --test "tests/unit/*.test.ts"`): **25 passed, 0 failed**
Run with Node's built-in runner and native TypeScript stripping (no install needed).

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

### Static checks
- `tsc --noEmit` was run with dependencies missing: **0 syntax errors (TS1xxx)**. The remaining ~380 diagnostics are all caused by uninstalled packages/types (`@types/node`, `react`, `next`, `@prisma/client`, `zod`, `better-auth`). **This is not a passing typecheck.**
- Migration vs schema structural cross-check (script): 15/15 tables, 13 unique indexes, 15 indexes, 19 foreign keys present on both sides. **Not** a substitute for Prisma validating it.

## NOT run (no result exists: do not assume these pass)
| Item | Command |
|---|---|
| Dependency install / lockfile | `npm install` |
| Prisma schema validation | `npx prisma validate` |
| Migration applies to empty DB | `npm run db:migrate` |
| Migration ↔ schema drift | `npm run db:drift-check` (needs `SHADOW_DATABASE_URL`) |
| Typecheck | `npm run typecheck` |
| Production build | `npm run build` |
| Isolation/idempotency/cascade integration test | `npm run test:integration` (requires migrated DB + env) |
| Worker end-to-end (demo) | `npm run worker:once` after queuing from the UI |
| Browser run of every screen | manual |
| **Any live Gmail / AI / WhatsApp call** | see HANDOFF |

Expect some fixes on first typecheck/build: Better Auth and Prisma API usage was written without the libraries present.

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
