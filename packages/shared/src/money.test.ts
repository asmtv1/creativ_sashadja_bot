import { describe, expect, it } from "vitest";
import { kopecksToYooKassaAmount, yookassaAmountToKopecks } from "./money";

describe("money helpers", () => {
  it("converts integer kopecks to YooKassa amount strings", () => {
    expect(kopecksToYooKassaAmount(10000)).toBe("100.00");
    expect(kopecksToYooKassaAmount(1)).toBe("0.01");
    expect(kopecksToYooKassaAmount(0)).toBe("0.00");
  });

  it("converts YooKassa amount strings to integer kopecks", () => {
    expect(yookassaAmountToKopecks("100.00")).toBe(10000);
    expect(yookassaAmountToKopecks("0.01")).toBe(1);
    expect(yookassaAmountToKopecks("999999.99")).toBe(99999999);
  });

  it("rejects invalid or fractional-kopeck YooKassa amounts", () => {
    expect(() => yookassaAmountToKopecks("100")).toThrow(/amount/i);
    expect(() => yookassaAmountToKopecks("100.001")).toThrow(/amount/i);
    expect(() => yookassaAmountToKopecks("-1.00")).toThrow(/amount/i);
    expect(() => kopecksToYooKassaAmount(1.5)).toThrow(/kopecks/i);
  });
});
