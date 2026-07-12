import { formatRubles } from "@course/shared";

type LockedCourse = {
  title: string;
  description: string;
  priceKopecks: number;
};

export function CourseLocked({
  course,
  onBuy,
  isBuying
}: {
  course: LockedCourse;
  onBuy: () => void;
  isBuying: boolean;
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
            aria-label="Вернуться в бот для оплаты"
            onClick={onBuy}
            disabled={isBuying}
          >
            <span aria-hidden="true">⚔</span>
            {isBuying ? "ВОЗВРАЩАЕМСЯ В БОТ…" : "ПЕРЕЙТИ К ОПЛАТЕ"}
            <span aria-hidden="true">→</span>
          </button>
          <p><span aria-hidden="true">ⓘ</span> Оплата откроется в Telegram. После неё возвращайся сюда — доступ появится автоматически.</p>
        </div>
      </section>
    </main>
  );
}
