# Google sign-in and Gmail connection

The Android app now has two distinct flows:

1. **Sign in with Google** uses Credential Manager and Firebase Authentication. Firebase restores the signed-in user across app restarts.
2. **Connect Gmail** requests only `gmail.readonly` using Google Identity AuthorizationClient. It checks the Gmail profile matches the signed-in email, then loads up to 20 recent inbox messages. Refresh requests a current authorization token. OAuth tokens and message content are not persisted by the app.

Sign out clears the visible inbox and Firebase session. Revoking Gmail access is a separate action in the user's Google Account third-party connections. This change does not enable background sync, AI summaries, or WhatsApp delivery.

## Required Firebase configuration

The checked-in `app/google-services.json` currently has an empty OAuth client list. The app therefore explains the missing setup rather than crashing or pretending sign-in succeeded.

Console access check on 22 November 2026: while signed in as `akenajonathan24@gmail.com`, Firebase reported that `gen-lang-client-0066594917` does not exist or the account lacks permission to list its apps. Project access must be restored, or the app must be registered in an accessible Firebase project and its configuration replaced. No provider or cloud permission was changed.

Use project **gen-lang-client-0066594917** (the project in this Android configuration), not the older PostgreSQL web app's Google project:

1. Firebase Console → Authentication → Sign-in method → enable Google and select the appropriate support email.
2. Firebase Project settings → Android app `com.mailbridge.ai` → register the SHA-1 and SHA-256 fingerprints for the key used to sign the APK.
3. Download the updated `google-services.json` into `android/app/`. It must contain a Web OAuth client (`client_type: 3`); Google Services generates `default_web_client_id` from it. Never put a client secret or service account private key in the APK.
4. In the same Google Cloud project, enable Gmail API, configure the OAuth consent screen and add the personal test Gmail account as an allowed test user while the app is in testing. Request the Gmail read-only scope. Google approval may be required before distributing beyond test users.
5. Build and install the updated APK. An APK can replace the old installed app only if its package and signing key match. This update uses version code 2; keep the original signing key for in-place upgrades.

Google documentation:
- https://firebase.google.com/docs/auth/android/google-signin
- https://developer.android.com/identity/authorization

## Build and check

Requires JDK 17, Android SDK 35 and Android build tools. Configure `JAVA_HOME` and the SDK location in ignored `local.properties` or `ANDROID_HOME`.

```powershell
cd android
.\gradlew.bat --project-cache-dir "$env:TEMP\mailbridge-gradle-cache" signingReport
.\gradlew.bat --project-cache-dir "$env:TEMP\mailbridge-gradle-cache" testDebugUnitTest assembleDebug
```

APK output: `app/build/outputs/apk/debug/app-debug.apk`.

On a phone with Google Play services, verify:
- Cancel sign-in: remain signed out and show a clear message.
- Complete Google sign-in: show the selected email without requesting Gmail access automatically.
- Decline Gmail permission: remain signed in, with no mail displayed.
- Connect Gmail: show only the signed-in account's recent inbox; handle an empty inbox normally.
- Refresh after permission expiry/revocation: show reconnect guidance rather than fake emails.
- Sign out or switch accounts: clear the previous mailbox immediately.
- Restart/rotate: retain Firebase identity; reconnect Gmail after a process restart to reload in-memory mail.

Local validation on 22 November 2026: Gradle could not start because Java/JAVA_HOME is unavailable; Android SDK was also absent in the standard location. Added Gmail client/parser tests are pending execution with that toolchain. No updated APK or real-phone sign-in success is claimed yet.
