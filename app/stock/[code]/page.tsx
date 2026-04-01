"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import HQChart from "@/components/HQChart";
import IndicatorPanel from "@/components/IndicatorPanel";
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
    <div className="h-[calc(100vh-52px)] flex flex-col bg-[var(--background)] overflow-hidden animate-page-enter">

      {/* Stock info strip - sticky */}
      <div className="info-strip shrink-0 px-3 sm:px-5 py-3 relative sticky top-0 z-10 bg-[var(--background)]">
        {/* Left accent bar */}
        <div className="accent-bar absolute left-0 top-3 bottom-3" />

        <div className="flex flex-wrap items-center gap-3 sm:gap-5 pl-3">
          {/* Stock badge + name */}
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center text-white font-bold text-xs sm:text-sm shadow-sm"
              style={{ background: 'var(--accent)' }}
            >
              <span className="hidden xs:inline">{code.slice(0, 2)}</span>
              <span className="xs:hidden">{code.slice(0, 1)}</span>
            </div>
            <div>
              <div className="text-sm font-bold text-[var(--text-primary)] leading-tight">
                {stockInfo?.name || code}
              </div>
              <div className="text-xs text-[var(--text-muted)] font-mono hidden sm:block">{code}</div>
            </div>
          </div>

          <div className="w-px h-6 sm:h-8 bg-[var(--border)] hidden sm:block" />

          {/* Price + change */}
          <div className="flex items-baseline gap-2 sm:gap-3">
            <span className={`text-xl sm:text-2xl font-bold font-mono ${isUp ? 'text-[var(--up-color)]' : 'text-[var(--down-color)]'}`}>
              {lastData?.close.toFixed(2) || '--'}
            </span>
            <span className={`text-xs sm:text-sm font-semibold px-1.5 sm:px-2 py-0.5 rounded-lg font-mono ${isUp ? 'badge-up' : 'badge-down'}`}>
              {isUp ? '+' : ''}{priceChange.toFixed(2)} ({isUp ? '+' : ''}{pricePercent}%)
            </span>
          </div>

          <div className="w-px h-6 sm:h-8 bg-[var(--border)] hidden sm:block" />

          {/* Stats grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 sm:gap-x-6 gap-y-1 w-full sm:w-auto">
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
      <main className="flex-1 flex flex-col min-h-0 p-4 gap-3">
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
        <div className="shrink-0 glass-card rounded-xl px-4 py-3 max-h-[120px] overflow-y-auto">
          <IndicatorPanel config={indicators} onChange={setIndicators} />
        </div>
      </main>
    </div>
  );
}
