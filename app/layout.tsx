import type { Metadata } from "next";
import { ThemeProvider } from "@/components/ThemeProvider";
import { UserProvider } from "@/components/UserProvider";
import Header from "@/components/Header";
import "./globals.css";

export const metadata: Metadata = {
  title: "股票分析",
  description: "个人股票分析工具",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Blocking script to prevent theme flash - runs before React hydration
  const themeScript = `
    (function() {
      try {
        var theme = localStorage.getItem('theme') || 'system';
        var resolved = theme === 'system'
          ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
          : theme;
        document.documentElement.setAttribute('data-theme', resolved);
      } catch (e) {}
    })();
  `;

  return (
    <html lang="zh" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <ThemeProvider>
          <UserProvider>
            <div className="sticky top-0 z-50">
              <Header />
            </div>
            {children}
          </UserProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
