"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useUser } from "@/components/UserProvider";

interface WatchlistItem {
  id: string;
  stockCode: string;
  stockName: string;
  latestCandle: {
    tradeDate: string;
    open: number;
    high: number;
    low: number;
    close: number;
    vol: number;
    prevClose: number;
  } | null;
}

export default function FavoritesPage() {
  const { user, loading: userLoading } = useUser();
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    fetch("/api/watchlist/with-stocks")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setItems(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [user]);

  const formatDate = (dateStr: string) => {
    const year = dateStr.slice(0, 4);
    const month = dateStr.slice(4, 6);
    const day = dateStr.slice(6, 8);
    return `${year}-${month}-${day}`;
  };

  const calculateChange = (item: WatchlistItem) => {
    if (!item.latestCandle) return { pct: "--", isUp: null, change: 0 };
    const { close, prevClose } = item.latestCandle;
    if (prevClose === 0) return { pct: "--", isUp: null, change: 0 };
    const change = close - prevClose;
    const pct = (change / prevClose) * 100;
    return {
      pct: (pct >= 0 ? "+" : "") + pct.toFixed(2) + "%",
      change: change,
      isUp: pct >= 0,
    };
  };

  if (userLoading || loading) {
    return (
      <div className="h-[calc(100dvh-52px)] flex flex-col bg-[var(--background)] overflow-hidden p-4">
        <div className="flex items-center justify-center h-32">
          <div className="w-6 h-6 rounded-full border-2 border-[var(--accent)] border-t-transparent animate-spin" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="h-[calc(100dvh-52px)] flex flex-col bg-[var(--background)] overflow-hidden p-4">
        <div className="flex items-center justify-center h-32">
          <div className="text-center">
            <p className="text-sm text-[var(--text-muted)] mb-2">请先登录</p>
            <Link href="/login" className="text-sm text-[var(--accent)] hover:underline">
              去登录
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100dvh-52px)] flex flex-col bg-[var(--background)] overflow-hidden p-4 animate-page-enter">
      <div className="mb-4 shrink-0">
        <h1 className="text-xl font-bold text-[var(--text-primary)]">我的收藏</h1>
        <p className="text-xs text-[var(--text-muted)] mt-1">自选股票实时行情</p>
      </div>

      {items.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-[var(--surface-elevated)] flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[var(--text-muted)]">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </div>
            <p className="text-sm text-[var(--text-muted)]">暂无自选股</p>
            <p className="text-xs text-[var(--text-muted)] mt-1">在行情页面添加自选股</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-2">
          {items.map((item) => {
            const { pct, isUp, change } = calculateChange(item);
            return (
              <Link
                key={item.id}
                href={`/stock/${item.stockCode}`}
                className="block glass-card rounded-xl px-4 py-3 hover:border-[var(--accent)] transition-all"
              >
                <div className="flex items-center gap-4">
                  {/* Left: Stock info */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-bold text-[var(--text-primary)]">
                        {item.stockCode}
                      </span>
                      <span className="text-sm text-[var(--text-secondary)] truncate">
                        {item.stockName}
                      </span>
                    </div>
                    <div className="text-xs text-[var(--text-muted)] mt-0.5">
                      {item.latestCandle ? formatDate(item.latestCandle.tradeDate) : "暂无数据"}
                    </div>
                  </div>

                  {/* Right: Price info */}
                  <div className="flex items-center gap-6 ml-auto">
                    {item.latestCandle ? (
                      <>
                        <div className="text-right">
                          <div className="text-xs text-[var(--text-muted)]">最新价</div>
                          <div className="font-mono text-sm font-semibold text-[var(--text-primary)]">
                            {item.latestCandle.close.toFixed(2)}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-[var(--text-muted)]">今涨跌幅</div>
                          <div className={`font-mono text-sm font-semibold ${
                            isUp === true ? "text-[var(--up-color)]" : isUp === false ? "text-[var(--down-color)]" : "text-[var(--text-muted)]"
                          }`}>
                            {pct}
                          </div>
                        </div>
                        <div className="text-right hidden sm:block">
                          <div className="text-xs text-[var(--text-muted)]">今涨跌</div>
                          <div className={`font-mono text-sm font-semibold ${
                            isUp === true ? "text-[var(--up-color)]" : isUp === false ? "text-[var(--down-color)]" : "text-[var(--text-muted)]"
                          }`}>
                            {change >= 0 ? "+" : ""}{change.toFixed(2)}
                          </div>
                        </div>
                        <div className="text-right hidden md:block">
                          <div className="text-xs text-[var(--text-muted)]">今开/最高/最低</div>
                          <div className="font-mono text-xs text-[var(--text-secondary)]">
                            {item.latestCandle.open.toFixed(2)} / {item.latestCandle.high.toFixed(2)} / {item.latestCandle.low.toFixed(2)}
                          </div>
                        </div>
                      </>
                    ) : (
                      <span className="text-xs text-[var(--text-muted)]">暂无行情数据</span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
