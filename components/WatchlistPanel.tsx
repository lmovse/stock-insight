"use client";

import { useEffect, useState } from "react";
import { useUser } from "./UserProvider";
import Link from "next/link";

interface WatchlistItem {
  id: string;
  stockCode: string;
  stockName?: string;
}

interface Props {
  compact?: boolean;
}

export default function WatchlistPanel({ compact = false }: Props) {
  const { user, loading: userLoading } = useUser();
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState(false);

  const loadWatchlist = () => {
    if (!user) return;
    setLoading(true);
    fetch("/api/watchlist")
      .then((r) => r.json())
      .then((data) => { setItems(data); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    loadWatchlist();
  }, [user]);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    await fetch(`/api/watchlist/${id}`, { method: "DELETE" });
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  if (userLoading || loading) {
    return (
      <div className="flex-1 overflow-y-auto">
        {[1, 2, 3].map((i) => (
          <div key={i} className={`${compact ? 'px-2 py-1.5' : 'px-3 py-2'} border-b border-[var(--border)] animate-pulse`}>
            <div className="h-4 bg-[var(--surface-elevated)] rounded w-16 mb-1" />
            <div className="h-3 bg-[var(--surface-elevated)] rounded w-24" />
          </div>
        ))}
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex-1 overflow-y-auto">
        <Link
          href="/login"
          className={`block ${compact ? 'px-2 py-1.5' : 'px-3 py-2'} text-xs text-[var(--accent)] hover:underline border-b border-[var(--border)]`}
        >
          登录以管理自选股
        </Link>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center py-8">
          <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-[var(--surface-elevated)] flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[var(--text-muted)]">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </div>
          <div className="text-xs text-[var(--text-muted)]">暂无自选股</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {items.map((item) => (
        <div
          key={item.id}
          className={`group relative ${compact ? 'px-2 py-1.5' : 'px-3 py-2'} hover:bg-[var(--surface-elevated)] transition-colors border-b border-[var(--border)]`}
        >
          <Link href={`/stock/${item.stockCode}`} className="flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className={`font-mono text-xs font-medium ${compact ? 'text-[var(--accent)]' : 'text-[var(--accent)]'}`}>
                  {item.stockCode}
                </span>
                <span className="text-xs text-[var(--text-muted)]">
                  {item.stockName || "未知"}
                </span>
              </div>
              {!compact && (
                <div className="text-xs text-[var(--text-muted)] mt-0.5">
                  涨跌幅 --%
                </div>
              )}
            </div>
          </Link>
          {!compact && (
            <button
              onClick={(e) => handleDelete(item.id, e)}
              className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 text-[var(--text-muted)] hover:text-[var(--accent)] text-xs transition-opacity"
            >
              ×
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
