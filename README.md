# Mail Bridge AI

Connect Gmail → pick an email → AI summary → save → WhatsApp notification → delivery status.
Phase 1 prototype. The local demo path is installed, migrated, built, and verified. Live Gmail, Anthropic, and WhatsApp provider flows still require owner credentials and explicit test authorization; see `docs/HANDOFF.md`.

## Requirements
Node.js ≥ 22.18, npm ≥ 10, PostgreSQL 14+ (local). Windows, macOS or Linux.

## 1. Install
```bash
npm install            # creates package-lock.json: commit it
npm run db:generate
```

## 2. Database (local PostgreSQL)
Using `psql` as a superuser:
```sql
CREATE USER mailbridge WITH PASSWORD 'mailbridge';
CREATE DATABASE mailbridge OWNER mailbridge;
-- for the drift check only:
CREATE DATABASE mailbridge_shadow OWNER mailbridge;
```
Then:
```bash
npm run db:migrate     # applies prisma/migrations (prisma migrate deploy)
npm run db:drift-check # see docs/TESTING.md; requires SHADOW_DATABASE_URL
npm run db:seed        # synthetic users only (alice/bob@example.test, no credentials)
```
> The initial migration was written by hand. If `db:drift-check` reports differences, regenerate with `npx prisma migrate dev --name init` and commit the result.

## 3. Environment
```bash
cp .env.example .env          # Windows PowerShell: Copy-Item .env.example .env
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"   # → BETTER_AUTH_SECRET
node -e "console.log('1:'+require('crypto').randomBytes(32).toString('base64'))"  # → ENCRYPTION_KEYS
```
Fill `.env`. `DEMO_MODE=true` (default) needs only the DB, `APP_URL`, `BETTER_AUTH_SECRET`, `ENCRYPTION_KEYS`.
`.env` is git-ignored. The env must also be present when running `npm run build` (route modules read it at import).

## 4. Run (two terminals)
```bash
npm run dev        # web on http://localhost:3000
npm run worker     # background worker (sends notifications, sweeper, retention)
```
`npm run worker:once` drains due jobs and exits (useful for testing).

## 5. Demo path (no Gmail, no AI key, nothing sent)
1. Open http://localhost:3000, **Sign up** (12+ char password).
2. Dashboard shows a **DEMO / MOCK ACTIVE** banner and 4 synthetic emails (one is a prompt-injection test).
3. Click **Summarize** on an email → summary appears under *Summaries*.
4. Add a phone number (fake is fine in demo) with the consent box. Set `ALLOW_OWNER_ATTEST=true` in `.env`, restart, click **Mark as mine (dev)**.
5. Click **Send to WhatsApp…** or **Send test…**. The worker (mock provider) records DELIVERED, labelled DEMO. Nothing leaves your machine.

Demo results are **not** live verification.

## 6. Live path (needs credentials; see HANDOFF → Live verification)
Set `DEMO_MODE=false`, Google OAuth client (redirect `{APP_URL}/api/gmail/callback`), `AI_PROVIDER=anthropic` + key, `WHATSAPP_PROVIDER=cloud` + Meta values, and **`WHATSAPP_LIVE_SEND_ALLOWLIST`** with only the number(s) you authorize for testing. Expose the webhook (`/api/webhooks/whatsapp`) over HTTPS (e.g. a tunnel) and register it in Meta with your verify token.

## Scripts
`dev` `build` `start` `worker` `worker:once` `db:generate` `db:migrate` `db:migrate:dev` `db:seed` `db:drift-check` `typecheck` `test` (unit) `test:integration` (needs DB).

## Layout
`src/app` UI + route handlers · `src/lib` services (pure modules are unit-tested) · `src/worker` worker · `prisma/` schema, migration, seed · `tests/` · `docs/`.
