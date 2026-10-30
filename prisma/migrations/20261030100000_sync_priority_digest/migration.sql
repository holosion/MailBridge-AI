-- AlterEnum
ALTER TYPE "JobType" ADD VALUE 'DAILY_DIGEST';

-- AlterEnum
ALTER TYPE "NotificationKind" ADD VALUE 'DIGEST';

-- AlterTable
ALTER TABLE "connected_email_accounts" ADD COLUMN     "lastSyncAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "notification_preferences" ADD COLUMN     "autoSyncEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "digestEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "digestTime" TEXT NOT NULL DEFAULT '08:00',
ADD COLUMN     "lastDigestSentAt" TIMESTAMP(3),
ADD COLUMN     "minPriority" "Priority" NOT NULL DEFAULT 'HIGH',
ADD COLUMN     "syncIntervalMinutes" INTEGER NOT NULL DEFAULT 15;
