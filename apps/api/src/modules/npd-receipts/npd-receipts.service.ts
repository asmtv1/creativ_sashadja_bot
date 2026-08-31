import { randomUUID } from "node:crypto";
import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { decryptRefreshToken, encryptRefreshToken, NpdGateway, NpdGatewayError } from "@course/npd";
import { PrismaService } from "../prisma/prisma.service";

const LEASE_MS = 90_000;
const RETRY_DELAYS_MS = [60_000, 5 * 60_000, 30 * 60_000, 2 * 60 * 60_000, 12 * 60 * 60_000];
const RECONCILIATION_WINDOW_MS = 5 * 60_000;

type Db = PrismaService & Record<string, any>;

@Injectable()
export class NpdReceiptsService implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout;
  constructor(private readonly prisma: PrismaService, private readonly config: ConfigService) {}

  onModuleInit() {
    // The API has no separate worker container. The short lease/CAS claim makes
    // these ticks safe when several API replicas are deployed.
    this.timer = setInterval(() => void this.processDue().catch(() => undefined), 15_000);
    this.timer.unref();
  }
  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }

  async queueCourseReceipt(input: { orderId: string; userId: string; telegramId: string; amountKopecks: number; currency: string; serviceName: string; paidAt: Date }) {
    if (input.currency !== "RUB") return;
    await this.prisma.npdReceipt.upsert({
      where: { orderId: input.orderId }, update: {},
      create: { orderId: input.orderId, userId: input.userId, telegramId: input.telegramId, amountKopecks: input.amountKopecks, currency: input.currency, serviceName: input.serviceName, operationAt: input.paidAt, operations: { create: {} } }
    });
  }

  async queueChannelReceipt(input: { paymentId: string; userId: string; telegramId: string; amountKopecks: number; currency: string; serviceName: string; paidAt: Date }) {
    if (input.currency !== "RUB") return;
    await this.prisma.npdReceipt.upsert({
      where: { channelPaymentId: input.paymentId }, update: {},
      create: { channelPaymentId: input.paymentId, userId: input.userId, telegramId: input.telegramId, amountKopecks: input.amountKopecks, currency: input.currency, serviceName: input.serviceName, operationAt: input.paidAt, operations: { create: {} } }
    });
  }

  async processDue(batchSize = Number(this.config.get("NPD_BATCH_SIZE") ?? 20)) {
    if (this.config.get<boolean>("NPD_PROCESSING_ENABLED") !== true) return { processed: 0, enabled: false };
    const owner = `npd:${process.pid}:${randomUUID()}`;
    let processed = 0;
    for (let i = 0; i < batchSize; i += 1) {
      const operation = await this.claimOne(owner);
      if (!operation) break;
      await this.processOne(operation, owner);
      processed += 1;
    }
    return { processed, enabled: true };
  }

  private async claimOne(owner: string) {
    const now = new Date();
    const candidate = await this.prisma.npdReceiptOperation.findFirst({
      where: { OR: [{ status: { in: ["PENDING", "RETRY"] }, nextAttemptAt: { lte: now } }, { status: "PROCESSING", leaseExpiresAt: { lt: now } }] },
      orderBy: [{ nextAttemptAt: "asc" }, { createdAt: "asc" }], select: { id: true }
    });
    if (!candidate) return null;
    const claimed = await this.prisma.npdReceiptOperation.updateMany({
      where: { id: candidate.id, OR: [{ status: { in: ["PENDING", "RETRY"] }, nextAttemptAt: { lte: now } }, { status: "PROCESSING", leaseExpiresAt: { lt: now } }] },
      data: { status: "PROCESSING", leaseOwner: owner, leaseExpiresAt: new Date(now.getTime() + LEASE_MS), lastAttemptAt: now, attemptCount: { increment: 1 } }
    });
    if (claimed.count !== 1) return null;
    return this.prisma.npdReceiptOperation.findUniqueOrThrow({ where: { id: candidate.id }, include: { receipt: { include: { connection: true } } } });
  }

  private async processOne(operation: any, owner: string) {
    try {
      const gateway = await this.gatewayFor(operation.receipt.connection);
      const issued = await gateway.createReceipt({ inn: operation.receipt.connection.inn, operationAt: operation.receipt.operationAt, paymentType: "ACCOUNT", services: [{ name: operation.receipt.serviceName, amount: rubles(operation.receipt.amountKopecks), quantity: 1 }] });
      await this.persistIssued(operation, owner, issued);
    } catch (error) {
      const npdError = error instanceof NpdGatewayError ? error : new NpdGatewayError("UNAVAILABLE", "NPD operation failed");
      if (npdError.code === "AMBIGUOUS_WRITE") {
        try {
          if (await this.reconcileAmbiguousCreate(operation, owner)) return;
        } catch { /* fall through to manual reconciliation */ }
        await this.reconciliationRequired(operation, owner, npdError.code, "NPD create outcome requires reconciliation");
        return;
      }
      if (npdError.code === "UNAUTHORIZED") {
        await this.prisma.npdConnection.update({ where: { id: operation.receipt.connectionId }, data: { status: "REAUTH_REQUIRED", lastErrorCode: npdError.code, lastErrorRedacted: "NPD authorization needs renewal" } });
        await this.finish(operation.id, owner, { status: "RETRY", nextAttemptAt: null, lastErrorCode: npdError.code, lastErrorRedacted: "NPD authorization needs renewal" });
        return;
      }
      if (["RATE_LIMITED", "TIMEOUT", "NETWORK"].includes(npdError.code) && operation.attemptCount < RETRY_DELAYS_MS.length) {
        await this.finish(operation.id, owner, { status: "RETRY", nextAttemptAt: retryAt(operation.attemptCount), lastErrorCode: npdError.code, lastErrorRedacted: "NPD temporary failure" });
        return;
      }
      await this.finish(operation.id, owner, { status: "FAILED", completedAt: new Date(), lastErrorCode: npdError.code, lastErrorRedacted: "NPD receipt issue failed" });
      await this.prisma.npdReceipt.update({ where: { id: operation.receiptId }, data: { status: "FAILED" } });
    }
  }

  private async gatewayFor(connection: any) {
    if (!connection?.fiscalizationStartedAt || connection.status !== "ACTIVE") throw new NpdGatewayError("UNAVAILABLE", "NPD connection is not active");
    const refreshToken = decryptRefreshToken({ cipher: connection.refreshTokenCipher, iv: connection.refreshTokenIv, tag: connection.refreshTokenTag, keyVersion: connection.refreshTokenKeyVersion });
    const gateway = new NpdGateway({ deviceId: connection.deviceId, timeoutMs: Number(this.config.get("NPD_REQUEST_TIMEOUT_MS") ?? 10_000) });
    const tokens = await gateway.refresh(refreshToken);
    const profile = await gateway.getProfile();
    if (profile.inn !== connection.inn) throw new NpdGatewayError("UNAUTHORIZED", "NPD profile INN mismatch");
    const encrypted = encryptRefreshToken(tokens.refreshToken);
    await this.prisma.npdConnection.update({ where: { id: connection.id }, data: { refreshTokenCipher: encrypted.cipher, refreshTokenIv: encrypted.iv, refreshTokenTag: encrypted.tag, refreshTokenKeyVersion: encrypted.keyVersion, lastRefreshedAt: new Date(), lastAuthorizedAt: new Date(), lastErrorCode: null, lastErrorRedacted: null } });
    return gateway;
  }

  private async reconcileAmbiguousCreate(operation: any, owner: string) {
    const gateway = await this.gatewayFor(operation.receipt.connection);
    const receipts = await gateway.listRecentReceipts({ from: new Date(operation.receipt.operationAt.getTime() - RECONCILIATION_WINDOW_MS) });
    const matches = receipts.filter((receipt: { cancelled: boolean; sourceDeviceId?: string; amountKopecks: number; serviceNames: string[]; operationAt: Date }) => !receipt.cancelled && receipt.sourceDeviceId === operation.receipt.connection.deviceId && receipt.amountKopecks === operation.receipt.amountKopecks && receipt.serviceNames.length === 1 && receipt.serviceNames[0] === operation.receipt.serviceName && Math.abs(receipt.operationAt.getTime() - operation.receipt.operationAt.getTime()) <= RECONCILIATION_WINDOW_MS);
    if (matches.length !== 1) return false;
    const confirmed = await gateway.getReceipt(operation.receipt.connection.inn, matches[0]!.receiptUuid);
    if (confirmed.cancelled) return false;
    await this.persistIssued(operation, owner, confirmed);
    return true;
  }

  private async persistIssued(operation: any, owner: string, issued: { receiptUuid: string; printUrl: string; jsonUrl: string }) {
    await this.prisma.$transaction(async (tx) => {
      const result = await tx.npdReceiptOperation.updateMany({ where: { id: operation.id, status: "PROCESSING", leaseOwner: owner }, data: { status: "SUCCEEDED", completedAt: new Date(), leaseOwner: null, leaseExpiresAt: null, lastErrorCode: null, lastErrorRedacted: null } });
      if (result.count !== 1) return;
      await tx.npdReceipt.update({ where: { id: operation.receiptId }, data: { status: "ISSUED", providerReceiptId: issued.receiptUuid, printUrl: issued.printUrl, jsonUrl: issued.jsonUrl, issuedAt: new Date() } });
      await tx.botOutbox.create({ data: { telegramId: operation.receipt.telegramId, type: "NPD_RECEIPT_ISSUED", payload: { receiptId: operation.receiptId, printUrl: issued.printUrl, serviceName: operation.receipt.serviceName } } });
      await tx.npdConnection.update({ where: { id: operation.receipt.connectionId }, data: { lastSuccessfulOperationAt: new Date() } });
    });
  }

  private async reconciliationRequired(operation: any, owner: string, code: string, message: string) {
    await this.prisma.$transaction([this.prisma.npdReceiptOperation.updateMany({ where: { id: operation.id, status: "PROCESSING", leaseOwner: owner }, data: { status: "RECONCILIATION_REQUIRED", completedAt: new Date(), leaseOwner: null, leaseExpiresAt: null, lastErrorCode: code, lastErrorRedacted: message } }), this.prisma.npdReceipt.update({ where: { id: operation.receiptId }, data: { status: "RECONCILIATION_REQUIRED" } })]);
  }
  private finish(id: string, owner: string, data: Record<string, unknown>) { return this.prisma.npdReceiptOperation.updateMany({ where: { id, status: "PROCESSING", leaseOwner: owner }, data: { ...data, leaseOwner: null, leaseExpiresAt: null } }); }
}

function rubles(kopecks: number) { return `${Math.floor(kopecks / 100)}.${String(kopecks % 100).padStart(2, "0")}`; }
function retryAt(attemptCount: number) { const base = RETRY_DELAYS_MS[Math.min(Math.max(attemptCount - 1, 0), RETRY_DELAYS_MS.length - 1)]!; return new Date(Date.now() + base + Math.floor(base * ((attemptCount * 37) % 11) / 100)); }
