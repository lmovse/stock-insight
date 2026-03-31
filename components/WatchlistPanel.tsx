"use client";

import { useEffect, useState } from "react";
import { useUser } from "./UserProvider";
import Link from "next/link";

interface WatchlistItem {
  id: string;
  stockCode: string;
  stockName?: string;
}

export default function WatchlistPanel() {
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
          <div key={i} className="px-3 py-2 border-b border-[var(--border)] animate-pulse">
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
          className="block px-3 py-2 text-xs text-[var(--accent)] hover:underline border-b border-[var(--border)]"
        >
          登录以管理自选股
        </Link>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto">
        <div className="px-3 py-2 text-xs text-[var(--text-muted)] italic">暂无自选股</div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {items.map((item) => (
        <div
          key={item.id}
          className="group relative px-3 py-2 hover:bg-[var(--surface-elevated)] transition-colors border-b border-[var(--border)]"
        >
          <Link href={`/stock/${item.stockCode}`} className="flex items-center justify-between">
            <span className="font-mono text-xs text-[var(--accent)]">{item.stockCode}</span>
            <span className="text-sm text-[var(--text-primary)] truncate ml-2">
              {item.stockName || "未知"}
            </span>
          </Link>
          <button
            onClick={(e) => handleDelete(item.id, e)}
            className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 text-[var(--text-muted)] hover:text-[var(--accent)] text-xs transition-opacity"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
