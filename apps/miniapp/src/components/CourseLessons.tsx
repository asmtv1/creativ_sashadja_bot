"use client";

import { useState } from "react";
import { CourseDto, LessonDto } from "@course/shared";
import { LessonPlayer } from "./LessonPlayer";

type CourseLessonsProps = {
  course: CourseDto;
  lessons: LessonDto[];
};

export function CourseLessons({ course, lessons }: CourseLessonsProps) {
  const [activeSlug, setActiveSlug] = useState(lessons[0]?.slug ?? "");
  const activeLesson = lessons.find((lesson) => lesson.slug === activeSlug) ?? lessons[0];
  const activeLessonIndex = activeLesson
    ? lessons.findIndex((lesson) => lesson.slug === activeLesson.slug)
    : 0;
  const courseProgress = lessons.length > 0 ? ((activeLessonIndex + 1) / lessons.length) * 100 : 0;
  const hasLessonMap = lessons.length > 1;

  return (
    <main className="game-course-shell">
      <section className="game-course" aria-label={course.title}>
        <header className="course-hud">
          <div className="course-hud__title">
            <span className="pixel-kicker">ВАШЕ ПРИКЛЮЧЕНИЕ</span>
            <h1>{course.title}</h1>
          </div>
          <div className="course-progress" aria-label={`Открыт урок ${activeLessonIndex + 1} из ${lessons.length}`}>
            <span className="course-progress__icon" aria-hidden="true">✦</span>
            <div>
              <span className="course-progress__label">ПУТЬ ПО КУРСУ</span>
              <div className="course-progress__track" aria-hidden="true">
                <span style={{ width: `${courseProgress}%` }} />
              </div>
              <span className="course-progress__value">Урок {activeLessonIndex + 1} из {lessons.length}</span>
            </div>
          </div>
        </header>

        <div className={`course-stage${hasLessonMap ? "" : " course-stage--single"}`}>
          <section className="lesson-player-panel" aria-label="Плеер урока">
            <div className="lesson-player-panel__header">
              <span className="lesson-badge">УРОК {activeLesson?.sortOrder ?? "—"}</span>
              <span className="lesson-now">СЕЙЧАС СМОТРИМ</span>
            </div>
            <h2>{activeLesson?.title ?? "Уроки пока не опубликованы"}</h2>
            {activeLesson?.description ? <p>{activeLesson.description}</p> : null}
            <div className="player-frame">
              {activeLesson ? <LessonPlayer lesson={activeLesson} /> : <p>Уроки пока не опубликованы.</p>}
            </div>
          </section>

          {hasLessonMap ? (
            <nav className="lesson-quest-list" aria-label="Список уроков">
              <div className="lesson-quest-list__heading"><span aria-hidden="true">✦</span><h2>КАРТА УРОКОВ</h2></div>
              {lessons.map((lesson) => {
                const isActive = lesson.slug === activeLesson?.slug;
                return (
                  <button aria-current={isActive ? "step" : undefined} className={`lesson-quest${isActive ? " active" : ""}`} key={lesson.slug} type="button" onClick={() => setActiveSlug(lesson.slug)}>
                    <span className="lesson-quest__number" aria-hidden="true">{lesson.sortOrder}</span>
                    <span className="lesson-quest__content"><strong>{lesson.title}</strong><small>{isActive ? "Смотреть урок" : "Открыть урок"}</small></span>
                    <span className="lesson-quest__arrow" aria-hidden="true">›</span>
                  </button>
                );
              })}
            </nav>
          ) : activeLesson ? (
            <aside className="lesson-summary" aria-label="О текущем уроке">
              <div className="lesson-summary__topline"><span aria-hidden="true">✦</span> ТВОЙ ПЕРВЫЙ ШАГ</div>
              <div className="lesson-summary__level" aria-hidden="true">01</div>
              <h2>Один урок —<br />одна практика</h2>
              <p>Смотри в своём темпе, возвращайся к важным моментам и пробуй сразу применить идеи.</p>
              <dl className="lesson-summary__stats">
                <div><dt>В ФОРМАТЕ</dt><dd>Видео-урок</dd></div>
                <div><dt>ДОСТУП</dt><dd><span aria-hidden="true">●</span> Открыт</dd></div>
              </dl>
              <div className="lesson-summary__hint"><span aria-hidden="true">✦</span><p>Нажми на плеер, чтобы начать просмотр.</p></div>
            </aside>
          ) : null}
        </div>
      </section>
    </main>
  );
}
