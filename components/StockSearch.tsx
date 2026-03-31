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
        const data = await res.json();
        setResults(data);
        setOpen(true);
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
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => query && setOpen(true)}
        placeholder="搜索股票代码或名称..."
        className="w-64 px-3 py-1.5 bg-[var(--surface)] border border-[var(--border)] text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] transition-colors font-mono"
      />
      {loading && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] text-xs">...</span>
      )}
      {open && results.length > 0 && (
        <div className="absolute top-full mt-1 w-full bg-[var(--surface-elevated)] border border-[var(--border)] z-50 max-h-64 overflow-y-auto">
          {results.map((s) => (
            <button
              key={s.code}
              onClick={() => select(s.code)}
              className="w-full px-3 py-2 flex items-center gap-3 hover:bg-[var(--surface)] text-left transition-colors"
            >
              <span className="font-mono text-xs text-[var(--accent)] w-16">{s.code}</span>
              <span className="text-sm text-[var(--text-primary)]">{s.name}</span>
              <span className="text-xs text-[var(--text-muted)] ml-auto">{s.market.toUpperCase()}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
