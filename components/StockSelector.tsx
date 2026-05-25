"use client";
import { useEffect, useState } from "react";

interface Stock {
  code: string;
  name: string;
  market: "sh" | "sz" | "bj";
}

interface StockConfig {
  stockCode: string;
  purpose: string;
}

interface Category {
  id: string;
  code: string;
  name: string;
  order: number;
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
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryStocks, setCategoryStocks] = useState<Record<string, string[]>>({});
  const [loadingCategories, setLoadingCategories] = useState(false);

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

  // 加载分类
  useEffect(() => {
    fetch("/api/config/categories")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setCategories(data);
        }
      })
      .catch(() => {});
  }, []);

  // 加载各分类的股票
  useEffect(() => {
    if (categories.length === 0) return;
    setLoadingCategories(true);
    Promise.all(
      categories.map(async (cat) => {
        const res = await fetch(`/api/config/stocks?purpose=${cat.code}`);
        const data = await res.json();
        return { key: cat.code, codes: Array.isArray(data) ? data.map((c: StockConfig) => c.stockCode) : [] };
      })
    ).then((results) => {
      const map: Record<string, string[]> = {};
      results.forEach((r) => { map[r.key] = r.codes; });
      setCategoryStocks(map);
      setLoadingCategories(false);
    }).catch(() => setLoadingCategories(false));
  }, [categories]);

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

  const addStocksByCategory = (codes: string[]) => {
    const newCodes = codes.filter((c) => !value.includes(c));
    if (newCodes.length > 0) {
      onChange([...value, ...newCodes]);
    }
  };

  const removeStock = (code: string) => {
    onChange(value.filter((c) => c !== code));
  };

  const isCategoryFullySelected = (codes: string[]) => {
    return codes.length > 0 && codes.every((c) => value.includes(c));
  };

  const isCategoryPartiallySelected = (codes: string[]) => {
    return codes.some((c) => value.includes(c)) && !codes.every((c) => value.includes(c));
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

      {/* 分类快捷选择 */}
      {!loadingCategories && categories.length > 0 && (
        <div className="mb-4 p-3 rounded-lg border border-[var(--border)] bg-[var(--background)]">
          <p className="text-xs text-[var(--text-muted)] mb-2">按分类添加</p>
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => {
              const codes = categoryStocks[cat.code] || [];
              const isFull = isCategoryFullySelected(codes);
              const isPartial = isCategoryPartiallySelected(codes);
              return (
                <button
                  key={cat.id}
                  onClick={() => addStocksByCategory(codes)}
                  disabled={codes.length === 0}
                  className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                    isFull
                      ? "bg-green-500/20 border-green-500/30 text-green-400"
                      : isPartial
                      ? "bg-yellow-500/20 border-yellow-500/30 text-yellow-400"
                      : "border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
                  } disabled:opacity-30`}
                >
                  {cat.name} ({codes.length})
                </button>
              );
            })}
          </div>
        </div>
      )}

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
