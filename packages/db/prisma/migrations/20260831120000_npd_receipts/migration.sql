CREATE TYPE "NpdConnectionStatus" AS ENUM ('ACTIVE', 'REAUTH_REQUIRED', 'DISABLED');
CREATE TYPE "NpdReceiptStatus" AS ENUM ('PENDING', 'ISSUED', 'RECONCILIATION_REQUIRED', 'FAILED');
CREATE TYPE "NpdReceiptOperationStatus" AS ENUM ('PENDING', 'PROCESSING', 'RETRY', 'SUCCEEDED', 'RECONCILIATION_REQUIRED', 'FAILED');
ALTER TYPE "OutboxType" ADD VALUE 'NPD_RECEIPT_ISSUED';

CREATE TABLE "NpdConnection" (
  "id" VARCHAR(32) NOT NULL DEFAULT 'default', "inn" VARCHAR(12) NOT NULL,
  "deviceId" VARCHAR(128) NOT NULL, "refreshTokenCipher" BYTEA NOT NULL,
  "refreshTokenIv" BYTEA NOT NULL, "refreshTokenTag" BYTEA NOT NULL,
  "refreshTokenKeyVersion" INTEGER NOT NULL, "status" "NpdConnectionStatus" NOT NULL DEFAULT 'ACTIVE',
  "fiscalizationStartedAt" TIMESTAMP(3), "lastAuthorizedAt" TIMESTAMP(3),
  "lastSuccessfulOperationAt" TIMESTAMP(3), "lastRefreshedAt" TIMESTAMP(3),
  "lastErrorCode" VARCHAR(64), "lastErrorRedacted" VARCHAR(1024),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "NpdConnection_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "NpdReceipt" (
  "id" UUID NOT NULL, "orderId" UUID, "channelPaymentId" UUID, "userId" UUID NOT NULL,
  "connectionId" VARCHAR(32) NOT NULL DEFAULT 'default', "status" "NpdReceiptStatus" NOT NULL DEFAULT 'PENDING',
  "amountKopecks" INTEGER NOT NULL, "currency" VARCHAR(3) NOT NULL DEFAULT 'RUB', "serviceName" VARCHAR(256) NOT NULL,
  "telegramId" TEXT NOT NULL, "operationAt" TIMESTAMP(3) NOT NULL, "providerReceiptId" VARCHAR(128),
  "printUrl" VARCHAR(2048), "jsonUrl" VARCHAR(2048), "issuedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "NpdReceipt_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "NpdReceiptOperation" (
  "id" UUID NOT NULL, "receiptId" UUID NOT NULL, "status" "NpdReceiptOperationStatus" NOT NULL DEFAULT 'PENDING',
  "attemptCount" INTEGER NOT NULL DEFAULT 0, "lastAttemptAt" TIMESTAMP(3), "nextAttemptAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  "leaseOwner" VARCHAR(128), "leaseExpiresAt" TIMESTAMP(3), "completedAt" TIMESTAMP(3),
  "lastErrorCode" VARCHAR(64), "lastErrorRedacted" VARCHAR(1024),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "NpdReceiptOperation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "NpdReceipt_orderId_key" ON "NpdReceipt"("orderId");
CREATE UNIQUE INDEX "NpdReceipt_channelPaymentId_key" ON "NpdReceipt"("channelPaymentId");
CREATE UNIQUE INDEX "NpdReceipt_providerReceiptId_key" ON "NpdReceipt"("providerReceiptId");
CREATE INDEX "NpdReceipt_connectionId_status_createdAt_idx" ON "NpdReceipt"("connectionId", "status", "createdAt");
CREATE UNIQUE INDEX "NpdReceiptOperation_receiptId_key" ON "NpdReceiptOperation"("receiptId");
CREATE INDEX "NpdReceiptOperation_status_nextAttemptAt_leaseExpiresAt_idx" ON "NpdReceiptOperation"("status", "nextAttemptAt", "leaseExpiresAt");
ALTER TABLE "NpdReceipt" ADD CONSTRAINT "NpdReceipt_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "NpdReceipt" ADD CONSTRAINT "NpdReceipt_channelPaymentId_fkey" FOREIGN KEY ("channelPaymentId") REFERENCES "ChannelPayment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "NpdReceipt" ADD CONSTRAINT "NpdReceipt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "TelegramUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "NpdReceipt" ADD CONSTRAINT "NpdReceipt_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "NpdConnection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "NpdReceiptOperation" ADD CONSTRAINT "NpdReceiptOperation_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "NpdReceipt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
