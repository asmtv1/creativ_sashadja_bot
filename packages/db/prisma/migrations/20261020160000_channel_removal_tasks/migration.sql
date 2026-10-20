CREATE TYPE "ChannelRemovalStatus" AS ENUM ('PENDING', 'RETRY', 'SKIPPED', 'REMOVED');

CREATE TABLE "ChannelRemovalTask" (
    "subscriptionId" UUID NOT NULL,
    "status" "ChannelRemovalStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastCheckedAt" TIMESTAMP(3),
    "lastReason" VARCHAR(100),
    "lastError" VARCHAR(500),
    "removedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ChannelRemovalTask_pkey" PRIMARY KEY ("subscriptionId")
);

CREATE INDEX "ChannelRemovalTask_status_nextAttemptAt_idx" ON "ChannelRemovalTask"("status", "nextAttemptAt");

ALTER TABLE "ChannelRemovalTask" ADD CONSTRAINT "ChannelRemovalTask_subscriptionId_fkey"
    FOREIGN KEY ("subscriptionId") REFERENCES "ChannelSubscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Allow users who renew after confirmed removal to receive a re-entry invite.
ALTER TABLE "ChannelPayment" ADD COLUMN "rejoinInviteRequired" BOOLEAN NOT NULL DEFAULT false;
