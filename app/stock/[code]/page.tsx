"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams } from "next/navigation";
import HQChart from "@/components/HQChart";
import IndicatorPanel from "@/components/IndicatorPanel";
import { calcMA } from "@/lib/indicators";
import type { KLineData, IndicatorConfig, StockInfo } from "@/lib/types";
import { useUser } from "@/components/UserProvider";

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
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const { user } = useUser();
  const [isWatched, setIsWatched] = useState(false);
  const [watchId, setWatchId] = useState<string | null>(null);
  const [watchLoading, setWatchLoading] = useState(false);

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

  // Check if stock is in watchlist
  useEffect(() => {
    if (!user || !code) return;
    fetch("/api/watchlist")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          const item = data.find((w: { stockCode: string }) => w.stockCode === code);
          if (item) {
            setIsWatched(true);
            setWatchId(item.id);
          }
        }
      })
      .catch(() => {});
  }, [user, code]);

  const toggleWatch = async () => {
    if (!user) {
      alert("请先登录");
      return;
    }
    setWatchLoading(true);
    try {
      if (isWatched && watchId) {
        await fetch(`/api/watchlist/${watchId}`, { method: "DELETE" });
        setIsWatched(false);
        setWatchId(null);
      } else {
        const res = await fetch("/api/watchlist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ stockCode: code }),
        });
        if (res.ok) {
          const data = await res.json();
          setIsWatched(true);
          setWatchId(data.id);
        }
      }
    } catch {
      // ignore
    } finally {
      setWatchLoading(false);
    }
  };

  const lastData = klineData.length > 0 ? klineData[klineData.length - 1] : null;
  const prevData = klineData.length > 1 ? klineData[klineData.length - 2] : null;
  const priceChange = lastData && prevData ? lastData.close - prevData.close : 0;
  const pricePercent = lastData && prevData && prevData.close !== 0
    ? ((lastData.close - prevData.close) / prevData.close * 100).toFixed(2)
    : '0.00';
  const isUp = priceChange >= 0;

  // Selected candle data for info panels
  const displayIndex = selectedIndex ?? (klineData.length - 1);
  const displayData = displayIndex >= 0 && displayIndex < klineData.length ? klineData[displayIndex] : null;
  const displayPrev = displayIndex > 0 ? klineData[displayIndex - 1] : null;
  const displayChange = displayData && displayPrev ? displayData.close - displayPrev.close : 0;
  const displayChangePct = displayPrev && displayPrev.close !== 0 ? (displayChange / displayPrev.close) * 100 : 0;
  const displayAmplitude = displayPrev && displayPrev.close !== 0 ? ((displayData!.high - displayData!.low) / displayPrev.close) * 100 : 0;
  const displayIsUp = displayChange >= 0;

  // MA values for display candle
  const maValues = useMemo(() => {
    if (!klineData.length || !displayData) return { MA5: null, MA10: null, MA20: null, MA60: null };
    const ma5 = calcMA(klineData, 5);
    const ma10 = calcMA(klineData, 10);
    const ma20 = calcMA(klineData, 20);
    const ma60 = calcMA(klineData, 60);
    return {
      MA5: ma5[displayIndex],
      MA10: ma10[displayIndex],
      MA20: ma20[displayIndex],
      MA60: ma60[displayIndex],
    };
  }, [klineData, displayIndex]);

  const formatAmount = (v: number) => {
    if (v >= 100000000) return (v / 100000000).toFixed(2) + "亿";
    if (v >= 10000) return (v / 10000).toFixed(2) + "万";
    return v.toFixed(2);
  };

  return (
    <div className="flex flex-col bg-[var(--background)] animate-page-enter" style={{ height: 'calc(100dvh - 52px)' }}>

      {/* Stock info strip - sticky */}
      <div className="info-strip shrink-0 px-3 sm:px-5 py-3 relative sticky top-0 z-10 bg-[var(--background)]">
        <div className="flex flex-wrap items-center gap-3 sm:gap-5">
          {/* Stock name */}
          <div className="flex items-center gap-2">
            <div>
              <div className="text-sm font-bold text-[var(--text-primary)] leading-tight">
                {stockInfo?.name || code}
              </div>
              <div className="text-xs text-[var(--text-muted)] font-mono hidden sm:block">{code}</div>
            </div>
            <button
              onClick={toggleWatch}
              disabled={watchLoading}
              className={`p-1.5 rounded-lg transition-colors ${
                isWatched
                  ? "text-[var(--accent)] hover:bg-[var(--surface-hover)]"
                  : "text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--surface-hover)]"
              }`}
              title={isWatched ? "取消收藏" : "添加收藏"}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill={isWatched ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
              </svg>
            </button>
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
      <main className="flex-1 flex flex-col min-h-0 p-4 gap-3 overflow-y-auto">
        {/* Chart */}
        <div className="flex-1 rounded-2xl overflow-hidden flex flex-col min-h-[200px]"
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

          {/* OHLCV info panel */}
          {displayData && (
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-x-2 sm:gap-x-4 px-2 sm:px-4 py-2 border-b border-[var(--border-subtle)] shrink-0">
              {[
                { label: '开盘', value: displayData.open.toFixed(2), color: '' },
                { label: '最高', value: displayData.high.toFixed(2), color: 'var(--up-color)' },
                { label: '收盘', value: displayData.close.toFixed(2), color: '' },
                { label: '最低', value: displayData.low.toFixed(2), color: 'var(--down-color)' },
                { label: '涨跌', value: `${displayIsUp ? '+' : ''}${displayChange.toFixed(2)}`, color: displayIsUp ? 'var(--up-color)' : 'var(--down-color)' },
                { label: '振幅', value: `${displayAmplitude.toFixed(2)}%`, color: '' },
                { label: '成交量', value: `${(displayData.volume / 10000).toFixed(2)}万`, color: '' },
                { label: '成交额', value: formatAmount(displayData.amount ?? 0), color: '' },
                { label: '日期', value: `${String(displayData.date).slice(0, 4)}/${String(displayData.date).slice(4, 6)}/${String(displayData.date).slice(6, 8)}`, color: '' },
              ].map(({ label, value, color }) => (
                <div key={label} className="flex items-center justify-between gap-2 min-w-0">
                  <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider shrink-0">{label}</span>
                  <span className="text-xs font-mono font-medium truncate" style={{ color: color || 'var(--text-primary)' }}>{value}</span>
                </div>
              ))}
            </div>
          )}

          {/* MA info panel */}
          {indicators.ma && (
            <div className="flex items-center gap-4 px-4 py-2 shrink-0 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider shrink-0">均线</span>
              {indicators.maPeriods.includes(5) && (
                <span className="text-xs font-mono shrink-0">
                  <span style={{ color: '#bbbbbb' }}>MA5</span>
                  <span className="ml-1" style={{ color: '#bbbbbb' }}>{maValues.MA5?.toFixed(2) ?? '-'}</span>
                </span>
              )}
              {indicators.maPeriods.includes(10) && (
                <span className="text-xs font-mono shrink-0">
                  <span style={{ color: '#d4a017' }}>MA10</span>
                  <span className="ml-1" style={{ color: '#d4a017' }}>{maValues.MA10?.toFixed(2) ?? '-'}</span>
                </span>
              )}
              {indicators.maPeriods.includes(20) && (
                <span className="text-xs font-mono shrink-0">
                  <span style={{ color: '#9333ea' }}>MA20</span>
                  <span className="ml-1" style={{ color: '#9333ea' }}>{maValues.MA20?.toFixed(2) ?? '-'}</span>
                </span>
              )}
              {indicators.maPeriods.includes(60) && (
                <span className="text-xs font-mono shrink-0">
                  <span style={{ color: '#c2410c' }}>MA60</span>
                  <span className="ml-1" style={{ color: '#c2410c' }}>{maValues.MA60?.toFixed(2) ?? '-'}</span>
                </span>
              )}
            </div>
          )}
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
              <HQChart code={code} klineData={klineData} indicators={indicators} onCrosshairMove={(info) => setSelectedIndex(info ? info.index : null)} />
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
