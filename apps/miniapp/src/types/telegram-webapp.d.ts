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
        openInvoice?(
          url: string,
          callback?: (status: "paid" | "cancelled" | "failed" | "pending") => void
        ): void;
        openLink(url: string): void;
        close(): void;
      };
    };
  }
}
