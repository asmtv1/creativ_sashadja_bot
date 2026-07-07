const YOOKASSA_AMOUNT_PATTERN = /^(0|[1-9]\d*)\.\d{2}$/;

export function kopecksToYooKassaAmount(kopecks: number): string {
  if (!Number.isInteger(kopecks) || kopecks < 0) {
    throw new Error("Kopecks must be a non-negative integer");
  }

  const rubles = Math.floor(kopecks / 100);
  const remainder = kopecks % 100;
  return `${rubles}.${remainder.toString().padStart(2, "0")}`;
}

export function yookassaAmountToKopecks(amount: string): number {
  if (!YOOKASSA_AMOUNT_PATTERN.test(amount)) {
    throw new Error("YooKassa amount must use fixed two-decimal format");
  }

  const [rubles = "0", kopecks = "00"] = amount.split(".");
  const result = Number(rubles) * 100 + Number(kopecks);
  if (!Number.isSafeInteger(result)) {
    throw new Error("YooKassa amount is too large");
  }

  return result;
}

export function formatRubles(kopecks: number): string {
  return `${kopecksToYooKassaAmount(kopecks)} ₽`;
}
