import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ExpiryPreview } from "./expiry-preview";

afterEach(() => cleanup());

describe("ExpiryPreview", () => {
  it("only invokes the report loader, reveals skip reasons, and pages the backlog", async () => {
    const load = vi.fn(async (offset: number) => ({
      mode: "DRY_RUN" as const, enabled: false,
      generatedAt: "2026-10-20T12:00:00.000Z", total: 51, offset,
      returned: 1, hasMore: offset === 0,
      counts: { remove: 0, skip: 1 },
      rows: [{ telegramId: "42", username: "owner", name: "Владелец", subscriptionId: "sub1", source: "MANUAL", periodEnd: "2026-10-01T00:00:00.000Z",
        graceUntil: "2026-10-01T00:00:00.000Z", decision: "SKIP" as const, reason: "CHANNEL_ADMIN", telegramStatus: "creator", lastError: null, removalStatus: null }],
    }));
    render(<ExpiryPreview load={load} />);
    expect(load).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Проверить просроченные" }));
    expect(await screen.findByText("Владелец")).toBeTruthy();
    expect(screen.getByText("Владелец или администратор")).toBeTruthy();
    expect(screen.getByText(/Автоматическое удаление отключено/)).toBeTruthy();
    expect(load).toHaveBeenCalledWith(0);
    fireEvent.click(screen.getByRole("button", { name: "Следующая страница" }));
    await waitFor(() => expect(load).toHaveBeenCalledWith(1));
  });
});
