import Link from "next/link";
import type { ReactNode } from "react";
import { LEGAL } from "../legal/legal-config";

export function LegalDocument({
  title,
  children
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <main className="legal-shell">
      <article className="legal-document">
        <header className="legal-header">
          <Link href="/">← Вернуться к курсу</Link>
          <p>Редакция от {LEGAL.effectiveDate}</p>
          <h1>{title}</h1>
        </header>
        {children}
        <footer className="legal-footer">
          <p>
            Исполнитель: {LEGAL.sellerName}, ИНН {LEGAL.sellerInn}, {LEGAL.sellerStatus}.
          </p>
          <p>
            Обращения: <a href={LEGAL.telegramContactUrl}>{LEGAL.telegramContact}</a>.
          </p>
          <nav aria-label="Юридические документы">
            <Link href="/legal/offer">Публичная оферта</Link>
            <Link href="/legal/privacy">Политика конфиденциальности</Link>
          </nav>
        </footer>
      </article>
    </main>
  );
}
