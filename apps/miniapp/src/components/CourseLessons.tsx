"use client";

import { useState } from "react";
import { CourseDto, LessonDto } from "@course/shared";
import { LessonPlayer } from "./LessonPlayer";

export function CourseLessons({ course, lessons }: { course: CourseDto; lessons: LessonDto[] }) {
  const [activeSlug, setActiveSlug] = useState(lessons[0]?.slug ?? "");
  const activeLesson = lessons.find((lesson) => lesson.slug === activeSlug) ?? lessons[0];

  return (
    <main className="app-shell stack">
      <section className="panel stack">
        <h1>{course.title}</h1>
        <p className="muted">{course.description}</p>
      </section>

      <section className="lesson-list">
        <nav className="lesson-nav" aria-label="Уроки">
          {lessons.map((lesson) => (
            <button
              className={`lesson-button${lesson.slug === activeLesson?.slug ? " active" : ""}`}
              key={lesson.slug}
              type="button"
              onClick={() => setActiveSlug(lesson.slug)}
            >
              <span aria-hidden="true">{lesson.sortOrder}. </span>
              <span>{lesson.title}</span>
            </button>
          ))}
        </nav>

        <div className="panel">
          {activeLesson ? <LessonPlayer lesson={activeLesson} /> : <p>Уроки пока не опубликованы.</p>}
        </div>
      </section>
    </main>
  );
}
