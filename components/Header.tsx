"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import StockSearch from "./StockSearch";
import AuthButtons from "./AuthButtons";
import ThemeToggle from "./ThemeToggle";

const navLinks = [
  { href: "/stock/600519", label: "行情" },
  { href: "/strategies", label: "策略" },
  { href: "/strategies/run", label: "运行" },
  { href: "/strategies/runs", label: "历史" },
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
        <div className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{ background: 'var(--accent)' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
        </div>
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
