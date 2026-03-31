"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Header from "@/components/Header";
import StockChart from "@/components/StockChart";
import IndicatorPanel from "@/components/IndicatorPanel";
import WatchlistPanel from "@/components/WatchlistPanel";
import PortfolioPanel from "@/components/PortfolioPanel";
import type { KLineData, IndicatorConfig } from "@/lib/types";

const defaultIndicators: IndicatorConfig = {
  ma: true,
  maPeriods: [5, 10, 20, 60],
  macd: true,
  kdj: false,
  boll: false,
  rsi: false,
  rsiPeriod: 14,
};

export default function StockPage() {
  const params = useParams();
  const code = params.code as string;
  const [klineData, setKlineData] = useState<KLineData[]>([]);
  const [loading, setLoading] = useState(true);
  const [indicators, setIndicators] = useState<IndicatorConfig>(defaultIndicators);
  const [watchlistOpen, setWatchlistOpen] = useState(true);
  const [portfolioOpen, setPortfolioOpen] = useState(true);

  useEffect(() => {
    if (!code) return;
    setLoading(true);
    fetch(`/api/stocks/${code}/kline?period=daily&count=300`)
      .then((r) => r.json())
      .then((data) => { setKlineData(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [code]);

  return (
    <div className="h-screen flex flex-col bg-[var(--background)]">
      <Header />
      <div className="flex-1 flex min-h-0">
        {/* Main chart area */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex-1 p-3 min-h-0">
            {loading ? (
              <div className="h-full flex items-center justify-center text-[var(--text-muted)] font-mono text-sm">
                Loading {code}...
              </div>
            ) : (
              <StockChart code={code} klineData={klineData} indicators={indicators} />
            )}
          </div>
          <IndicatorPanel config={indicators} onChange={setIndicators} />
        </div>

        {/* Right sidebar */}
        <div className="w-64 border-l border-[var(--border)] flex flex-col shrink-0">
          <button
            onClick={() => setWatchlistOpen(!watchlistOpen)}
            className="w-full px-3 py-2 flex items-center justify-between text-xs font-mono uppercase tracking-wide text-[var(--text-muted)] hover:text-[var(--text-primary)] border-b border-[var(--border)] transition-colors"
          >
            Watchlist
            <span>{watchlistOpen ? "−" : "+"}</span>
          </button>
          {watchlistOpen && <WatchlistPanel />}

          <button
            onClick={() => setPortfolioOpen(!portfolioOpen)}
            className="w-full px-3 py-2 flex items-center justify-between text-xs font-mono uppercase tracking-wide text-[var(--text-muted)] hover:text-[var(--text-primary)] border-t border-b border-[var(--border)] transition-colors"
          >
            Portfolio
            <span>{portfolioOpen ? "−" : "+"}</span>
          </button>
          {portfolioOpen && <PortfolioPanel />}
        </div>
      </div>
    </div>
  );
}
