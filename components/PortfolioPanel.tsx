"use client";

import { useEffect, useState } from "react";
import { useUser } from "./UserProvider";
import Link from "next/link";

interface Position {
  id: string;
  stockCode: string;
  shares: number;
  avgCost: number;
}

export default function PortfolioPanel() {
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
      <div className="flex-1 p-3">
        <div className="text-xs text-[var(--text-muted)] animate-pulse">加载中...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex-1 p-3">
        <div className="text-xs text-[var(--text-muted)] mb-3">持仓记录</div>
        <Link href="/login" className="text-xs text-[var(--accent)] hover:underline">
          登录以查看持仓
        </Link>
      </div>
    );
  }

  if (positions.length === 0) {
    return (
      <div className="flex-1 p-3">
        <div className="text-xs text-[var(--text-muted)] mb-3">持仓记录</div>
        <div className="text-xs text-[var(--text-muted)] italic">暂无持仓</div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {positions.map((p) => (
        <Link
          key={p.id}
          href={`/stock/${p.stockCode}`}
          className="block px-3 py-2 hover:bg-[var(--surface-elevated)] transition-colors border-b border-[var(--border)]"
        >
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs text-[var(--accent)]">{p.stockCode}</span>
            <span className="text-sm text-[var(--text-primary)]">{p.shares}</span>
          </div>
          <div className="text-xs text-[var(--text-muted)] mt-1">
            成本价: ¥{p.avgCost.toFixed(2)}
          </div>
        </Link>
      ))}
    </div>
  );
}
