"use client";

import Link from "next/link";
import StockSearch from "./StockSearch";
import AuthButtons from "./AuthButtons";
import ThemeToggle from "./ThemeToggle";

export default function Header() {
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

      <div className="flex items-center gap-4">
        <Link href="/strategies" className="text-sm text-gray-400 hover:text-white transition-colors">
          策略
        </Link>
        <Link href="/strategies/run" className="text-sm text-gray-400 hover:text-white transition-colors">
          运行
        </Link>
        <Link href="/strategies/runs" className="text-sm text-gray-400 hover:text-white transition-colors">
          历史
        </Link>
        <Link href="/prompts" className="text-sm text-gray-400 hover:text-white transition-colors">
          提示词
        </Link>
        <ThemeToggle />
        <AuthButtons />
      </div>
    </header>
  );
}
