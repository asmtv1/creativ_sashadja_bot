"use client";

import { FormEvent, useState } from "react";

type Credentials = { user: string; password: string };
type ProductKey = "course" | "channel";
type DashboardUser = {
  telegramId: string;
  username: string | null;
  name: string | null;
  firstSeenAt: string;
  hasAccess: boolean;
  source: "PAYMENT" | "ADMIN" | null;
  paidAt: string | null;
  amountKopecks: number | null;
  accessUntil?: string | null;
  autoRenew?: boolean;
};
type Dashboard = {
  product: {
    key: ProductKey;
    title: string;
    priceKopecks: number;
    currency: string;
  };
  metrics: { openedBot: number; paidUsers: number; revenueKopecks: number };
  users: DashboardUser[];
};
type Receipt = {
  id: string;
  telegramId: string;
  username: string | null;
  name: string | null;
  product: string;
  amountKopecks: number;
  currency: string;
  paidAt: string;
  status: "PENDING" | "ISSUED" | "RECONCILIATION_REQUIRED" | "FAILED";
  receiptUrl: string | null;
  lastError: string | null;
};

const PRODUCT_META: Record<
  ProductKey,
  { tab: string; access: string; empty: string }
> = {
  course: {
    tab: "Курс",
    access: "Доступ к курсу",
    empty: "Пока никто не открывал бота.",
  },
  channel: {
    tab: "Канал",
    access: "Доступ к каналу",
    empty: "Пока никто не открывал бота.",
  },
};

export default function AdminPage() {
  const [credentials, setCredentials] = useState<Credentials>({
    user: "",
    password: "",
  });
  const [isAuthorized, setAuthorized] = useState(false);
  const [activeTab, setActiveTab] = useState<ProductKey>("course");
  const [dashboards, setDashboards] = useState<
    Partial<Record<ProductKey, Dashboard>>
  >({});
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [isLoading, setLoading] = useState(false);
  const [accessTarget, setAccessTarget] = useState("");
  const [notice, setNotice] = useState<{
    kind: "success" | "error";
    text: string;
  } | null>(null);
  const dashboard = dashboards[activeTab];
  const visibleUsers = dashboard?.users ?? [];

  async function loadDashboard(
    tab: ProductKey,
    activeCredentials = credentials,
  ) {
    const payload = (await adminRequest(
      `/api/admin/dashboard/${tab}`,
      activeCredentials,
    )) as Dashboard;
    setDashboards((current) => ({ ...current, [tab]: payload }));
  }

  async function loadReceipts(activeCredentials = credentials) {
    const payload = (await adminRequest("/api/admin/npd-receipts", activeCredentials)) as Receipt[];
    setReceipts(payload);
  }

  async function signIn(event: FormEvent) {
    event.preventDefault();
    setNotice(null);
    setLoading(true);
    try {
      await Promise.all([loadDashboard("course"), loadDashboard("channel"), loadReceipts()]);
      setAuthorized(true);
    } catch {
      setNotice({
        kind: "error",
        text: "Не удалось войти. Проверьте логин и пароль администратора.",
      });
    } finally {
      setLoading(false);
    }
  }

  async function changeTab(tab: ProductKey) {
    setActiveTab(tab);
    setNotice(null);
    if (!dashboards[tab]) {
      setLoading(true);
      try {
        await loadDashboard(tab);
      } catch {
        setNotice({
          kind: "error",
          text: "Не удалось загрузить данные по продукту.",
        });
      } finally {
        setLoading(false);
      }
    }
  }

  async function resolveTelegramId(rawTarget: string) {
    const target = rawTarget.trim();
    if (!target) throw new Error("Укажите @username или Telegram ID.");
    if (!target.startsWith("@")) return target;
    const result = (await adminRequest(
      `/api/admin/users/by-username/${encodeURIComponent(target)}`,
      credentials,
    )) as { telegramId: string | null };
    if (!result.telegramId)
      throw new Error("Пользователь ещё не запускал бота.");
    return result.telegramId;
  }

  async function mutateAccess(action: "grant" | "revoke", target: string) {
    if (action === "revoke" && !window.confirm("Точно отозвать доступ?"))
      return;
    setNotice(null);
    setLoading(true);
    try {
      const telegramId = await resolveTelegramId(target);
      const path =
        activeTab === "course"
          ? `/api/admin/access/${action}`
          : `/api/admin/channel-access/${action}`;
      const body =
        activeTab === "course"
          ? { telegramId, courseSlug: "basic-course" }
          : { telegramId };
      const result = await adminRequest(path, credentials, {
        method: "POST",
        body,
      });
      setAccessTarget("");
      await loadDashboard(activeTab);
      setNotice({
        kind: "success",
        text:
          action === "grant" &&
          activeTab === "channel" &&
          typeof result === "object" &&
          result &&
          "inviteLink" in result
            ? "Доступ выдан: одноразовая ссылка отправлена пользователю в Telegram."
            : action === "grant"
              ? "Доступ выдан."
              : "Доступ отозван.",
      });
    } catch (error) {
      setNotice({
        kind: "error",
        text:
          error instanceof Error
            ? error.message
            : "Не удалось изменить доступ.",
      });
    } finally {
      setLoading(false);
    }
  }

  if (!isAuthorized)
    return (
      <main className="admin-shell">
        <section className="admin-login" aria-labelledby="admin-login-title">
          <p className="admin-brand">GAFUS</p>
          <h1 id="admin-login-title">Управление продажами</h1>
          <p>
            Войдите с данными администратора, чтобы просматривать покупателей и
            управлять доступами.
          </p>
          <form className="admin-login__form" onSubmit={signIn}>
            <label>
              Логин
              <input
                value={credentials.user}
                onChange={(event) =>
                  setCredentials({ ...credentials, user: event.target.value })
                }
                autoComplete="username"
                required
              />
            </label>
            <label>
              Пароль
              <input
                type="password"
                value={credentials.password}
                onChange={(event) =>
                  setCredentials({
                    ...credentials,
                    password: event.target.value,
                  })
                }
                autoComplete="current-password"
                required
              />
            </label>
            <button type="submit" disabled={isLoading}>
              {isLoading ? "Проверяем…" : "Войти"}
            </button>
          </form>
          {notice ? (
            <p className={`admin-notice ${notice.kind}`}>{notice.text}</p>
          ) : null}
        </section>
      </main>
    );

  return (
    <main className="admin-shell">
      <section className="admin-app">
        <header className="admin-topbar">
          <div>
            <p className="admin-brand">GAFUS</p>
            <h1>Продажи и доступы</h1>
          </div>
          <button
            className="admin-signout"
            type="button"
            onClick={() => {
              setAuthorized(false);
              setDashboards({});
              setReceipts([]);
              setCredentials({ user: "", password: "" });
            }}
          >
            Выйти
          </button>
        </header>
        <nav className="admin-tabs" aria-label="Продукты">
          {(Object.keys(PRODUCT_META) as ProductKey[]).map((tab) => (
            <button
              key={tab}
              type="button"
              className={activeTab === tab ? "active" : ""}
              onClick={() => void changeTab(tab)}
            >
              {PRODUCT_META[tab].tab}
            </button>
          ))}
        </nav>
        {dashboard ? (
          <>
            <section className="admin-heading">
              <div>
                <h2>{dashboard.product.title}</h2>
                <p>
                  {activeTab === "course"
                    ? "Разовая покупка"
                    : "Подписка на 30 суток"}{" "}
                  · {formatRubles(dashboard.product.priceKopecks)}
                </p>
              </div>
              <button
                className="admin-refresh"
                type="button"
                onClick={() => void loadDashboard(activeTab)}
                disabled={isLoading}
              >
                Обновить
              </button>
            </section>
            <section className="admin-metrics" aria-label="Сводка по продукту">
              <Metric
                label="Зашли в бота"
                value={dashboard.metrics.openedBot.toLocaleString("ru-RU")}
              />
              <Metric
                label="Купили"
                value={dashboard.metrics.paidUsers.toLocaleString("ru-RU")}
              />
              <Metric
                label="Общий доход"
                value={formatRubles(dashboard.metrics.revenueKopecks)}
                emphasize
              />
            </section>
            <section
              className="admin-access-panel"
              aria-labelledby="manual-access-title"
            >
              <div>
                <h3 id="manual-access-title">
                  {PRODUCT_META[activeTab].access}
                </h3>
                <p>
                  Введите @username или Telegram ID. Пользователь должен хотя бы
                  раз запустить бота.
                </p>
              </div>
              <div className="admin-access-panel__actions">
                <input
                  value={accessTarget}
                  onChange={(event) => setAccessTarget(event.target.value)}
                  placeholder="@username или Telegram ID"
                  aria-label="Пользователь для изменения доступа"
                />
                <button
                  type="button"
                  onClick={() => void mutateAccess("grant", accessTarget)}
                  disabled={isLoading}
                >
                  Выдать доступ
                </button>
                <button
                  type="button"
                  className="admin-danger"
                  onClick={() => void mutateAccess("revoke", accessTarget)}
                  disabled={isLoading}
                >
                  Отозвать
                </button>
              </div>
            </section>
            {notice ? (
              <p className={`admin-notice ${notice.kind}`}>{notice.text}</p>
            ) : null}
            <section
              className="admin-table-section"
              aria-labelledby="admin-users-title"
            >
              <div className="admin-table-section__heading">
                <h3 id="admin-users-title">Пользователи</h3>
                <span>{visibleUsers.length} отображается</span>
              </div>
              {visibleUsers.length ? (
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Пользователь</th>
                        <th>Зашёл в бота</th>
                        <th>Статус</th>
                        <th>Источник</th>
                        <th>Оплата</th>
                        <th aria-label="Действия" />
                      </tr>
                    </thead>
                    <tbody>
                      {visibleUsers.map((user) => (
                        <UserRow
                          key={user.telegramId}
                          user={user}
                          tab={activeTab}
                          onMutate={mutateAccess}
                          disabled={isLoading}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="admin-empty">{PRODUCT_META[activeTab].empty}</p>
              )}
            </section>
            <section className="admin-table-section" aria-labelledby="admin-receipts-title">
              <div className="admin-table-section__heading">
                <div>
                  <h3 id="admin-receipts-title">Чеки НПД</h3>
                  <p>Последние {receipts.length} записей. Ссылка появляется только после подтверждения НПД.</p>
                </div>
                <button className="admin-refresh" type="button" onClick={() => void loadReceipts()} disabled={isLoading}>Обновить чеки</button>
              </div>
              {receipts.length ? (
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead><tr><th>Покупатель</th><th>Товар</th><th>Оплата</th><th>Статус чека</th><th>Чек</th></tr></thead>
                    <tbody>{receipts.map((receipt) => <ReceiptRow key={receipt.id} receipt={receipt} />)}</tbody>
                  </table>
                </div>
              ) : <p className="admin-empty">Чеков пока нет.</p>}
            </section>
          </>
        ) : (
          <div className="admin-loading">Загружаем данные…</div>
        )}
      </section>
    </main>
  );
}
function ReceiptRow({ receipt }: { receipt: Receipt }) {
  const handle = receipt.username ? `@${receipt.username}` : `ID ${receipt.telegramId}`;
  const status = receipt.status === "ISSUED" ? "Сформирован" : receipt.status === "PENDING" ? "В очереди" : receipt.status === "RECONCILIATION_REQUIRED" ? "Нужна сверка" : "Ошибка";
  return <tr>
    <td><strong>{receipt.name || handle}</strong><small>{receipt.name ? handle : ""}</small></td>
    <td>{receipt.product}</td>
    <td>{formatRubles(receipt.amountKopecks)}<small>{formatDate(receipt.paidAt)}</small></td>
    <td><span className={receipt.status === "ISSUED" ? "admin-status active" : "admin-status"}>{status}</span>{receipt.lastError ? <small>{receipt.lastError}</small> : null}</td>
    <td>{receipt.receiptUrl ? <a href={receipt.receiptUrl} target="_blank" rel="noreferrer">Открыть чек</a> : "—"}</td>
  </tr>;
}

function Metric({
  label,
  value,
  emphasize = false,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <div className={emphasize ? "admin-metric emphasize" : "admin-metric"}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
function UserRow({
  user,
  tab,
  onMutate,
  disabled,
}: {
  user: DashboardUser;
  tab: ProductKey;
  onMutate: (action: "grant" | "revoke", target: string) => Promise<void>;
  disabled: boolean;
}) {
  const handle = user.username ? `@${user.username}` : user.telegramId;
  return (
    <tr>
      <td>
        <strong>{user.name || handle}</strong>
        <small>{user.name ? handle : `ID ${user.telegramId}`}</small>
      </td>
      <td>{formatDate(user.firstSeenAt)}</td>
      <td>
        <span
          className={user.hasAccess ? "admin-status active" : "admin-status"}
        >
          {user.hasAccess ? "Есть доступ" : "Нет доступа"}
        </span>
        {tab === "channel" && user.hasAccess && user.accessUntil ? (
          <small>до {formatDate(user.accessUntil)}</small>
        ) : null}
      </td>
      <td>
        {user.source === "PAYMENT"
          ? "Оплата"
          : user.source === "ADMIN"
            ? "Вручную"
            : "—"}
      </td>
      <td>
        {user.amountKopecks ? (
          <>
            {formatRubles(user.amountKopecks)}
            <small>{user.paidAt ? formatDate(user.paidAt) : ""}</small>
          </>
        ) : (
          "—"
        )}
      </td>
      <td className="admin-row-actions">
        <button
          type="button"
          onClick={() => void onMutate("grant", user.telegramId)}
          disabled={disabled}
        >
          Выдать
        </button>
        <button
          type="button"
          className="admin-danger"
          onClick={() => void onMutate("revoke", user.telegramId)}
          disabled={disabled || !user.hasAccess}
        >
          Отозвать
        </button>
      </td>
    </tr>
  );
}
function formatRubles(kopecks: number) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(kopecks / 100);
}
function formatDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Europe/Moscow",
  }).format(new Date(value));
}
async function adminRequest(
  path: string,
  credentials: Credentials,
  init: { method?: string; body?: unknown } = {},
) {
  const response = await fetch(path, {
    method: init.method ?? "GET",
    headers: {
      Authorization: `Basic ${btoa(`${credentials.user}:${credentials.password}`)}`,
      "Content-Type": "application/json",
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(
      typeof payload.message === "string"
        ? payload.message
        : `Ошибка запроса (${response.status})`,
    );
  return payload;
}
