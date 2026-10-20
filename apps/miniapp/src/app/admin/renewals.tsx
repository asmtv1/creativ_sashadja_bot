"use client";

import { useState } from "react";

type RenewalState = "RENEWED" | "AWAITING" | "NOT_RENEWED" | "PAYMENT_PROBLEM" | "AUTO_RENEW_OFF" | "REFUNDED";
type PaymentKind = "INITIAL" | "RENEWAL" | "MANUAL_RENEWAL";
type PaymentStatus = "PENDING" | "SUCCEEDED" | "CANCELED" | "FAILED" | "REFUNDED";

type RenewalUser = {
  telegramId: string;
  username: string | null;
  name: string | null;
  state: RenewalState;
  active: boolean;
  autoRenew: boolean;
  firstPaidAt: string | null;
  lastPaidAt: string | null;
  periodEnd: string | null;
  nextChargeAt: string | null;
  nextAttemptAt: string | null;
  successfulRenewals: number;
  successfulPayments: number;
  payments: Array<{
    id: string;
    kind: PaymentKind;
    status: PaymentStatus;
    amountKopecks: number;
    currency: string;
    date: string;
  }>;
};

export type RenewalsReport = {
  product: string;
  generatedAt: string;
  metrics: {
    total: number;
    active: number;
    renewedEver: number;
    notRenewed: number;
    paymentProblem: number;
    autoRenewOff: number;
  };
  users: RenewalUser[];
};

const STATE_LABELS: Record<RenewalState, string> = {
  RENEWED: "Продлена",
  AWAITING: "Ожидает продления",
  NOT_RENEWED: "Не продлил",
  PAYMENT_PROBLEM: "Сбой оплаты",
  AUTO_RENEW_OFF: "Автопродление отключено",
  REFUNDED: "Возврат",
};
const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  PENDING: "Ожидает оплаты",
  SUCCEEDED: "Оплачено",
  CANCELED: "Отменена",
  FAILED: "Ошибка",
  REFUNDED: "Возврат",
};
const PAYMENT_KIND_LABELS: Record<PaymentKind, string> = {
  INITIAL: "Первая оплата",
  RENEWAL: "Автопродление",
  MANUAL_RENEWAL: "Ручное продление",
};

type RenewalFilter = "all" | "renewed" | "not-renewed" | "awaiting" | "problem" | "stopped";

export function RenewalsSection({ report, loading, onRefresh }: {
  report: RenewalsReport | null;
  loading: boolean;
  onRefresh: () => void;
}) {
  const [filter, setFilter] = useState<RenewalFilter>("all");
  const [search, setSearch] = useState("");

  if (!report) return <p className="admin-loading">{loading ? "Загружаем продления…" : "Нет данных о продлениях."}</p>;

  const needle = search.trim().toLocaleLowerCase("ru-RU").replace(/^@/, "");
  const users = report.users.filter((user) => {
    const matchesFilter = filter === "all"
      || (filter === "renewed" && user.successfulRenewals > 0)
      || (filter === "not-renewed" && user.state === "NOT_RENEWED")
      || (filter === "awaiting" && user.state === "AWAITING")
      || (filter === "problem" && user.state === "PAYMENT_PROBLEM")
      || (filter === "stopped" && user.state === "AUTO_RENEW_OFF");
    return matchesFilter && (!needle || [user.name, user.username, user.telegramId]
      .some((value) => value?.toLocaleLowerCase("ru-RU").includes(needle)));
  });

  return <>
    <section className="admin-heading">
      <div>
        <h2>Продления · {report.product}</h2>
        <p>Только пользователи с историей оплат. «Продлевали» — хотя бы раз, «Не продлили» — истёк текущий срок. Данные на {formatDate(report.generatedAt)}.</p>
      </div>
      <button type="button" className="admin-refresh" onClick={onRefresh} disabled={loading}>Обновить</button>
    </section>
    <section className="admin-metrics" aria-label="Сводка по продлениям">
      <div className="admin-metric"><span>Платили хотя бы раз</span><strong>{report.metrics.total}</strong></div>
      <div className="admin-metric"><span>Продлевали хотя бы раз</span><strong>{report.metrics.renewedEver}</strong></div>
      <div className="admin-metric"><span>Не продлили после окончания</span><strong>{report.metrics.notRenewed}</strong></div>
      <div className="admin-metric"><span>Действует сейчас</span><strong>{report.metrics.active}</strong></div>
      <div className="admin-metric"><span>Проблемы оплаты</span><strong>{report.metrics.paymentProblem}</strong></div>
      <div className="admin-metric"><span>Отключили автопродление</span><strong>{report.metrics.autoRenewOff}</strong></div>
    </section>
    <section className="admin-table-section" aria-labelledby="renewals-heading">
      <div className="admin-table-section__heading">
        <div>
          <h3 id="renewals-heading">Оплаченные подписки</h3>
          <span>{users.length} из {report.metrics.total}</span>
        </div>
      </div>
      <div className="admin-renewal-controls">
        <label>Статус
          <select aria-label="Фильтр продлений" value={filter} onChange={(event) => setFilter(event.target.value as RenewalFilter)}>
            <option value="all">Все оплатившие</option>
            <option value="renewed">Продлевали хотя бы раз</option>
            <option value="not-renewed">Не продлили</option>
            <option value="awaiting">Ожидают продления</option>
            <option value="problem">Проблемы оплаты</option>
            <option value="stopped">Отключили автопродление</option>
          </select>
        </label>
        <label>Поиск
          <input aria-label="Поиск подписчика" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Имя, @username или Telegram ID" />
        </label>
      </div>
      {users.length ? <div className="admin-table-wrap">
        <table className="admin-table">
          <thead><tr>
            <th>Подписчик</th><th>Статус продления</th><th>Подписка до</th><th>Первая оплата</th><th>Последняя оплата</th><th>Продлений</th><th>История</th>
          </tr></thead>
          <tbody>{users.map((user) => <tr key={user.telegramId}>
            <td><strong>{user.name || (user.username ? `@${user.username}` : `ID ${user.telegramId}`)}</strong><small>{user.username ? `@${user.username} · ` : ""}ID {user.telegramId}</small></td>
            <td><span className={user.active && user.state === "RENEWED" ? "admin-status active" : "admin-status"}>{STATE_LABELS[user.state]}</span>
              <small>{user.autoRenew ? "Автопродление включено" : "Автопродление выключено"}</small>
              {user.nextAttemptAt ? <small>Повторная попытка: {formatDateTime(user.nextAttemptAt)}</small> : null}
            </td>
            <td><strong>{formatDateTime(user.periodEnd)}</strong>{user.nextChargeAt ? <small>Следующее списание: {formatDateTime(user.nextChargeAt)}</small> : null}</td>
            <td>{formatDate(user.firstPaidAt)}</td>
            <td>{formatDate(user.lastPaidAt)}</td>
            <td>{user.successfulRenewals}</td>
            <td>{user.payments.length ? <details>
              <summary>Платежи</summary>
              <ul className="admin-renewal-history">{user.payments.map((payment) => <li key={payment.id}>
                {formatDate(payment.date)} · {PAYMENT_KIND_LABELS[payment.kind]} · {PAYMENT_STATUS_LABELS[payment.status]} · {formatRubles(payment.amountKopecks)}
              </li>)}</ul>
            </details> : "—"}</td>
          </tr>)}</tbody>
        </table>
      </div> : <p className="admin-empty">Подписчиков по выбранному фильтру нет.</p>}
    </section>
  </>;
}

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "short", year: "numeric", timeZone: "Europe/Moscow" }).format(new Date(value));
}
function formatDateTime(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Moscow",
  }).format(new Date(value)) + " МСК";
}
function formatRubles(kopecks: number) {
  return new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 }).format(kopecks / 100);
}
