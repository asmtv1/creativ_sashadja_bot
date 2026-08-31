import { formatRubles } from "@course/shared";
import Link from "next/link";

type LockedCourse = {
  title: string;
  description: string;
  priceKopecks: number;
};

export function CourseLocked({
  course,
  onBuy,
  isBuying,
  actionLabel,
  paymentMessage
}: {
  course: LockedCourse;
  onBuy: () => void;
  isBuying: boolean;
  actionLabel?: string;
  paymentMessage?: string;
}) {
  return (
    <main className="locked-shell">
      <section className="locked-card" aria-labelledby="locked-course-title">
        <div className="locked-card__hud" aria-label="Статус приключения">
          <span className="locked-card__hearts" aria-label="Три жизни">♥ ♥ ♥</span>
          <span className="locked-card__energy"><span aria-hidden="true">⚡</span> МИССИЯ ДОСТУПНА</span>
        </div>

        <div className="locked-card__hero">
          <span className="locked-card__crown" aria-hidden="true">♛</span>
          <span className="pixel-kicker">НОВАЯ МИССИЯ</span>
          <h1 id="locked-course-title">{course.title}</h1>
          <p>{course.description}</p>
        </div>

        <div className="locked-rewards" aria-label="Что входит в курс">
          <div><span aria-hidden="true">▶</span><strong>Видеоурок</strong><small>Смотри в своём темпе</small></div>
          <div><span aria-hidden="true">✦</span><strong>10 кейсов</strong><small>Реальные посты брендов</small></div>
          <div><span aria-hidden="true">▤</span><strong>30 идей</strong><small>Бонусный PDF-файл</small></div>
        </div>

        <div className="locked-checkpoint">
          <div className="locked-checkpoint__price">
            <span>ОТКРЫТЬ ПРИКЛЮЧЕНИЕ</span>
            <strong>{formatRubles(course.priceKopecks)}</strong>
            <small>ОДИН ПЛАТЁЖ · ДОСТУП НАВСЕГДА</small>
          </div>
          <button
            type="button"
            aria-label="Принять условия и перейти к оплате"
            onClick={onBuy}
            disabled={isBuying}
          >
            <span aria-hidden="true">⚔</span>
            {actionLabel ?? (isBuying ? "ГОТОВИМ ОПЛАТУ…" : "ПРИНЯТЬ УСЛОВИЯ И ПЕРЕЙТИ К ОПЛАТЕ")}
            <span aria-hidden="true">→</span>
          </button>
          <p className={paymentMessage ? "locked-checkpoint__status" : undefined}>
            <span aria-hidden="true">ⓘ</span>
            {paymentMessage ?? "Оплата откроется прямо здесь. После неё доступ появится автоматически."}
          </p>
          <p className="locked-checkpoint__legal">
            Нажимая кнопку, вы принимаете <Link href="/legal/offer">оферту</Link> и ознакомились с{" "}
            <Link href="/legal/privacy">политикой конфиденциальности</Link>.
          </p>
        </div>
      </section>
    </main>
  );
}
