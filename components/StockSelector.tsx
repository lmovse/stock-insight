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
      <label className="block text-sm mb-1">选择股票</label>
      <div className="flex flex-wrap gap-2 mb-2">
        {value.map((code) => (
          <span key={code} className="px-2 py-1 bg-gray-700 rounded text-sm flex items-center gap-1">
            {code}
            <button onClick={() => removeStock(code)} className="text-gray-400 hover:text-white">×</button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleSearch())}
          placeholder="搜索股票代码或名称"
          className="flex-1 p-2 border rounded bg-background text-foreground"
        />
        <button onClick={handleSearch} className="px-4 py-2 border rounded">搜索</button>
      </div>
      {results.length > 0 && (
        <div className="mt-2 border rounded bg-gray-800 max-h-40 overflow-y-auto">
          {results.map((s) => (
            <button
              key={s.code}
              onClick={() => addStock(s)}
              className="w-full text-left px-3 py-2 hover:bg-gray-700 flex justify-between"
            >
              <span>{s.name} ({s.code})</span>
              <span className="text-gray-400 text-sm">{s.market.toUpperCase()}</span>
            </button>
          ))}
        </div>
      )}
      {watchlist.length > 0 && (
        <div className="mt-3">
          <div className="text-sm text-gray-400 mb-1">自选股</div>
          <div className="flex flex-wrap gap-1">
            {watchlist.map((s) => (
              <button
                key={s.code}
                onClick={() => addStock(s)}
                disabled={value.includes(s.code)}
                className="px-2 py-1 text-xs border rounded hover:bg-gray-700 disabled:opacity-50"
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
