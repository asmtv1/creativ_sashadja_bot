import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  authenticateTelegram: vi.fn(),
  createCourseCheckout: vi.fn(),
  getMyCourse: vi.fn(),
  verifyCourseCheckout: vi.fn()
}));

const telegram = vi.hoisted(() => ({
  getTelegramInitData: vi.fn(),
  openExternalUrl: vi.fn(),
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
  it("prepares a direct YooKassa checkout and opens its confirmation URL", async () => {
    telegram.getTelegramInitData.mockReturnValue("signed-init-data");
    api.authenticateTelegram.mockResolvedValue({ token: "session" });
    api.getMyCourse.mockResolvedValue(lockedCourse);
    api.createCourseCheckout.mockResolvedValue({
      orderId: "order_1",
      paymentUrl: "https://yookassa.example/confirm"
    });

    render(<HomePage />);

    const payButton = await screen.findByRole("button", { name: /перейти к оплате/i });
    await waitFor(() => expect(payButton.hasAttribute("disabled")).toBe(false));
    fireEvent.click(payButton);

    await waitFor(() => {
      expect(telegram.openExternalUrl).toHaveBeenCalledWith("https://yookassa.example/confirm");
    });
    expect(api.createCourseCheckout).toHaveBeenCalledWith("basic-course");
  });
});
