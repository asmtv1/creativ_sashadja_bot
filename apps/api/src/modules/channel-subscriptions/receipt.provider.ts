export type ReceiptPayment = { id: string; amountKopecks: number; currency: string; paidAt: Date };
export type ReceiptResult = { externalId: string; receiptUrl?: string };

export interface SelfEmployedReceiptProvider {
  isReady(): Promise<boolean>;
  issueReceipt(payment: ReceiptPayment): Promise<ReceiptResult>;
  cancelReceipt(receipt: { externalId: string }, refund: { paymentId: string }): Promise<void>;
  getOperationStatus(externalId: string): Promise<"PENDING" | "SUCCEEDED" | "FAILED">;
}

/** Temporary default: checkout is allowed, while receipt operations remain retryable until a provider is connected. */
export class DisabledSelfEmployedReceiptProvider implements SelfEmployedReceiptProvider {
  async isReady() { return false; }
  async issueReceipt(): Promise<ReceiptResult> { throw new Error("Receipt provider is disabled"); }
  async cancelReceipt(): Promise<void> { throw new Error("Receipt provider is disabled"); }
  async getOperationStatus(): Promise<"FAILED"> { return "FAILED"; }
}
