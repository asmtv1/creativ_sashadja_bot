export type ReceiptPayment = { id: string; amountKopecks: number; currency: string; paidAt: Date };
export type ReceiptResult = { externalId: string; receiptUrl?: string };

export interface SelfEmployedReceiptProvider {
  isReady(): Promise<boolean>;
  issueReceipt(payment: ReceiptPayment): Promise<ReceiptResult>;
  cancelReceipt(receipt: { externalId: string }, refund: { paymentId: string }): Promise<void>;
  getOperationStatus(externalId: string): Promise<"PENDING" | "SUCCEEDED" | "FAILED">;
}

/** Safe default: no real checkout is possible until a verified provider is configured. */
export class DisabledSelfEmployedReceiptProvider implements SelfEmployedReceiptProvider {
  async isReady() { return false; }
  async issueReceipt(): Promise<ReceiptResult> { throw new Error("Receipt provider is disabled"); }
  async cancelReceipt(): Promise<void> { throw new Error("Receipt provider is disabled"); }
  async getOperationStatus(): Promise<"FAILED"> { return "FAILED"; }
}
