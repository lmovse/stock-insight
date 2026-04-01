"use client";

import { useEffect, useState } from "react";
import { useUser } from "./UserProvider";
import Link from "next/link";

interface Position {
  id: string;
  stockCode: string;
  stockName?: string;
  shares: number;
  avgCost: number;
  currentPrice?: number;
}

interface Props {
  compact?: boolean;
}

export default function PortfolioPanel({ compact = false }: Props) {
  const { user, loading: userLoading } = useUser();
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    fetch("/api/portfolio/positions")
      .then((r) => r.json())
      .then((data) => { setPositions(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [user]);

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
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center py-8">
          <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-[var(--surface-elevated)] flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[var(--text-muted)]">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <Link href="/login" className="text-xs text-[var(--accent)] hover:underline">
            登录以查看持仓
          </Link>
        </div>
      </div>
    );
  }

  if (positions.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center py-8">
          <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-[var(--surface-elevated)] flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[var(--text-muted)]">
              <path d="M21 12a9 9 0 1 1-9-9" />
              <path d="M21 3v9h-9" />
            </svg>
          </div>
          <div className="text-xs text-[var(--text-muted)]">暂无持仓</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {positions.map((p) => {
        const gainLoss = p.currentPrice && p.currentPrice > 0
          ? ((p.currentPrice - p.avgCost) / p.avgCost * 100).toFixed(2)
          : null;

        return (
          <Link
            key={p.id}
            href={`/stock/${p.stockCode}`}
            className={`block ${compact ? 'px-2 py-1.5' : 'px-3 py-2'} hover:bg-[var(--surface-elevated)] transition-colors border-b border-[var(--border)]`}
          >
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-[var(--accent)]">{p.stockCode}</span>
                  {p.stockName && (
                    <span className="text-xs text-[var(--text-muted)] truncate">{p.stockName}</span>
                  )}
                </div>
                <div className="text-xs text-[var(--text-muted)] mt-0.5">
                  {p.shares}股 · 成本 ¥{p.avgCost.toFixed(2)}
                </div>
              </div>
              {gainLoss && (
                <div className={`text-xs font-medium ${Number(gainLoss) >= 0 ? 'text-[var(--up-color)]' : 'text-[var(--down-color)]'}`}>
                  {Number(gainLoss) >= 0 ? '+' : ''}{gainLoss}%
                </div>
              )}
            </div>
          </Link>
        );
      })}
    </div>
  );
}
