"use client";

import { useState } from "react";
import { CourseDto, LessonDto } from "@course/shared";
import { openExternalUrl } from "../lib/telegram";
import { LessonPlayer } from "./LessonPlayer";

type CourseLessonsProps = {
  course: CourseDto;
  lessons: LessonDto[];
};

const LESSON_LOOT = [
  { title: "VOIS", href: "https://t.me/vois/5333" },
  { title: "Яндекс Музыка", href: "https://t.me/yandexmusic_live/10484" },
  { title: "Самокат", href: "https://t.me/samokatwithlove/4321" },
  { title: "Яндекс Лавка", href: "https://t.me/yandex_lavka_tg/1272" },
  { title: "Додо Пицца", href: "https://t.me/dodorus/24" },
  { title: "ВкусВилл", href: "https://t.me/we_are_vkusvill/8405" },
  { title: "Золотое Яблоко", href: "https://t.me/goldapple/25471" },
  { title: "ЕГЭХАБ", href: "https://t.me/egehub_ed/2480" },
  { title: "Коллегция", href: "https://t.me/colleagtion/3032" },
  { title: "TOP TEN BURGERS", href: "https://www.instagram.com/reel/DZgmWDyuPPF/?igsh=MWE1bnB0Zm5zM211ZQ==" }
] as const;

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
            <aside className="lesson-summary lesson-loot" aria-label="Твой лут">
              <div className="lesson-summary__topline"><span aria-hidden="true">✦</span> БОНУС-КОЛЛЕКЦИЯ</div>
              <h2>Твой лут</h2>
              <p>10 кейсов из урока — забирай ссылки и разбирай игровые механики.</p>
              <ol className="lesson-loot__links">
                {LESSON_LOOT.map((item, index) => (
                  <li key={item.href}>
                    <a
                      href={item.href}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`Открыть кейс: ${item.title}`}
                      onClick={(event) => {
                        event.preventDefault();
                        openExternalUrl(item.href);
                      }}
                    >
                      <span className="lesson-loot__number" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                      <span>{item.title}</span>
                      <span className="lesson-loot__arrow" aria-hidden="true">↗</span>
                    </a>
                  </li>
                ))}
              </ol>
              <p className="lesson-loot__notice">Instagram принадлежит компании Meta, признанной экстремистской организацией и запрещённой на территории Российской Федерации.</p>
            </aside>
          ) : null}
        </div>
      </section>
    </main>
  );
}
