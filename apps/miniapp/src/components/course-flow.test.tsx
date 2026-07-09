import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CourseLessons } from "./CourseLessons";
import { CourseLocked } from "./CourseLocked";
import { ErrorState } from "./ErrorState";

describe("Mini App course flow components", () => {
  it("shows an error state when Telegram initData is unavailable", () => {
    render(<ErrorState message="Откройте курс из Telegram" />);

    expect(screen.getByText("Откройте курс из Telegram")).toBeTruthy();
  });

  it("shows the locked state and calls the bot return action for users without access", () => {
    const onBuy = vi.fn();
    render(
      <CourseLocked
        course={{ title: "Course", description: "Intro", priceKopecks: 10000 }}
        onBuy={onBuy}
        isBuying={false}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /вернуться в бот/i }));

    expect(onBuy).toHaveBeenCalledOnce();
  });

  it("renders lessons and passes API-provided embed URLs to the player", () => {
    render(
      <CourseLessons
        course={{ slug: "basic", title: "Course", description: "Intro", priceKopecks: 10000 }}
        lessons={[
          {
            slug: "lesson-1",
            sortOrder: 1,
            title: "Lesson 1",
            description: "Start",
            durationSeconds: 120,
            kinescopeEmbedUrl: "https://kinescope.io/embed/secret",
            posterUrl: null
          }
        ]}
      />
    );

    expect(screen.getByText("вот ваш урок. смотрите")).toBeTruthy();
    expect(screen.getByRole("button", { name: /на весь экран/i })).toBeTruthy();
    expect(screen.getByTitle("Lesson 1").getAttribute("src")).toBe(
      "https://kinescope.io/embed/secret"
    );
  });
});
