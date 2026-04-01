"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import type { StockInfo } from "@/lib/types";

export default function StockSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<StockInfo[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!query.trim()) { setResults([]); setOpen(false); return; }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/stocks/search?q=${encodeURIComponent(query)}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setResults(data);
        setOpen(true);
      } catch (e) {
        console.error("[StockSearch] Failed to search:", e);
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const select = (code: string) => {
    router.push(`/stock/${code}`);
    setQuery("");
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => query && setOpen(true)}
          placeholder="搜索股票..."
          className="w-full px-3 py-1.5 pl-8 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] rounded-xl border border-[var(--border)] bg-[var(--surface)] backdrop-blur-sm focus:border-[var(--accent)] focus:outline-none transition-all font-medium"
        />
        <svg
          className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-muted)]"
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        {loading && (
          <div className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5">
            <div className="w-3.5 h-3.5 rounded-full border-2 border-[var(--text-muted)] border-t-transparent animate-spin" />
          </div>
        )}
      </div>
      {open && results.length > 0 && (
        <div className="absolute top-full mt-1.5 w-full glass-card rounded-xl z-50 overflow-hidden">
          {results.map((s) => (
            <button
              key={s.code}
              onClick={() => select(s.code)}
              className="w-full px-3 py-2.5 flex items-center gap-3 hover:bg-[var(--surface-hover)] text-left transition-colors border-b border-[var(--border-subtle)] last:border-b-0"
            >
              <span className="font-mono text-xs font-semibold text-[var(--accent)] w-16">{s.code}</span>
              <span className="text-sm font-medium text-[var(--text-primary)]">{s.name}</span>
              <span className="text-xs text-[var(--text-muted)] ml-auto px-1.5 py-0.5 rounded-md bg-[var(--surface-hover)]">{s.market.toUpperCase()}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
