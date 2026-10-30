-- Hand-written initial migration. Generated WITHOUT running Prisma (no network/DB in authoring sandbox).
-- Verify with:  npm run db:drift-check   (see docs/TESTING.md). Replace by `prisma migrate dev` output if it reports drift.

CREATE TYPE "ConnectionStatus" AS ENUM ('ACTIVE', 'NEEDS_REAUTH', 'DISCONNECTED');
CREATE TYPE "Priority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');
CREATE TYPE "DestinationStatus" AS ENUM ('PENDING', 'VERIFIED', 'REVOKED');
CREATE TYPE "NotificationKind" AS ENUM ('TEST', 'SUMMARY');
CREATE TYPE "SendMode" AS ENUM ('TEMPLATE', 'TEXT');
CREATE TYPE "AttemptStatus" AS ENUM ('PENDING', 'SENDING', 'ACCEPTED', 'SENT', 'DELIVERED', 'READ', 'FAILED', 'UNKNOWN');
CREATE TYPE "JobStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'DEAD');
CREATE TYPE "JobType" AS ENUM ('SEND_NOTIFICATION', 'SYNC_EMAILS', 'SWEEP_STUCK_ATTEMPTS', 'PURGE_RETENTION');

CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,
    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "verifications" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "verifications_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "connected_email_accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'gmail',
    "emailAddress" TEXT NOT NULL,
    "scopes" TEXT NOT NULL,
    "status" "ConnectionStatus" NOT NULL DEFAULT 'ACTIVE',
    "accessTokenEnc" TEXT,
    "refreshTokenEnc" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "lastError" TEXT,
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "disconnectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "connected_email_accounts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "email_records" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "connectedAccountId" TEXT,
    "provider" TEXT NOT NULL DEFAULT 'gmail',
    "providerMessageId" TEXT NOT NULL,
    "threadId" TEXT,
    "subject" TEXT NOT NULL,
    "senderName" TEXT,
    "senderEmail" TEXT NOT NULL,
    "snippet" TEXT,
    "bodyText" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "permalink" TEXT NOT NULL,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "email_records_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "summaries" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emailRecordId" TEXT,
    "subject" TEXT NOT NULL,
    "senderName" TEXT,
    "senderEmail" TEXT NOT NULL,
    "providerMessageId" TEXT NOT NULL,
    "permalink" TEXT NOT NULL,
    "mainMessage" TEXT NOT NULL,
    "requiredAction" TEXT,
    "deadlineText" TEXT,
    "deadlineEvidence" TEXT,
    "priority" "Priority" NOT NULL,
    "priorityReason" TEXT NOT NULL,
    "aiProvider" TEXT NOT NULL,
    "aiModel" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "warnings" TEXT[],
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "summaries_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "notification_destinations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'whatsapp',
    "e164" TEXT NOT NULL,
    "status" "DestinationStatus" NOT NULL DEFAULT 'PENDING',
    "verifiedAt" TIMESTAMP(3),
    "verificationMethod" TEXT,
    "lastInboundAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "notification_destinations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "consent_records" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "destinationId" TEXT NOT NULL,
    "textVersion" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    CONSTRAINT "consent_records_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "notification_preferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "quietHoursStart" TEXT NOT NULL DEFAULT '22:00',
    "quietHoursEnd" TEXT NOT NULL DEFAULT '07:00',
    "notificationsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "notification_attempts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "destinationId" TEXT NOT NULL,
    "summaryId" TEXT,
    "kind" "NotificationKind" NOT NULL,
    "mode" "SendMode",
    "status" "AttemptStatus" NOT NULL DEFAULT 'PENDING',
    "requestKey" TEXT NOT NULL,
    "providerName" TEXT,
    "providerMessageId" TEXT,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "resolvedManually" BOOLEAN NOT NULL DEFAULT false,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "sendStartedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "notification_attempts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "delivery_events" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "attemptId" TEXT,
    "provider" TEXT NOT NULL,
    "providerEventId" TEXT NOT NULL,
    "providerMessageId" TEXT,
    "status" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "detail" JSONB,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "delivery_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "background_jobs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "type" "JobType" NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "status" "JobStatus" NOT NULL DEFAULT 'QUEUED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "runAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedUntil" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "background_jobs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sync_checkpoints" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "cursor" TEXT,
    "lastRunAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "sync_checkpoints_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "usage_records" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "usage_records_pkey" PRIMARY KEY ("id")
);

-- Unique constraints (duplicate email ingestion, duplicate notification jobs, one number per account, idempotent webhooks)
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "sessions_token_key" ON "sessions"("token");
CREATE UNIQUE INDEX "connected_email_accounts_userId_provider_emailAddress_key" ON "connected_email_accounts"("userId", "provider", "emailAddress");
CREATE UNIQUE INDEX "email_records_userId_provider_providerMessageId_key" ON "email_records"("userId", "provider", "providerMessageId");
CREATE UNIQUE INDEX "summaries_emailRecordId_promptVersion_key" ON "summaries"("emailRecordId", "promptVersion");
CREATE UNIQUE INDEX "notification_destinations_channel_e164_key" ON "notification_destinations"("channel", "e164");
CREATE UNIQUE INDEX "notification_preferences_userId_key" ON "notification_preferences"("userId");
CREATE UNIQUE INDEX "notification_attempts_requestKey_key" ON "notification_attempts"("requestKey");
CREATE UNIQUE INDEX "notification_attempts_providerMessageId_key" ON "notification_attempts"("providerMessageId");
CREATE UNIQUE INDEX "delivery_events_provider_providerEventId_key" ON "delivery_events"("provider", "providerEventId");
CREATE UNIQUE INDEX "background_jobs_dedupeKey_key" ON "background_jobs"("dedupeKey");
CREATE UNIQUE INDEX "sync_checkpoints_accountId_kind_key" ON "sync_checkpoints"("accountId", "kind");
CREATE UNIQUE INDEX "usage_records_userId_metric_period_key" ON "usage_records"("userId", "metric", "period");

-- Indexes
CREATE INDEX "sessions_userId_idx" ON "sessions"("userId");
CREATE INDEX "accounts_userId_idx" ON "accounts"("userId");
CREATE INDEX "verifications_identifier_idx" ON "verifications"("identifier");
CREATE INDEX "connected_email_accounts_userId_idx" ON "connected_email_accounts"("userId");
CREATE INDEX "email_records_userId_receivedAt_idx" ON "email_records"("userId", "receivedAt" DESC);
CREATE INDEX "email_records_createdAt_idx" ON "email_records"("createdAt");
CREATE INDEX "summaries_userId_createdAt_idx" ON "summaries"("userId", "createdAt" DESC);
CREATE INDEX "notification_destinations_userId_idx" ON "notification_destinations"("userId");
CREATE INDEX "consent_records_userId_destinationId_idx" ON "consent_records"("userId", "destinationId");
CREATE INDEX "notification_attempts_userId_createdAt_idx" ON "notification_attempts"("userId", "createdAt" DESC);
CREATE INDEX "notification_attempts_status_sendStartedAt_idx" ON "notification_attempts"("status", "sendStartedAt");
CREATE INDEX "delivery_events_attemptId_idx" ON "delivery_events"("attemptId");
CREATE INDEX "delivery_events_providerMessageId_idx" ON "delivery_events"("providerMessageId");
CREATE INDEX "background_jobs_status_runAt_idx" ON "background_jobs"("status", "runAt");
CREATE INDEX "background_jobs_userId_idx" ON "background_jobs"("userId");

-- Foreign keys: every user-owned row cascades on user deletion (account deletion = hard delete)
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "connected_email_accounts" ADD CONSTRAINT "connected_email_accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "email_records" ADD CONSTRAINT "email_records_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "email_records" ADD CONSTRAINT "email_records_connectedAccountId_fkey" FOREIGN KEY ("connectedAccountId") REFERENCES "connected_email_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "summaries" ADD CONSTRAINT "summaries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "summaries" ADD CONSTRAINT "summaries_emailRecordId_fkey" FOREIGN KEY ("emailRecordId") REFERENCES "email_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "notification_destinations" ADD CONSTRAINT "notification_destinations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "notification_destinations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notification_attempts" ADD CONSTRAINT "notification_attempts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notification_attempts" ADD CONSTRAINT "notification_attempts_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "notification_destinations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notification_attempts" ADD CONSTRAINT "notification_attempts_summaryId_fkey" FOREIGN KEY ("summaryId") REFERENCES "summaries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "delivery_events" ADD CONSTRAINT "delivery_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "delivery_events" ADD CONSTRAINT "delivery_events_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "notification_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "background_jobs" ADD CONSTRAINT "background_jobs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sync_checkpoints" ADD CONSTRAINT "sync_checkpoints_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "connected_email_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "usage_records" ADD CONSTRAINT "usage_records_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
