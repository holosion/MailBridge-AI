# MailBridge AI — Native Android Setup & Service Configuration

This directory contains the modular Kotlin + Jetpack Compose (Material 3) Android project for **MailBridge AI**, structured around a provider-agnostic `EmailProviderClient` domain layer so additional email providers (Outlook/IMAP) and a shared iOS Kotlin Multiplatform core can be added cleanly.

## 1. Functional Components in This Repository
- **Live Interactive Full-Stack Web App (Port 3000)**:
  - Firebase Authentication (`GoogleAuthProvider`) + Cloud Firestore persistence (`users`, `preferences`, `whatsapp`, `emailInsights`, `alerts`, `reminders`) protected by hardened `firestore.rules`.
  - Official Gmail REST API v1 integration (`https://www.googleapis.com/auth/gmail.readonly`) with separate sign-in vs. Gmail authorization consent.
  - Server-side Gemini AI structured JSON analyzer (`server.ts` -> `gemini-4-hydrogen` with untrusted-email isolation and strict schema validation).
  - Real-time Gmail Pub/Sub push webhook handler (`/api/gmail/watch-webhook`).
  - Meta WhatsApp Business Cloud API integration endpoints (`/api/notifications/whatsapp/verify` and `/api/notifications/whatsapp/send-alert`).
- **Native Android Kotlin Project (`/android`)**:
  - Material 3 Compose UI (`#174EA6` / `#00BCD4`) with Light & Dark themes and 5-tab navigation (`Home | Inbox | AI Insights | Alerts | Settings`).
  - `GmailApiClient.kt` + `GeminiEmailAnalyzer.kt` + `MailBridgeMessagingService.kt` (FCM) + JUnit parser tests.

## 2. External Service Configuration Required for Native Android APK Build
1. **Firebase Android App Registration**:
   - Register Android package `com.mailbridge.ai` in the Firebase Console (`gen-lang-client-0066594917`).
   - Add your debug & release SHA-1 / SHA-256 signing fingerprints.
   - Download `google-services.json` into `/android/app/google-services.json`.
2. **Gmail OAuth & Pub/Sub Watch**:
   - In Google Cloud Console, enable **Gmail API** and **Cloud Pub/Sub API**.
   - Create an Android OAuth 2.0 Client ID matching `com.mailbridge.ai` + SHA-1.
   - Point a Cloud Pub/Sub push subscription to your deployed backend URL: `https://<your-cloud-run-url>/api/gmail/watch-webhook`.
3. **Meta WhatsApp Business Cloud API**:
   - Create a Meta Developer App with the **WhatsApp** product enabled.
   - Submit and approve the `mailbridge_urgent_alert` utility template.
   - Configure `WHATSAPP_ACCESS_TOKEN` and `WHATSAPP_PHONE_NUMBER_ID` in your backend server environment secrets (never inside the Android APK).
4. **Build APK Locally**:
   - Open `/android` in Android Studio Ladybug+ (JDK 17, Android SDK 35) and run `./gradlew assembleDebug` or `./gradlew test`.
