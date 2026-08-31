CREATE TYPE "ChannelSubscriptionStatus" AS ENUM ('PENDING', 'ACTIVE', 'PAST_DUE', 'CANCELED_AT_PERIOD_END', 'EXPIRED', 'REFUNDED');
CREATE TYPE "ChannelPaymentKind" AS ENUM ('INITIAL', 'RENEWAL', 'MANUAL_RENEWAL');
CREATE TYPE "ChannelPaymentStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'CANCELED', 'FAILED', 'REFUNDED');
CREATE TYPE "ReceiptOperationType" AS ENUM ('ISSUE', 'CANCEL');
CREATE TYPE "ReceiptOperationStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED');
CREATE TYPE "ChannelMembershipSource" AS ENUM ('MANAGED', 'MANUAL', 'EXEMPT');

CREATE TABLE "ChannelProduct" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "slug" TEXT NOT NULL, "title" TEXT NOT NULL,
  "priceKopecks" INTEGER NOT NULL, "currency" TEXT NOT NULL DEFAULT 'RUB', "periodDays" INTEGER NOT NULL DEFAULT 30,
  "renewalLeadMinutes" INTEGER NOT NULL DEFAULT 240, "gracePeriodMinutes" INTEGER NOT NULL DEFAULT 1440,
  "enabled" BOOLEAN NOT NULL DEFAULT false, "telegramChatId" TEXT, "telegramChatTitle" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ChannelProduct_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ChannelProduct_slug_key" ON "ChannelProduct"("slug");

CREATE TABLE "ChannelSubscription" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "userId" UUID NOT NULL, "productId" UUID NOT NULL,
  "status" "ChannelSubscriptionStatus" NOT NULL DEFAULT 'PENDING', "autoRenew" BOOLEAN NOT NULL DEFAULT true,
  "paymentMethodId" TEXT, "periodStart" TIMESTAMP(3), "periodEnd" TIMESTAMP(3), "nextChargeAt" TIMESTAMP(3), "nextAttemptAt" TIMESTAMP(3),
  "attemptCount" INTEGER NOT NULL DEFAULT 0, "reminderSentForEnd" TIMESTAMP(3), "termsVersion" TEXT, "termsAcceptedAt" TIMESTAMP(3), "cancelRequestedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ChannelSubscription_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ChannelSubscription_userId_productId_key" ON "ChannelSubscription"("userId", "productId");
CREATE INDEX "ChannelSubscription_nextChargeAt_idx" ON "ChannelSubscription"("nextChargeAt");
CREATE INDEX "ChannelSubscription_nextAttemptAt_idx" ON "ChannelSubscription"("nextAttemptAt");
CREATE INDEX "ChannelSubscription_periodEnd_idx" ON "ChannelSubscription"("periodEnd");
ALTER TABLE "ChannelSubscription" ADD CONSTRAINT "ChannelSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "TelegramUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChannelSubscription" ADD CONSTRAINT "ChannelSubscription_productId_fkey" FOREIGN KEY ("productId") REFERENCES "ChannelProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "ChannelPayment" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "subscriptionId" UUID NOT NULL, "kind" "ChannelPaymentKind" NOT NULL,
  "status" "ChannelPaymentStatus" NOT NULL DEFAULT 'PENDING', "amountKopecks" INTEGER NOT NULL, "currency" TEXT NOT NULL,
  "providerPaymentId" TEXT, "idempotenceKey" TEXT NOT NULL, "confirmationUrl" TEXT, "failureCode" TEXT, "providerPayload" JSONB,
  "paidAt" TIMESTAMP(3), "refundedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ChannelPayment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ChannelPayment_providerPaymentId_key" ON "ChannelPayment"("providerPaymentId");
CREATE UNIQUE INDEX "ChannelPayment_idempotenceKey_key" ON "ChannelPayment"("idempotenceKey");
CREATE INDEX "ChannelPayment_subscriptionId_status_idx" ON "ChannelPayment"("subscriptionId", "status");
ALTER TABLE "ChannelPayment" ADD CONSTRAINT "ChannelPayment_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "ChannelSubscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ChannelInvite" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "subscriptionId" UUID NOT NULL, "inviteLink" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL, "usedAt" TIMESTAMP(3), "revokedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ChannelInvite_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ChannelInvite_inviteLink_key" ON "ChannelInvite"("inviteLink");
CREATE INDEX "ChannelInvite_subscriptionId_expiresAt_idx" ON "ChannelInvite"("subscriptionId", "expiresAt");
ALTER TABLE "ChannelInvite" ADD CONSTRAINT "ChannelInvite_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "ChannelSubscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ChannelMembership" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "subscriptionId" UUID NOT NULL, "source" "ChannelMembershipSource" NOT NULL,
  "joinedAt" TIMESTAMP(3), "removedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ChannelMembership_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ChannelMembership_subscriptionId_key" ON "ChannelMembership"("subscriptionId");
ALTER TABLE "ChannelMembership" ADD CONSTRAINT "ChannelMembership_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "ChannelSubscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ReceiptOperation" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "paymentId" UUID NOT NULL, "type" "ReceiptOperationType" NOT NULL,
  "status" "ReceiptOperationStatus" NOT NULL DEFAULT 'PENDING', "externalId" TEXT, "receiptUrl" TEXT, "attempts" INTEGER NOT NULL DEFAULT 0,
  "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "lastError" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ReceiptOperation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ReceiptOperation_paymentId_type_key" ON "ReceiptOperation"("paymentId", "type");
CREATE INDEX "ReceiptOperation_status_nextAttemptAt_idx" ON "ReceiptOperation"("status", "nextAttemptAt");
ALTER TABLE "ReceiptOperation" ADD CONSTRAINT "ReceiptOperation_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "ChannelPayment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
