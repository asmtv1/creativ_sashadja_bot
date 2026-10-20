import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { RenewalsSection, type RenewalsReport } from "./renewals";

afterEach(() => cleanup());

const report: RenewalsReport = {
  product: "Креатив идеи",
  generatedAt: "2026-10-20T12:00:00.000Z",
  metrics: { total: 2, active: 1, renewedEver: 1, notRenewed: 1, paymentProblem: 0, autoRenewOff: 0 },
  users: [
    {
      telegramId: "42", username: "renewed", name: "Иван", state: "RENEWED", active: true, autoRenew: true,
      firstPaidAt: "2026-08-01T00:00:00.000Z", lastPaidAt: "2026-10-01T00:00:00.000Z", periodEnd: "2026-10-31T00:00:00.000Z",
      nextChargeAt: "2026-10-30T00:00:00.000Z", nextAttemptAt: null, successfulRenewals: 2, successfulPayments: 3,
      payments: [{ id: "p1", kind: "RENEWAL", status: "SUCCEEDED", amountKopecks: 39000, currency: "RUB", date: "2026-10-01T00:00:00.000Z" }],
    },
    {
      telegramId: "43", username: "expired", name: "Мария", state: "NOT_RENEWED", active: false, autoRenew: false,
      firstPaidAt: "2026-08-01T00:00:00.000Z", lastPaidAt: "2026-08-01T00:00:00.000Z", periodEnd: "2026-09-01T00:00:00.000Z",
      nextChargeAt: null, nextAttemptAt: null, successfulRenewals: 0, successfulPayments: 1, payments: [],
    },
  ],
};

describe("RenewalsSection", () => {
  it("shows paid history, expiry, payment history and filters", () => {
    render(<RenewalsSection report={report} loading={false} onRefresh={() => {}} />);
    expect(screen.getByRole("heading", { name: "Продления · Креатив идеи" })).toBeTruthy();
    expect(screen.getByText("Иван")).toBeTruthy();
    expect(screen.getByText("Мария")).toBeTruthy();
    expect(screen.getByText("Не продлил")).toBeTruthy();
    expect(screen.getByText(/31 окт. 2026 г.*МСК/)).toBeTruthy();
    fireEvent.change(screen.getByRole("combobox", { name: "Фильтр продлений" }), { target: { value: "not-renewed" } });
    expect(screen.queryByText("Иван")).toBeNull();
    expect(screen.getByText("Мария")).toBeTruthy();
    fireEvent.change(screen.getByRole("combobox", { name: "Фильтр продлений" }), { target: { value: "all" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Поиск подписчика" }), { target: { value: "@renewed" } });
    expect(screen.getByText("Иван")).toBeTruthy();
    expect(screen.queryByText("Мария")).toBeNull();
    fireEvent.click(screen.getByText("Платежи"));
    expect(screen.getByText(/Автопродление · Оплачено/)).toBeTruthy();
  });
});
