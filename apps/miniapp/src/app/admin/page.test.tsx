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
  users: [
    {
      telegramId: "43",
      username: "waiting",
      name: "Ожидающий",
      firstSeenAt: "2026-08-01T00:00:00.000Z",
      hasAccess: false,
      source: null,
      paymentStatus: "PENDING",
      paidAt: null,
      amountKopecks: 39000,
    },
    {
      telegramId: "44",
      username: "did-not-pay",
      name: "Отказ от оплаты",
      firstSeenAt: "2026-08-01T00:00:00.000Z",
      hasAccess: false,
      source: null,
      paymentStatus: "CANCELED",
      paidAt: null,
      amountKopecks: 39000,
    },
  ],
};
const receipts = [
  {
    id: "receipt-1",
    telegramId: "42",
    username: "student",
    name: "Иван",
    product: "Креативный контент | обучение",
    amountKopecks: 59900,
    currency: "RUB",
    paidAt: "2026-08-01T00:00:00.000Z",
    status: "ISSUED",
    receiptUrl: "https://lknpd.nalog.ru/receipt/1/print",
    lastError: null,
  },
];

describe("AdminPage", () => {
  it("loads product dashboards and opens NPD receipts from a separate menu tab", async () => {
    let hasSession = false;
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async (input: string, init?: RequestInit) => {
          if (init?.headers && "Authorization" in init.headers) hasSession = true;
          if (!hasSession) return new Response(JSON.stringify({ message: "Unauthorized" }), { status: 401 });
          return new Response(
            JSON.stringify(
              input.includes("/npd-receipts")
                ? receipts
                : input.includes("/channel")
                  ? channelDashboard
                  : courseDashboard,
            ),
            { status: 200 },
          );
        },
      ),
    );
    render(<AdminPage />);

    await screen.findByRole("button", { name: "Войти" });

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
    expect(screen.getByText("Ожидает оплаты")).toBeTruthy();
    expect(screen.getByText("Не оплатил")).toBeTruthy();
    expect(screen.getAllByText(/390.*₽/).length).toBeGreaterThan(0);
    expect(screen.queryByRole("heading", { name: "Чеки НПД" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Чеки НПД" }));
    expect(await screen.findByRole("heading", { name: "Чеки НПД" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Открыть чек" }).getAttribute("href")).toBe(receipts[0]!.receiptUrl);

    cleanup();
    render(<AdminPage />);
    expect(await screen.findByRole("heading", { name: "Креативный контент | обучение" })).toBeTruthy();
  });
});
