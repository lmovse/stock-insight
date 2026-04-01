"use client";
import { useEffect, useState } from "react";

interface Stock {
  code: string;
  name: string;
  market: "sh" | "sz" | "bj";
}

export default function StockSelector({
  value,
  onChange,
}: {
  value: string[];
  onChange: (codes: string[]) => void;
}) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<Stock[]>([]);
  const [watchlist, setWatchlist] = useState<Stock[]>([]);

  useEffect(() => {
    fetch("/api/watchlist")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setWatchlist(data.map((item: { stockCode: string }) => ({
            code: item.stockCode,
            name: item.stockCode,
            market: "sz" as const,
          })));
        }
      })
      .catch(() => setWatchlist([]));
  }, []);

  const handleSearch = async () => {
    if (!search.trim()) return;
    const res = await fetch(`/api/stocks/search?q=${encodeURIComponent(search)}`);
    const data = await res.json();
    setResults(Array.isArray(data) ? data.slice(0, 10) : []);
  };

  const addStock = (stock: Stock) => {
    if (!value.includes(stock.code)) {
      onChange([...value, stock.code]);
    }
    setSearch("");
    setResults([]);
  };

  const removeStock = (code: string) => {
    onChange(value.filter((c) => c !== code));
  };

  return (
    <div>
      {/* 已选股票标签 */}
      <div className="flex flex-wrap gap-2 mb-3">
        {value.map((code) => (
          <span
            key={code}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-mono"
            style={{ background: "var(--accent)", color: "black" }}
          >
            {code}
            <button onClick={() => removeStock(code)} className="hover:opacity-70">×</button>
          </span>
        ))}
        {value.length === 0 && <span className="text-xs text-[var(--text-muted)]">未选择股票</span>}
      </div>

      {/* 搜索框 */}
      <div className="flex gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          placeholder="搜索股票代码或名称"
          className="flex-1 px-3 py-2 rounded-lg text-sm bg-[var(--background)] border border-[var(--border)] text-foreground"
        />
        <button
          onClick={handleSearch}
          className="px-4 py-2 rounded-lg text-sm border border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
        >
          搜索
        </button>
      </div>

      {/* 搜索结果 */}
      {results.length > 0 && (
        <div className="mt-2 rounded-lg border border-[var(--border)] overflow-hidden animate-tab">
          {results.map((s) => (
            <button
              key={s.code}
              onClick={() => addStock(s)}
              className="w-full text-left px-3 py-2 text-sm hover:bg-white/5 flex justify-between items-center"
            >
              <span>{s.name} ({s.code})</span>
              <span className="text-xs text-[var(--text-muted)]">{s.market.toUpperCase()}</span>
            </button>
          ))}
        </div>
      )}

      {/* 自选股快捷选择 */}
      {watchlist.length > 0 && (
        <div className="mt-3">
          <p className="text-xs text-[var(--text-muted)] mb-2">自选股</p>
          <div className="flex flex-wrap gap-1">
            {watchlist.map((s) => (
              <button
                key={s.code}
                onClick={() => addStock(s)}
                disabled={value.includes(s.code)}
                className="px-2 py-1 text-xs rounded border border-[var(--border)] hover:bg-white/5 disabled:opacity-30 transition-colors"
              >
                {s.code}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
