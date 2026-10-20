"use client";

import { useState } from "react";

type PreviewRow = {
  telegramId: string;
  username: string | null;
  name: string | null;
  subscriptionId: string;
  source: string | null;
  periodEnd: string | null;
  graceUntil: string | null;
  decision: "REMOVE" | "SKIP";
  reason: string;
  telegramStatus: string | null;
  lastError: string | null;
  removalStatus: string | null;
};
export type ExpiryPreviewReport = {
  mode: "DRY_RUN";
  enabled: boolean;
  generatedAt: string;
  total: number;
  offset: number;
  returned: number;
  hasMore: boolean;
  counts: { remove: number; skip: number };
  rows: PreviewRow[];
};

const reasons: Record<string, string> = {
  EXEMPT: "Исключение EXEMPT",
  ALREADY_REMOVED: "Ранее удалён",
  MEMBERSHIP_ALREADY_REMOVED: "Удаление уже отмечено",
  CHANNEL_NOT_BOUND: "Канал не привязан",
  NO_EXPIRY: "Нет срока доступа",
  ACCESS_ACTIVE: "Доступ продлён",
  GRACE_PERIOD: "Льготный период",
  NO_CONFIRMED_PAYMENT: "Нет подтверждённой оплаты",
  PAYMENT_PENDING: "Оплата в обработке",
  INVITE_STILL_ACTIVE: "Ссылка-приглашение ещё действует",
  CHANNEL_ADMIN: "Владелец или администратор",
  NOT_A_MEMBER: "Уже не состоит в канале",
  TELEGRAM_CHECK_FAILED: "Не удалось проверить Telegram",
  ACCESS_EXPIRED: "Срок и льготный период истекли",
};

export function ExpiryPreview({ load }: { load: (offset: number) => Promise<ExpiryPreviewReport> }) {
  const [report, setReport] = useState<ExpiryPreviewReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  async function show(offset: number) {
    setLoading(true); setError("");
    try { setReport(await load(offset)); }
    catch { setError("Не удалось получить предварительный отчёт. Ничего не удалено."); }
    finally { setLoading(false); }
  }
  return <section className="admin-table-section" aria-labelledby="expiry-preview-title">
    <div className="admin-table-section__heading">
      <div>
        <h3 id="expiry-preview-title">Предварительный отчёт об исключениях</h3>
        <p>Только чтение: проверяем подписку и роль в Telegram. Эта кнопка никого не удаляет.</p>
      </div>
      <button type="button" className="admin-refresh" disabled={loading} onClick={() => void show(0)}>
        {loading ? "Проверяем…" : "Проверить просроченные"}
      </button>
    </div>
    {error ? <p role="alert" className="admin-notice error">{error}</p> : null}
    {report ? <>
      <p>Записей с истёкшим сроком: {report.total}. Страница: {report.offset + 1}–{report.offset + report.returned}.
        На этой странице к удалению: {report.counts.remove}; пропустить: {report.counts.skip}.
        {report.enabled ? " Автоматическая обработка включена в конфигурации." : " Автоматическое удаление отключено."}
      </p>
      <div className="admin-table-wrap"><table className="admin-table">
        <thead><tr><th>Участник</th><th>Срок подписки</th><th>Льготный период до</th><th>Решение</th><th>Причина</th><th>Telegram</th><th>Прошлая ошибка</th></tr></thead>
        <tbody>{report.rows.map((row) => <tr key={row.subscriptionId}>
          <td><strong>{row.name || (row.username ? `@${row.username}` : row.telegramId)}</strong><small>{row.username ? `@${row.username} · ` : ""}{row.telegramId}</small></td>
          <td>{formatDate(row.periodEnd)}</td><td>{formatDate(row.graceUntil)}</td>
          <td><span className={row.decision === "REMOVE" ? "admin-status" : "admin-status active"}>{row.decision === "REMOVE" ? "Удалить после разрешения" : "Пропустить"}</span></td>
          <td>{reasons[row.reason] || row.reason}</td><td>{row.telegramStatus ?? "Не проверялся"}</td><td>{row.lastError || "—"}</td>
        </tr>)}</tbody>
      </table></div>
      {!report.rows.length ? <p className="admin-empty">Просроченных записей не найдено.</p> : null}
      <div className="admin-renewal-pagination">
        <button type="button" disabled={loading || report.offset === 0} onClick={() => void show(Math.max(0, report.offset - 20))}>Назад</button>
        <button type="button" disabled={loading || !report.hasMore} onClick={() => void show(report.offset + report.returned)}>Следующая страница</button>
      </div>
    </> : null}
  </section>;
}
function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Moscow",
  }).format(new Date(value)) + " МСК";
}
