"use client";

import { FormEvent, useState } from "react";

type OrderRow = {
  id: string;
  telegramId: string;
  courseSlug: string;
  status: string;
  amountKopecks: number;
  currency: string;
  createdAt: string;
};

export default function AdminPage() {
  const [credentials, setCredentials] = useState({ user: "", password: "" });
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [access, setAccess] = useState({ telegramId: "", courseSlug: "basic-course" });
  const [message, setMessage] = useState("");

  async function loadOrders(event: FormEvent) {
    event.preventDefault();
    const rows = (await adminRequest("/api/admin/orders", credentials)) as OrderRow[];
    setOrders(rows);
  }

  async function mutateAccess(action: "grant" | "revoke") {
    await adminRequest(`/api/admin/access/${action}`, credentials, {
      method: "POST",
      body: access
    });
    setMessage(action === "grant" ? "Доступ выдан" : "Доступ отозван");
  }

  return (
    <main className="app-shell stack">
      <section className="panel stack">
        <h1>Admin</h1>
        <form className="admin-grid" onSubmit={loadOrders}>
          <input
            aria-label="user"
            placeholder="Basic user"
            value={credentials.user}
            onChange={(event) => setCredentials({ ...credentials, user: event.target.value })}
          />
          <input
            aria-label="password"
            placeholder="Basic password"
            type="password"
            value={credentials.password}
            onChange={(event) => setCredentials({ ...credentials, password: event.target.value })}
          />
          <button type="submit">Загрузить заказы</button>
        </form>
      </section>

      <section className="panel stack">
        <div className="admin-grid">
          <input
            aria-label="telegram id"
            placeholder="Telegram ID"
            value={access.telegramId}
            onChange={(event) => setAccess({ ...access, telegramId: event.target.value })}
          />
          <input
            aria-label="course slug"
            placeholder="Course slug"
            value={access.courseSlug}
            onChange={(event) => setAccess({ ...access, courseSlug: event.target.value })}
          />
          <button type="button" onClick={() => void mutateAccess("grant")}>
            Выдать доступ
          </button>
          <button type="button" onClick={() => void mutateAccess("revoke")}>
            Отозвать доступ
          </button>
        </div>
        {message ? <p>{message}</p> : null}
      </section>

      <section className="panel stack">
        {orders.map((order) => (
          <div key={order.id}>
            <strong>{order.telegramId}</strong> {order.courseSlug} {order.status}
          </div>
        ))}
      </section>
    </main>
  );
}

async function adminRequest(
  path: string,
  credentials: { user: string; password: string },
  init: { method?: string; body?: unknown } = {}
) {
  const response = await fetch(path, {
    method: init.method ?? "GET",
    headers: {
      Authorization: `Basic ${btoa(`${credentials.user}:${credentials.password}`)}`,
      "Content-Type": "application/json"
    },
    body: init.body ? JSON.stringify(init.body) : undefined
  });
  if (!response.ok) {
    throw new Error(`Admin request failed with ${response.status}`);
  }
  return response.json();
}
