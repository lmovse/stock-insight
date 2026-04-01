"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import HQChart from "@/components/HQChart";
import IndicatorPanel from "@/components/IndicatorPanel";
import WatchlistPanel from "@/components/WatchlistPanel";
import PortfolioPanel from "@/components/PortfolioPanel";
import type { KLineData, IndicatorConfig, StockInfo } from "@/lib/types";

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
  const [stockInfo, setStockInfo] = useState<StockInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [indicators, setIndicators] = useState<IndicatorConfig>(defaultIndicators);
  const [sidebarTab, setSidebarTab] = useState<'watchlist' | 'portfolio'>('watchlist');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [period, setPeriod] = useState<"daily" | "weekly" | "monthly">("daily");

  useEffect(() => {
    if (!code) return;
    setLoading(true);

    Promise.all([
      fetch(`/api/stocks/${code}`).then((r) => r.ok ? r.json() : null),
      fetch(`/api/stocks/${code}/kline?period=${period}&count=300`).then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      }),
    ]).then(([info, kline]) => {
      if (info) setStockInfo(info);
      setKlineData(kline);
      setLoading(false);
    }).catch((e) => {
      console.error(`[StockPage] Failed to load ${code}:`, e);
      setLoading(false);
    });
  }, [code, period]);

  const lastData = klineData.length > 0 ? klineData[klineData.length - 1] : null;
  const prevData = klineData.length > 1 ? klineData[klineData.length - 2] : null;
  const priceChange = lastData && prevData ? lastData.close - prevData.close : 0;
  const pricePercent = lastData && prevData && prevData.close !== 0
    ? ((lastData.close - prevData.close) / prevData.close * 100).toFixed(2)
    : '0.00';
  const isUp = priceChange >= 0;

  return (
    <div className="h-screen flex flex-col bg-[var(--background)] overflow-hidden">

      {/* Stock info strip */}
      <div className="info-strip flex-shrink-0 px-5 py-3 relative">
        {/* Left accent bar */}
        <div className="accent-bar absolute left-0 top-3 bottom-3" />

        <div className="flex items-center gap-5 pl-3">
          {/* Stock badge + name */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-sm"
              style={{ background: 'var(--accent)' }}
            >
              {code.slice(0, 2)}
            </div>
            <div>
              <div className="text-sm font-bold text-[var(--text-primary)] leading-tight">
                {stockInfo?.name || code}
              </div>
              <div className="text-xs text-[var(--text-muted)] font-mono">{code}</div>
            </div>
          </div>

          <div className="w-px h-8 bg-[var(--border)]" />

          {/* Price + change */}
          <div className="flex items-baseline gap-3">
            <span className={`text-2xl font-bold font-mono ${isUp ? 'text-[var(--up-color)]' : 'text-[var(--down-color)]'}`}>
              {lastData?.close.toFixed(2) || '--'}
            </span>
            <span className={`text-sm font-semibold px-2 py-0.5 rounded-lg font-mono ${isUp ? 'badge-up' : 'badge-down'}`}>
              {isUp ? '+' : ''}{priceChange.toFixed(2)} ({isUp ? '+' : ''}{pricePercent}%)
            </span>
          </div>

          <div className="w-px h-8 bg-[var(--border)]" />

          {/* Stats grid */}
          <div className="grid grid-cols-4 gap-x-6 gap-y-1">
            {[
              { label: '开盘', value: lastData?.open.toFixed(2) },
              { label: '最高', value: lastData?.high.toFixed(2) },
              { label: '最低', value: lastData?.low.toFixed(2) },
              { label: '成交量', value: lastData?.volume ? (lastData.volume / 1000000).toFixed(2) + '万' : '--' },
            ].map(({ label, value }) => (
              <div key={label} className="flex flex-col">
                <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-medium">{label}</span>
                <span className="text-xs font-semibold font-mono text-[var(--text-secondary)]">{value || '--'}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main area */}
      <main className="flex-1 flex min-h-0 relative">
        {/* Left: Chart + Indicators */}
        <div className="flex-1 flex flex-col min-w-0 p-4 pr-0 gap-3">
          {/* Chart */}
          <div className="flex-1 rounded-2xl overflow-hidden flex flex-col"
            style={{ background: 'var(--surface-solid, var(--surface))', border: '1px solid var(--border-subtle)' }}
          >
            {/* Period selector */}
            <div className="flex items-center gap-2 px-4 py-2 border-b border-[var(--border-subtle)] shrink-0">
              {(["daily", "weekly", "monthly"] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`px-3 py-1 text-xs font-mono uppercase tracking-wide border transition-colors rounded-lg ${
                    period === p
                      ? "bg-[var(--accent)] text-white border-[var(--accent)]"
                      : "bg-transparent text-[var(--text-muted)] border-[var(--border)] hover:border-[var(--accent)]"
                  }`}
                >
                  {p === "daily" ? "日K" : p === "weekly" ? "周K" : "月K"}
                </button>
              ))}
            </div>
            {loading ? (
              <div className="h-full flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-9 h-9 rounded-full border-2 border-[var(--accent)] border-t-transparent animate-spin" />
                  <span className="text-sm text-[var(--text-muted)]">加载中 {code}...</span>
                </div>
              </div>
            ) : error ? (
              <div className="h-full flex items-center justify-center text-[var(--text-muted)]">
                错误: {error}
              </div>
            ) : (
              <div className="flex-1 min-h-0">
                <HQChart code={code} klineData={klineData} indicators={indicators} />
              </div>
            )}
          </div>

          {/* Indicator bar */}
          <div className="glass-card rounded-xl px-4 py-3">
            <IndicatorPanel config={indicators} onChange={setIndicators} />
          </div>
        </div>

        {/* Right: Sidebar */}
        <div
          className={`flex-shrink-0 flex flex-col gap-3 p-4 transition-all duration-300 ${
            sidebarOpen ? "w-80 opacity-100" : "w-0 opacity-0 pointer-events-none overflow-hidden"
          }`}
        >
          {/* Tab switcher */}
          <div className="glass-raised rounded-xl p-1 flex gap-1">
            {(['watchlist', 'portfolio'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setSidebarTab(tab)}
                className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
                  sidebarTab === tab ? 'pill-active' : 'pill-inactive'
                }`}
              >
                {tab === 'watchlist' ? '自选股' : '持仓'}
              </button>
            ))}
          </div>

          {/* Panel */}
          <div className="flex-1 glass-card overflow-hidden flex flex-col">
            <div className="flex-1 overflow-y-auto">
              {sidebarTab === 'watchlist' ? <WatchlistPanel compact /> : <PortfolioPanel compact />}
            </div>
          </div>
        </div>

        {/* Toggle */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className={`toggle-btn absolute top-1/2 -translate-y-1/2 w-6 h-12 rounded-xl flex items-center justify-center text-[var(--text-secondary)] transition-all ${
            sidebarOpen ? "right-[308px]" : "right-4"
          }`}
        >
          {sidebarOpen ? "›" : "‹"}
        </button>
      </main>
    </div>
  );
}
