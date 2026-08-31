import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import AdminPage from "./page";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const courseDashboard = {
  product: {
    key: "course",
    title: "Креативный контент | обучение",
    priceKopecks: 59900,
    currency: "RUB",
  },
  metrics: { openedBot: 12, paidUsers: 3, revenueKopecks: 179700 },
  users: [
    {
      telegramId: "42",
      username: "student",
      name: "Иван",
      firstSeenAt: "2026-08-01T00:00:00.000Z",
      hasAccess: true,
      source: "PAYMENT",
      paidAt: "2026-08-01T00:00:00.000Z",
      amountKopecks: 59900,
    },
  ],
};
const channelDashboard = {
  product: {
    key: "channel",
    title: "Креатив идеи",
    priceKopecks: 39000,
    currency: "RUB",
  },
  metrics: { openedBot: 12, paidUsers: 1, revenueKopecks: 39000 },
  users: [],
};

describe("AdminPage", () => {
  it("loads both products and separates them into tabs", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async (input: string) =>
          new Response(
            JSON.stringify(
              input.includes("/channel") ? channelDashboard : courseDashboard,
            ),
            { status: 200 },
          ),
      ),
    );
    render(<AdminPage />);

    fireEvent.change(screen.getByLabelText("Логин"), {
      target: { value: "admin" },
    });
    fireEvent.change(screen.getByLabelText("Пароль"), {
      target: { value: "password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Войти" }));

    expect(
      await screen.findByRole("heading", {
        name: "Креативный контент | обучение",
      }),
    ).toBeTruthy();
    expect(screen.getByText(/1.*797.*₽/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Канал" }));
    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: "Креатив идеи" }),
      ).toBeTruthy(),
    );
    expect(screen.getAllByText(/390.*₽/).length).toBeGreaterThan(0);
  });
});
