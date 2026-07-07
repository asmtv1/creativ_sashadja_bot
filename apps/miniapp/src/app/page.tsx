"use client";

import { useEffect, useState } from "react";
import { CourseAccessResponse } from "@course/shared";
import { CourseLessons } from "../components/CourseLessons";
import { CourseLocked } from "../components/CourseLocked";
import { ErrorState } from "../components/ErrorState";
import { LoadingState } from "../components/LoadingState";
import { authenticateTelegram, getMyCourse } from "../lib/api-client";
import { closeTelegramWebApp, getTelegramInitData, prepareTelegramWebApp } from "../lib/telegram";

type ScreenState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "course"; data: CourseAccessResponse };

export default function HomePage() {
  const [state, setState] = useState<ScreenState>({ kind: "loading" });

  useEffect(() => {
    async function boot() {
      prepareTelegramWebApp();
      const initData = getTelegramInitData();
      if (!initData) {
        setState({ kind: "error", message: "Откройте курс из Telegram" });
        return;
      }
      await authenticateTelegram(initData);
      setState({ kind: "course", data: await getMyCourse() });
    }

    void boot().catch((error: unknown) => {
      setState({
        kind: "error",
        message: error instanceof Error ? error.message : "Не удалось открыть курс"
      });
    });
  }, []);

  if (state.kind === "loading") {
    return <LoadingState />;
  }
  if (state.kind === "error") {
    return <ErrorState message={state.message} />;
  }
  if (state.data.hasAccess && state.data.lessons) {
    return <CourseLessons course={state.data.course} lessons={state.data.lessons} />;
  }
  return <CourseLocked course={state.data.course} onBuy={closeTelegramWebApp} isBuying={false} />;
}
