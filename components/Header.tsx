"use client";

import { useState } from "react";
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isActive = (href: string) => {
    if (href === "/stock/600519") {
      return pathname.startsWith("/stock");
    }
    return pathname.startsWith(href);
  };

  return (
    <header className="header-bar relative h-[52px] px-2 sm:px-5 flex items-center gap-2 sm:gap-4">
      <Link href="/" className="flex items-center shrink-0 group">
        <svg width="165" height="30" viewBox="0 0 165 30" fill="none">
          {/* Icon: candlestick bars, vertically centered around y=15 */}
          <rect x="0" y="5" width="3" height="20" rx="1" style={{ fill: 'var(--text-muted)' }}/>
          <rect x="0" y="12" width="3" height="6" rx="0.5" style={{ fill: 'var(--accent)' }}/>
          <rect x="5" y="3" width="3" height="24" rx="1" style={{ fill: 'var(--text-primary)' }}/>
          <rect x="5" y="10" width="3" height="10" rx="0.5" style={{ fill: 'var(--accent)' }}/>
          <rect x="10" y="7" width="3" height="16" rx="1" style={{ fill: 'var(--text-muted)' }}/>
          <rect x="10" y="13" width="3" height="4" rx="0.5" style={{ fill: 'var(--accent)' }}/>
          {/* STOCK */}
          <text x="20" y="22" fontFamily="'Plus Jakarta Sans', sans-serif" fontSize="15" fontWeight="800" letterSpacing="1" style={{ fill: 'var(--text-primary)' }}>STOCK</text>
          {/* INSIGHT */}
          <text x="87" y="22" fontFamily="'Plus Jakarta Sans', sans-serif" fontSize="15" fontWeight="300" letterSpacing="1" style={{ fill: 'var(--accent)' }}>INSIGHT</text>
        </svg>
      </Link>

      <div className="flex-1 min-w-0 mx-2">
        <StockSearch />
      </div>

      {/* Desktop nav */}
      <div className="hidden md:flex items-center gap-1">
        {navLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
              isActive(link.href)
                ? "bg-accent/20 text-accent font-medium"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)]"
            }`}
          >
            {link.label}
          </Link>
        ))}
      </div>

      {/* Mobile menu button */}
      <button
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        className="md:hidden p-2 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] transition-colors"
      >
        {mobileMenuOpen ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        )}
      </button>

      {/* Mobile dropdown menu */}
      {mobileMenuOpen && (
        <div className="absolute top-[52px] left-0 right-0 z-50 border-t border-[var(--border)] md:hidden"
          style={{ background: 'var(--surface)' }}>
          <div
            className="backdrop-blur-md"
            style={{ background: 'oklch(from var(--surface) l c h / 0.8)' }}
          >
            <div className="flex flex-col gap-1 p-3">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`px-4 py-2.5 text-sm rounded-lg transition-colors font-medium ${
                    isActive(link.href)
                      ? "text-[var(--accent)]"
                      : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center gap-1 sm:gap-2">
        <ThemeToggle />
        <AuthButtons />
      </div>
    </header>
  );
}
