import { describe, expect, it, vi } from "vitest";
import { NpdGatewayError } from "@course/npd";
import { NpdReceiptsService } from "./npd-receipts.service";

describe("NpdReceiptsService issuance", () => {
  it("uses WIRE and persists safe provider diagnostics for a rejected receipt", async () => {
    const updateMany = vi.fn(async () => ({ count: 1 }));
    const update = vi.fn(async () => ({}));
    const prisma = { npdReceiptOperation: { updateMany }, npdReceipt: { update } };
    const service = new NpdReceiptsService(prisma as any, {} as any);
    const createReceipt = vi.fn().mockRejectedValue(new NpdGatewayError("API_ERROR", "private data", 400, "validation.error"));
    vi.spyOn(service as any, "gatewayFor").mockResolvedValue({ createReceipt });
    const operationAt = new Date("2026-09-05T20:08:49.193Z");
    await (service as any).processOne({
      id: "operation", receiptId: "receipt", attemptCount: 1,
      receipt: { connection: { inn: "123456789012" }, operationAt, serviceName: "Канал", amountKopecks: 39000 }
    }, "owner");
    expect(createReceipt).toHaveBeenCalledWith({ inn: "123456789012", operationAt, paymentType: "WIRE", services: [{ name: "Канал", amount: "390.00", quantity: 1 }] });
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "operation", status: "PROCESSING", leaseOwner: "owner" },
      data: expect.objectContaining({ status: "FAILED", lastErrorCode: "API_ERROR", lastErrorRedacted: "Не удалось сформировать чек НПД · API_ERROR · HTTP 400 · validation.error" })
    }));
    expect(update).toHaveBeenCalledWith({ where: { id: "receipt" }, data: { status: "FAILED" } });
  });
});
