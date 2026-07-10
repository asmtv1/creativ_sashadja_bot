export {};

declare global {
  interface Window {
    Telegram?: {
      WebApp: {
        initData: string;
        ready(): void;
        expand(): void;
        requestFullscreen?(): void;
        exitFullscreen?(): void;
        openLink(url: string): void;
        close(): void;
      };
    };
  }
}
