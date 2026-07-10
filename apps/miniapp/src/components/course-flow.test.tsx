import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CourseLessons } from "./CourseLessons";
import { CourseLocked } from "./CourseLocked";
import { ErrorState } from "./ErrorState";

afterEach(() => {
  cleanup();
  delete window.Telegram;
  document.documentElement.className = "";
});

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
    expect(screen.queryByRole("button", { name: /на весь экран/i })).toBeNull();
    const player = screen.getByTitle("Lesson 1");
    expect(player.getAttribute("src")).toBe("https://kinescope.io/embed/secret");
    expect(player.getAttribute("allow")).toBe(
      "autoplay; fullscreen; picture-in-picture; encrypted-media; gyroscope; accelerometer; clipboard-write; screen-wake-lock"
    );
    expect(player.hasAttribute("allowfullscreen")).toBe(true);
  });

  it("mirrors Kinescope fullscreen changes to the iframe and Telegram Mini App", () => {
    const requestFullscreen = vi.fn();
    const exitFullscreen = vi.fn();
    window.Telegram = {
      WebApp: {
        initData: "",
        ready: vi.fn(),
        expand: vi.fn(),
        openLink: vi.fn(),
        close: vi.fn(),
        requestFullscreen,
        exitFullscreen
      }
    };

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

    const player = screen.getByTitle<HTMLIFrameElement>("Lesson 1");
    window.dispatchEvent(
      new MessageEvent("message", {
        data: { type: "KINESCOPE_PLAYER_FULLSCREEN_CHANGE", value: true },
        origin: "https://kinescope.io",
        source: player.contentWindow
      })
    );

    expect(player.classList.contains("player-fullscreen")).toBe(true);
    expect(document.documentElement.classList.contains("player-fullscreen-open")).toBe(true);
    expect(requestFullscreen).toHaveBeenCalledOnce();

    window.dispatchEvent(
      new MessageEvent("message", {
        data: { type: "KINESCOPE_PLAYER_FULLSCREEN_CHANGE", value: false },
        origin: "https://kinescope.io",
        source: player.contentWindow
      })
    );

    expect(player.classList.contains("player-fullscreen")).toBe(false);
    expect(document.documentElement.classList.contains("player-fullscreen-open")).toBe(false);
    expect(exitFullscreen).toHaveBeenCalledOnce();
  });
});
