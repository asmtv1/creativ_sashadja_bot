import { describe, expect, it, vi } from "vitest";
import { setNpdCutover } from "./npd-cutover";

describe("setNpdCutover", () => {
  it("sets the cutover once for an active connection", async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const now = new Date("2026-08-31T20:00:00.000Z");
    const startedAt = await setNpdCutover({
      findUnique: vi.fn().mockResolvedValue({ status: "ACTIVE", fiscalizationStartedAt: null }),
      updateMany
    }, now);

    expect(startedAt).toEqual(now);
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: "default", status: "ACTIVE", fiscalizationStartedAt: null },
      data: { fiscalizationStartedAt: now }
    });
  });

  it.each([
    [null, "NPD connection is not configured"],
    [{ status: "REAUTH_REQUIRED", fiscalizationStartedAt: null }, "NPD connection is not active"],
    [{ status: "ACTIVE", fiscalizationStartedAt: new Date("2026-08-30T20:00:00.000Z") }, "NPD fiscalization already started"]
  ])("refuses an unsafe state", async (connection, message) => {
    const updateMany = vi.fn();
    await expect(setNpdCutover({ findUnique: vi.fn().mockResolvedValue(connection), updateMany })).rejects.toThrow(message);
    expect(updateMany).not.toHaveBeenCalled();
  });
});
