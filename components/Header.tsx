"use client";

import Link from "next/link";
import StockSearch from "./StockSearch";
import AuthButtons from "./AuthButtons";

export default function Header() {
  return (
    <header className="h-14 border-b border-[var(--border)] flex items-center px-4 gap-4 bg-[var(--surface)]">
      <Link href="/" className="flex items-center gap-2 shrink-0">
        <div className="w-6 h-6 bg-[var(--accent)]" />
        <span className="font-display font-semibold text-[var(--text-primary)] tracking-wide">
          股票分析
        </span>
      </Link>
      <div className="flex-1 flex justify-center">
        <StockSearch />
      </div>
      <AuthButtons />
    </header>
  );
}