import Script from "next/script";
import "./globals.css";

export const metadata = {
  title: "Course",
  description: "Telegram Mini App course"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>
        <Script src="https://telegram.org/js/telegram-web-app.js?62" strategy="beforeInteractive" />
        {children}
      </body>
    </html>
  );
}
