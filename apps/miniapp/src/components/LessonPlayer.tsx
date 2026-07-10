"use client";

import { useEffect, useRef } from "react";
import { LessonDto } from "@course/shared";
import { exitTelegramFullscreen, requestTelegramFullscreen } from "../lib/telegram";

const KINESCOPE_FULLSCREEN_EVENT = "KINESCOPE_PLAYER_FULLSCREEN_CHANGE";

function isFullscreenMessage(data: unknown): data is { type: string; value: boolean } {
  return (
    typeof data === "object" &&
    data !== null &&
    "type" in data &&
    data.type === KINESCOPE_FULLSCREEN_EVENT &&
    "value" in data &&
    typeof data.value === "boolean"
  );
}

export function LessonPlayer({ lesson }: { lesson: LessonDto }) {
  const playerRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const player = playerRef.current;
    if (!player) {
      return;
    }

    const playerOrigin = new URL(lesson.kinescopeEmbedUrl).origin;
    let isFullscreen = false;

    const setFullscreen = (nextFullscreen: boolean) => {
      isFullscreen = nextFullscreen;
      player.classList.toggle("player-fullscreen", nextFullscreen);
      document.documentElement.classList.toggle("player-fullscreen-open", nextFullscreen);

      if (nextFullscreen) {
        requestTelegramFullscreen();
      } else {
        exitTelegramFullscreen();
      }
    };

    const handlePlayerMessage = (event: MessageEvent<unknown>) => {
      if (
        event.origin !== playerOrigin ||
        event.source !== player.contentWindow ||
        !isFullscreenMessage(event.data)
      ) {
        return;
      }

      setFullscreen(event.data.value);
    };

    window.addEventListener("message", handlePlayerMessage);

    return () => {
      window.removeEventListener("message", handlePlayerMessage);
      player.classList.remove("player-fullscreen");
      document.documentElement.classList.remove("player-fullscreen-open");
      if (isFullscreen) {
        exitTelegramFullscreen();
      }
    };
  }, [lesson.kinescopeEmbedUrl]);

  return (
    <div className="player-wrap">
      <iframe
        ref={playerRef}
        className="player"
        title={lesson.title}
        src={lesson.kinescopeEmbedUrl}
        allow="autoplay; fullscreen; picture-in-picture; encrypted-media; gyroscope; accelerometer; clipboard-write; screen-wake-lock"
        allowFullScreen
        frameBorder="0"
      />
    </div>
  );
}
