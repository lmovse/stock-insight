"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import StockSearch from "./StockSearch";
import AuthButtons from "./AuthButtons";
import ThemeToggle from "./ThemeToggle";
import { useUser } from "./UserProvider";

const navLinks = [
  { href: "/stock/600519", label: "行情" },
  { href: "/strategies", label: "策略" },
  { href: "/prompts", label: "提示词" },
];

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useUser();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    if (!mobileMenuOpen) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMobileMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [mobileMenuOpen]);

  const isActive = (href: string) => {
    if (href === "/stock/600519") {
      return pathname.startsWith("/stock");
    }
    return pathname.startsWith(href);
  };

  return (
    <header className="header-bar relative h-[52px] px-2 sm:px-5 flex items-center gap-2 sm:gap-4">
      <Link href="/" className="flex items-center shrink-0 group">
        <span style={{ fontFamily: "'Archivo', sans-serif", fontWeight: 800, fontSize: '18px', letterSpacing: '0.5px' }}>
          <span style={{ color: 'var(--accent)' }}>STOCK</span>
          <span style={{ color: 'var(--text-primary)' }}> INSIGHT</span>
        </span>
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

      {/* Mobile dropdown menu - floating card */}
      {mobileMenuOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 md:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
          {/* Card */}
          <div ref={menuRef} className="absolute left-0 right-0 top-[52px] z-50 md:hidden animate-menu-enter">
            <div
              className="mx-2 rounded-xl shadow-lg border overflow-hidden"
              style={{ background: 'var(--surface-solid, var(--surface))', borderColor: 'var(--border)' }}
            >
              <div className="flex flex-col py-1">
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`px-4 py-2.5 text-sm transition-colors font-medium ${
                      isActive(link.href)
                        ? "text-[var(--accent)]"
                        : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)]"
                    }`}
                  >
                    {link.label}
                  </Link>
                ))}
                {user && (
                  <button
                    onClick={async () => {
                      setMobileMenuOpen(false);
                      await logout();
                      router.push("/login");
                    }}
                    className="px-4 py-2.5 text-sm text-left transition-colors text-[var(--text-secondary)] hover:text-[var(--down-color)] hover:bg-[var(--surface-hover)]"
                  >
                    退出登录
                  </button>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      <div className="flex items-center gap-1 sm:gap-2">
        <ThemeToggle />
        <AuthButtons />
      </div>
    </header>
  );
}
