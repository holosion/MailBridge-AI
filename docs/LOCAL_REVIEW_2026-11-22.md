# Local update and test review — 22 November 2026

## Repository update

- Source: https://github.com/holosion/MailBridge-AI.git, branch `main`.
- Updated the clean local checkout from `fb7f885` to `2209502` by fast-forward.
- Preserved the ignored local `.env` and existing database. No cloud deployment or GitHub push was performed.
- The repository now contains a Vite/React + Express + Firebase application, a native Kotlin Android scaffold, and the retained Next.js/PostgreSQL application. The new app does not automatically use the old app's accounts or Gmail OAuth sessions.

## Checks

- TypeScript check: passed after restoring dependencies and source aliases removed by the upstream merge.
- Retained backend unit tests: all 29 passed after a clean dependency update. The initial clean install exposed missing backend packages; these have been restored.
- PostgreSQL integration test: attempted, but failed at connection setup because Docker/PostgreSQL is not running on localhost:5432. No isolation-test result can be claimed for this run.
- Vite production build: passed using Node 24.22.3; large JavaScript bundle warning (about 1 MB uncompressed).
- HTTP smoke checks: 8 passed on port 3100, with provider credentials disabled. Covered homepage, health, missing/invalid analysis input, missing Gemini configuration, invalid/unconfigured WhatsApp recipient, and invalid/valid synthetic Gmail webhook payloads.
- Browser: onboarding, demo entry, five-message inbox, message details, and missing-Gemini-key error display all worked.
- Android `testDebugUnitTest assembleDebug`: blocked before compilation because Java/JAVA_HOME is missing. Android SDK was not found in the standard location either. The committed APK was not installed or treated as proof of a successful source build.
- Live Firebase sign-in, Firestore rules enforcement, Gmail authorization in the new app, Gemini output, FCM delivery, and WhatsApp delivery were not verified by these smoke tests.

## Important unfinished behavior

1. **Native Android UI is a scaffold.** `android/app/src/main/java/com/mailbridge/ai/MainActivity.kt` displays placeholder Home, Inbox, Insights, and Alerts screens. It does not connect the Gmail/AI helper classes to a sign-in flow, data loading, or view models.
2. **Automatic incoming-email processing is missing from the new backend.** `server.ts` acknowledges Gmail Pub/Sub payloads but does not fetch history/messages, analyze them, persist results, or schedule alerts. The browser's analysis flow is manually triggered.
3. **Backend authorization is missing.** Express AI and WhatsApp routes do not validate Firebase ID tokens or enforce per-user recipient ownership/consent. Firestore rules do not protect these Express endpoints. Address this before exposing the new server with live credentials.
4. **WhatsApp acceptance is incorrectly presented as verification/delivery.** The verify route reports `verified` upon Meta accepting a send request, without proving number ownership. The alert route reports `sent` without delivery confirmation. The new server has no equivalent of the retained backend's signed WhatsApp status webhook, allowlist, queue, or delivery reconciliation. Free-form alert text also needs a valid conversation window or an approved template.
5. **Gemini is not configured locally.** The existing private `.env` has no `GEMINI_API_KEY`. README instructs using `.env.local`, while the server's `dotenv/config` defaults to `.env`; startup documentation/configuration needs alignment.
6. **Native push is incomplete.** The Android service can render received FCM messages, but the activity does not request notification permission, and no end-to-end device-token registration plus server dispatch flow is connected.
7. **Android test/build details need verification once the SDK is installed.** JVM parser tests use Android `org.json` without a JVM JSON test dependency. Release configuration references a missing `proguard-rules.pro`. These are source-review findings, not compiler-confirmed failures.
8. **Generated files are tracked upstream.** The repository includes `android/.gradle` caches and an APK. Ignore rules were restored locally, but already-tracked files remain tracked; cleanup should be a separate reviewed change.

## Next implementation priorities

1. Install/configure JDK 17 and Android SDK 35, then build and run Android unit tests on this checkout.
2. Connect native Firebase sign-in, Gmail consent, inbox data, and AI results to the Compose screens.
3. Protect the Express API with authenticated user checks and recipient consent; implement accurate WhatsApp status handling.
4. Implement the actual Gmail history-processing job and FCM token registration/dispatch.
5. Configure Gemini and validate the new Firebase project/rules using test accounts before live email-to-alert testing.

This is a working web-interface prototype, not a verified end-to-end mobile email notification system yet.

## Local compatibility changes and repeatable checks

- Updated esbuild to match Vite's declared peer range and TypeScript to 6.0.3 to match the Firebase ESLint tooling's supported range. Regenerated the npm lockfile without force/legacy-peer-deps.
- Restored the retained backend's exact dependencies (Next.js, Prisma, Better Auth, Zod), Prisma generation commands, unit/integration test scripts, and TypeScript source aliases.
- Declared Node >=24.12.0, as required by the installed Firebase packages. This machine's default Node remains 22.23.2; Node 24.22.3 was downloaded separately for validation.
- Added `tests/smoke/backend.test.mjs`: starts an isolated backend process with no live Gemini/WhatsApp credentials, runs eight HTTP checks, and shuts the process down.
- Restored ignore rules for local Next.js output, Android settings/caches, and signing key files. No private environment file was changed.

With Node 24.12+ on PATH:

```powershell
npm ci
npm run db:generate
npm run lint
npm test
npm run build
npm run test:smoke
# Requires Docker/PostgreSQL to be running:
npm run test:integration
```

Run `npm run dev` for the new interface. It uses Firebase, not the legacy PostgreSQL sign-in. Do not assume the earlier connected Gmail session transfers to it.
