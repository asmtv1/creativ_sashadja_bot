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
    <main className="app-shell">
      <section className="panel stack">
        <h1>{course.title}</h1>
        <p className="muted">{course.description}</p>
        <strong>{formatRubles(course.priceKopecks)}</strong>
        <button type="button" onClick={onBuy} disabled={isBuying}>
          Вернуться в бот для оплаты
        </button>
      </section>
    </main>
  );
}
