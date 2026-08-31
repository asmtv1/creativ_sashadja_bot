"use client";

import { useCallback, useEffect, useState } from "react";
import { CourseAccessResponse } from "@course/shared";
import { CourseLessons } from "../components/CourseLessons";
import { CourseLocked } from "../components/CourseLocked";
import { ErrorState } from "../components/ErrorState";
import { LoadingState } from "../components/LoadingState";
import {
  authenticateTelegram,
  createCourseCheckout,
  getMyCourse,
  verifyCourseCheckout
} from "../lib/api-client";
import { getTelegramInitData, openExternalUrl, prepareTelegramWebApp } from "../lib/telegram";

type ScreenState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "course"; data: CourseAccessResponse };

type CheckoutState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ready"; orderId: string; paymentUrl: string }
  | { kind: "processing"; orderId: string; paymentUrl: string }
  | { kind: "checking"; orderId: string; paymentUrl: string; message: string }
  | { kind: "error"; message: string };

export default function HomePage() {
  const [state, setState] = useState<ScreenState>({ kind: "loading" });
  const [checkout, setCheckout] = useState<CheckoutState>({ kind: "idle" });

  const prepareCheckout = useCallback(async (courseSlug: string) => {
    setCheckout({ kind: "loading" });
    try {
      const checkout = await createCourseCheckout(courseSlug);
      if ("alreadyPaid" in checkout) {
        setState({ kind: "course", data: await getMyCourse() });
        setCheckout({ kind: "idle" });
        return;
      }
      setCheckout({
        kind: "ready",
        orderId: checkout.orderId,
        paymentUrl: checkout.paymentUrl
      });
    } catch (error) {
      setCheckout({
        kind: "error",
        message: error instanceof Error ? error.message : "Не удалось подготовить оплату"
      });
    }
  }, []);

  useEffect(() => {
    async function boot() {
      prepareTelegramWebApp();
      const initData = getTelegramInitData();
      if (!initData) {
        setState({ kind: "error", message: "Откройте курс из Telegram" });
        return;
      }
      await authenticateTelegram(initData);
      const course = await getMyCourse();
      setState({ kind: "course", data: course });
      if (!course.hasAccess) {
        void prepareCheckout(course.course.slug);
      }
    }

    void boot().catch((error: unknown) => {
      setState({
        kind: "error",
        message: error instanceof Error ? error.message : "Не удалось открыть курс"
      });
    });
  }, [prepareCheckout]);

  async function checkCourseAccess(orderId: string, paymentUrl: string) {
    setCheckout({ kind: "processing", orderId, paymentUrl });
    await verifyCourseCheckout(orderId);
    const updated = await pollCourseAccess();
    setState({ kind: "course", data: updated });
    if (updated.hasAccess) {
      setCheckout({ kind: "idle" });
      return;
    }
    setCheckout({
      kind: "checking",
      orderId,
      paymentUrl,
      message: "Платёж ещё обрабатывается. Подожди немного и проверь доступ ещё раз."
    });
  }

  async function handleBuy(courseSlug: string) {
    if (checkout.kind === "idle" || checkout.kind === "error") {
      await prepareCheckout(courseSlug);
      return;
    }
    if (checkout.kind === "checking") {
      await checkCourseAccess(checkout.orderId, checkout.paymentUrl);
      return;
    }
    if (checkout.kind !== "ready") {
      return;
    }

    try {
      openExternalUrl(checkout.paymentUrl);
      setCheckout({
        kind: "checking",
        orderId: checkout.orderId,
        paymentUrl: checkout.paymentUrl,
        message: "После оплаты вернитесь в бот и нажмите «Проверить доступ»."
      });
    } catch (error) {
      setCheckout({
        kind: "error",
        message: error instanceof Error ? error.message : "Не удалось открыть оплату"
      });
    }
  }

  if (state.kind === "loading") {
    return <LoadingState />;
  }
  if (state.kind === "error") {
    return <ErrorState message={state.message} />;
  }
  if (state.data.hasAccess && state.data.lessons) {
    return <CourseLessons course={state.data.course} lessons={state.data.lessons} />;
  }
  const isCheckoutBusy = checkout.kind === "loading" || checkout.kind === "processing";
  const actionLabel =
    checkout.kind === "loading"
      ? "ГОТОВИМ ОПЛАТУ…"
      : checkout.kind === "processing"
        ? "ПРОВЕРЯЕМ ДОСТУП…"
        : checkout.kind === "checking"
          ? "ПРОВЕРИТЬ ДОСТУП"
          : checkout.kind === "error"
            ? "ПОВТОРИТЬ"
            : undefined;
  const paymentMessage =
    checkout.kind === "error" || checkout.kind === "checking" ? checkout.message : undefined;

  return (
    <CourseLocked
      course={state.data.course}
      onBuy={() => void handleBuy(state.data.course.slug)}
      isBuying={isCheckoutBusy}
      actionLabel={actionLabel}
      paymentMessage={paymentMessage}
    />
  );
}

async function pollCourseAccess(attempts = 8): Promise<CourseAccessResponse> {
  let course = await getMyCourse();
  for (let attempt = 1; attempt < attempts && !course.hasAccess; attempt += 1) {
    await new Promise((resolve) => window.setTimeout(resolve, 750));
    course = await getMyCourse();
  }
  return course;
}
