"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import StockSearch from "./StockSearch";
import AuthButtons from "./AuthButtons";
import ThemeToggle from "./ThemeToggle";

const navLinks = [
  { href: "/stock/600519", label: "行情" },
  { href: "/strategies", label: "策略" },
  { href: "/prompts", label: "提示词" },
];

export default function Header() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/stock/600519") {
      return pathname.startsWith("/stock");
    }
    return pathname.startsWith(href);
  };

  return (
    <header className="header-bar h-[52px] px-5 flex items-center gap-4">
      <Link href="/" className="flex items-center gap-2 shrink-0 group">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="items-center">
          <defs>
            <linearGradient id="logoGrad" x1="4" y1="4" x2="20" y2="20" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="var(--text-primary)" />
              <stop offset="100%" stopColor="var(--text-muted)" />
            </linearGradient>
          </defs>
          <path d="M3 20V9l6-6 4 4 8-9v16" stroke="url(#logoGrad)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" filter="url(#logoShadow)"/>
          <path d="M3 20h18" stroke="url(#logoGrad)" strokeWidth="1.5" strokeLinecap="round"/>
          <defs>
            <filter id="logoShadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="1" stdDeviation="1" floodColor="var(--text-primary)" floodOpacity="0.4"/>
            </filter>
          </defs>
        </svg>
        <span className="text-sm font-bold text-[var(--text-primary)] tracking-tight group-hover:text-[var(--accent)] transition-colors">
          StockInsight
        </span>
      </Link>

      <div className="flex-1 max-w-xs mx-auto">
        <StockSearch />
      </div>

      <div className="flex items-center gap-1">
        {navLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
              isActive(link.href)
                ? "bg-accent/20 text-accent font-medium"
                : "text-gray-400 hover:text-white hover:bg-gray-800"
            }`}
          >
            {link.label}
          </Link>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <ThemeToggle />
        <AuthButtons />
      </div>
    </header>
  );
}
