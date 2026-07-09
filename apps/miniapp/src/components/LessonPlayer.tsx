"use client";

import { useRef } from "react";
import { LessonDto } from "@course/shared";

export function LessonPlayer({ lesson }: { lesson: LessonDto }) {
  const frameRef = useRef<HTMLIFrameElement>(null);

  const openFullscreen = () => {
    void frameRef.current?.requestFullscreen();
  };

  return (
    <div className="player-wrap">
      <iframe
        ref={frameRef}
        className="player"
        title={lesson.title}
        src={lesson.kinescopeEmbedUrl}
        allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
        allowFullScreen
      />
      <button className="fullscreen-button" type="button" onClick={openFullscreen}>
        На весь экран
      </button>
    </div>
  );
}
