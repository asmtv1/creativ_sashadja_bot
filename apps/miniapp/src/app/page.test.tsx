import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  authenticateTelegram: vi.fn(),
  createCourseInvoice: vi.fn(),
  getMyCourse: vi.fn()
}));

const telegram = vi.hoisted(() => ({
  getTelegramInitData: vi.fn(),
  openTelegramInvoice: vi.fn(),
  prepareTelegramWebApp: vi.fn()
}));

vi.mock("../lib/api-client", () => api);
vi.mock("../lib/telegram", () => telegram);

import HomePage from "./page";

const lockedCourse = {
  hasAccess: false,
  course: {
    slug: "basic-course",
    title: "Креативный контент | обучение",
    description: "Урок по геймификации в контенте",
    priceKopecks: 59900
  }
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("HomePage checkout", () => {
  it("prepares an invoice and opens Telegram checkout without closing the Mini App", async () => {
    telegram.getTelegramInitData.mockReturnValue("signed-init-data");
    telegram.openTelegramInvoice.mockResolvedValue("cancelled");
    api.authenticateTelegram.mockResolvedValue({ token: "session" });
    api.getMyCourse.mockResolvedValue(lockedCourse);
    api.createCourseInvoice.mockResolvedValue({
      orderId: "order_1",
      invoiceUrl: "https://t.me/$invoice"
    });

    render(<HomePage />);

    const payButton = await screen.findByRole("button", { name: /перейти к оплате/i });
    await waitFor(() => expect(payButton.hasAttribute("disabled")).toBe(false));
    fireEvent.click(payButton);

    await waitFor(() => {
      expect(telegram.openTelegramInvoice).toHaveBeenCalledWith("https://t.me/$invoice");
    });
    expect(api.createCourseInvoice).toHaveBeenCalledWith("basic-course");
  });
});
