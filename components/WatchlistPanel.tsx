"use client";

import Link from "next/link";

const PLACEHOLDER_STOCKS = [
  { code: "600519", name: "贵州茅台" },
  { code: "000858", name: "五粮液" },
  { code: "601318", name: "中国平安" },
  { code: "000001", name: "平安银行" },
  { code: "600036", name: "招商银行" },
];

export default function WatchlistPanel() {
  return (
    <div className="flex-1 overflow-y-auto">
      {PLACEHOLDER_STOCKS.map((s) => (
        <Link
          key={s.code}
          href={`/stock/${s.code}`}
          className="block px-3 py-2 hover:bg-[var(--surface-elevated)] transition-colors border-b border-[var(--border)]"
        >
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs text-[var(--accent)]">{s.code}</span>
            <span className="text-sm text-[var(--text-primary)] truncate ml-2">{s.name}</span>
          </div>
        </Link>
      ))}
    </div>
  );
}
